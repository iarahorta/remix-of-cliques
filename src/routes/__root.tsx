import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-[#0b3d91]">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-slate-800">Página não encontrada</h2>
        <p className="mt-2 text-sm text-slate-500">A página que você procura não existe.</p>
        <Link to="/" className="mt-6 inline-flex items-center justify-center rounded-md bg-[#0b3d91] px-5 py-2.5 text-sm font-semibold text-white">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-slate-800">Algo deu errado</h1>
        <p className="mt-2 text-sm text-slate-500">Tente novamente em instantes.</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-md bg-[#0b3d91] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "zpclik — Encurtador de Links Inteligente" },
      { name: "description", content: "Encurte links, acompanhe acessos reais e distribua tráfego com rotação inteligente." },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "zpclik — Encurtador de Links Inteligente" },
      { name: "twitter:title", content: "zpclik — Encurtador de Links Inteligente" },
      { property: "og:description", content: "Encurte links, acompanhe acessos reais e distribua tráfego com rotação inteligente." },
      { name: "twitter:description", content: "Encurte links, acompanhe acessos reais e distribua tráfego com rotação inteligente." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e41a3f2b-6133-4a3f-beb8-65b284f9ca3e/id-preview-0215fae2--9c2f61df-dff7-4c0e-8f62-456fff6d20db.lovable.app-1782495129187.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e41a3f2b-6133-4a3f-beb8-65b284f9ca3e/id-preview-0215fae2--9c2f61df-dff7-4c0e-8f62-456fff6d20db.lovable.app-1782495129187.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      // Visitor ID persistente (90 dias)
      let vid: string = localStorage.getItem("zpk_vid") ?? "";
      if (!vid) {
        vid = (crypto as any).randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem("zpk_vid", vid);
      }
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref && /^[A-Za-z0-9_-]{4,24}$/.test(ref)) {
        const existing = localStorage.getItem("zpk_ref");
        // First-touch: mantém a primeira atribuição
        if (!existing) {
          localStorage.setItem("zpk_ref", ref);
          localStorage.setItem("zpk_ref_at", String(Date.now()));
          // 90 dias
          document.cookie = `zpk_ref=${ref}; path=/; max-age=${60 * 60 * 24 * 90}; SameSite=Lax`;
          // Registra visita atribuída no servidor (fire-and-forget)
          const refVal = ref;
          const vidVal = vid;
          import("@/lib/partner-attribution.functions").then(({ trackReferralVisit }) => {
            trackReferralVisit({ data: {
              token: refVal,
              visitor_id: vidVal,
              landing_url: window.location.href,
              referer: document.referrer || undefined,
              utm_source: params.get("utm_source") || undefined,
              utm_medium: params.get("utm_medium") || undefined,
              utm_campaign: params.get("utm_campaign") || undefined,
              utm_content: params.get("utm_content") || undefined,
              utm_term: params.get("utm_term") || undefined,
            } }).catch(() => {});
          }).catch(() => {});
        }
      }
      // Expira zpk_ref após 90 dias
      const at = Number(localStorage.getItem("zpk_ref_at") ?? 0);
      if (at && Date.now() - at > 90 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem("zpk_ref");
        localStorage.removeItem("zpk_ref_at");
      }
    } catch {}
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
