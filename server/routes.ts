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

import { eventService } from "./services/eventService";

export async function registerRoutes(
  _httpServer: Server,
  app: Express
): Promise<Server> {
  // Get dashboard data
  app.get("/api/dashboard", async (_req, res) => {
    try {
      // Try to fetch real-time quotes (cached for 60s)
      await stockService.fetchRealTimeQuotes().catch(e => console.error("Initial quote fetch error", e));

      const allNews = await storage.getAllNews().catch(err => {
        console.error("Storage getAllNews error:", err);
        return [];
      });
      const allXPosts = await storage.getAllXPosts().catch(err => {
        console.error("Storage getAllXPosts error:", err);
        return [];
      });

      const stocks = stockService.computeSentimentSummaries(allNews);
      const market = stockService.getDashboardMarket();
      const upcomingEvents = eventService.getUpcomingEvents();

      const data: DashboardData = {
        market,
        stocks,
        recentNews: allNews.slice(0, 20),
        xPosts: allXPosts.slice(0, 15),
        upcomingEvents,
        lastAnalyzed: aiService.getStatus().lastAnalyzed,
      };

      res.json(data);
    } catch (error) {
      console.error("Dashboard API Error:", error);
      res.status(500).json({ 
        message: "Failed to load dashboard data",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Trigger analysis (news + X posts)
  app.post("/api/analyze", async (_req, res) => {
    try {
      const status = aiService.getStatus();
      if (status.isAnalyzing) {
        return res.status(400).json({ status: "already_running", message: "分析任務正在進行中" });
      }

      // Start both analyses in parallel
      aiService.fetchAndAnalyzeNews().catch(err => console.error("Async News Analysis Error:", err));
      aiService.fetchXPosts().catch(err => console.error("Async X Fetch Error:", err));
      
      res.json({ status: "started", message: "分析任務已啟動" });
    } catch (error) {
      console.error("Analyze API Error:", error);
      res.status(500).json({ 
        message: "無法啟動分析任務",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get analysis status
  app.get("/api/status", async (_req, res) => {
    try {
      const status = aiService.getStatus();
      const newsCount = (await storage.getAllNews().catch(() => [])).length;
      const xPostCount = (await storage.getAllXPosts().catch(() => [])).length;
      
      res.json({
        ...status,
        newsCount,
        xPostCount,
      });
    } catch (error) {
      res.status(500).json({ message: "無法獲取分析狀態" });
    }
  });

  // ─── Day Trading API ───
  app.get("/api/daytrade", async (_req, res) => {
    try {
      await stockService.fetchRealTimeQuotes().catch(e => console.error("DayTrade quote fetch error", e));
      const signals = stockService.calculateDayTradeSignals();
      const market = stockService.getDashboardMarket();

      const data: DayTradeData = {
        signals,
        market,
        lastUpdated: new Date().toISOString(),
      };

      res.json(data);
    } catch (error) {
      console.error("Daytrade API Error:", error);
      res.status(500).json({ message: "無法載入當沖數據" });
    }
  });

  // Auto-analyze on first request if no data (wrapped in try-catch to prevent startup crash)
  try {
    const allNews = await storage.getAllNews();
    if (allNews.length === 0) {
      aiService.fetchAndAnalyzeNews().catch(err => console.error("Initial Analysis Error:", err));
      aiService.fetchXPosts().catch(err => console.error("Initial X Fetch Error:", err));
    }
  } catch (err) {
    console.error("Failed to perform initial news check in registerRoutes", err);
  }

  // Try initial quote fetch (non-blocking)
  stockService.fetchRealTimeQuotes().catch(err => console.error("Initial Quote Fetch Error in registerRoutes", err));

  return _httpServer;
}
