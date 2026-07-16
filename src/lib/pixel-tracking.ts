import { useEffect, useRef } from "react";
import { isMetaPixelEnabled, trackEvent } from "./meta-pixel";

/**
 * Rastreamento avançado do Meta Pixel — cliques, tempo, scroll e
 * visualização de seções. Todo no-op silencioso quando o Pixel não
 * está configurado (VITE_META_PIXEL_ID ausente).
 */

function fire(name: string, params?: Record<string, any>) {
  if (!isMetaPixelEnabled()) return;
  try {
    trackEvent(name, params);
  } catch {
    /* noop */
  }
}

/**
 * Clique em botão/CTA. Dispara dois eventos:
 *  - `ButtonClick` genérico (para dashboards)
 *  - `{Name}_Click` custom (para públicos personalizados)
 */
export function trackClick(name: string, extra?: Record<string, any>) {
  const safe = name.replace(/\s+/g, "_");
  fire("ButtonClick", { button: name, ...(extra ?? {}) });
  fire(`${safe}_Click`, extra);
}

/**
 * Dispara `{Name}_View` UMA ÚNICA VEZ quando o elemento entra na
 * viewport (>=50% visível).
 */
export function useSectionView<T extends HTMLElement = HTMLElement>(name: string) {
  const ref = useRef<T | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isMetaPixelEnabled()) return;
    const el = ref.current;
    if (!el || firedRef.current) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !firedRef.current) {
            firedRef.current = true;
            const safe = name.replace(/\s+/g, "_");
            fire(`${safe}_View`, { section: name });
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [name]);

  return ref;
}

/** Dispara `Scroll_25/50/75/90` uma vez cada durante a sessão. */
export function useScrollDepth() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isMetaPixelEnabled()) return;
    const fired = new Set<number>();
    const marks = [25, 50, 75, 90];

    const onScroll = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const height = doc.scrollHeight - window.innerHeight;
      if (height <= 0) return;
      const pct = Math.min(100, Math.round((scrollTop / height) * 100));
      for (const m of marks) {
        if (pct >= m && !fired.has(m)) {
          fired.add(m);
          fire(`Scroll_${m}`, { depth: m });
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
}

/** Dispara `Time_15s/30s/60s/120s/300s` conforme o usuário permanece. */
export function useTimeOnPage() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isMetaPixelEnabled()) return;
    const marks = [15, 30, 60, 120, 300];
    const timers = marks.map((s) =>
      window.setTimeout(() => fire(`Time_${s}s`, { seconds: s }), s * 1000),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);
}
