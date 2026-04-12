import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, TrendingUp, TrendingDown, Minus, ChevronRight, ShieldAlert } from "lucide-react";
import { ScoreRing } from "./ScoreRing";
import { IndicatorBadge } from "./IndicatorBadge";
import type { DayTradeSignal, TechnicalData } from "@shared/schema";

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

// ─── MA Alignment Pill ───────────────────────────────────────────────────────
function MaAlignmentPill({ alignment }: { alignment: TechnicalData["maAlignment"] }) {
  const map = {
    bullish: { label: "多頭排列", cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
    bearish: { label: "空頭排列", cls: "bg-red-500/10 text-red-500 border-red-500/20" },
    mixed: { label: "均線混排", cls: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
  };
  const { label, cls } = map[alignment];
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${cls}`}>{label}</span>
  );
}

// ─── Technical Panel ─────────────────────────────────────────────────────────
function TechCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] text-muted-foreground">{label}</span>
      <span className={`text-[11px] font-bold tabular-nums ${color ?? ""}`}>{value}</span>
    </div>
  );
}

function TechnicalPanel({ td, currentPrice }: { td: TechnicalData; currentPrice: number }) {
  const kdColor = td.kdSignal === "golden_cross" ? "text-emerald-500"
    : td.kdSignal === "death_cross" ? "text-red-500"
      : td.kdSignal === "overbought" ? "text-orange-400"
        : td.kdSignal === "oversold" ? "text-sky-400"
          : "";

  const rsiColor = td.rsiSignal === "overbought" ? "text-orange-400"
    : td.rsiSignal === "oversold" ? "text-sky-400"
      : td.rsi && td.rsi > 50 ? "text-emerald-500" : "text-red-400";

  const macdColor = td.macdSignal === "golden_cross" || td.macdSignal === "bullish"
    ? "text-emerald-500" : "text-red-400";

  return (
    <div className="space-y-2 mt-3">
      {/* 均線 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">均線</span>
          <MaAlignmentPill alignment={td.maAlignment} />
        </div>
        <div className="grid grid-cols-3 gap-2 p-2 bg-muted/20 rounded-lg border border-border/40">
          <TechCell
            label="MA5"
            value={td.ma5?.toFixed(2) ?? "--"}
            color={td.ma5 && currentPrice > td.ma5 ? "text-emerald-500" : "text-red-400"}
          />
          <TechCell
            label="MA20"
            value={td.ma20?.toFixed(2) ?? "--"}
            color={td.ma20 && currentPrice > td.ma20 ? "text-emerald-500" : "text-red-400"}
          />
          <TechCell
            label="MA60"
            value={td.ma60?.toFixed(2) ?? "--"}
            color={td.ma60 && currentPrice > td.ma60 ? "text-emerald-500" : "text-red-400"}
          />
        </div>
      </div>

      {/* KD / RSI / MACD */}
      <div>
        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">動能指標</span>
        <div className="grid grid-cols-3 gap-2 p-2 mt-1 bg-muted/20 rounded-lg border border-border/40">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] text-muted-foreground">KD (9)</span>
            <span className={`text-[11px] font-bold tabular-nums ${kdColor}`}>
              K:{td.k?.toFixed(1) ?? "--"} D:{td.d?.toFixed(1) ?? "--"}
            </span>
            {td.kdOblique && (
              <span className="text-[8px] text-orange-400 font-semibold">⚠ 鈍化</span>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] text-muted-foreground">RSI (14)</span>
            <span className={`text-[11px] font-bold tabular-nums ${rsiColor}`}>
              {td.rsi?.toFixed(1) ?? "--"}
            </span>
            {td.rsiOblique && (
              <span className="text-[8px] text-orange-400 font-semibold">⚠ 鈍化</span>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] text-muted-foreground">MACD Hist</span>
            <span className={`text-[11px] font-bold tabular-nums ${macdColor}`}>
              {td.macdHistogram != null
                ? `${td.macdHistogram > 0 ? "+" : ""}${td.macdHistogram.toFixed(3)}`
                : "--"}
            </span>
          </div>
        </div>
      </div>

      {/* 量能 */}
      <div className="flex items-center gap-3 text-[10px]">
        <span className="text-muted-foreground">量比</span>
        <span className={`font-bold tabular-nums ${td.volumeRatio > 1.2 ? "text-emerald-500" : td.volumeRatio < 0.7 ? "text-muted-foreground" : ""}`}>
          {td.volumeRatio.toFixed(2)}x
        </span>
        <span className="text-muted-foreground">20日均量</span>
        <span className="font-semibold tabular-nums">
          {td.avgVolume20 >= 1_000_000
            ? `${(td.avgVolume20 / 1_000_000).toFixed(1)}M`
            : `${(td.avgVolume20 / 1_000).toFixed(0)}K`}
        </span>
      </div>

      {/* 停損建議 */}
      {td.stopLoss && (
        <div className="flex items-start gap-2 p-2 bg-destructive/5 border border-destructive/20 rounded-lg">
          <ShieldAlert className="w-3.5 h-3.5 text-destructive/70 shrink-0 mt-0.5" />
          <div>
            <p className="text-[9px] font-bold text-destructive/70 mb-0.5">建議停損</p>
            <p className="text-[10px] text-muted-foreground">{td.stopLossReason}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Signal Card ─────────────────────────────────────────────────────────────
export function SignalCard({ signal }: { signal: DayTradeSignal }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = signalIcon(signal.overallSignal);
  const isUp = signal.change >= 0;
  const borderColor = signal.overallSignal.includes("buy")
    ? "border-l-emerald-500"
    : signal.overallSignal.includes("sell")
      ? "border-l-red-500"
      : "border-l-gray-400";

  const td = signal.technicalData;

  return (
    <motion.div variants={fadeUp}>
      <Card
        className={`relative overflow-hidden border-l-4 ${borderColor} cursor-pointer transition-all duration-200 hover:ring-1 hover:ring-primary/20`}
        onClick={() => setExpanded(!expanded)}
        data-testid={`signal-card-${signal.ticker}`}
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold tabular-nums px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                {signal.ticker}
              </span>
              <span className="font-semibold text-sm">{signal.stockName}</span>
              {td && <MaAlignmentPill alignment={td.maAlignment} />}
            </div>
            <div className="flex items-center gap-2">
              <ScoreRing score={signal.dayTradeScore} size={44} />
              <Badge className={`gap-1 ${signalBg(signal.overallSignal)} ${signalColor(signal.overallSignal)} border`}>
                <Icon className="w-3 h-3" />
                {signalLabel(signal.overallSignal)}
              </Badge>
            </div>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-lg font-bold tabular-nums">{signal.price.toLocaleString()}</span>
            <span className={`text-xs font-semibold tabular-nums ${isUp ? "text-emerald-500" : "text-red-500"}`}>
              {isUp ? "+" : ""}{signal.change.toFixed(2)} ({isUp ? "+" : ""}{signal.changePercent.toFixed(2)}%)
            </span>
            {td?.rsi !== null && td?.rsi !== undefined && (
              <span className={`text-[10px] tabular-nums ml-1 ${td.rsiSignal === "overbought" ? "text-orange-400" : td.rsiSignal === "oversold" ? "text-sky-400" : "text-muted-foreground"}`}>
                RSI {td.rsi.toFixed(1)}
              </span>
            )}
          </div>

          {/* OHLCV row */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-2 flex-wrap">
            <span>開 {signal.open.toLocaleString()}</span>
            <span>高 {signal.dayHigh.toLocaleString()}</span>
            <span>低 {signal.dayLow.toLocaleString()}</span>
            <span>量 {signal.volume >= 1_000_000 ? `${(signal.volume / 1_000_000).toFixed(1)}M` : `${(signal.volume / 1_000).toFixed(0)}K`}</span>
            <span>振幅 {signal.amplitude.toFixed(2)}%</span>
            {td && (
              <span className={`font-semibold ${td.volumeRatio > 1.2 ? "text-emerald-500" : ""}`}>
                量比 {td.volumeRatio.toFixed(2)}x
              </span>
            )}
            <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={spring} className="ml-auto">
              <ChevronDown className="w-3.5 h-3.5" />
            </motion.div>
          </div>

          {/* Indicator badges */}
          <div className="flex flex-wrap gap-1.5">
            {signal.indicators.slice(0, 5).map((ind, i) => (
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
                <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                  {/* Price range bar */}
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

                  {/* Technical data panel */}
                  {td && <TechnicalPanel td={td} currentPrice={signal.price} />}

                  {/* Reasons */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground">組合訊號分析</span>
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
