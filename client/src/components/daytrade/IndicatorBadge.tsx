import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TechnicalIndicator } from "@shared/schema";

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

export function IndicatorBadge({ indicator }: { indicator: TechnicalIndicator }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs ${signalBg(indicator.signal)}`}>
          <span className="font-medium text-foreground/80">{indicator.name}</span>
          <span className={`font-semibold tabular-nums ${signalColor(indicator.signal)}`}>{indicator.value}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{indicator.description}</TooltipContent>
    </Tooltip>
  );
}
