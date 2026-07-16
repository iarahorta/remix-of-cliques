/* global window, document */
const ENV_PIXEL_ID = (import.meta.env as any).VITE_META_PIXEL_ID as string | undefined;
// ID padrão do cliente HS (Meta Pixel). Pode ser sobrescrito via VITE_META_PIXEL_ID.
export const PIXEL_ID: string | undefined = ENV_PIXEL_ID || "914759281092030";

export function isMetaPixelEnabled(): boolean {
  return !!PIXEL_ID;
}

export function getPixelId(): string | undefined {
  return PIXEL_ID;
}

export function initMetaPixel(): void {
  if (!PIXEL_ID || typeof window === "undefined") return;
  if ((window as any).fbq) return; // already initialized

  (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");

  (window as any).fbq("init", PIXEL_ID);
  (window as any).fbq("track", "PageView");
}

const extraPixels = new Set<string>();

/**
 * Inicializa um Pixel adicional (ex.: Pixel do afiliado White Label).
 * Todos os `fbq('track', ...)` posteriores disparam em TODOS os pixels
 * inicializados — comportamento padrão do fbq.
 */
export function initExtraPixel(id: string): void {
  if (!id || typeof window === "undefined") return;
  const clean = String(id).trim();
  if (!clean) return;
  if (extraPixels.has(clean)) return;
  const fbq = (window as any).fbq as undefined | ((...a: any[]) => void);
  if (!fbq) return;
  fbq("init", clean);
  fbq("track", "PageView");
  extraPixels.add(clean);
}

const STANDARD_EVENTS = new Set([
  "PageView", "ViewContent", "Search", "AddToCart", "AddToWishlist",
  "InitiateCheckout", "AddPaymentInfo", "Purchase", "Lead",
  "CompleteRegistration", "Contact", "CustomizeProduct", "Donate",
  "FindLocation", "Schedule", "StartTrial", "SubmitApplication", "Subscribe",
]);

export function trackEvent(eventName: string, params?: Record<string, any>): void {
  if (typeof window === "undefined") return;
  const fbq = (window as any).fbq as undefined | ((...args: any[]) => void);
  if (!fbq) return;
  const method = STANDARD_EVENTS.has(eventName) ? "track" : "trackCustom";
  if (params) fbq(method, eventName, params);
  else fbq(method, eventName);
}

export function trackPageView(): void {
  trackEvent("PageView");
}
