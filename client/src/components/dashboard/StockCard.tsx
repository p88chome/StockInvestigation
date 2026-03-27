import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import { Sparkline } from "./Sparkline";
import { SentimentBadge } from "./SentimentBadge";
import { SentimentBar } from "./SentimentBar";
import { NewsItem } from "./NewsItem";
import type { StockSentimentSummary, StockQuote } from "@shared/schema";

const spring = { type: "spring" as const, damping: 30, stiffness: 200 };
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: spring },
};

function PriceDisplay({ quote }: { quote?: StockQuote }) {
  if (!quote || !quote.price) return null;
  const isUp = quote.change >= 0;
  return (
    <div className="flex items-baseline gap-2 mt-1.5 mb-1">
      <span className="text-lg font-bold tabular-nums">
        {quote.price.toLocaleString()}
      </span>
      <span className={`text-xs font-semibold tabular-nums ${isUp ? "text-emerald-500" : "text-red-500"}`}>
        {isUp ? "+" : ""}{quote.change.toFixed(2)} ({isUp ? "+" : ""}{quote.changePercent.toFixed(2)}%)
      </span>
    </div>
  );
}

function VolumeBadge({ volume }: { volume: number }) {
  if (!volume) return null;
  const formatted = volume >= 1_000_000
    ? `${(volume / 1_000_000).toFixed(1)}M`
    : volume >= 1_000
      ? `${(volume / 1_000).toFixed(0)}K`
      : volume.toString();
  return (
    <span className="text-[10px] text-muted-foreground tabular-nums">
      Vol {formatted}
    </span>
  );
}

export function StockCard({ stock, index }: { stock: StockSentimentSummary; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const sentimentGradient = stock.overallSentiment === "bullish" ? "from-emerald-500/8 to-transparent" : stock.overallSentiment === "bearish" ? "from-red-500/8 to-transparent" : "from-gray-500/5 to-transparent";
  const borderAccent = stock.overallSentiment === "bullish" ? "border-l-emerald-500" : stock.overallSentiment === "bearish" ? "border-l-red-500" : "border-l-gray-400";
  const sparkScores = stock.latestNews.map((n) => n.sentimentScore);

  return (
    <motion.div variants={fadeUp} custom={index}>
      <Card
        className={`relative overflow-hidden border-l-4 ${borderAccent} cursor-pointer transition-all duration-200 hover:ring-1 hover:ring-primary/20 bg-gradient-to-br ${sentimentGradient} backdrop-blur-sm`}
        onClick={() => setExpanded(!expanded)}
        data-testid={`card-stock-${stock.ticker}`}
      >
        <div className="absolute inset-0 bg-card/80 dark:bg-card/70 pointer-events-none" />
        <div className="relative p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold tabular-nums px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                {stock.ticker}
              </span>
              <span className="font-semibold text-sm">{stock.stockName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkline scores={sparkScores} />
              <SentimentBadge sentiment={stock.overallSentiment} score={stock.avgScore} />
            </div>
          </div>

          <PriceDisplay quote={stock.quote} />

          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-medium text-primary/80">{stock.signal}</span>
            <span className="text-xs text-muted-foreground">{stock.newsCount} 則相關新聞</span>
            {stock.quote && <VolumeBadge volume={stock.quote.volume} />}
            <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={spring} className="ml-auto">
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </motion.div>
          </div>

          <SentimentBar score={stock.avgScore} />

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
                  {stock.quote && stock.quote.dayLow > 0 && (
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2">
                      <span className="tabular-nums">{stock.quote.dayLow}</span>
                      <div className="flex-1 h-1 bg-muted/50 rounded-full relative overflow-hidden">
                        {(() => {
                          const range = stock.quote!.dayHigh - stock.quote!.dayLow;
                          const pos = range ? ((stock.quote!.price - stock.quote!.dayLow) / range) * 100 : 50;
                          return <div className="absolute h-full bg-primary/40 rounded-full" style={{ width: `${pos}%` }} />;
                        })()}
                      </div>
                      <span className="tabular-nums">{stock.quote.dayHigh}</span>
                      <span className="text-muted-foreground/60">今日區間</span>
                    </div>
                  )}
                  {stock.latestNews.map((news, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06, ...spring }}>
                      <NewsItem news={news} compact />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </motion.div>
  );
}
