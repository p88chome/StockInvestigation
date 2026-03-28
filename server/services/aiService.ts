import { TRACKED_STOCKS } from "@shared/constants";
import type { InsertStockNews, InsertXPost } from "@shared/schema";
import { storage } from "../storage";

interface AzureConfig {
  apiKey: string;
  endpoint: string;
  deployment: string;
  apiVersion: string;
}

// Helper: get Azure OpenAI config from env or Firebase Functions runtime config
function getAzureConfig(): AzureConfig | null {
  const env = process.env;
  
  // Try ENV first
  if (env.AZURE_OPENAI_API_KEY && env.AZURE_OPENAI_ENDPOINT && env.AZURE_OPENAI_DEPLOYMENT) {
    return {
      apiKey: env.AZURE_OPENAI_API_KEY,
      endpoint: env.AZURE_OPENAI_ENDPOINT,
      deployment: env.AZURE_OPENAI_DEPLOYMENT,
      apiVersion: env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview",
    };
  }

  // Try Firebase Functions config
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const firebaseConfig = require("firebase-functions").config();
    if (firebaseConfig?.azure?.api_key) {
      return {
        apiKey: firebaseConfig.azure.api_key,
        endpoint: firebaseConfig.azure.endpoint,
        deployment: firebaseConfig.azure.deployment,
        apiVersion: firebaseConfig.azure.api_version || "2024-12-01-preview",
      };
    }
  } catch {
    // not in Firebase environment or config not set
  }

  return null;
}

export class AiService {
  private isAnalyzing = false;
  private lastAnalyzed = "";

  async fetchXPosts(): Promise<void> {
    try {
      const { OpenAI } = await import("openai");
      const config = getAzureConfig();
      if (!config) {
        console.error("Azure OpenAI configuration is missing. Skipping X post fetch.");
        return;
      }

      const client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: `${config.endpoint}/openai/deployments/${config.deployment}`,
        defaultQuery: { "api-version": config.apiVersion },
        defaultHeaders: { "api-key": config.apiKey },
      });

      const stockList = TRACKED_STOCKS.map((s) => `${s.ticker} ${s.name}`).join("、");

      const prompt = `你是一位專門監控 X (Twitter) 上全球資本市場（包含台股、美股與加密貨幣）輿情的分析師。請模擬你目前在 X 平台上看到的關於這些市場的最新即時貼文。

追蹤的資產清單：${stockList}

請生成 8-12 則在 X 上會出現的典型貼文，包括：
- 知名投資 KOL 的觀點（如：財經網美、華爾街分析師、科技觀察者、幣圈大V）
- 外資/法人的進出動態與機構報告
- 產業鏈消息與區塊鏈生態動態
- 市場情緒觀察（散戶恐慌或貪婪）
- 國際總經事件對市場的即時評論

回應格式必須是純 JSON 陣列，每個元素：
{
  "author": "作者顯示名稱（繁體中文或英文）",
  "authorHandle": "@xxx 形式的 X 帳號",
  "content": "貼文內容（繁體中文，像真實 X 貼文，可用 $ 符號標記資產代號如 $NVDA 或 $BTC，可含 emoji，100-200字）",
  "postUrl": "https://x.com/xxx/status/... 形式的模擬 URL",
  "relatedTickers": ["2330", "AAPL", "BTC"],
  "sentiment": "bullish 或 bearish 或 neutral",
  "sentimentScore": -1到1的數值,
  "sentimentReason": "情緒判斷原因（繁體中文，1句話）",
  "postedAt": "ISO 8601 時間字串（近幾小時內）"
}

重要規則：
1. 貼文要像真實 X 上的風格：簡短、有觀點、有 hashtag
2. 要涵蓋多元市場（台股、美股、虛幣）及多空觀點
3. 現在是2026年3月底，請根據該時間的合理情境推衍
4. 要反映真實的市場主題：AI大爆發、聯準會利率、科技巨頭財報、加密貨幣趨勢與監管等
5. relatedTickers 只放追蹤資產清單裡有的代號
6. authorHandle 要看起來像真實帳號
7. 請確保回傳有效的 JSON 陣列`;

