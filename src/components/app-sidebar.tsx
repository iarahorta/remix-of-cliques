import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Link2, LogOut, Menu, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import logoAsset from "@/assets/zpclik-logo.png.asset.json";

const navItems = [
  { title: "Encurtador", url: "/encurtador", icon: Link2 },
  { title: "Assinantes", url: "/assinantes", icon: Users },
] as const;

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <img src={logoAsset.url} alt="zpclik" className="h-9 w-9 rounded-md object-cover ring-1 ring-[oklch(0.5_0.1_80/_0.4)]" />
      <span className="font-display text-lg tracking-wide">
        <span className="text-gold-gradient">zp</span>
        <span className="text-foreground">clik</span>
      </span>
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const { user, isAdmin, isSuperAdmin } = useAuth();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onNavigate?.();
    navigate({ to: "/login", replace: true });
  };

  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();
  const role = isSuperAdmin ? "Admin-chefe" : isAdmin ? "Admin" : "Cliente";

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="px-6 pt-6 pb-4 border-b border-[oklch(0.32_0.04_80/_0.25)]">
        <Brand />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.url;
          return (
            <Link
              key={item.url}
              to={item.url}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-gold-metal text-[#1a1408] shadow-[0_4px_20px_-8px_rgba(212,165,55,0.6)]"
                  : "text-muted-foreground hover:bg-[oklch(0.22_0.012_60)] hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-[oklch(0.32_0.04_80/_0.25)]">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[oklch(0.2_0.012_60)]">
          <div className="h-9 w-9 shrink-0 rounded-full bg-gold-metal text-[#1a1408] flex items-center justify-center text-xs font-bold">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-[#f0c95a]">{role}</p>
            <p className="text-sm text-foreground truncate">{user?.email ?? "—"}</p>
          </div>
          <button
            onClick={handleSignOut}
            aria-label="Sair"
            className="p-2 rounded-md hover:bg-[oklch(0.28_0.02_70)] text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar() {
  return (
    <aside className="hidden md:flex md:flex-col w-64 shrink-0 border-r border-[oklch(0.32_0.04_80/_0.25)] min-h-screen sticky top-0">
      <SidebarContent />
    </aside>
  );
}

export function MobileTopBar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="md:hidden sticky top-0 z-40 flex items-center justify-between gap-3 px-4 h-14 bg-sidebar border-b border-[oklch(0.32_0.04_80/_0.25)]">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button aria-label="Abrir menu" className="p-2 -ml-2 rounded-md hover:bg-[oklch(0.22_0.012_60)] text-muted-foreground hover:text-foreground">
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64 bg-sidebar border-[oklch(0.32_0.04_80/_0.25)]">
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <Brand />
      <div className="w-9" />
    </header>
  );
}
