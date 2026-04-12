import { TRACKED_STOCKS, TAIEX_TICKER, MarketType } from "@shared/constants";
import type {
  StockQuote, MarketOverview, DayTradeSignal, TechnicalIndicator,
  TechnicalData, MarketBreadth,
} from "@shared/schema";
import { getCachedInstitutional } from "./twseService";

// ─── OHLCV bar (one trading day) ──────────────────────────────────────────────
interface OHLCVBar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── Technical Indicator Math ─────────────────────────────────────────────────

function calcMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calcEMA(closes: number[], period: number): number[] {
  if (closes.length === 0) return [];
  const k = 2 / (period + 1);
  const emas: number[] = [closes[0]];
  for (let i = 1; i < closes.length; i++) {
    emas.push(closes[i] * k + emas[i - 1] * (1 - k));
  }
  return emas;
}

function calcRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  const diffs = closes.slice(1).map((c, i) => c - closes[i]);
  const gains = diffs.map((d) => (d > 0 ? d : 0));
  const losses = diffs.map((d) => (d < 0 ? -d : 0));

  // Wilder's smoothing
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 100) / 100;
}

function calcKD(
  highs: number[], lows: number[], closes: number[], period = 9
): { k: number; d: number } | null {
  if (closes.length < period) return null;

  const kArr: number[] = [];
  const dArr: number[] = [];
  let prevK = 50;
  let prevD = 50;

  for (let i = period - 1; i < closes.length; i++) {
    const highSlice = highs.slice(i - period + 1, i + 1);
    const lowSlice = lows.slice(i - period + 1, i + 1);
    const hh = Math.max(...highSlice);
    const ll = Math.min(...lowSlice);
    const rsv = hh !== ll ? ((closes[i] - ll) / (hh - ll)) * 100 : 50;
    const k = (2 / 3) * prevK + (1 / 3) * rsv;
    const d = (2 / 3) * prevD + (1 / 3) * k;
    kArr.push(k);
    dArr.push(d);
    prevK = k;
    prevD = d;
  }

  if (kArr.length === 0) return null;
  return {
    k: Math.round(kArr[kArr.length - 1] * 100) / 100,
    d: Math.round(dArr[dArr.length - 1] * 100) / 100,
  };
}

function calcMACD(
  closes: number[]
): { dif: number; dea: number; histogram: number } | null {
  if (closes.length < 35) return null;
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const difs = ema12.slice(25).map((e12, i) => e12 - ema26[i + 25]);
  if (difs.length < 9) return null;
  const deaArr = calcEMA(difs, 9);
  const dif = difs[difs.length - 1];
  const dea = deaArr[deaArr.length - 1];
  return {
    dif: Math.round(dif * 1000) / 1000,
    dea: Math.round(dea * 1000) / 1000,
    histogram: Math.round((dif - dea) * 1000) / 1000,
  };
}

/** 判斷 KD 是否鈍化（近 N 根持續超買/超賣）*/
function detectKDOblique(bars: OHLCVBar[], k: number, period = 3): boolean {
  if (bars.length < period) return false;
  // 鈍化：K > 80 且近幾根 close 都在 high 附近，或 K < 20 且 close 都在 low 附近
  if (k > 80) {
    return bars.slice(-period).every(
      (b) => b.close > (b.high + b.low) / 2
    );
  }
  if (k < 20) {
    return bars.slice(-period).every(
      (b) => b.close < (b.high + b.low) / 2
    );
  }
  return false;
}

// ─── Build TechnicalData from history bars ─────────────────────────────────

