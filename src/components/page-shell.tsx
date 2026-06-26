import type { ReactNode } from "react";

export function PageShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-6 md:py-12 w-full">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6 md:mb-8">
        <div className="min-w-0">
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl tracking-wide text-gold-gradient break-words">{title}</h2>
          {subtitle && <p className="mt-2 text-sm md:text-base text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap gap-2 md:gap-3">{actions}</div>
      </header>
      {children}
    </div>
  );
}
