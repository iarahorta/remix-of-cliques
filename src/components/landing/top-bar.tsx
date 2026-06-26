import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/hs-logo.png.asset.json";

export function LandingTopBar() {
  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-background/70 border-b border-[oklch(0.3_0.04_60_/_0.4)]">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-5 h-16">
        <Link to="/" className="flex items-center gap-3">
          <img src={logoAsset.url} alt="HS Assessoria" className="h-9 w-9 object-contain" />
          <span className="font-display text-lg tracking-[0.3em] text-gold-gradient font-semibold">HS</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <a href="#planos" className="hidden sm:inline text-muted-foreground hover:text-foreground transition-colors">Planos</a>
          <a href="#beneficios" className="hidden sm:inline text-muted-foreground hover:text-foreground transition-colors">Benefícios</a>
          <Link
            to="/login"
            className="rounded-md border border-[oklch(0.55_0.1_60_/_0.6)] px-4 py-1.5 text-xs font-semibold tracking-wider uppercase text-gold-gradient hover:bg-[oklch(0.2_0.03_60)] transition-colors"
          >
            Acessar Painel
          </Link>
        </nav>
      </div>
    </header>
  );
}
