import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { aiService } from "./services/aiService";
import { stockService } from "./services/stockService";
import { fetchTwseQuote, fetchTwseInstitutional, preloadTwseData } from "./services/twseService";
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

      const breadth = stockService.calculateMarketBreadth();

      const data: DayTradeData = {
        signals,
        market,
        breadth,
        lastUpdated: new Date().toISOString(),
      };

      res.json(data);
    } catch (error) {
      console.error("Daytrade API Error:", error);
      res.status(500).json({ message: "無法載入當沖數據" });
    }
  });

  // ─── TWSE Stock Lookup ───
  /**
   * GET /api/twse/:ticker
   * 以 TWSE OpenAPI 查詢任意台股即時報價 + 基本面 + 法人買賣超
   * e.g. GET /api/twse/2330
   */
  app.get("/api/twse/:ticker", async (req, res) => {
    const { ticker } = req.params;
    if (!/^\d{4,6}$/.test(ticker)) {
      return res.status(400).json({ message: "請輸入有效的台股代碼（4-6 位數字）" });
    }

    try {
      const [quote, institutional] = await Promise.all([
        fetchTwseQuote(ticker),
        fetchTwseInstitutional(ticker),
      ]);

      if (!quote) {
        return res.status(404).json({ message: `找不到股票代碼 ${ticker} 的資料，請確認代碼正確且該股票有在上市交易` });
      }

      res.json({ quote, institutional });
    } catch (err) {
      console.error(`[TWSE] Lookup error for ${ticker}:`, err);
      res.status(500).json({ message: "查詢失敗，請稍後再試" });
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

  // Preload TWSE fundamentals + institutional data (non-blocking)
  preloadTwseData().catch(err => console.error("TWSE Preload Error:", err));

  return _httpServer;
}
