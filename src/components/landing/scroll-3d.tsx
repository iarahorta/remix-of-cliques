import { useEffect, useRef, type ReactNode, type CSSProperties } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** intensity multiplier */
  intensity?: number;
  /** rotate axis bias: 'x' tilts forward/back, 'y' tilts left/right, 'mix' both */
  axis?: "x" | "y" | "mix";
  /** stagger delay in ms for layout siblings */
  delay?: number;
  style?: CSSProperties;
};

/**
 * Wraps children with a scroll-linked 3D tilt + parallax.
 * Uses requestAnimationFrame + getBoundingClientRect; respects prefers-reduced-motion.
 * Fully mobile-friendly (no pointer/hover dependency).
 */
export function Scroll3D({ children, className, intensity = 1, axis = "mix", delay = 0, style }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      el.style.opacity = "1";
      el.style.transform = "none";
      return;
    }

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // -1 (above viewport) → 0 (centered) → 1 (below viewport)
      const center = rect.top + rect.height / 2;
      const progress = Math.max(-1.2, Math.min(1.2, (center - vh / 2) / (vh / 2 + rect.height / 2)));
      const visible = rect.top < vh && rect.bottom > 0;
      const enter = Math.max(0, Math.min(1, 1 - Math.abs(progress) * 0.9));
      const opacity = visible ? 0.35 + enter * 0.65 : 0;

      const rx = axis === "y" ? 0 : -progress * 14 * intensity;
      const ry = axis === "x" ? 0 : progress * 10 * intensity;
      const ty = progress * 30 * intensity;
      const scale = 0.94 + enter * 0.06;

      el.style.opacity = String(opacity);
      el.style.transform =
        `perspective(1200px) translate3d(0, ${ty.toFixed(2)}px, 0) ` +
        `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
    };

    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [axis, intensity]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        transformStyle: "preserve-3d",
        willChange: "transform, opacity",
        transition: `transform 120ms linear, opacity 200ms linear`,
        transitionDelay: `${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