function buildTechnicalData(bars: OHLCVBar[], currentPrice: number): TechnicalData {
  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const volumes = bars.map((b) => b.volume);

  const ma5 = calcMA(closes, 5);
  const ma20 = calcMA(closes, 20);
  const ma60 = calcMA(closes, 60);

  // 均線排列
  let maAlignment: TechnicalData["maAlignment"] = "mixed";
  if (ma5 && ma20 && ma60) {
    if (ma5 > ma20 && ma20 > ma60) maAlignment = "bullish";
    else if (ma5 < ma20 && ma20 < ma60) maAlignment = "bearish";
  } else if (ma5 && ma20) {
    maAlignment = ma5 > ma20 ? "bullish" : "bearish";
  }

  // KD
  const kd = calcKD(highs, lows, closes);
  let kdSignal: TechnicalData["kdSignal"] = "neutral";
  let kdOblique = false;
  if (kd) {
    const { k, d } = kd;
    // 判斷金叉/死叉：需要比前一根的 K/D
    const kdPrev = bars.length >= 10
      ? calcKD(highs.slice(0, -1), lows.slice(0, -1), closes.slice(0, -1))
      : null;

    if (kdPrev) {
      const prevCrossState = kdPrev.k > kdPrev.d ? "above" : "below";
      const currCrossState = k > d ? "above" : "below";
      if (prevCrossState === "below" && currCrossState === "above") kdSignal = "golden_cross";
      else if (prevCrossState === "above" && currCrossState === "below") kdSignal = "death_cross";
      else if (k > 80) kdSignal = "overbought";
      else if (k < 20) kdSignal = "oversold";
    } else {
      if (k > 80) kdSignal = "overbought";
      else if (k < 20) kdSignal = "oversold";
    }
    kdOblique = detectKDOblique(bars, k);
  }

  // RSI
  const rsi = calcRSI(closes);
  let rsiSignal: TechnicalData["rsiSignal"] = "neutral";
  let rsiOblique = false;
  if (rsi !== null) {
    if (rsi > 70) {
      rsiSignal = "overbought";
      // RSI 鈍化：>80 且最近 3 根 close 還在漲
      if (rsi > 80 && closes.length >= 3) {
        rsiOblique = closes[closes.length - 1] > closes[closes.length - 3];
      }
    } else if (rsi < 30) {
      rsiSignal = "oversold";
      if (rsi < 20 && closes.length >= 3) {
        rsiOblique = closes[closes.length - 1] < closes[closes.length - 3];
      }
    }
  }

  // MACD
  const macd = calcMACD(closes);
  let macdSignal: TechnicalData["macdSignal"] = "neutral";
  if (macd) {
    const prevMACD = bars.length > 35
      ? calcMACD(closes.slice(0, -1))
      : null;

    if (prevMACD) {
      const prevAbove = prevMACD.dif > prevMACD.dea;
      const currAbove = macd.dif > macd.dea;
      if (!prevAbove && currAbove) macdSignal = "golden_cross";
      else if (prevAbove && !currAbove) macdSignal = "death_cross";
      else macdSignal = macd.dif > macd.dea ? "bullish" : "bearish";
    } else {
      macdSignal = macd.dif > macd.dea ? "bullish" : "bearish";
    }
  }

  // 20日均量 & 量比
  const avgVolume20 = volumes.length >= 20
    ? Math.round(volumes.slice(-20).reduce((a, b) => a + b, 0) / 20)
    : Math.round(volumes.reduce((a, b) => a + b, 0) / (volumes.length || 1));
  const todayVol = volumes[volumes.length - 1] || 0;
  const volumeRatio = avgVolume20 > 0
    ? Math.round((todayVol / avgVolume20) * 100) / 100
    : 1;

  // 停損建議
  let stopLoss: number | null = null;
  let stopLossReason = "";
  const recentLow = bars.length >= 1 ? bars[bars.length - 1].low : null;
  if (ma20 && recentLow) {
    // 優先以當日低點或 MA20 中較高者為停損
    stopLoss = Math.round(Math.max(ma20, recentLow) * 100) / 100;
    stopLossReason = `跌破 MA20 (${ma20.toFixed(2)}) 或今日低點 (${recentLow.toFixed(2)}) 即停損`;
  } else if (recentLow) {
    stopLoss = Math.round(recentLow * 100) / 100;
    stopLossReason = `跌破今日低點 (${recentLow.toFixed(2)}) 即停損`;
  }

  return {
    ma5: ma5 ? Math.round(ma5 * 100) / 100 : null,
    ma20: ma20 ? Math.round(ma20 * 100) / 100 : null,
    ma60: ma60 ? Math.round(ma60 * 100) / 100 : null,
    maAlignment,
    k: kd?.k ?? null,
    d: kd?.d ?? null,
    kdSignal,
    kdOblique,
    rsi,
    rsiSignal,
    rsiOblique,
    macdDif: macd?.dif ?? null,
    macdDea: macd?.dea ?? null,
    macdHistogram: macd?.histogram ?? null,
    macdSignal,
    avgVolume20,
    volumeRatio,
    stopLoss,
    stopLossReason,
  };
}

