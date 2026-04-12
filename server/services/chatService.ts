/**
 * chatService.ts
 * AI 問答服務：Azure OpenAI GPT-4.1 + FinMind 資料工具
 */

interface AzureConfig {
  apiKey: string;
  endpoint: string;
  deployment: string;
  apiVersion: string;
}

function getChatConfig(): AzureConfig | null {
  const env = process.env;
  const apiKey = env.AZURE_OPENAI_API_KEY || env.OPENAI_API_KEY;
  if (apiKey && env.AZURE_OPENAI_ENDPOINT && env.AZURE_OPENAI_DEPLOYMENT) {
    return {
      apiKey: apiKey,
      endpoint: env.AZURE_OPENAI_ENDPOINT,
      deployment: env.AZURE_OPENAI_DEPLOYMENT,
      apiVersion: env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview",
    };
  }
  try {
    const fc = require("firebase-functions").config();
    if (fc?.azure?.api_key) {
      return {
        apiKey: fc.azure.api_key,
        endpoint: fc.azure.endpoint,
        deployment: fc.azure.deployment,
        apiVersion: fc.azure.api_version || "2024-12-01-preview",
      };
    }
  } catch { /* not in Firebase env */ }
  return null;
}

// ─── FinMind API ──────────────────────────────────────────────────────────────

const FINMIND_BASE = "https://api.finmindtrade.com/api/v4/data";

