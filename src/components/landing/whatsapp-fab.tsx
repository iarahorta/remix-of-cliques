import { MessageCircle } from "lucide-react";
import { trackEvent } from "@/lib/meta-pixel";
import { trackClick } from "@/lib/pixel-tracking";

const WHATSAPP_NUMBER = "5531975225821";
const WHATSAPP_MESSAGE = "Ola, venho do site e quero saber mais!";
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

export function WhatsAppFab() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      onClick={() => {
        trackClick("WhatsAppFAB");
        trackEvent("Lead", { content_name: "WhatsApp FAB", content_category: "WhatsApp" });
      }}

      className="fixed bottom-5 right-5 z-50 group"
    >
      <span className="absolute inset-0 rounded-full bg-[oklch(0.75_0.18_150)] opacity-60 animate-ping" />
      <span className="absolute -inset-1 rounded-full bg-[oklch(0.7_0.13_70_/_0.45)] blur-md" />
      <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[oklch(0.55_0.18_150)] text-white shadow-[0_8px_24px_oklch(0.55_0.18_150_/_0.55)] ring-1 ring-[oklch(0.75_0.13_70_/_0.6)] transition-transform group-hover:scale-105">
        <MessageCircle className="h-7 w-7" />
      </span>
    </a>
  );
}
