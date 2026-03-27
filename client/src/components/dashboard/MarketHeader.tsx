import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DashboardData } from "@shared/schema";

export function MarketHeader({ data }: { data: DashboardData | undefined }) {
  const isDown = data?.market.taiexChange.startsWith("-");
  return (
    <div className="flex items-center gap-6 flex-wrap">
      <div>
        <div className="text-xs text-muted-foreground mb-0.5 font-medium">加權指數 TAIEX</div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold tabular-nums">{data?.market.taiexPoints || "---"}</span>
          <span className={`text-sm font-semibold tabular-nums ${isDown ? "text-red-500" : "text-emerald-500"}`}>
            {data?.market.taiexChange || "---"} ({data?.market.taiexChangePercent || "---"})
          </span>
          {isDown ? <TrendingDown className="w-4 h-4 text-red-500" /> : <TrendingUp className="w-4 h-4 text-emerald-500" />}
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="w-3 h-3" />
        <span>{data?.market.lastUpdated || "---"}</span>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${data?.market.marketStatus === "open" ? "text-emerald-500 border-emerald-500/30" : "text-muted-foreground"}`}>
          {data?.market.marketStatus === "open" ? "開盤中" : "已收盤"}
        </Badge>
      </div>
    </div>
  );
}

export function SentimentDistribution({ bullish, neutral, bearish }: { bullish: number; neutral: number; bearish: number }) {
  const total = bullish + neutral + bearish || 1;
  return (
    <div className="w-full">
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
        <motion.div className="rounded-full" style={{ background: "linear-gradient(90deg, hsl(142 60% 40%), hsl(160 60% 45%))" }} initial={{ width: 0 }} animate={{ width: `${(bullish / total) * 100}%` }} transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }} />
        <motion.div className="bg-gray-400/50 rounded-full" initial={{ width: 0 }} animate={{ width: `${(neutral / total) * 100}%` }} transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }} />
        <motion.div className="rounded-full" style={{ background: "linear-gradient(90deg, hsl(0 72% 48%), hsl(10 72% 54%))" }} initial={{ width: 0 }} animate={{ width: `${(bearish / total) * 100}%` }} transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }} />
      </div>
    </div>
  );
}
