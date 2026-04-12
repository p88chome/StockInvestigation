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

// ─── Fetch price via Yahoo Finance (TWSE STOCK_DAY is unreliable) ────────────

interface YahooBar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number; // unix seconds
}

async function fetchYahooTW(ticker: string): Promise<YahooBar[] | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}.TW?interval=1d&range=5d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const timestamps: number[] = result.timestamp ?? [];
    const q = result.indicators?.quote?.[0];
    if (!q || timestamps.length === 0) return null;

    const bars: YahooBar[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (q.close?.[i] == null || isNaN(q.close[i])) continue;
      bars.push({
        open: q.open?.[i] ?? q.close[i],
        high: q.high?.[i] ?? q.close[i],
        low: q.low?.[i] ?? q.close[i],
        close: q.close[i],
        volume: q.volume?.[i] ?? 0,
        timestamp: timestamps[i],
      });
    }
    return bars.length > 0 ? bars : null;
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * 查詢單一台股即時報價
 * 股價來源：Yahoo Finance {ticker}.TW（穩定）
 * 基本面：TWSE BWIBBU_ALL（PE/PB/殖利率）
 * @param ticker 股票代碼，例如 "2330"
 */
export async function fetchTwseQuote(ticker: string): Promise<TwseStockQuote | null> {
  const [bars] = await Promise.all([
    fetchYahooTW(ticker),
    loadFundamentals(),
  ]);
  if (!bars || bars.length === 0) return null;

  const last = bars[bars.length - 1];
  // 前一交易日收盤（用 bars 倒數第二根，永遠正確）
  const prevClose = bars.length >= 2 ? bars[bars.length - 2].close : 0;

  const change = prevClose > 0
    ? Math.round((last.close - prevClose) * 100) / 100
    : 0;
  const changePercent = prevClose > 0
    ? Math.round((change / prevClose) * 10000) / 100
    : 0;

  // 日期：Unix timestamp → YYYY/MM/DD
  const date = last.timestamp
    ? new Date(last.timestamp * 1000).toLocaleDateString("zh-TW", {
        timeZone: "Asia/Taipei",
        year: "numeric", month: "2-digit", day: "2-digit",
      })
    : "";

  const fund = fundamentalsCache.get(ticker);

  return {
    ticker,
    name: fund?.name ?? ticker,
    date,
    open: last.open,
    high: last.high,
    low: last.low,
    close: last.close,
    change,
    changePercent,
    volume: last.volume,
    value: 0,        // Yahoo Finance v8 不提供成交金額，設 0
    transactions: 0,
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
