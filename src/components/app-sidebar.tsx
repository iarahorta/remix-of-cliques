import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
// (line 1 kept)
import { Link2, LogOut, Menu, Settings, Sparkles, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { title: "Encurtador", url: "/encurtador", icon: Link2 },
  { title: "Assinantes", url: "/assinantes", icon: Users },
  { title: "Configurações Asaas", url: "/configuracoes/asaas", icon: Settings },
] as const;

function Brand() {
  return (
    <div className="flex items-center gap-2 font-semibold tracking-tight text-slate-800">
      <div className="h-8 w-8 rounded-md bg-[#0b3d91] text-white flex items-center justify-center">
        <Sparkles className="h-4 w-4" />
      </div>
      <span className="text-lg">cliques</span>
    </div>
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
    <div className="flex flex-col h-full bg-white">
      <div className="px-6 pt-6 pb-4 border-b border-slate-200">
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
                  ? "bg-[#0b3d91] text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-200">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50">
          <div className="h-9 w-9 shrink-0 rounded-full bg-[#0b3d91] text-white flex items-center justify-center text-xs font-bold">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500">{role}</p>
            <p className="text-sm text-slate-800 truncate">{user?.email ?? "—"}</p>
          </div>
          <button
            onClick={handleSignOut}
            aria-label="Sair"
            className="p-2 rounded-md hover:bg-slate-200 text-slate-500 transition-colors"
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
    <aside className="hidden md:flex md:flex-col w-64 shrink-0 border-r border-slate-200 min-h-screen sticky top-0">
      <SidebarContent />
    </aside>
  );
}

export function MobileTopBar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="md:hidden sticky top-0 z-40 flex items-center justify-between gap-3 px-4 h-14 bg-white border-b border-slate-200">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button aria-label="Abrir menu" className="p-2 -ml-2 rounded-md hover:bg-slate-100 text-slate-700">
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64 bg-white">
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <Brand />
      <div className="w-9" />
    </header>
  );
}
