import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export function SentimentBadge({ sentiment, score }: { sentiment: string; score: number }) {
  if (sentiment === "bullish") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1 backdrop-blur-sm" data-testid="badge-bullish">
        <TrendingUp className="w-3 h-3" />
        看漲 {score > 0 ? `+${score.toFixed(2)}` : score.toFixed(2)}
      </Badge>
    );
  }
  if (sentiment === "bearish") {
    return (
      <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20 gap-1 backdrop-blur-sm" data-testid="badge-bearish">
        <TrendingDown className="w-3 h-3" />
        看跌 {score.toFixed(2)}
      </Badge>
    );
  }
  return (
    <Badge className="bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20 gap-1 backdrop-blur-sm" data-testid="badge-neutral">
      <Minus className="w-3 h-3" />
      中性 {score.toFixed(2)}
    </Badge>
  );
}