// ─── Combination Signal Logic ─────────────────────────────────────────────────

function computeSignalFromTechnical(
  td: TechnicalData,
  quote: StockQuote
): {
  overallSignal: DayTradeSignal["overallSignal"];
  signalScore: number;
  indicators: TechnicalIndicator[];
  reasons: string[];
  dayTradeScore: number;
} {
  const indicators: TechnicalIndicator[] = [];
  const reasons: string[] = [];
  let score = 0;

  // ── 1. 均線排列 ──
  if (td.maAlignment === "bullish") {
    indicators.push({ name: "均線排列", value: `多頭排列 (MA5>MA20>MA60)`, signal: "buy", description: "均線呈多頭排列，中長線趨勢向上" });
    score += 1.0;
    reasons.push("均線多頭排列，趨勢偏多");
  } else if (td.maAlignment === "bearish") {
    indicators.push({ name: "均線排列", value: `空頭排列 (MA5<MA20<MA60)`, signal: "sell", description: "均線呈空頭排列，中長線趨勢向下" });
    score -= 1.0;
    reasons.push("均線空頭排列，趨勢偏空");
  } else {
    indicators.push({ name: "均線排列", value: `混排 (趨勢不明)`, signal: "neutral", description: "均線交叉混排，方向不明確" });
  }

  // MA20 支撐/壓力
  if (td.ma20) {
    const distPct = ((quote.price - td.ma20) / td.ma20) * 100;
    if (distPct > 0 && distPct < 3) {
      indicators.push({ name: "MA20 位置", value: `+${distPct.toFixed(1)}% (站上月線)`, signal: "buy", description: "股價站上月線，短線有支撐" });
      score += 0.3;
    } else if (distPct < 0 && distPct > -3) {
      indicators.push({ name: "MA20 位置", value: `${distPct.toFixed(1)}% (貼近月線)`, signal: "sell", description: "股價跌破月線，注意支撐失守" });
      score -= 0.3;
    }
  }

  // ── 2. KD ──
  if (td.k !== null && td.d !== null) {
    const kdObliqueSuffix = td.kdOblique ? " ⚠️ 鈍化" : "";

    if (td.kdSignal === "golden_cross") {
      const isSafe = td.k < 50; // 黃金交叉在低檔才安全
      indicators.push({
        name: "KD",
        value: `K=${td.k.toFixed(1)} D=${td.d.toFixed(1)} 黃金交叉${kdObliqueSuffix}`,
        signal: "buy",
        description: isSafe ? "KD 低檔黃金交叉，多方翻身訊號較可靠" : "KD 高檔黃金交叉，動能強但追高需謹慎",
      });
      score += isSafe ? 0.8 : 0.3;
      reasons.push(`KD 黃金交叉 (K=${td.k.toFixed(1)})${isSafe ? "，低檔翻多" : "，高檔需注意"}`);
    } else if (td.kdSignal === "death_cross") {
      indicators.push({
        name: "KD",
        value: `K=${td.k.toFixed(1)} D=${td.d.toFixed(1)} 死亡交叉${kdObliqueSuffix}`,
        signal: "sell",
        description: "KD 死亡交叉，空方施壓，注意停損",
      });
      score -= 0.8;
      reasons.push(`KD 死亡交叉 (K=${td.k.toFixed(1)})，出場訊號`);
    } else if (td.kdSignal === "overbought") {
      indicators.push({
        name: "KD",
        value: `K=${td.k.toFixed(1)} D=${td.d.toFixed(1)} 超買${kdObliqueSuffix}`,
        signal: td.kdOblique ? "neutral" : "sell",
        description: td.kdOblique
          ? "KD > 80 鈍化，強勢股可持續，但風險升高"
          : "KD 超買區間，短線有拉回壓力",
      });
      score += td.kdOblique ? 0 : -0.4;
      if (td.kdOblique) reasons.push("KD 高檔鈍化，強勢整理中");
    } else if (td.kdSignal === "oversold") {
      indicators.push({
        name: "KD",
        value: `K=${td.k.toFixed(1)} D=${td.d.toFixed(1)} 超賣${kdObliqueSuffix}`,
        signal: td.kdOblique ? "neutral" : "buy",
        description: td.kdOblique
          ? "KD < 20 鈍化，弱勢股持續探底，不建議搶反彈"
          : "KD 超賣區間，有反彈機會",
      });
      score += td.kdOblique ? 0 : 0.3;
    } else {
      indicators.push({ name: "KD", value: `K=${td.k.toFixed(1)} D=${td.d.toFixed(1)}`, signal: "neutral", description: "KD 中性區間" });
    }
  }

  // ── 3. RSI ──
  if (td.rsi !== null) {
    const obliqueSuffix = td.rsiOblique ? " 鈍化" : "";
    if (td.rsiSignal === "overbought") {
      indicators.push({
        name: "RSI(14)",
        value: `${td.rsi.toFixed(1)}${obliqueSuffix}`,
        signal: td.rsiOblique ? "neutral" : "sell",
        description: td.rsiOblique ? "RSI 高檔鈍化，動能仍強，持股觀察" : "RSI 超買，短線漲多，注意獲利了結",
      });
      score += td.rsiOblique ? 0.2 : -0.3;
    } else if (td.rsiSignal === "oversold") {
      indicators.push({
        name: "RSI(14)",
        value: `${td.rsi.toFixed(1)}${obliqueSuffix}`,
        signal: td.rsiOblique ? "neutral" : "buy",
        description: td.rsiOblique ? "RSI 低檔鈍化，弱勢持續，等待轉折" : "RSI 超賣，有技術反彈機會",
      });
      score += td.rsiOblique ? 0 : 0.3;
    } else {
      const rsiLabel = td.rsi > 50 ? "偏強" : "偏弱";
      indicators.push({ name: "RSI(14)", value: `${td.rsi.toFixed(1)} (${rsiLabel})`, signal: td.rsi > 50 ? "buy" : "sell", description: `RSI ${td.rsi.toFixed(1)}，動能${rsiLabel}` });
      score += td.rsi > 50 ? 0.1 : -0.1;
    }
  }

  // ── 4. MACD ──
  if (td.macdDif !== null && td.macdHistogram !== null) {
    if (td.macdSignal === "golden_cross") {
      indicators.push({ name: "MACD", value: `黃金交叉 DIF=${td.macdDif.toFixed(3)}`, signal: "buy", description: "MACD DIF 上穿 DEA，中線做多訊號" });
      score += 0.6;
      reasons.push("MACD 黃金交叉，中線偏多");
    } else if (td.macdSignal === "death_cross") {
      indicators.push({ name: "MACD", value: `死亡交叉 DIF=${td.macdDif.toFixed(3)}`, signal: "sell", description: "MACD DIF 下穿 DEA，中線轉空" });
      score -= 0.6;
      reasons.push("MACD 死亡交叉，中線轉空");
    } else {
      const isBull = td.macdSignal === "bullish";
      const histDir = td.macdHistogram > 0 ? "紅柱擴張" : "綠柱收縮";
      indicators.push({
        name: "MACD",
        value: `${isBull ? "多方" : "空方"} Hist=${td.macdHistogram.toFixed(3)}`,
        signal: isBull ? "buy" : "sell",
        description: `MACD ${histDir}，${isBull ? "多方動能" : "空方持續"}`,
      });
      score += isBull ? 0.2 : -0.2;
    }
  }

  // ── 5. 量能 ──
  if (td.volumeRatio > 1.5) {
    indicators.push({ name: "量能", value: `${td.volumeRatio.toFixed(2)}x 均量 (爆量)`, signal: "neutral", description: "成交量明顯放大，注意方向確認" });
    score += quote.changePercent > 0 ? 0.4 : -0.4;
    reasons.push(`成交量 ${td.volumeRatio.toFixed(1)}x 均量，量價${quote.changePercent > 0 ? "配合上漲" : "背離下跌"}`);
  } else if (td.volumeRatio > 1.2) {
    indicators.push({ name: "量能", value: `${td.volumeRatio.toFixed(2)}x 均量 (溫和放量)`, signal: "buy", description: "量能溫和放大，有資金流入跡象" });
    score += 0.2;
  } else if (td.volumeRatio < 0.5) {
    indicators.push({ name: "量能", value: `${td.volumeRatio.toFixed(2)}x 均量 (極度萎縮)`, signal: "neutral", description: "成交量極度萎縮，市場觀望氣氛濃厚" });
  }

  // ── 6. 日內位置 (盤中當沖輔助) ──
  const dayRange = quote.dayHigh - quote.dayLow;
  const pricePos = dayRange > 0 ? (quote.price - quote.dayLow) / dayRange : 0.5;
  if (pricePos > 0.8) {
    indicators.push({ name: "日內位置", value: `${(pricePos * 100).toFixed(0)}% 靠高`, signal: "sell", description: "股價在今日區間高點，追高需謹慎" });
    score -= 0.2;
  } else if (pricePos < 0.2) {
    indicators.push({ name: "日內位置", value: `${(pricePos * 100).toFixed(0)}% 靠低`, signal: "buy", description: "股價在今日區間低點，有反彈空間" });
    score += 0.2;
  }

  // ── 組合確認邏輯（加分/扣分）──
  const isBullAlignment = td.maAlignment === "bullish";
  const isKDGolden = td.kdSignal === "golden_cross" && (td.k ?? 100) < 50;
  const isMACDBull = td.macdSignal === "golden_cross" || td.macdSignal === "bullish";
  const isVolumeOk = td.volumeRatio >= 1.2;

  if (isBullAlignment && isKDGolden && isMACDBull && isVolumeOk) {
    score += 0.5;
    reasons.push("多重訊號共振：均線多頭 + KD 低檔黃金交叉 + MACD 翻多 + 量能放大");
  }

  // ── 振幅（當沖適合度）──
  const amplitude = quote.previousClose > 0
    ? ((quote.dayHigh - quote.dayLow) / quote.previousClose) * 100
    : 0;

  // dayTradeScore：振幅 + 量能 + 漲跌幅絕對值
  let dayTradeScore = 40;
  dayTradeScore += Math.min(amplitude * 8, 25);
  dayTradeScore += Math.min((td.volumeRatio - 1) * 15, 20);
  dayTradeScore += Math.min(Math.abs(quote.changePercent) * 3, 15);
  dayTradeScore = Math.min(Math.max(Math.round(dayTradeScore), 0), 100);

  if (reasons.length === 0) reasons.push("各指標訊號混沌，建議觀望");

  let overallSignal: DayTradeSignal["overallSignal"];
  if (score >= 1.8) overallSignal = "strong_buy";
  else if (score >= 0.5) overallSignal = "buy";
  else if (score <= -1.8) overallSignal = "strong_sell";
  else if (score <= -0.5) overallSignal = "sell";
  else overallSignal = "neutral";

  return { overallSignal, signalScore: Math.round(score * 100) / 100, indicators, reasons, dayTradeScore };
}

