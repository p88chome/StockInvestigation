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
import { SideDrawer } from "@/components/SideDrawer";

/* ─── Motion presets ─── */
const spring = { type: "spring" as const, damping: 30, stiffness: 200 };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const fadeIn = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.35 } } };

/* ─── Loading Skeleton ─── */
function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-6 pt-24">
      <div className="flex gap-4 items-center">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-24" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
    </div>
  );
}

/* ─── Market Tab Button ─── */
function MarketTabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-5 py-1.5 text-sm font-medium rounded-full transition-all duration-200 cursor-pointer
        ${active
          ? "bg-primary text-primary-foreground shadow-[0_0_14px_hsl(var(--primary)/0.35)]"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
        }`}
    >
      {children}
    </button>
  );
}

export default function Dashboard() {
  const { toast } = useToast();
  const [isDark, setIsDark] = useState(
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
  );
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
  const isMarketOpen = data?.market.marketStatus === "open";

  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-background">
        {/* Sticky header skeleton */}
        <div className="fixed top-4 left-4 right-4 z-50 h-14 glass-card rounded-2xl" />
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="p-6 pt-24 flex items-center gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="relative">
              <Activity className="w-5 h-5 text-primary" />
              <motion.div
                className="absolute inset-0 rounded-full bg-primary/20"
                animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
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
      {/* Ambient background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/2 -right-1/4 w-[900px] h-[900px] rounded-full bg-primary/[0.025] blur-[120px]" />
        <div className="absolute -bottom-1/2 -left-1/4 w-[700px] h-[700px] rounded-full bg-emerald-500/[0.015] blur-[100px]" />
      </div>

      {/* ─── Floating Glassmorphism Navbar ─── */}
      <motion.nav
        className="fixed top-4 left-4 right-4 z-50 glass-card rounded-2xl px-4 py-2.5 flex items-center justify-between shadow-lg"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
      >
        {/* Logo + title */}
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <svg viewBox="0 0 32 32" className="w-7 h-7 text-primary" fill="none" stroke="currentColor" strokeWidth="2" aria-label="台股情報站">
              <rect x="2" y="18" width="6" height="12" rx="1" />
              <rect x="13" y="10" width="6" height="20" rx="1" />
              <rect x="24" y="2" width="6" height="28" rx="1" />
              <path d="M5 16 L16 8 L27 2" strokeLinecap="round" />
            </svg>
            <div className="absolute -inset-1 bg-primary/15 rounded-lg blur-sm -z-10" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight leading-none">台股情報站</h1>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">AI 情緒分析 · X 輿情 · 即時股價</p>
          </div>
          {/* Live indicator */}
          {isMarketOpen && (
            <div className="hidden sm:flex items-center gap-1.5 ml-1 text-[10px] font-semibold text-emerald-500">
              <span className="live-dot scale-75" />
              LIVE
            </div>
          )}
        </div>

        {/* Nav actions */}
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsDark(!isDark)}
                data-testid="button-theme-toggle"
                className="w-8 h-8 rounded-xl cursor-pointer"
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={isDark ? "sun" : "moon"}
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </motion.div>
                </AnimatePresence>
              </Button>
            </TooltipTrigger>
            <TooltipContent>切換明暗模式</TooltipContent>
          </Tooltip>

          <Link href="/daytrade">
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl h-8 cursor-pointer" data-testid="button-daytrade">
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs">當沖工具</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
            data-testid="button-refresh-analysis"
            className="gap-1.5 rounded-xl h-8 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${analyzeMutation.isPending || isRefetching ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline text-xs">重新分析</span>
          </Button>
        </div>
      </motion.nav>

      {/* ─── Page content (offset for fixed nav) ─── */}
      <div className="relative max-w-6xl mx-auto px-4 pt-24 pb-6">

        {/* ─── Market Overview Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.05 }}
          className="mb-5"
        >
          <div className="relative overflow-hidden glass-card rounded-2xl p-5" data-testid="card-market-overview">
            {/* Gradient top stripe */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-primary to-red-500 opacity-70 rounded-t-2xl" />

            <div className="flex items-center justify-between flex-wrap gap-4">
              <MarketHeader data={data} />

              <div className="flex items-center gap-5">
                {data && data.stocks.length > 0 && (
                  <div className="hidden sm:block w-44">
                    <div className="flex justify-between mb-1.5">
                      <span className="text-[10px] text-emerald-500 font-semibold tabular-nums">{bullishCount} 漲</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">{neutralCount} 平</span>
                      <span className="text-[10px] text-red-500 font-semibold tabular-nums">{bearishCount} 跌</span>
                    </div>
                    <SentimentDistribution bullish={bullishCount} neutral={neutralCount} bearish={bearishCount} />
                  </div>
                )}
                {data?.lastAnalyzed && (
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1 border border-border/40 rounded-lg px-2 py-1">
                    <Activity className="w-3 h-3 text-primary" />
                    {new Date(data.lastAnalyzed).toLocaleString("zh-TW")}
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ─── Stock Search ─── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.10 }}
        >
          <StockSearch />
        </motion.div>

        {/* ─── KPI Cards ─── */}
        <motion.div className="grid grid-cols-3 gap-3 mb-5" variants={stagger} initial="hidden" animate="show">
          <KpiCard value={bullishCount} label="看漲" color="text-emerald-500" icon={TrendingUp} testId="kpi-bullish" />
          <KpiCard value={neutralCount} label="中性" color="text-gray-400" icon={Minus} testId="kpi-neutral" />
          <KpiCard value={bearishCount} label="看跌" color="text-red-500" icon={TrendingDown} testId="kpi-bearish" />
        </motion.div>

        {/* ─── Empty state ─── */}
        {(!data || data.stocks.length === 0) && !isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="p-10 text-center rounded-2xl border-dashed border-2">
              <div className="relative inline-block mb-4">
                <Activity className="w-9 h-9 text-primary" />
                <motion.div
                  className="absolute inset-0 rounded-full bg-primary/20"
                  animate={{ scale: [1, 2, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              <p className="text-sm text-muted-foreground mb-4">AI 正在分析最新市場新聞與 X 輿情，請稍候...</p>
              <Button
                disabled={analyzeMutation.isPending}
                variant="outline"
                size="sm"
                onClick={() => analyzeMutation.mutate()}
                data-testid="button-start-analysis"
                className="rounded-xl gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${analyzeMutation.isPending ? "animate-spin" : ""}`} />
                啟動分析
              </Button>
            </Card>
          </motion.div>
        )}

        {/* ─── Stock Sentiment Section ─── */}
        {data && data.stocks.length > 0 && (
          <>
            {/* Market tab pills */}
            <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
              <MarketTabBtn active={marketTab === "tw"} onClick={() => setMarketTab("tw")}>台股</MarketTabBtn>
              <MarketTabBtn active={marketTab === "us"} onClick={() => setMarketTab("us")}>美股</MarketTabBtn>
              <MarketTabBtn active={marketTab === "crypto"} onClick={() => setMarketTab("crypto")}>加密貨幣</MarketTabBtn>
            </div>

            {/* Section heading */}
            <motion.div className="flex items-center gap-2 mb-3" variants={fadeIn} initial="hidden" animate="show">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold">個股情緒分析</h2>
              <span className="text-xs text-muted-foreground">(點擊展開詳情)</span>
              <span className="ml-auto text-[10px] text-muted-foreground tabular-nums border border-border/50 rounded-md px-1.5 py-0.5">
                {totalNews} 則新聞
              </span>
            </motion.div>

            {/* Stock cards */}
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-7"
              variants={stagger}
              initial="hidden"
              animate="show"
            >
              {filteredStocks.map((stock, i) => <StockCard key={stock.ticker} stock={stock} index={i} />)}
            </motion.div>

            {/* ─── Feed tabs ─── */}
            <div className="flex items-center gap-1 mb-4 border-b border-border/50 pb-0">
              <button
                onClick={() => setActiveTab("x")}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-all duration-200 border-b-2 -mb-px cursor-pointer
                  ${activeTab === "x"
                    ? "text-primary border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                  }`}
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                即時輿情
                {totalXPosts > 0 && (
                  <span className="ml-1 text-[10px] px-1.5 py-0 border border-current/30 rounded-md tabular-nums">{totalXPosts}</span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("news")}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-all duration-200 border-b-2 -mb-px cursor-pointer
                  ${activeTab === "news"
                    ? "text-primary border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                  }`}
              >
                <Newspaper className="w-3.5 h-3.5" />
                市場新聞
                <span className="ml-1 text-[10px] px-1.5 py-0 border border-current/30 rounded-md tabular-nums">{totalNews}</span>
              </button>
            </div>

            {/* ─── Feed content ─── */}
            <AnimatePresence mode="wait">
              {activeTab === "x" && (
                <motion.div
                  key="x"
                  className="space-y-2 mb-8"
                  variants={stagger}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
                >
                  {(data.xPosts || []).length === 0 ? (
                    <div className="text-center py-10 text-sm text-muted-foreground">X 輿情分析中...</div>
                  ) : (
                    (data.xPosts || []).map((post) => <XPostCard key={post.id} post={post} />)
                  )}
                </motion.div>
              )}
              {activeTab === "news" && (
                <motion.div
                  key="news"
                  className="space-y-2 mb-8"
                  variants={stagger}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
                >
                  {data.recentNews.slice(0, 15).map((news) => <NewsItem key={news.id} news={news} />)}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* ─── Footer ─── */}
        <motion.footer
          className="py-5 border-t border-border/40 text-center"
          variants={fadeIn}
          initial="hidden"
          animate="show"
        >
          <p className="text-[10px] text-muted-foreground mb-1.5">本站資訊僅供參考，不構成投資建議。投資有風險，請自行判斷。</p>
          <PerplexityAttribution />
        </motion.footer>
      </div>

      {/* AI 問答 + 法說行事曆 Drawer */}
      <SideDrawer events={data?.upcomingEvents ?? []} />
    </div>
  );
}
