import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  Zap,
  RefreshCw,
  Clock,
  Activity,
  BarChart3,
  ShieldCheck,
  Gauge,
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useState } from "react";
import type { DayTradeData, MarketBreadth } from "@shared/schema";

// Extracted Components
import { SignalCard } from "@/components/daytrade/SignalCard";
import { CostCalculator } from "@/components/daytrade/CostCalculator";
import { EducationSection } from "@/components/daytrade/EducationSection";

const spring = { type: "spring" as const, damping: 30, stiffness: 200 };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

/* ─── Market Tab Button (shared with dashboard) ─── */
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

// ─── Market Breadth Panel ─────────────────────────────────────────────────────
function MarketBreadthPanel({ breadth }: { breadth: MarketBreadth }) {
  const signalMap = {
    bullish: { label: "大盤偏多", cls: "text-emerald-500", dot: "bg-emerald-500" },
    bearish: { label: "大盤偏空", cls: "text-red-500", dot: "bg-red-500" },
    neutral: { label: "大盤中性", cls: "text-muted-foreground", dot: "bg-muted-foreground" },
  };
  const { label, cls, dot } = signalMap[breadth.breadthSignal];
  const total = breadth.advanceCount + breadth.declineCount + breadth.neutralCount || 1;
  const advPct = Math.round((breadth.advanceCount / total) * 100);
  const decPct = Math.round((breadth.declineCount / total) * 100);

  const maAlignMap = {
    bullish: { label: "多頭排列", cls: "text-emerald-500" },
    bearish: { label: "空頭排列", cls: "text-red-500" },
    mixed: { label: "混排", cls: "text-muted-foreground" },
  };
  const maInfo = maAlignMap[breadth.taiexMaAlignment];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.08 }}>
      <div className="glass-card rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold">大盤技術狀態 (TAIEX)</h2>
          </div>
          <div className={`flex items-center gap-1.5 text-xs font-bold ${cls}`}>
            <span className={`w-2 h-2 rounded-full ${dot} opacity-80`} />
            {label}
          </div>
        </div>

        {/* Advance / Decline bar */}
        <div className="mb-4">
          <div className="flex justify-between text-[11px] mb-2">
            <span className="text-emerald-500 font-semibold">↑ {breadth.advanceCount} 漲 ({advPct}%)</span>
            <span className="text-muted-foreground">{breadth.neutralCount} 平</span>
            <span className="text-red-500 font-semibold">{breadth.declineCount} 跌 ({decPct}%) ↓</span>
          </div>
          <div className="h-2 rounded-full bg-muted/40 overflow-hidden flex gap-0.5">
            <motion.div
              className="rounded-full"
              style={{ background: "linear-gradient(90deg, hsl(142 60% 40%), hsl(160 60% 48%))" }}
              initial={{ width: 0 }}
              animate={{ width: `${advPct}%` }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.div
              className="bg-red-500/60 rounded-full ml-auto"
              initial={{ width: 0 }}
              animate={{ width: `${decPct}%` }}
              transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>

        {/* TAIEX Technicals grid */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "MA20", value: breadth.taiexMa20 != null ? breadth.taiexMa20.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "--" },
            { label: "MA60", value: breadth.taiexMa60 != null ? breadth.taiexMa60.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "--" },
            {
              label: "RSI",
              value: breadth.taiexRsi != null ? breadth.taiexRsi.toFixed(1) : "--",
              cls: breadth.taiexRsi && breadth.taiexRsi > 70 ? "text-orange-400" : breadth.taiexRsi && breadth.taiexRsi < 30 ? "text-sky-400" : "",
            },
            { label: "均線排列", value: maInfo.label, cls: maInfo.cls },
          ].map(({ label: l, value, cls: c }) => (
            <div key={l} className="flex flex-col gap-0.5 bg-muted/25 rounded-lg p-2">
              <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{l}</span>
              <span className={`text-[12px] font-bold tabular-nums ${c ?? ""}`}>{value}</span>
            </div>
          ))}
        </div>

        {breadth.taiexMacdHistogram !== null && (
          <div className="mt-3 flex items-center gap-2 text-[11px] border-t border-border/40 pt-3">
            <span className="text-muted-foreground">MACD 柱狀</span>
            <span className={`font-bold tabular-nums ${breadth.taiexMacdHistogram > 0 ? "text-emerald-500" : "text-red-500"}`}>
              {breadth.taiexMacdHistogram > 0 ? "+" : ""}{breadth.taiexMacdHistogram.toFixed(2)}
            </span>
            <span className={`text-[10px] ${breadth.taiexMacdHistogram > 0 ? "text-emerald-500/70" : "text-red-500/70"}`}>
              ({breadth.taiexMacdHistogram > 0 ? "多方動能" : "空方持續"})
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-6 pt-24">
      <div className="flex gap-4 items-center">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-6 w-24" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
        <Skeleton className="h-[500px] rounded-xl" />
      </div>
    </div>
  );
}

