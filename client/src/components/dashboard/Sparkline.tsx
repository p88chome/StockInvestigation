export function Sparkline({ scores, width = 80, height = 28 }: { scores: number[]; width?: number; height?: number }) {
  if (scores.length < 2) return null;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const points = scores
    .map((s, i) => `${(i / (scores.length - 1)) * width},${height - ((s - min) / range) * (height - 4) - 2}`)
    .join(" ");
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const color = avg > 0.15 ? "var(--sparkline-bull)" : avg < -0.15 ? "var(--sparkline-bear)" : "var(--sparkline-neutral)";
  return (
    <svg width={width} height={height} className="shrink-0" aria-hidden>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
