import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { SentimentBadge } from "./SentimentBadge";
import type { XPost } from "@shared/schema";

export function XPostCard({ post }: { post: XPost }) {
  const tickers: string[] = (() => {
    try { return JSON.parse(post.relatedTickers); } catch { return []; }
  })();
  return (
    <div className="p-3.5 bg-card/60 backdrop-blur-sm rounded-lg border border-border/40 hover:border-border/70 transition-colors" data-testid={`xpost-${post.id}`}>
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-primary" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold">{post.author}</span>
            <span className="text-[10px] text-muted-foreground">{post.authorHandle}</span>
            <span className="text-[10px] text-muted-foreground ml-auto">
              {(() => {
                try {
                  const d = new Date(post.postedAt);
                  const now = new Date();
                  const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
                  if (diff < 0) return "剛剛";
                  if (diff < 60) return `${diff}分鐘前`;
                  if (diff < 1440) return `${Math.floor(diff / 60)}小時前`;
                  return d.toLocaleDateString("zh-TW");
                } catch { return ""; }
              })()}
            </span>
          </div>
          <p className="text-xs leading-relaxed mb-2 whitespace-pre-wrap">{post.content}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {tickers.map((t) => (
              <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">{t}</Badge>
            ))}
            <SentimentBadge sentiment={post.sentiment} score={post.sentimentScore} />
            {post.postUrl && (
              <a href={post.postUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary/70 hover:text-primary transition-colors hover:underline ml-auto">
                查看原文<ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
