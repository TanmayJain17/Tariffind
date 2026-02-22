import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}

export function AnimatedNumber({ value, prefix = "", suffix = "", decimals = 2, duration = 1200, className = "" }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);
  const startTime = useRef<number>(0);

  useEffect(() => {
    const start = ref.current;
    const diff = value - start;
    startTime.current = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + diff * eased;
      setDisplay(current);
      ref.current = current;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
  }, [value, duration]);

  return (
    <span className={`font-mono ${className}`}>
      {prefix}{display.toFixed(decimals)}{suffix}
    </span>
  );
}
