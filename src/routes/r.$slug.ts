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
            _user_agent: h.get("user-agent") || null,
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