async function callFinMind(dataset: string, dataId: string, startDate: string, endDate: string): Promise<any> {
  const token = process.env.FINMIND_TOKEN ?? "";
  const params = new URLSearchParams({
    dataset,
    data_id: dataId,
    start_date: startDate,
    end_date: endDate,
    ...(token ? { token } : {}),
  });

  try {
    const res = await fetch(`${FINMIND_BASE}?${params}`, {
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) return { error: `FinMind API returned ${res.status}` };
    const json = await res.json();
    // FinMind returns { status: 200, msg: "success", data: [...] }
    if (json.status !== 200) return { error: json.msg ?? "Unknown error" };
    return { data: json.data?.slice(0, 30) ?? [] }; // limit rows to avoid context overflow
  } catch (err) {
    return { error: String(err) };
  }
}

// ─── OpenAI Tool Definitions ──────────────────────────────────────────────────

const FINMIND_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "query_stock_price",
      description: "查詢台股個股歷史日收盤價、開高低收、成交量。適合分析個股走勢、計算漲跌幅。",
      parameters: {
        type: "object",
        properties: {
          stock_id: { type: "string", description: "股票代碼，例如 2330（台積電）" },
          start_date: { type: "string", description: "起始日期 YYYY-MM-DD，預設近 30 日" },
          end_date: { type: "string", description: "結束日期 YYYY-MM-DD，預設今日" },
        },
        required: ["stock_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "query_institutional_trading",
      description: "查詢外資、投信、自營商買賣超股數與金額（三大法人）。",
      parameters: {
        type: "object",
        properties: {
          stock_id: { type: "string", description: "股票代碼" },
          start_date: { type: "string", description: "起始日期 YYYY-MM-DD" },
          end_date: { type: "string", description: "結束日期 YYYY-MM-DD" },
        },
        required: ["stock_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "query_monthly_revenue",
      description: "查詢個股月營收（單月 & 累計）及年增率，用於基本面分析。",
      parameters: {
        type: "object",
        properties: {
          stock_id: { type: "string", description: "股票代碼" },
          start_date: { type: "string", description: "起始年月 YYYY-MM-01" },
          end_date: { type: "string", description: "結束年月 YYYY-MM-01" },
        },
        required: ["stock_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "query_financial_statement",
      description: "查詢個股季度財務報表：EPS、ROE、毛利率、營業利益率等。",
      parameters: {
        type: "object",
        properties: {
          stock_id: { type: "string", description: "股票代碼" },
          start_date: { type: "string", description: "起始日期 YYYY-MM-DD（以季為單位）" },
          end_date: { type: "string", description: "結束日期 YYYY-MM-DD" },
        },
        required: ["stock_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "query_pe_ratio",
      description: "查詢個股歷史本益比（PER）、股價淨值比（PBR）、股息殖利率。",
      parameters: {
        type: "object",
        properties: {
          stock_id: { type: "string", description: "股票代碼" },
          start_date: { type: "string", description: "起始日期 YYYY-MM-DD" },
          end_date: { type: "string", description: "結束日期 YYYY-MM-DD" },
        },
        required: ["stock_id"],
      },
    },
  },
] as const;

// ─── Tool execution ────────────────────────────────────────────────────────────

function defaultDateRange(days = 30): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { start: fmt(start), end: fmt(end) };
}

async function executeTool(name: string, args: any): Promise<string> {
  const { start, end } = defaultDateRange(30);
  const startDate = args.start_date || start;
  const endDate = args.end_date || end;
  const stockId = args.stock_id || "";

  const datasetMap: Record<string, string> = {
    query_stock_price: "TaiwanStockPrice",
    query_institutional_trading: "TaiwanStockInstitutionalInvestorsBuySell",
    query_monthly_revenue: "TaiwanStockMonthRevenue",
    query_financial_statement: "TaiwanStockFinancialStatements",
    query_pe_ratio: "TaiwanStockPER",
  };

  const dataset = datasetMap[name];
  if (!dataset || !stockId) return JSON.stringify({ error: "Invalid tool call" });

  const result = await callFinMind(dataset, stockId, startDate, endDate);
  return JSON.stringify(result);
}

// ─── Chat Message Types ────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatRequest {
  message: string;
  history: ChatMessage[];
}

// ─── Main Chat Function ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `你是「台股情報站」的 AI 分析師，擅長台灣股票市場分析。
你可以使用 FinMind 工具查詢即時資料，包括股價歷史、法人買賣超、月營收、財務報表與本益比。
回答時請：
- 用繁體中文回答
- 引用具體數字佐證
- 區分「事實資料」與「個人觀點」
- 提示投資風險：所有分析僅供參考，不構成投資建議
今日日期：${new Date().toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" })}`;

/**
 * 非串流版本：完整回答後一次回傳
 */
export async function chat(req: ChatRequest): Promise<string> {
  const config = getChatConfig();
  if (!config) return "AI 服務尚未設定，請聯絡管理員配置 Azure OpenAI 環境變數。";

  const url = `${config.endpoint}openai/deployments/${config.deployment}/chat/completions?api-version=${config.apiVersion}`;

  const messages: any[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...req.history.slice(-10), // 保留最近 10 輪對話
    { role: "user", content: req.message },
  ];

  try {
    // First call: may trigger tool calls
    const body1 = {
      messages,
      tools: FINMIND_TOOLS,
      tool_choice: "auto",
      max_tokens: 1500,
      temperature: 0.3,
    };

    const res1 = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": config.apiKey },
      body: JSON.stringify(body1),
    });
    if (!res1.ok) {
      const err = await res1.text();
      console.error("[Chat] API error:", err);
      return "AI 服務暫時無法使用，請稍後再試。";
    }

    const data1 = await res1.json();
    const choice = data1.choices?.[0];
    if (!choice) return "無法取得 AI 回應。";

    const assistantMsg = choice.message;

    // If no tool calls, return directly
    if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
      return assistantMsg.content ?? "（無回應）";
    }

    // Execute tool calls in parallel
    const toolResults = await Promise.all(
      assistantMsg.tool_calls.map(async (tc: any) => {
        const args = JSON.parse(tc.function.arguments || "{}");
        const result = await executeTool(tc.function.name, args);
        return { tool_call_id: tc.id, role: "tool" as const, content: result };
      })
    );

    // Second call: with tool results
    const messages2 = [
      ...messages,
      assistantMsg,
      ...toolResults,
    ];

    const res2 = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": config.apiKey },
      body: JSON.stringify({ messages: messages2, max_tokens: 1500, temperature: 0.3 }),
    });
    if (!res2.ok) return "AI 分析工具執行後無法取得回應，請稍後再試。";

    const data2 = await res2.json();
    return data2.choices?.[0]?.message?.content ?? "（無回應）";
  } catch (err) {
    console.error("[Chat] Error:", err);
    return "發生未預期錯誤，請稍後再試。";
  }
}
