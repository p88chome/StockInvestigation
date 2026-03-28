import { TRACKED_STOCKS } from "@shared/constants";
import type { LegalConference } from "@shared/schema";

export class EventService {
  private events: LegalConference[] = [];

  constructor() {
    this.generateMockEvents();
  }

  private generateMockEvents() {
    const now = new Date();
    // Simulate events for the next 14 days
    const mockEvents: LegalConference[] = [
      {
        ticker: "2330",
        stockName: "台積電 TSMC",
        date: this.getRelativeDate(2),
        description: "2026年第一季法人說明會 - 展望 2nm 進度與全球佈局",
        location: "線上視訊會議",
      },
      {
        ticker: "NVDA",
        stockName: "輝達 Nvidia",
        date: this.getRelativeDate(5),
        description: "GTC 2026 延續論壇：AI 伺服器需求展望",
        location: "聖荷西會議中心",
      },
      {
        ticker: "2454",
        stockName: "聯發科 MediaTek",
        date: this.getRelativeDate(3),
        description: "旗艦級晶片天璣系列新品發表與法說",
        location: "台北寒舍艾美酒店",
      },
      {
        ticker: "2317",
        stockName: "鴻海 Foxconn",
        date: this.getRelativeDate(7),
        description: "電動車事業進度說明會 (Model B 量產進度)",
        location: "土城總部",
      },
      {
        ticker: "BTC",
        stockName: "比特幣 Bitcoin",
        date: this.getRelativeDate(4),
        description: "SEC 關於比特幣現貨 ETF 衍生品審核期限",
        location: "華盛頓特區",
      }
    ];

    this.events = mockEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  private getRelativeDate(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  }

  getUpcomingEvents(): LegalConference[] {
    return this.events;
  }

  getEventForStock(ticker: string): LegalConference | undefined {
    return this.events.find(e => e.ticker === ticker);
  }
}

export const eventService = new EventService();