// ─── StockService ─────────────────────────────────────────────────────────────

export class StockService {
  private cachedQuotes: Map<string, StockQuote> = new Map();
  private cachedHistory: Map<string, OHLCVBar[]> = new Map();
  private cachedMarket: MarketOverview | null = null;
  private taiexHistory: OHLCVBar[] = [];
  private lastQuoteFetch = 0;

  async fetchRealTimeQuotes(): Promise<void> {
    const now = Date.now();
    if (now - this.lastQuoteFetch < 60_000 && this.cachedQuotes.size > 0) return;

    try {
      const tasks = [
        this.fetchSingleQuote("", TAIEX_TICKER, "TAIEX", "tw"),
        ...TRACKED_STOCKS.map((s) =>
          this.fetchSingleQuote(s.ticker, s.apiTicker, s.name, s.market)
        ),
      ];
      await Promise.all(tasks);
      this.lastQuoteFetch = now;
      console.log(`[StockService] Fetched quotes + history for ${this.cachedQuotes.size} stocks`);
    } catch (err) {
      console.error("[StockService] Quote fetch error:", err);
    }
  }

  private async fetchSingleQuote(
    ticker: string, apiTicker: string, stockName: string, market: MarketType
  ): Promise<void> {
    try {
      // 改為 3mo 歷史資料，足夠計算 MA60 / KD / RSI / MACD
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(apiTicker)}?interval=1d&range=3mo`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      });
      if (!res.ok) return;
      const data = await res.json();
      const result = data?.chart?.result?.[0];
      const meta = result?.meta;
      if (!meta) return;

      const rawQ = result?.indicators?.quote?.[0];
      const opens: number[] = rawQ?.open ?? [];
      const highs: number[] = rawQ?.high ?? [];
      const lows: number[] = rawQ?.low ?? [];
      const closes: number[] = rawQ?.close ?? [];
      const volumes: number[] = rawQ?.volume ?? [];

      const n = Math.min(opens.length, highs.length, lows.length, closes.length, volumes.length);

      // Filter out null/NaN values
      const bars: OHLCVBar[] = [];
      for (let i = 0; i < n; i++) {
        if (closes[i] == null || isNaN(closes[i])) continue;
        bars.push({
          open: opens[i] || closes[i],
          high: highs[i] || closes[i],
          low: lows[i] || closes[i],
          close: closes[i],
          volume: volumes[i] || 0,
        });
      }

      const price = meta.regularMarketPrice || (bars[bars.length - 1]?.close ?? 0);
      // regularMarketPreviousClose = 昨日收盤（正確）
      // chartPreviousClose = 圖表起點的收盤（range=3mo 時是3個月前，不能用）
      const prev =
        meta.regularMarketPreviousClose ||
        meta.previousClose ||
        bars[bars.length - 2]?.close ||   // 倒數第二根日線 fallback
        0;
      const change = Math.round((price - prev) * 100) / 100;
      const changePct = prev ? Math.round((change / prev) * 10000) / 100 : 0;
      const lastBar = bars[bars.length - 1];

      if (apiTicker === TAIEX_TICKER) {
        this.taiexHistory = bars;
        this.cachedMarket = {
          taiexPoints: this.formatNumber(price),
          taiexChange: this.formatChange(change),
          taiexChangePercent: `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`,
          lastUpdated: new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }),
          marketStatus: meta.marketState === "REGULAR" ? "open" : "closed",
        };
      } else {
        this.cachedQuotes.set(ticker, {
          ticker,
          stockName,
          market,
          price,
          change,
          changePercent: changePct,
          previousClose: prev,
          volume: lastBar?.volume ?? 0,
          dayHigh: meta.regularMarketDayHigh || lastBar?.high || 0,
          dayLow: meta.regularMarketDayLow || lastBar?.low || 0,
          open: meta.regularMarketOpen || lastBar?.open || 0,
        });
        this.cachedHistory.set(ticker, bars);
      }
    } catch {
      // silently skip
    }
  }

  getDashboardMarket(): MarketOverview {
    return this.cachedMarket ?? {
      taiexPoints: "---",
      taiexChange: "---",
      taiexChangePercent: "---",
      lastUpdated: new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }),
      marketStatus: "closed",
    };
  }

  getQuote(ticker: string) {
    return this.cachedQuotes.get(ticker);
  }

  // ─── Day Trade Signals ──────────────────────────────────────────────────────

  calculateDayTradeSignals(): DayTradeSignal[] {
    const signals: DayTradeSignal[] = [];

    for (const stock of TRACKED_STOCKS) {
      const quote = this.cachedQuotes.get(stock.ticker);
      if (!quote || !quote.price) continue;

      const bars = this.cachedHistory.get(stock.ticker) ?? [];
      const td = bars.length >= 10 ? buildTechnicalData(bars, quote.price) : null;

      const amplitude = quote.previousClose
        ? Math.round(((quote.dayHigh - quote.dayLow) / quote.previousClose) * 10000) / 100
        : 0;

      let computed = {
        overallSignal: "neutral" as DayTradeSignal["overallSignal"],
        signalScore: 0,
        indicators: [] as TechnicalIndicator[],
        reasons: ["歷史資料不足，無法計算技術指標"] as string[],
        dayTradeScore: 40,
      };

      if (td) {
        computed = computeSignalFromTechnical(td, quote);
      } else {
        // Fallback: simple intraday logic
        const pos = (quote.dayHigh - quote.dayLow) > 0
          ? (quote.price - quote.dayLow) / (quote.dayHigh - quote.dayLow)
          : 0.5;
        computed.indicators.push({
          name: "日內位置",
          value: `${(pos * 100).toFixed(0)}%`,
          signal: pos > 0.7 ? "sell" : pos < 0.3 ? "buy" : "neutral",
          description: "當日價格位置",
        });
      }

      const avgVolume = td?.avgVolume20 || quote.volume || 1;
      const volumeRatio = td?.volumeRatio ?? 1;

      signals.push({
        ticker: stock.ticker,
        stockName: stock.name,
        market: stock.market,
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        volume: quote.volume,
        avgVolume,
        volumeRatio,
        dayHigh: quote.dayHigh,
        dayLow: quote.dayLow,
        open: quote.open,
        previousClose: quote.previousClose,
        amplitude,
        indicators: computed.indicators,
        technicalData: td,
        overallSignal: computed.overallSignal,
        signalScore: computed.signalScore,
        dayTradeScore: computed.dayTradeScore,
        reasons: computed.reasons,
      });
    }

    return signals.sort((a, b) => b.dayTradeScore - a.dayTradeScore);
  }

  // ─── Market Breadth ─────────────────────────────────────────────────────────

  calculateMarketBreadth(): MarketBreadth | null {
    if (this.cachedQuotes.size === 0) return null;

    let advanceCount = 0, declineCount = 0, neutralCount = 0;
    for (const q of Array.from(this.cachedQuotes.values())) {
      if (q.market !== "tw") continue; // 只看台股
      if (q.changePercent > 0.5) advanceCount++;
      else if (q.changePercent < -0.5) declineCount++;
      else neutralCount++;
    }

    const taiexTD = this.taiexHistory.length >= 10
      ? buildTechnicalData(this.taiexHistory, parseFloat(this.cachedMarket?.taiexPoints?.replace(/,/g, "") || "0"))
      : null;

    const breadthSignal: MarketBreadth["breadthSignal"] =
      advanceCount > declineCount * 2 ? "bullish"
        : declineCount > advanceCount * 2 ? "bearish"
          : "neutral";

    return {
      taiexMa20: taiexTD?.ma20 ?? null,
      taiexMa60: taiexTD?.ma60 ?? null,
      taiexRsi: taiexTD?.rsi ?? null,
      taiexMacdHistogram: taiexTD?.macdHistogram ?? null,
      taiexMaAlignment: taiexTD?.maAlignment ?? "mixed",
      advanceCount,
      declineCount,
      neutralCount,
      breadthSignal,
    };
  }

  // ─── Institutional Trading (uses TWSE real data) ────────────────────────────

  calculateInstitutionalTrading(ticker: string): any {
    const twse = getCachedInstitutional(ticker);
    if (twse) {
      return {
        foreignNet: twse.foreignNet,
        investmentNet: twse.trustNet,
        dealerNet: twse.dealerNet,
        totalNet: twse.totalNet,
        tradeDate: twse.date,
      };
    }
    return null;
  }

  // ─── Sentiment Summaries (for Dashboard) ────────────────────────────────────

  computeSentimentSummaries(allNews: any[]): any[] {
    const byTicker = new Map<string, any[]>();
    for (const news of allNews) {
      const existing = byTicker.get(news.ticker) || [];
      existing.push(news);
      byTicker.set(news.ticker, existing);
    }

    const summaries: any[] = [];
    for (const stock of TRACKED_STOCKS) {
      const news = byTicker.get(stock.ticker) || [];
      if (news.length === 0) continue;

      const avgScore = news.reduce((sum: number, n: any) => sum + n.sentimentScore, 0) / news.length;

      let overallSentiment: "bullish" | "bearish" | "neutral";
      let signal: string;
      if (avgScore > 0.2) {
        overallSentiment = "bullish";
        signal = avgScore > 0.5 ? "強力看漲" : "偏多";
      } else if (avgScore < -0.2) {
        overallSentiment = "bearish";
        signal = avgScore < -0.5 ? "強力看跌" : "偏空";
      } else {
        overallSentiment = "neutral";
        signal = "中性觀望";
      }

      const quote = this.cachedQuotes.get(stock.ticker);
      summaries.push({
        ticker: stock.ticker,
        stockName: stock.name,
        market: stock.market,
        overallSentiment,
        avgScore: Math.round(avgScore * 100) / 100,
        newsCount: news.length,
        latestNews: news.slice(0, 3),
        signal,
        quote,
        institutional: this.calculateInstitutionalTrading(stock.ticker),
      });
    }

    return summaries.sort((a, b) => Math.abs(b.avgScore) - Math.abs(a.avgScore));
  }

  private formatNumber(n: number): string {
    if (!n) return "---";
    return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }

  private formatChange(n: number): string {
    if (n === undefined || n === null) return "---";
    return `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
  }
}

export const stockService = new StockService();
