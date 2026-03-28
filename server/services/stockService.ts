import { TRACKED_STOCKS, TAIEX_TICKER, MarketType } from "@shared/constants";
import type { StockQuote, MarketOverview, DayTradeSignal, TechnicalIndicator } from "@shared/schema";

export class StockService {
  private cachedQuotes: Map<string, StockQuote> = new Map();
  private cachedMarket: MarketOverview | null = null;
  private lastQuoteFetch = 0;

  async fetchRealTimeQuotes(): Promise<void> {
    const now = Date.now();
    if (now - this.lastQuoteFetch < 60_000 && this.cachedQuotes.size > 0) return;

    try {
      const promises = [
        this.fetchSingleQuote("", TAIEX_TICKER, "TAIEX", "tw"),
        ...TRACKED_STOCKS.map((s) => this.fetchSingleQuote(s.ticker, s.apiTicker, s.name, s.market)),
      ];
      await Promise.all(promises);
      this.lastQuoteFetch = now;
      console.log(`Fetched real-time quotes for ${this.cachedQuotes.size} stocks + TAIEX`);
    } catch (err) {
      console.error("Quote fetch error:", err);
    }
  }

  private async fetchSingleQuote(ticker: string, apiTicker: string, stockName: string, market: MarketType): Promise<void> {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(apiTicker)}?interval=1d&range=1d`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      });
      if (!res.ok) return;
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta) return;

      const price = meta.regularMarketPrice || 0;
      const prev = meta.chartPreviousClose || meta.previousClose || 0;
      const change = Math.round((price - prev) * 100) / 100;
      const changePct = prev ? Math.round((change / prev) * 10000) / 100 : 0;

      if (apiTicker === TAIEX_TICKER) {
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
          volume: meta.regularMarketVolume || 0,
          dayHigh: meta.regularMarketDayHigh || 0,
          dayLow: meta.regularMarketDayLow || 0,
          open: data?.chart?.result?.[0]?.indicators?.quote?.[0]?.open?.[0] || 0,
        });
      }
    } catch (err) {
      // silently skip
    }
  }

  getDashboardMarket(): MarketOverview {
    return this.cachedMarket || {
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

  calculateDayTradeSignals(): DayTradeSignal[] {
    const signals: DayTradeSignal[] = [];

    for (const stock of TRACKED_STOCKS) {
      const quote = this.cachedQuotes.get(stock.ticker);
      if (!quote || !quote.price) continue;

      const amplitude = quote.previousClose
        ? Math.round(((quote.dayHigh - quote.dayLow) / quote.previousClose) * 10000) / 100
        : 0;

      const avgVolume = quote.volume || 1;
      const volumeRatio = Math.round((quote.volume / Math.max(avgVolume, 1)) * 100) / 100;

      const indicators: TechnicalIndicator[] = [];
      const reasons: string[] = [];
      let signalScore = 0;

      const dayRange = quote.dayHigh - quote.dayLow;
      const pricePosition = dayRange > 0 ? ((quote.price - quote.dayLow) / dayRange) : 0.5;

      if (pricePosition > 0.8) {
        indicators.push({ name: "日內位置", value: `${(pricePosition * 100).toFixed(0)}% (靠近高點)`, signal: "sell", description: "股價位於今日區間高點附近，短線可能有回落壓力" });
        signalScore -= 0.5;
        reasons.push("股價靠近日高點，追高風險較大");
      } else if (pricePosition < 0.2) {
        indicators.push({ name: "日內位置", value: `${(pricePosition * 100).toFixed(0)}% (靠近低點)`, signal: "buy", description: "股價位於今日區間低點附近，可能有反彈機會" });
        signalScore += 0.5;
        reasons.push("股價靠近日低點，反彈機率較高");
      } else {
        indicators.push({ name: "日內位置", value: `${(pricePosition * 100).toFixed(0)}% (中間)`, signal: "neutral", description: "股價位於今日區間中段" });
      }

      const gapPercent = quote.previousClose ? ((quote.open - quote.previousClose) / quote.previousClose) * 100 : 0;
      if (gapPercent > 1) {
        indicators.push({ name: "開盤跳空", value: `+${gapPercent.toFixed(2)}% 跳空開高`, signal: "buy", description: "開盤跳空開高，多方強勢" });
        signalScore += 0.3;
        reasons.push(`開盤跳空 +${gapPercent.toFixed(2)}%，多方氣勢強`);
      } else if (gapPercent < -1) {
        indicators.push({ name: "開盤跳空", value: `${gapPercent.toFixed(2)}% 跳空開低`, signal: "sell", description: "開盤跳空開低，空方施壓" });
        signalScore -= 0.3;
        reasons.push(`開盤跳空 ${gapPercent.toFixed(2)}%，空方施壓`);
      }

      const intradayChange = quote.open ? ((quote.price - quote.open) / quote.open) * 100 : 0;
      if (intradayChange > 0.5) {
        indicators.push({ name: "盤中趨勢", value: `開盤後漲 ${intradayChange.toFixed(2)}%`, signal: "buy", description: "盤中走高，短線多方佔優" });
        signalScore += 0.4;
      } else if (intradayChange < -0.5) {
        indicators.push({ name: "盤中趨勢", value: `開盤後跌 ${intradayChange.toFixed(2)}%`, signal: "sell", description: "盤中走低，短線空方佔優" });
        signalScore -= 0.4;
      }

      if (amplitude > 3) {
        indicators.push({ name: "振幅", value: `${amplitude.toFixed(2)}% (高波動)`, signal: "neutral", description: "今日振幅大，當沖機會多但風險也高" });
        reasons.push(`振幅 ${amplitude.toFixed(2)}%，波動性高適合當沖`);
      }

      if (quote.changePercent > 2) {
        indicators.push({ name: "漲跌幅", value: `+${quote.changePercent.toFixed(2)}%`, signal: "buy", description: "大漲中，多方強勢" });
        signalScore += 0.5;
      } else if (quote.changePercent < -2) {
        indicators.push({ name: "漲跌幅", value: `${quote.changePercent.toFixed(2)}%`, signal: "sell", description: "大跌中，空方強勢" });
        signalScore -= 0.5;
      }

      let overallSignal: DayTradeSignal["overallSignal"];
      if (signalScore >= 1) overallSignal = "strong_buy";
      else if (signalScore >= 0.3) overallSignal = "buy";
      else if (signalScore <= -1) overallSignal = "strong_sell";
      else if (signalScore <= -0.3) overallSignal = "sell";
      else overallSignal = "neutral";

      let dayTradeScore = 50;
      dayTradeScore += Math.min(amplitude * 10, 25);
      dayTradeScore += Math.min(quote.volume / 10_000_000, 15);
      dayTradeScore += Math.abs(quote.changePercent) * 3;
      dayTradeScore = Math.min(Math.max(Math.round(dayTradeScore), 0), 100);

      if (reasons.length === 0) reasons.push("盤中走勢平穩，暫無明顯訊號");

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
        indicators,
        overallSignal,
        signalScore: Math.round(signalScore * 100) / 100,
        dayTradeScore,
        reasons,
      });
    }

    return signals.sort((a, b) => b.dayTradeScore - a.dayTradeScore);
  }

  calculateInstitutionalTrading(ticker: string): any {
    // Deterministic mock data based on ticker and current date
    const seed = ticker.split("").reduce((a, b) => a + b.charCodeAt(0), 0);
    const day = new Date().getDate();
    
    const foreignNet = Math.round((Math.sin(seed + day) * 5000));
    const investmentNet = Math.round((Math.cos(seed * day) * 2000));
    const dealerNet = Math.round((Math.tan(seed + day/2) * 1000));
    
    return {
      foreignNet,
      investmentNet,
      dealerNet,
      totalNet: foreignNet + investmentNet + dealerNet,
      tradeDate: new Date().toISOString().split("T")[0],
    };
  }

  computeSentimentSummaries(
    allNews: any[]
  ): any[] {
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

      const avgScore =
        news.reduce((sum, n) => sum + n.sentimentScore, 0) / news.length;

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
