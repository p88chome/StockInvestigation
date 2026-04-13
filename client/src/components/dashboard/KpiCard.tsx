import { motion } from "framer-motion";
import { AnimatedNumber } from "./AnimatedNumber";
import { TrendingUp } from "lucide-react";

const scaleIn = { hidden: { opacity: 0, scale: 0.94 }, show: { opacity: 1, scale: 1, transition: { type: "spring", damping: 30, stiffness: 200 } } };

const colorMap: Record<string, { border: string; bg: string; glow: string; text: string; icon: string }> = {
  "text-emerald-500": {
    border: "border-l-emerald-500/60",
    bg: "bg-emerald-500/[0.04]",
    glow: "shadow-[0_0_20px_hsl(142_60%_40%/0.10)]",
    text: "gradient-text-bull",
    icon: "text-emerald-500/20",
  },
  "text-gray-400": {
    border: "border-l-gray-400/40",
    bg: "bg-gray-400/[0.03]",
    glow: "",
    text: "text-gray-400",
    icon: "text-gray-400/15",
  },
  "text-red-500": {
    border: "border-l-red-500/60",
    bg: "bg-red-500/[0.04]",
    glow: "shadow-[0_0_20px_hsl(0_72%_51%/0.10)]",
    text: "gradient-text-bear",
    icon: "text-red-500/20",
  },
};

export function KpiCard({ value, label, color, icon: Icon, testId }: { value: number; label: string; color: string; icon: typeof TrendingUp; testId: string }) {
  const style = colorMap[color] ?? { border: "border-l-primary/50", bg: "bg-primary/[0.03]", glow: "", text: "text-primary", icon: "text-primary/20" };

  return (
    <motion.div variants={scaleIn}>
      <div
        className={`relative overflow-hidden rounded-xl border border-border/50 border-l-2 ${style.border} ${style.bg} ${style.glow} p-4 text-center transition-all duration-200 hover:border-border/80 cursor-default`}
        data-testid={testId}
      >
        {/* Large background icon */}
        <div className={`absolute right-1 top-1/2 -translate-y-1/2 ${style.icon}`}>
          <Icon className="w-14 h-14" />
        </div>
        <div className="relative">
          <div className={`text-3xl font-bold tabular-nums ${color === "text-gray-400" ? "text-gray-400" : ""}`}>
            {color !== "text-gray-400" ? (
              <span className={style.text}><AnimatedNumber value={value} /></span>
            ) : (
              <AnimatedNumber value={value} />
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1 font-medium tracking-wide uppercase">{label}</div>
        </div>
      </div>
    </motion.div>
  );
}
