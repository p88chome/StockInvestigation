import { useState, useEffect, useRef } from "react";

export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    const start = prev.current;
    const diff = value - start;
    const dur = 600;
    const t0 = performance.now();
    function tick(now: number) {
      const p = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(start + diff * e));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    prev.current = value;
  }, [value]);
  return <span className={className}>{display}</span>;
}
