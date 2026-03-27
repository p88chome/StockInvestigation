import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { AnimatedNumber } from "./AnimatedNumber";
import { TrendingUp } from "lucide-react";

const scaleIn = { hidden: { opacity: 0, scale: 0.96 }, show: { opacity: 1, scale: 1, transition: { type: "spring", damping: 30, stiffness: 200 } } };

export function KpiCard({ value, label, color, icon: Icon, testId }: { value: number; label: string; color: string; icon: typeof TrendingUp; testId: string }) {
  return (
    <motion.div variants={scaleIn}>
      <Card className="relative overflow-hidden p-4 text-center" data-testid={testId}>
        <div className="absolute right-2 top-2 opacity-[0.06]"><Icon className="w-12 h-12" /></div>
        <div className="relative">
          <div className={`text-3xl font-bold tabular-nums ${color}`}><AnimatedNumber value={value} /></div>
          <div className="text-xs text-muted-foreground mt-0.5 font-medium">{label}</div>
        </div>
      </Card>
    </motion.div>
  );
}