      const response = await client.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: config.deployment,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0].message.content || "";
      const jsonStr = this.extractJson(content);
      const parsed = JSON.parse(jsonStr);
      // Handle either array or object wrapping an array
      const posts = Array.isArray(parsed) ? parsed : (parsed.posts || Object.values(parsed)[0]) as InsertXPost[];
      
      const now = new Date().toISOString();

      await storage.clearAllXPosts();

      const postsToInsert = posts.map((p) => ({
        ...p,
        relatedTickers: typeof p.relatedTickers === "string" ? p.relatedTickers : JSON.stringify(p.relatedTickers),
        fetchedAt: now,
        postedAt: p.postedAt || now,
      }));

      await storage.insertManyXPosts(postsToInsert);
      console.log(`Fetched ${postsToInsert.length} X posts via Azure OpenAI`);
    } catch (error) {
      console.error("X post fetch error:", error);
    }
  }

  async fetchAndAnalyzeNews(): Promise<void> {
    if (this.isAnalyzing) return;
    this.isAnalyzing = true;

    try {
      const { OpenAI } = await import("openai");
      const config = getAzureConfig();
      if (!config) {
        console.error("Azure OpenAI configuration is missing. Skipping news analysis.");
        this.isAnalyzing = false;
        return;
      }

      const client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: `${config.endpoint}/openai/deployments/${config.deployment}`,
        defaultQuery: { "api-version": config.apiVersion },
        defaultHeaders: { "api-key": config.apiKey },
      });

      const prompt = `你是一位專業的全球資本市場分析師。請根據你所知道的最新市場動態，為以下台股、美股與加密貨幣主要標的提供新聞分析與情緒判斷。

追蹤的資產清單：
${TRACKED_STOCKS.map((s) => `- ${s.ticker} ${s.name} (市場: ${s.market})`).join("\n")}

請為每支標的提供 2-3 則最新相關新聞（可以是國際新聞、產業新聞、地緣政治事件、區塊鏈動態等，只要可能影響該資產價格的都算），並進行情緒分析。

回應格式必須是純 JSON 陣列（不要有其他文字），每個元素結構如下：
{
  "ticker": "資產代號",
  "stockName": "資產名稱",
  "headline": "新聞標題（繁體中文）",
  "summary": "新聞摘要 2-3 句（繁體中文）",
  "source": "新聞來源名稱（例如：經濟日報、Bloomberg、CoinDesk 等）",
  "sourceUrl": "該新聞來源的實際網站 URL",
  "sentiment": "bullish 或 bearish 或 neutral",
  "sentimentScore": 介於 -1 到 1 的數值,
  "sentimentReason": "原因",
  "category": "geopolitics 或 earnings 或 industry 或 macro 或 policy 或 tech"
}

重要規則：
1. 考慮當前全球局勢：AI與半導體供應鏈、聯準會貨幣政策、加密貨幣監管與採用、國際地緣政治等
2. 每支目標資產至少2則新聞
3. sentimentScore 要有區分度，不要全都是中性或全看好
4. 確保回傳有效的 JSON 陣列
5. 現在是2026年3月底，請考慮此時合理的世界觀態勢`;

      const response = await client.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: config.deployment,
        max_tokens: 6000,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0].message.content || "";
      const jsonStr = this.extractJson(content);
      const parsed = JSON.parse(jsonStr);
      const newsItems = (Array.isArray(parsed) ? parsed : (parsed.news || Object.values(parsed)[0])) as InsertStockNews[];
      
      const now = new Date().toISOString();

      await storage.clearAllNews();

      const newsToInsert = newsItems.map((item) => ({
        ...item,
        publishedAt: item.publishedAt || now,
        fetchedAt: now,
      }));

      await storage.insertManyNews(newsToInsert);
      this.lastAnalyzed = now;
      console.log(`Analyzed ${newsToInsert.length} news items via Azure OpenAI`);
    } catch (error) {
      console.error("Analysis error:", error);
    } finally {
      this.isAnalyzing = false;
    }
  }

  private extractJson(content: string): string {
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) return codeBlockMatch[1].trim();
    const jsonMatch = content.match(/\[[\s\S]*\]/) || content.match(/\{[\s\S]*\}/);
    return jsonMatch ? jsonMatch[0] : content;
  }

  getStatus() {
    return {
      isAnalyzing: this.isAnalyzing,
      lastAnalyzed: this.lastAnalyzed,
    };
  }
}

export const aiService = new AiService();
