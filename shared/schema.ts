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

// Types for the API response
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
  lastAnalyzed: string;
}

// ─── Day Trading Types ───

export interface TechnicalIndicator {
  name: string;
  value: string;
  signal: "buy" | "sell" | "neutral";
  description: string;
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
  volumeRatio: number; // volume / avgVolume
  dayHigh: number;
  dayLow: number;
  open: number;
  previousClose: number;
  amplitude: number; // (high - low) / prev close %
  indicators: TechnicalIndicator[];
  overallSignal: "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell";
  signalScore: number; // -2 to +2
  dayTradeScore: number; // 0-100, suitability for day trading
  reasons: string[];
}

export interface DayTradeData {
  signals: DayTradeSignal[];
  market: MarketOverview;
  lastUpdated: string;
}