export default function DayTrade() {
  const [marketTab, setMarketTab] = useState<"tw" | "us" | "crypto">("tw");
  const { data, isLoading, isRefetching, refetch } = useQuery<DayTradeData>({
    queryKey: ["/api/daytrade"],
    refetchInterval: 15000,
  });

  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-background">
        <div className="fixed top-4 left-4 right-4 z-50 h-14 glass-card rounded-2xl" />
        <div className="max-w-6xl mx-auto"><LoadingSkeleton /></div>
      </div>
    );
  }

  const isMarketDown = data?.market.taiexChange.startsWith("-");
  const filteredSignals = data?.signals.filter(s => s.market === marketTab) || [];

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Ambient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/4 -left-1/4 w-[700px] h-[700px] rounded-full bg-primary/[0.018] blur-[120px]" />
        <div className="absolute -bottom-1/4 -right-1/4 w-[900px] h-[900px] rounded-full bg-emerald-500/[0.012] blur-[120px]" />
      </div>

      {/* ─── Floating Navbar ─── */}
      <motion.nav
        className="fixed top-4 left-4 right-4 z-50 glass-card rounded-2xl px-4 py-2.5 flex items-center justify-between shadow-lg"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
      >
        {/* Left: back + title */}
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl w-8 h-8 hover:bg-muted cursor-pointer"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <div>
              <h1 className="text-sm font-bold tracking-tight leading-none">盤中當沖工具</h1>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">即時技術指標 · 損平計算 · 指南</p>
            </div>
          </div>
        </div>

        {/* Right: TAIEX + refresh */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end">
            <div className="flex items-center gap-1.5 text-xs font-semibold tabular-nums">
              <span className="text-muted-foreground">TAIEX</span>
              <span>{data?.market.taiexPoints}</span>
              <span className={isMarketDown ? "text-red-500" : "text-emerald-500"}>
                {data?.market.taiexChange} ({data?.market.taiexChangePercent})
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="w-2.5 h-2.5" />
              <span>{data?.market.lastUpdated}</span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="gap-1.5 rounded-xl h-8 cursor-pointer"
            data-testid="button-refresh-daytrade"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline text-xs">更新訊號</span>
          </Button>
        </div>
      </motion.nav>

      {/* ─── Page Content ─── */}
      <div className="relative max-w-6xl mx-auto px-4 pt-24 pb-6">

        {/* 大盤技術狀態 */}
        {data?.breadth && <MarketBreadthPanel breadth={data.breadth} />}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ─── Left column: signals + education ─── */}
          <div className="lg:col-span-7 space-y-6">
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-bold">即時強弱訊號</h2>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />多方
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />空方
                  </div>
                  <span className="border border-border/50 rounded px-1.5 py-0.5">每 15s 自動更新</span>
                </div>
              </div>

              {/* Market tab pills */}
              <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
                <MarketTabBtn active={marketTab === "tw"} onClick={() => setMarketTab("tw")}>台股</MarketTabBtn>
                <MarketTabBtn active={marketTab === "us"} onClick={() => setMarketTab("us")}>美股</MarketTabBtn>
                <MarketTabBtn active={marketTab === "crypto"} onClick={() => setMarketTab("crypto")}>加密貨幣</MarketTabBtn>
              </div>

              <motion.div className="space-y-3" variants={stagger} initial="hidden" animate="show">
                {filteredSignals.map((sig) => (
                  <SignalCard key={sig.ticker} signal={sig} />
                ))}
                {filteredSignals.length === 0 && (
                  <div className="glass-card rounded-2xl p-12 text-center border border-dashed border-border/60">
                    <BarChart3 className="w-9 h-9 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">目前暫無明顯量能標的，請稍候再試...</p>
                  </div>
                )}
              </motion.div>
            </section>

            <section>
              <EducationSection />
            </section>
          </div>

          {/* ─── Right column: calculator + disclaimer ─── */}
          <div className="lg:col-span-5 space-y-4">
            <div className="sticky top-24">
              <CostCalculator />

              <div className="mt-4 glass-card rounded-2xl p-4 border-l-2 border-l-primary/50">
                <div className="flex items-start gap-2.5 text-xs leading-relaxed">
                  <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-primary">當沖核心原則</p>
                    <p className="text-muted-foreground leading-relaxed">當沖並非長線投資，若股價跌破進場支撐點位或買入理由消失，請務必嚴格執行停損，避免虧損擴散。</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
