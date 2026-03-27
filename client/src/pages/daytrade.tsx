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
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useState } from "react";
import type { DayTradeData } from "@shared/schema";

// Extracted Components
import { SignalCard } from "@/components/daytrade/SignalCard";
import { CostCalculator } from "@/components/daytrade/CostCalculator";
import { EducationSection } from "@/components/daytrade/EducationSection";

const spring = { type: "spring" as const, damping: 30, stiffness: 200 };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: spring } };

function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <div className="flex gap-4 items-center"><Skeleton className="h-8 w-32" /><Skeleton className="h-6 w-24" /></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}</div>
        <Skeleton className="h-[500px] rounded-lg" />
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
        <div className="max-w-6xl mx-auto p-6"><LoadingSkeleton /></div>
      </div>
    );
  }

  const isMarketDown = data?.market.taiexChange.startsWith("-");
  const filteredSignals = data?.signals.filter(s => s.market === marketTab) || [];

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-primary/[0.01] blur-3xl opacity-50" />
        <div className="absolute -bottom-1/4 -right-1/4 w-[800px] h-[800px] rounded-full bg-emerald-500/[0.015] blur-3xl opacity-30" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-6">
        <motion.header className="flex items-center justify-between mb-8" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary fill-primary/20" />
                <h1 className="text-xl font-bold tracking-tight">盤中當沖工具</h1>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">即時技術指標監控 · 進場損平計算 · 當沖指南</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end mr-2">
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
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching} className="gap-2 backdrop-blur-sm" data-testid="button-refresh-daytrade">
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
              更新訊號
            </Button>
          </div>
        </motion.header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-bold">即時強弱訊號</h2>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" />多方</div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" />空方</div>
                  <span>每 15s 自動更新</span>
                </div>
              </div>

              <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
                <Button variant={marketTab === "tw" ? "default" : "outline"} size="sm" onClick={() => setMarketTab("tw")} className="rounded-full px-5">台股</Button>
                <Button variant={marketTab === "us" ? "default" : "outline"} size="sm" onClick={() => setMarketTab("us")} className="rounded-full px-5">美股</Button>
                <Button variant={marketTab === "crypto" ? "default" : "outline"} size="sm" onClick={() => setMarketTab("crypto")} className="rounded-full px-5">加密貨幣</Button>
              </div>

              <motion.div className="space-y-3" variants={stagger} initial="hidden" animate="show">
                {filteredSignals.map((sig) => (
                  <SignalCard key={sig.ticker} signal={sig} />
                ))}
                {filteredSignals.length === 0 && (
                  <Card className="p-12 text-center border-dashed border-2 bg-muted/5">
                    <BarChart3 className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">目前暫無明顯量能標的，請稍候再試...</p>
                  </Card>
                )}
              </motion.div>
            </section>

            <section>
              <EducationSection />
            </section>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="sticky top-6">
              <CostCalculator />
              <Card className="mt-4 p-4 bg-primary/[0.02] border-primary/10">
                <div className="flex items-start gap-2.5 text-xs leading-relaxed">
                  <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-primary">當沖核心原則</p>
                    <p className="text-muted-foreground">當沖並非長線投資，若股價跌破進場支撐點位或買入理由消失，請務必嚴格執行停損，避免虧損擴散。</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
