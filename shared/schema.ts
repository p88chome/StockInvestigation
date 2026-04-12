import { z } from "zod";

export const insertStockNewsSchema = z.object({
  ticker: z.string(),
  stockName: z.string(),
  headline: z.string(),
  summary: z.string(),
  source: z.string(),
  sourceUrl: z.string().optional().nullable(),
  sentiment: z.string(), // "bullish" | "bearish" | "neutral"
  sentimentScore: z.number(),
  sentimentReason: z.string(),
  category: z.string(),
  publishedAt: z.string(),
  fetchedAt: z.string(),
});

export type InsertStockNews = z.infer<typeof insertStockNewsSchema>;
export type StockNews = InsertStockNews & { id: string | number };

export const insertXPostSchema = z.object({
  author: z.string(),
  authorHandle: z.string(),
  content: z.string(),
  postUrl: z.string().optional().nullable(),
  relatedTickers: z.string(), // JSON array string
  sentiment: z.string(),
  sentimentScore: z.number(),
  sentimentReason: z.string(),
  postedAt: z.string(),
  fetchedAt: z.string(),
});

export type InsertXPost = z.infer<typeof insertXPostSchema>;
export type XPost = InsertXPost & { id: string | number };

// Types for real-time stock quotes
export interface StockQuote {
  ticker: string;
  stockName: string;
  market: "tw" | "us" | "crypto";
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  volume: number;
  dayHigh: number;
  dayLow: number;
  open: number;
}

// ─── Market Events & Institutional Data ───

export interface LegalConference {
  ticker: string;
  stockName: string;
  date: string; // ISO or YYYY-MM-DD
  description: string;
  location?: string;
}

export interface InstitutionalTrading {
  foreignNet: number; // 外資超
  investmentNet: number; // 投信超
  dealerNet: number; // 自營商超
  totalNet: number;
  tradeDate: string;
}

export interface StockSentimentSummary {
  ticker: string;
  stockName: string;
  market: "tw" | "us" | "crypto";
  overallSentiment: "bullish" | "bearish" | "neutral";
  avgScore: number;
  newsCount: number;
  latestNews: StockNews[];
  signal: string;
  quote?: StockQuote;
  institutional?: InstitutionalTrading;
  upcomingEvent?: LegalConference;
}

export interface MarketOverview {
  taiexPoints: string;
  taiexChange: string;
  taiexChangePercent: string;
  lastUpdated: string;
  marketStatus: "open" | "closed";
}

export interface DashboardData {
  market: MarketOverview;
  stocks: StockSentimentSummary[];
  recentNews: StockNews[];
  xPosts: XPost[];
  upcomingEvents: LegalConference[];
  lastAnalyzed: string;
}

// ─── Day Trading Types ───

export interface TechnicalIndicator {
  name: string;
  value: string;
  signal: "buy" | "sell" | "neutral";
  description: string;
}

/** 完整技術指標數值（由歷史日線計算） */
export interface TechnicalData {
  // 均線
  ma5: number | null;
  ma20: number | null;
  ma60: number | null;
  maAlignment: "bullish" | "bearish" | "mixed"; // 多頭/空頭排列

  // KD (Stochastic 9,3,3)
  k: number | null;
  d: number | null;
  kdSignal: "golden_cross" | "death_cross" | "overbought" | "oversold" | "neutral";
  kdOblique: boolean; // KD 鈍化 (>80 or <20 持續)

  // RSI (14)
  rsi: number | null;
  rsiSignal: "overbought" | "oversold" | "neutral";
  rsiOblique: boolean; // RSI 鈍化

  // MACD (12, 26, 9)
  macdDif: number | null;  // DIF line
  macdDea: number | null;  // DEA/Signal line
  macdHistogram: number | null;
  macdSignal: "golden_cross" | "death_cross" | "bullish" | "bearish" | "neutral";

  // 量能
  avgVolume20: number;   // 20日平均量
  volumeRatio: number;   // 今日量 / 20日均量

  // 停損建議
  stopLoss: number | null;       // 建議停損價
  stopLossReason: string;
}

export interface DayTradeSignal {
  ticker: string;
  stockName: string;
  market: "tw" | "us" | "crypto";
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
  volumeRatio: number;
  dayHigh: number;
  dayLow: number;
  open: number;
  previousClose: number;
  amplitude: number;
  indicators: TechnicalIndicator[];
  technicalData: TechnicalData | null;  // 新增：完整技術數值
  overallSignal: "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell";
  signalScore: number;
  dayTradeScore: number;
  reasons: string[];
}

/** 大盤技術狀態 */
export interface MarketBreadth {
  taiexMa20: number | null;
  taiexMa60: number | null;
  taiexRsi: number | null;
  taiexMacdHistogram: number | null;
  taiexMaAlignment: "bullish" | "bearish" | "mixed";
  advanceCount: number;   // 上漲家數（追蹤股票中）
  declineCount: number;   // 下跌家數
  neutralCount: number;
  breadthSignal: "bullish" | "bearish" | "neutral";
}

export interface DayTradeData {
  signals: DayTradeSignal[];
  market: MarketOverview;
  breadth: MarketBreadth | null;
  lastUpdated: string;
}
// ─── TWSE OpenAPI Types ───

export interface TwseStockQuote {
  ticker: string;
  name: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  changePercent: number;
  volume: number;
  value: number;
  transactions: number;
  pe: number | null;
  pb: number | null;
  dividendYield: number | null;
}

// ─── Multi-User & Auth ───

export const insertUserSchema = z.object({
  username: z.string().min(3, "使用者名稱至少 3 個字元"),
  password: z.string().min(6, "密碼至少 6 個字元"),
  displayName: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = InsertUser & { id: string | number };

export const watchlistSchema = z.object({
  userId: z.string().or(z.number()),
  tickers: z.array(z.string()),
});

export type Watchlist = z.infer<typeof watchlistSchema>;

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}
