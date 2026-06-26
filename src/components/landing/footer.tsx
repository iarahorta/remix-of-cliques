import { Link } from "@tanstack/react-router";
import { WHATSAPP_URL } from "./whatsapp-fab";

export function LandingFooter() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="card-premium p-10 sm:p-14 text-center bg-gradient-to-br from-[oklch(0.2_0.03_60)] to-[oklch(0.12_0.02_50)]">
          <h2 className="font-display text-3xl sm:text-4xl">
            Pronto para <span className="text-gold-gradient">disparar com performance</span>?
          </h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-xl mx-auto">
            Fale com um consultor agora e receba uma estratégia sob medida para o seu nicho.
          </p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-gold-metal px-8 py-3.5 text-sm font-semibold hover:scale-[1.02] transition-transform"
          >
            Falar com Consultor
          </a>
        </div>
      </section>

      <footer className="border-t border-[oklch(0.3_0.04_60_/_0.4)] mt-8">
        <div className="mx-auto max-w-6xl px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} HS Assessoria. Todos os direitos reservados.</p>
          <Link to="/login" className="hover:text-gold-gradient transition-colors">
            Acessar Painel
          </Link>
        </div>
      </footer>
    </>
  );
}
