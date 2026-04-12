/**
 * twseService.ts
 * 透過 TWSE OpenAPI (https://openapi.twse.com.tw/) 取得台股即時/歷史資料
 */

export interface TwseStockQuote {
  ticker: string;
  name: string;
  date: string;         // 最新交易日 YYYY/MM/DD
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  changePercent: number;
  volume: number;       // 股
  value: number;        // 成交金額（元）
  transactions: number;
  pe: number | null;
  pb: number | null;
  dividendYield: number | null;
}

export interface TwseInstitutional {
  date: string;
  foreignNet: number;
  trustNet: number;
  dealerNet: number;
  totalNet: number;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

interface FundamentalsEntry {
  name: string;
  pe: number | null;
  pb: number | null;
  dividendYield: number | null;
}

let fundamentalsCache = new Map<string, FundamentalsEntry>();
let fundamentalsFetchedAt = 0;
const FUNDAMENTALS_TTL = 30 * 60 * 1000;

let institutionalCache = new Map<string, TwseInstitutional>();
let institutionalFetchedAt = 0;
const INSTITUTIONAL_TTL = 60 * 60 * 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseNum(s: string | number | undefined): number {
  if (s === undefined || s === null) return 0;
  const cleaned = String(s).replace(/,/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/** 民國年 "113/04/12" → "2024/04/12" */
function rocToAd(rocDate: string): string {
  const parts = rocDate.split("/");
  if (parts.length !== 3) return rocDate;
  const year = parseInt(parts[0], 10) + 1911;
  return `${year}/${parts[1]}/${parts[2]}`;
}

// ─── Load Fundamentals (BWIBBU_ALL) ──────────────────────────────────────────

async function loadFundamentals(): Promise<void> {
  const now = Date.now();
  if (now - fundamentalsFetchedAt < FUNDAMENTALS_TTL && fundamentalsCache.size > 0) return;

  try {
    const res = await fetch("https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL", {
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) return;
    const data: any[] = await res.json();

    fundamentalsCache = new Map();
    for (const row of data) {
      const code: string = row.Code ?? "";
      if (!code) continue;
      fundamentalsCache.set(code, {
        name: row.Name ?? code,
        pe: parseNum(row.PEratio) || null,
        pb: parseNum(row.PBratio) || null,
        dividendYield: parseNum(row.DividendYield) || null,
      });
    }
    fundamentalsFetchedAt = now;
    console.log(`[TWSE] Loaded fundamentals for ${fundamentalsCache.size} stocks`);
  } catch (err) {
    console.error("[TWSE] Fundamentals load error:", err);
  }
}

// ─── Load Institutional (T86) ─────────────────────────────────────────────────

async function loadInstitutional(): Promise<void> {
  const now = Date.now();
  if (now - institutionalFetchedAt < INSTITUTIONAL_TTL && institutionalCache.size > 0) return;

  try {
    // TWSE returns most recent available trading day if today is a holiday/weekend
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}`;

    const res = await fetch(
      `https://openapi.twse.com.tw/v1/fund/T86?date=${dateStr}&selectType=ALL`,
      { headers: { "Accept": "application/json" } }
    );
    if (!res.ok) return;
    const data: any[] = await res.json();

    institutionalCache = new Map();
    for (const row of data) {
      // Field names differ between TWSE API versions — handle both
      const code: string = row.Code ?? row["證券代號"] ?? "";
      if (!code) continue;

      const foreignNet = parseNum(
        row.Foreign_Investor_Net_Buy_or_Sell ??
        row["外陸資買賣超股數(不含外資自營商)"] ??
        row["外資及陸資買賣超股數"]
      );
      const trustNet = parseNum(
        row.Investment_Trust_Net_Buy_or_Sell ??
        row["投信買賣超股數"]
      );
      const dealerNet = parseNum(
        row.Dealer_Net_Buy_or_Sell ??
        row["自營商買賣超股數(合計)"] ??
        row["自營商買賣超股數"]
      );

      institutionalCache.set(code, {
        date: rocToAd(row.Date ?? row["日期"] ?? ""),
        foreignNet,
        trustNet,
        dealerNet,
        totalNet: foreignNet + trustNet + dealerNet,
      });
    }
    institutionalFetchedAt = now;
    console.log(`[TWSE] Loaded institutional data for ${institutionalCache.size} stocks`);
  } catch (err) {
    console.error("[TWSE] Institutional load error:", err);
  }
}

// ─── Fetch Individual Stock Day Data ─────────────────────────────────────────

async function fetchStockDay(ticker: string): Promise<any[] | null> {
  try {
    const res = await fetch(
      `https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY?stockNo=${encodeURIComponent(ticker)}`,
      { headers: { "Accept": "application/json" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return data;
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * 查詢單一台股即時報價（最新交易日）
 * @param ticker 四位股票代碼，例如 "2330"
 */
export async function fetchTwseQuote(ticker: string): Promise<TwseStockQuote | null> {
  const [dayData] = await Promise.all([
    fetchStockDay(ticker),
    loadFundamentals(),
  ]);
  if (!dayData) return null;

  const last = dayData[dayData.length - 1];
  const prev = dayData.length >= 2 ? dayData[dayData.length - 2] : null;

  const close = parseNum(last.ClosingPrice);
  const prevClose = prev ? parseNum(prev.ClosingPrice) : 0;

  // TWSE Change field: "+5.00" / "-3.00" / "--" (停牌)
  const rawChange = String(last.Change ?? "").trim();
  const change = rawChange && rawChange !== "--"
    ? parseNum(rawChange)
    : prevClose > 0 ? Math.round((close - prevClose) * 100) / 100 : 0;

  const changePercent = prevClose > 0
    ? Math.round((change / prevClose) * 10000) / 100
    : 0;

  const fund = fundamentalsCache.get(ticker);

  return {
    ticker,
    name: fund?.name ?? ticker,
    date: rocToAd(last.Date ?? ""),
    open: parseNum(last.OpeningPrice),
    high: parseNum(last.HighestPrice),
    low: parseNum(last.LowestPrice),
    close,
    change,
    changePercent,
    volume: parseNum(last.TradeVolume),
    value: parseNum(last.TradeValue),
    transactions: parseNum(last.Transaction),
    pe: fund?.pe ?? null,
    pb: fund?.pb ?? null,
    dividendYield: fund?.dividendYield ?? null,
  };
}

/**
 * 取得指定股票的法人買賣超（當日最新）
 */
export async function fetchTwseInstitutional(ticker: string): Promise<TwseInstitutional | null> {
  await loadInstitutional();
  return institutionalCache.get(ticker) ?? null;
}

/**
 * 從 cache 取法人資料（不等待）— 給 stockService 快速使用
 */
export function getCachedInstitutional(ticker: string): TwseInstitutional | null {
  return institutionalCache.get(ticker) ?? null;
}

/**
 * 伺服器啟動時預先載入法人資料 & 基本面資料
 */
export async function preloadTwseData(): Promise<void> {
  await Promise.all([loadFundamentals(), loadInstitutional()]);
}
