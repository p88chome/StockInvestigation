import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Activity,
  BarChart3,
  Newspaper,
  Zap,
  Sun,
  Moon,
} from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import type { DashboardData } from "@shared/schema";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import { useToast } from "@/hooks/use-toast";

// Extracted Components
import { StockCard } from "@/components/dashboard/StockCard";
import { NewsItem } from "@/components/dashboard/NewsItem";
import { XPostCard } from "@/components/dashboard/XPostCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { MarketHeader, SentimentDistribution } from "@/components/dashboard/MarketHeader";
import { StockSearch } from "@/components/dashboard/StockSearch";
import { Calendar, Info } from "lucide-react";

/* ─── Motion presets ─── */
const spring = { type: "spring" as const, damping: 30, stiffness: 200 };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: spring } };
const fadeIn = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.35 } } };

/* ─── Loading Skeleton ─── */
function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <div className="flex gap-4 items-center"><Skeleton className="h-8 w-32" /><Skeleton className="h-6 w-24" /></div>
      <div className="grid grid-cols-3 gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}</div>
    </div>
  );
}

export default function Dashboard() {
  const { toast } = useToast();
  const [isDark, setIsDark] = useState(typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [activeTab, setActiveTab] = useState<"news" | "x">("x");
  const [marketTab, setMarketTab] = useState<"tw" | "us" | "crypto">("tw");

  useEffect(() => { document.documentElement.classList.toggle("dark", isDark); }, [isDark]);

  const { data, isLoading, isRefetching } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
    refetchInterval: 10000,
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => { const res = await apiRequest("POST", "/api/analyze"); return res.json(); },
    onSuccess: (data) => {
      if (data?.status === "started") {
        toast({ title: "分析已啟動", description: "AI 正在背景分析最新市場數據，這可能需要約 30 秒至 1 分鐘，請稍候。" });
      } else if (data?.status === "already_running") {
        toast({ title: "分析執行中", description: "AI 已經在背景進行分析，請稍候。" });
      }
      setTimeout(() => { queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] }); }, 2000);
    },
    onError: () => {
      toast({ title: "啟動失敗", description: "無法啟動分析，請稍後再試。", variant: "destructive" });
    }
  });

  const filteredStocks = data?.stocks.filter((s) => s.market === marketTab) || [];
  const bullishCount = filteredStocks.filter((s) => s.overallSentiment === "bullish").length || 0;
  const bearishCount = filteredStocks.filter((s) => s.overallSentiment === "bearish").length || 0;
  const neutralCount = filteredStocks.filter((s) => s.overallSentiment === "neutral").length || 0;
  const totalNews = data?.recentNews.length || 0;
  const totalXPosts = data?.xPosts?.length || 0;

  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto">
          <motion.div className="p-6 flex items-center gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="relative">
              <Activity className="w-5 h-5 text-primary" />
              <motion.div className="absolute inset-0 rounded-full bg-primary/20" animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />
            </div>
            <span className="text-sm text-muted-foreground">AI 正在分析市場新聞與 X 即時輿情...首次載入需要約 30 秒</span>
          </motion.div>
          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] rounded-full bg-primary/[0.02] blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/4 w-[600px] h-[600px] rounded-full bg-primary/[0.015] blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-5">
        <motion.header className="flex items-center justify-between mb-6" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
          <div className="flex items-center gap-3">
            <div className="relative">
              <svg viewBox="0 0 32 32" className="w-7 h-7 text-primary" fill="none" stroke="currentColor" strokeWidth="2" aria-label="台股情報站">
                <rect x="2" y="18" width="6" height="12" rx="1" /><rect x="13" y="10" width="6" height="20" rx="1" /><rect x="24" y="2" width="6" height="28" rx="1" />
                <path d="M5 16 L16 8 L27 2" strokeLinecap="round" />
              </svg>
              <div className="absolute -inset-1 bg-primary/10 rounded-lg blur-sm -z-10" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">台股情報站</h1>
              <p className="text-xs text-muted-foreground">AI 新聞情緒分析 · X 即時輿情 · 真實股價</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => setIsDark(!isDark)} data-testid="button-theme-toggle" className="backdrop-blur-sm">
                  <AnimatePresence mode="wait">
                    <motion.div key={isDark ? "sun" : "moon"} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </motion.div>
                  </AnimatePresence>
                </Button>
              </TooltipTrigger>
              <TooltipContent>切換明暗模式</TooltipContent>
            </Tooltip>
            <Link href="/daytrade">
              <Button variant="outline" size="sm" className="gap-1.5 backdrop-blur-sm" data-testid="button-daytrade">
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">當沖工具</span>
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => analyzeMutation.mutate()} disabled={analyzeMutation.isPending} data-testid="button-refresh-analysis" className="gap-1.5 backdrop-blur-sm">
              <RefreshCw className={`w-3.5 h-3.5 ${analyzeMutation.isPending || isRefetching ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">重新分析</span>
            </Button>
          </div>
        </motion.header>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.05 }}>
          <Card className="relative overflow-hidden p-4 mb-5 border-border/50" data-testid="card-market-overview">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-primary to-red-500 opacity-60" />
            <div className="flex items-center justify-between flex-wrap gap-4">
              <MarketHeader data={data} />
              <div className="flex items-center gap-4">
                {data && data.stocks.length > 0 && (
                  <div className="hidden sm:block w-40">
                    <SentimentDistribution bullish={bullishCount} neutral={neutralCount} bearish={bearishCount} />
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] text-emerald-500 tabular-nums">{bullishCount} 漲</span>
                      <span className="text-[9px] text-muted-foreground tabular-nums">{neutralCount} 平</span>
                      <span className="text-[9px] text-red-500 tabular-nums">{bearishCount} 跌</span>
                    </div>
                  </div>
                )}
                {data?.lastAnalyzed && (
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Zap className="w-3 h-3" />{new Date(data.lastAnalyzed).toLocaleString("zh-TW")}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </motion.div>

        {data?.upcomingEvents && data.upcomingEvents.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.1 }} className="mb-5 overflow-x-auto pb-2 scrollbar-hide">
            <div className="flex items-center gap-2 mb-2 px-1">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <h2 className="text-xs font-bold">即將法說會 (Event Calendar)</h2>
            </div>
            <div className="flex gap-3">
              {data.upcomingEvents.map((event, i) => (
                <div key={i} className="flex-shrink-0 w-48 p-2.5 rounded-xl bg-card border border-border/60 hover:border-primary/30 transition-colors shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  </div>
                  <div className="flex justify-between items-start mb-1.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">{event.ticker}</span>
                    <span className="text-[10px] text-muted-foreground font-medium">{event.date}</span>
                  </div>
                  <p className="text-[11px] font-semibold mb-1 truncate">{event.stockName}</p>
                  <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{event.description}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ─── TWSE 個股查詢 ─── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.12 }}>
          <StockSearch />
        </motion.div>

        <motion.div className="grid grid-cols-3 gap-3 mb-5" variants={stagger} initial="hidden" animate="show">
          <KpiCard value={bullishCount} label="看漲" color="text-emerald-500" icon={TrendingUp} testId="kpi-bullish" />
          <KpiCard value={neutralCount} label="中性" color="text-gray-400" icon={Minus} testId="kpi-neutral" />
          <KpiCard value={bearishCount} label="看跌" color="text-red-500" icon={TrendingDown} testId="kpi-bearish" />
        </motion.div>

        {(!data || data.stocks.length === 0) && !isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="p-8 text-center">
              <div className="relative inline-block mb-3">
                <Activity className="w-8 h-8 text-primary" />
                <motion.div className="absolute inset-0 rounded-full bg-primary/20" animate={{ scale: [1, 2, 1], opacity: [0.4, 0, 0.4] }} transition={{ duration: 2, repeat: Infinity }} />
              </div>
              <p className="text-sm text-muted-foreground mb-3">AI 正在分析最新市場新聞與 X 輿情，請稍候...</p>
              <Button disabled={analyzeMutation.isPending} variant="outline" size="sm" onClick={() => analyzeMutation.mutate()} data-testid="button-start-analysis">
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${analyzeMutation.isPending ? "animate-spin" : ""}`} />啟動分析
              </Button>
            </Card>
          </motion.div>
        )}

        {data && data.stocks.length > 0 && (
          <>
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
              <Button variant={marketTab === "tw" ? "default" : "outline"} size="sm" onClick={() => setMarketTab("tw")} className="rounded-full px-5">台股</Button>
              <Button variant={marketTab === "us" ? "default" : "outline"} size="sm" onClick={() => setMarketTab("us")} className="rounded-full px-5">美股</Button>
              <Button variant={marketTab === "crypto" ? "default" : "outline"} size="sm" onClick={() => setMarketTab("crypto")} className="rounded-full px-5">加密貨幣</Button>
            </div>

            <motion.div className="flex items-center gap-2 mb-3" variants={fadeIn} initial="hidden" animate="show">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold">個股情緒分析</h2>
              <span className="text-xs text-muted-foreground">(點擊展開詳情)</span>
              <span className="ml-auto text-[10px] text-muted-foreground tabular-nums px-1.5 py-0 border rounded">{totalNews} 則新聞</span>
            </motion.div>

            <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6" variants={stagger} initial="hidden" animate="show">
              {filteredStocks.map((stock, i) => <StockCard key={stock.ticker} stock={stock} index={i} />)}
            </motion.div>

            <div className="flex items-center gap-1 mb-3 border-b border-border/50 pb-2">
              <button onClick={() => setActiveTab("x")} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-t transition-colors ${activeTab === "x" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                即時輿情
                {totalXPosts > 0 && <span className="ml-1 text-[10px] px-1.5 py-0 border rounded">{totalXPosts}</span>}
              </button>
              <button onClick={() => setActiveTab("news")} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-t transition-colors ${activeTab === "news" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
                <Newspaper className="w-3.5 h-3.5" />
                市場新聞
                <span className="ml-1 text-[10px] px-1.5 py-0 border rounded">{totalNews}</span>
              </button>
            </div>

            <AnimatePresence mode="wait">
              {activeTab === "x" && (
                <motion.div key="x" className="space-y-2 mb-8" variants={stagger} initial="hidden" animate="show" exit={{ opacity: 0 }}>
                  {(data.xPosts || []).length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">X 輿情分析中...</div>
                  ) : (
                    (data.xPosts || []).map((post, i) => <XPostCard key={post.id} post={post} />)
                  )}
                </motion.div>
              )}
              {activeTab === "news" && (
                <motion.div key="news" className="space-y-2 mb-8" variants={stagger} initial="hidden" animate="show" exit={{ opacity: 0 }}>
                  {data.recentNews.slice(0, 15).map((news, i) => <NewsItem key={news.id} news={news} />)}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        <motion.footer className="py-4 border-t border-border/50 text-center" variants={fadeIn} initial="hidden" animate="show">
          <p className="text-[10px] text-muted-foreground mb-1">本站資訊僅供參考，不構成投資建議。投資有風險，請自行判斷。</p>
          <PerplexityAttribution />
        </motion.footer>
      </div>
    </div>
  );
}
