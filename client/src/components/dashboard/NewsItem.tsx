import { Badge } from "@/components/ui/badge";
import { Newspaper, Globe, BarChart3, Building2, Landmark, AlertTriangle, Cpu, ExternalLink } from "lucide-react";
import { SentimentBadge } from "./SentimentBadge";
import type { StockNews } from "@shared/schema";

const categoryIcons: Record<string, any> = {
  geopolitics: Globe,
  earnings: BarChart3,
  industry: Building2,
  macro: Landmark,
  policy: AlertTriangle,
  tech: Cpu,
};

const categoryLabels: Record<string, string> = {
  geopolitics: "地緣政治",
  earnings: "財報",
  industry: "產業動態",
  macro: "總經",
  policy: "政策",
  tech: "科技趨勢",
};

export function NewsItem({ news, compact = false }: { news: StockNews; compact?: boolean }) {
  const CategoryIcon = categoryIcons[news.category] || Newspaper;
  return (
    <div className={`group ${compact ? "py-2" : "p-3.5 bg-card/60 backdrop-blur-sm rounded-lg border border-border/40 hover:border-border/70 transition-colors"}`} data-testid={`news-item-${news.id}`}>
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 p-1 rounded bg-muted/50">
          <CategoryIcon className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <span className={`font-medium leading-snug ${compact ? "text-xs" : "text-sm"}`}>{news.headline}</span>
          {!compact && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{news.summary}</p>}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{news.ticker} {news.stockName.split(" ")[0]}</Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{categoryLabels[news.category] || news.category}</Badge>
            <SentimentBadge sentiment={news.sentiment} score={news.sentimentScore} />
            {!compact && (
              news.sourceUrl ? (
                <a href={news.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-[10px] text-primary/70 hover:text-primary transition-colors hover:underline" data-testid={`link-source-${news.id}`}>
                  {news.source}<ExternalLink className="w-2.5 h-2.5" />
                </a>
              ) : (
                <span className="text-[10px] text-muted-foreground">{news.source}</span>
              )
            )}
          </div>
          {!compact && news.sentimentReason && (
            <p className="text-xs text-muted-foreground mt-1.5 italic border-l-2 border-primary/30 pl-2">{news.sentimentReason}</p>
          )}
        </div>
      </div>
    </div>
  );
}
