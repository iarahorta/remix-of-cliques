import { createFileRoute } from "@tanstack/react-router";

function firstHeader(headers: Headers, names: string[]): string | null {
  for (const name of names) {
    const value = headers.get(name);
    if (value && value.trim()) return value.trim();
  }
  return null;
}

function cleanGeo(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return raw;
  }
}

export const Route = createFileRoute("/r/$slug")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const slug = (params.slug ?? "").trim().toLowerCase();
        if (!slug) return new Response("Not Found", { status: 404 });

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const h = request.headers;
        const ua = h.get("user-agent") || "";
        const isCrawler = /(facebookexternalhit|Facebot|WhatsApp|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|Pinterest|SkypeUriPreview|redditbot|Applebot|Googlebot|bingbot|embedly|vkShare|W3C_Validator|Iframely)/i.test(ua);
        if (isCrawler) {
          const url = new URL(request.url);
          const origin = url.origin;
          const title = "zpclik — Encurtador de Links Premium";
          const description = "Rotação inteligente, analytics reais e link de WhatsApp em segundos. R$ 19,90/mês.";
          const image = "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e41a3f2b-6133-4a3f-beb8-65b284f9ca3e/id-preview-0215fae2--9c2f61df-dff7-4c0e-8f62-456fff6d20db.lovable.app-1782495129187.png";
          const html = `<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8">
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="zpclik">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${image}">
<meta property="og:url" content="${origin}/">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">
</head><body></body></html>`;
          return new Response(html, {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
          });
        }

        const cf =
          ((request as any).cf as
            | {
                city?: string;
                region?: string;
                regionCode?: string;
                country?: string;
              }
            | undefined) || undefined;

        const { data, error } = await supabaseAdmin.rpc(
          "record_short_link_visit" as any,
          {
            _slug: slug,
            _ip: firstHeader(h, ["cf-connecting-ip", "x-real-ip"]) ||
              (h.get("x-forwarded-for") || "").split(",")[0].trim() ||
              null,
            _country: cleanGeo(firstHeader(h, ["cf-ipcountry", "x-vercel-ip-country"]) || cf?.country),
            _region: cleanGeo(firstHeader(h, ["cf-region", "x-vercel-ip-country-region"]) || cf?.region),
            _region_code: cleanGeo(firstHeader(h, ["cf-region-code", "x-vercel-ip-country-region"]) || cf?.regionCode),
            _city: cleanGeo(firstHeader(h, ["cf-ipcity", "x-vercel-ip-city"]) || cf?.city),
            _user_agent: ua || null,
            _referer: h.get("referer") || null,
          },
        );
        if (error || !data || !data[0]) {
          return new Response("Link não encontrado", { status: 404 });
        }
        const row = data[0] as { target: string | null; status: string };
        if (!row.target || row.status !== "active") {
          return new Response("Link não encontrado", { status: 404 });
        }
        const url = new URL(request.url);
        const fallback = `${url.origin}/`;
        const target = row.target && row.target.trim() ? row.target : fallback;

        return new Response(null, {
          status: 302,
          headers: {
            location: target,
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
