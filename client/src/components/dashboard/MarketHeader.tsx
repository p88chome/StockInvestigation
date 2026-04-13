import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Clock } from "lucide-react";
import type { DashboardData } from "@shared/schema";

export function MarketHeader({ data }: { data: DashboardData | undefined }) {
  const isDown = data?.market.taiexChange.startsWith("-");
  const isOpen = data?.market.marketStatus === "open";

  return (
    <div className="flex items-center gap-6 flex-wrap">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase">加權指數 TAIEX</span>
          {isOpen && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500">
              <span className="live-dot scale-75" />
              開盤中
            </span>
          )}
          {!isOpen && data && (
            <span className="text-[10px] font-medium text-muted-foreground/70 border border-border/50 rounded px-1.5 py-0">
              已收盤
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2.5">
          <span className="text-2xl font-bold tabular-nums tracking-tight">{data?.market.taiexPoints || "---"}</span>
          <div className={`flex items-center gap-1 text-sm font-semibold tabular-nums ${isDown ? "text-red-500" : "text-emerald-500"}`}>
            {isDown
              ? <TrendingDown className="w-3.5 h-3.5" />
              : <TrendingUp className="w-3.5 h-3.5" />
            }
            <span>{data?.market.taiexChange || "---"}</span>
            <span className="text-xs opacity-80">({data?.market.taiexChangePercent || "---"})</span>
          </div>
        </div>
      </div>

      {data?.market.lastUpdated && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{data.market.lastUpdated}</span>
        </div>
      )}
    </div>
  );
}

export function SentimentDistribution({ bullish, neutral, bearish }: { bullish: number; neutral: number; bearish: number }) {
  const total = bullish + neutral + bearish || 1;
  return (
    <div className="w-full">
      <div className="flex h-1.5 rounded-full overflow-hidden gap-0.5">
        <motion.div
          className="rounded-full"
          style={{ background: "linear-gradient(90deg, hsl(142 60% 40%), hsl(160 60% 45%))" }}
          initial={{ width: 0 }}
          animate={{ width: `${(bullish / total) * 100}%` }}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.div
          className="bg-muted-foreground/25 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${(neutral / total) * 100}%` }}
          transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        />
        <motion.div
          className="rounded-full"
          style={{ background: "linear-gradient(90deg, hsl(0 72% 48%), hsl(10 72% 54%))" }}
          initial={{ width: 0 }}
          animate={{ width: `${(bearish / total) * 100}%` }}
          transition={{ duration: 0.9, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}
