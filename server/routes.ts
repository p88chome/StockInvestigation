import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { aiService } from "./services/aiService";
import { stockService } from "./services/stockService";
import type {
  DashboardData,
  MarketOverview,
  DayTradeData,
} from "@shared/schema";

export async function registerRoutes(
  _httpServer: Server,
  app: Express
): Promise<Server> {
  // Get dashboard data
  app.get("/api/dashboard", async (_req, res) => {
    // Try to fetch real-time quotes (cached for 60s)
    await stockService.fetchRealTimeQuotes();

    const allNews = await storage.getAllNews();
    const allXPosts = await storage.getAllXPosts();
    const stocks = stockService.computeSentimentSummaries(allNews);
    const market = stockService.getDashboardMarket();

    const data: DashboardData = {
      market,
      stocks,
      recentNews: allNews.slice(0, 20),
      xPosts: allXPosts.slice(0, 15),
      lastAnalyzed: aiService.getStatus().lastAnalyzed,
    };

    res.json(data);
  });

  // Trigger analysis (news + X posts)
  app.post("/api/analyze", async (_req, res) => {
    const status = aiService.getStatus();
    if (status.isAnalyzing) {
      res.json({ status: "already_running" });
      return;
    }
    // Start both analyses in parallel
    aiService.fetchAndAnalyzeNews();
    aiService.fetchXPosts();
    res.json({ status: "started" });
  });

  // Get analysis status
  app.get("/api/status", async (_req, res) => {
    const status = aiService.getStatus();
    res.json({
      ...status,
      newsCount: (await storage.getAllNews()).length,
      xPostCount: (await storage.getAllXPosts()).length,
    });
  });

  // ─── Day Trading API ───
  app.get("/api/daytrade", async (_req, res) => {
    await stockService.fetchRealTimeQuotes();
    const signals = stockService.calculateDayTradeSignals();
    const market = stockService.getDashboardMarket();

    const data: DayTradeData = {
      signals,
      market,
      lastUpdated: new Date().toISOString(),
    };

    res.json(data);
  });

  // Auto-analyze on first request if no data
  const allNews = await storage.getAllNews();
  if (allNews.length === 0) {
    aiService.fetchAndAnalyzeNews();
    aiService.fetchXPosts();
  }

  // Try initial quote fetch
  stockService.fetchRealTimeQuotes();

  return _httpServer;
}
