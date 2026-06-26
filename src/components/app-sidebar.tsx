import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard, Send, Wallet, History, LogOut, Menu,
  Tags, FileText, Link2, Users, ShieldCheck, FileSpreadsheet, ClipboardList,
  Plug, MessageSquareText, LayoutTemplate,
} from "lucide-react";
import logoAsset from "@/assets/hs-logo.png.asset.json";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const clientItems = [
  { title: "Dashboard", url: "/painel", icon: LayoutDashboard },
  { title: "Nova Campanha", url: "/nova-campanha", icon: Send },
  { title: "Recarga", url: "/recarga", icon: Wallet },
  { title: "Histórico", url: "/historico", icon: History },
];

type AdminItem = { title: string; url: string; icon: any; permission?: string };
const adminItems: AdminItem[] = [
  { title: "Pedidos", url: "/admin/pedidos", icon: ClipboardList, permission: "view_all_campaigns" },
  { title: "Encurtador", url: "/encurtador", icon: Link2, permission: "view_all_campaigns" },
  { title: "Landing (Planos)", url: "/admin/landing", icon: LayoutTemplate, permission: "manage_pricing" },
  { title: "Valores", url: "/admin/valores", icon: Tags, permission: "manage_pricing" },
  { title: "Templates", url: "/admin/templates", icon: FileText, permission: "edit_templates" },
  { title: "WhatsApp Templates", url: "/admin/wa-templates", icon: MessageSquareText, permission: "manage_infobip" },
  { title: "Infobip", url: "/admin/infobip", icon: Plug, permission: "manage_infobip" },
  { title: "Usuários", url: "/admin/usuarios", icon: Users, permission: "manage_users" },
  { title: "Todas Campanhas", url: "/admin/campanhas", icon: ShieldCheck, permission: "view_all_campaigns" },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const { user, isAdmin, isSuperAdmin, hasPermission } = useAuth();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onNavigate?.();
    navigate({ to: "/login", replace: true });
  };

  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();
  const visibleAdminItems = adminItems.filter((i) => isAdmin || hasPermission(i.permission as any));
  const showAdminSection = visibleAdminItems.length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center">
        <img
          src={logoAsset.url}
          alt="HS Assessoria"
          className="w-24 h-24 md:w-32 md:h-32 object-contain drop-shadow-[0_6px_24px_rgba(200,150,80,0.45)]"
        />
        <div className="mt-4 flex flex-col items-center leading-none">
          <span className="font-display text-4xl md:text-5xl tracking-[0.2em] text-gold-gradient font-semibold">HS</span>
          <span className="mt-2 font-display text-base md:text-lg tracking-[0.42em] text-gold-gradient/90 font-medium">ASSESSORIA</span>
        </div>
        <div className="mt-4 h-px w-3/4 bg-gradient-to-r from-transparent via-[oklch(0.6_0.12_55)] to-transparent" />
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
        {clientItems.map((item) => (
          <NavItem key={item.url} {...item} active={pathname === item.url} onClick={onNavigate} />
        ))}
        {hasPermission("use_hygiene_tool") && (
          <NavItem title="Higienização" url="/higienizacao" icon={FileSpreadsheet} active={pathname === "/higienizacao"} onClick={onNavigate} />
        )}

        {showAdminSection && (
          <>
            <p className="mt-6 mb-2 px-4 text-[10px] uppercase tracking-[0.2em] text-[oklch(0.6_0.1_60)]">
              {isSuperAdmin ? "Admin-chefe" : isAdmin ? "Admin" : "Acesso"}
            </p>
            {visibleAdminItems.map((item) => (
              <NavItem key={item.url} {...item} active={pathname === item.url} onClick={onNavigate} />
            ))}
          </>
        )}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-sidebar-accent/40">
          <div className="h-9 w-9 shrink-0 rounded-full bg-gold-metal flex items-center justify-center text-xs font-bold">{initials}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{isSuperAdmin ? "Admin-chefe" : isAdmin ? "Admin" : showAdminSection ? "Equipe" : "Cliente"}</p>
            <p className="text-sm text-foreground truncate">{user?.email ?? "—"}</p>
          </div>
          <button onClick={handleSignOut} aria-label="Sair" className="p-2 rounded-md hover:bg-sidebar-accent text-[oklch(0.75_0.12_70)] hover:text-[oklch(0.85_0.14_75)] transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar() {
  return (
    <aside className="hidden md:flex md:flex-col w-72 shrink-0 bg-sidebar border-r border-sidebar-border min-h-screen sticky top-0">
      <SidebarContent />
    </aside>
  );
}

export function MobileTopBar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="md:hidden sticky top-0 z-40 flex items-center justify-between gap-3 px-4 h-14 bg-sidebar/95 backdrop-blur border-b border-sidebar-border">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button aria-label="Abrir menu" className="p-2 -ml-2 rounded-md hover:bg-sidebar-accent text-[oklch(0.8_0.12_70)]">
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-72 bg-sidebar border-sidebar-border">
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex items-center gap-2 min-w-0">
        <img src={logoAsset.url} alt="HS" className="h-8 w-8 object-contain shrink-0" />
        <span className="font-display text-lg tracking-[0.25em] text-gold-gradient font-semibold">HS</span>
      </div>
      <div className="w-9" />
    </header>
  );
}

function NavItem({ url, title, icon: Icon, active, onClick }: { url: string; title: string; icon: any; active: boolean; onClick?: () => void }) {
  return (
    <Link
      to={url}
      onClick={onClick}
      className={`group flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${
        active ? "bg-gold-metal font-semibold" : "text-sidebar-foreground hover:bg-sidebar-accent hover:translate-x-0.5"
      }`}
    >
      <Icon className={`h-4 w-4 ${active ? "" : "text-[oklch(0.7_0.1_65)]"}`} />
      <span className="tracking-wide">{title}</span>
    </Link>
  );
}
