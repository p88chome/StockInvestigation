import { motion } from "framer-motion";

export function SentimentBar({ score }: { score: number }) {
  const pct = ((score + 1) / 2) * 100;
  return (
    <div className="w-full h-1.5 bg-muted/50 rounded-full overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(5, pct)}%` }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        style={{
          background: score > 0.2 ? "linear-gradient(90deg, hsl(142 60% 40%), hsl(160 60% 45%))" : score < -0.2 ? "linear-gradient(90deg, hsl(0 72% 48%), hsl(10 72% 54%))" : "linear-gradient(90deg, hsl(220 10% 50%), hsl(220 10% 60%))",
        }}
      />
    </div>
  );
}
