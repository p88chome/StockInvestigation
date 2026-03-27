import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, TrendingUp, TrendingDown, Minus, ChevronRight } from "lucide-react";
import { ScoreRing } from "./ScoreRing";
import { IndicatorBadge } from "./IndicatorBadge";
import type { DayTradeSignal } from "@shared/schema";

const spring = { type: "spring" as const, damping: 30, stiffness: 200 };
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: spring } };

function signalColor(signal: string) {
  if (signal === "buy" || signal === "strong_buy") return "text-emerald-500";
  if (signal === "sell" || signal === "strong_sell") return "text-red-500";
  return "text-gray-400";
}
function signalBg(signal: string) {
  if (signal === "buy" || signal === "strong_buy") return "bg-emerald-500/10 border-emerald-500/20";
  if (signal === "sell" || signal === "strong_sell") return "bg-red-500/10 border-red-500/20";
  return "bg-gray-500/5 border-gray-500/10";
}
function signalLabel(signal: string) {
  switch (signal) {
    case "strong_buy": return "強力做多";
    case "buy": return "偏多操作";
    case "neutral": return "觀望";
    case "sell": return "偏空操作";
    case "strong_sell": return "強力做空";
    default: return signal;
  }
}
function signalIcon(signal: string) {
  if (signal === "buy" || signal === "strong_buy") return TrendingUp;
  if (signal === "sell" || signal === "strong_sell") return TrendingDown;
  return Minus;
}

export function SignalCard({ signal }: { signal: DayTradeSignal }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = signalIcon(signal.overallSignal);
  const isUp = signal.change >= 0;
  const borderColor = signal.overallSignal.includes("buy") ? "border-l-emerald-500" : signal.overallSignal.includes("sell") ? "border-l-red-500" : "border-l-gray-400";

  return (
    <motion.div variants={fadeUp}>
      <Card
        className={`relative overflow-hidden border-l-4 ${borderColor} cursor-pointer transition-all duration-200 hover:ring-1 hover:ring-primary/20`}
        onClick={() => setExpanded(!expanded)}
        data-testid={`signal-card-${signal.ticker}`}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold tabular-nums px-1.5 py-0.5 rounded bg-primary/10 text-primary">{signal.ticker}</span>
              <span className="font-semibold text-sm">{signal.stockName}</span>
            </div>
            <div className="flex items-center gap-2">
              <ScoreRing score={signal.dayTradeScore} size={44} />
              <Badge className={`gap-1 ${signalBg(signal.overallSignal)} ${signalColor(signal.overallSignal)} border`}>
                <Icon className="w-3 h-3" />
                {signalLabel(signal.overallSignal)}
              </Badge>
            </div>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-lg font-bold tabular-nums">{signal.price.toLocaleString()}</span>
            <span className={`text-xs font-semibold tabular-nums ${isUp ? "text-emerald-500" : "text-red-500"}`}>
              {isUp ? "+" : ""}{signal.change.toFixed(2)} ({isUp ? "+" : ""}{signal.changePercent.toFixed(2)}%)
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-muted-foreground mb-2">
            <span>開 {signal.open.toLocaleString()}</span>
            <span>高 {signal.dayHigh.toLocaleString()}</span>
            <span>低 {signal.dayLow.toLocaleString()}</span>
            <span>量 {signal.volume >= 1_000_000 ? `${(signal.volume / 1_000_000).toFixed(1)}M` : `${(signal.volume / 1_000).toFixed(0)}K`}</span>
            <span>振幅 {signal.amplitude.toFixed(2)}%</span>
            <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={spring} className="ml-auto">
              <ChevronDown className="w-3.5 h-3.5" />
            </motion.div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {signal.indicators.map((ind, i) => (
              <IndicatorBadge key={i} indicator={ind} />
            ))}
          </div>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="tabular-nums">{signal.dayLow.toLocaleString()}</span>
                    <div className="flex-1 h-1.5 bg-muted/50 rounded-full relative overflow-hidden">
                      {(() => {
                        const range = signal.dayHigh - signal.dayLow;
                        const pos = range ? ((signal.price - signal.dayLow) / range) * 100 : 50;
                        return (
                          <>
                            <div className="absolute h-full bg-gradient-to-r from-red-400/60 via-gray-300/40 to-emerald-400/60 rounded-full w-full" />
                            <div className="absolute w-2 h-2 bg-foreground rounded-full top-1/2 -translate-y-1/2 shadow-sm" style={{ left: `calc(${pos}% - 4px)` }} />
                          </>
                        );
                      })()}
                    </div>
                    <span className="tabular-nums">{signal.dayHigh.toLocaleString()}</span>
                    <span className="text-muted-foreground/60">今日區間</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground">分析摘要</span>
                    {signal.reasons.map((r, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs">
                        <ChevronRight className="w-3 h-3 mt-0.5 text-primary/60 shrink-0" />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </motion.div>
  );
}
