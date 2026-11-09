import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyContext, hasRole, ROLE_LABELS } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { NotificationLink } from "@/components/NotificationLink";
import { FileText, Inbox, Package, LayoutDashboard, Settings, Users, LogOut, Zap, ScrollText, Warehouse } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: AppShell,
});

function AppShell() {
  const { data: ctx } = useMyContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isAdmin = hasRole(ctx, "admin");

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const link = "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent";
  const active = { className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" };

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="bg-sidebar md:w-64 md:shrink-0">
        <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-sidebar-primary text-sidebar-primary-foreground">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-sidebar-accent-foreground">Baza Materiale</p>
            <p className="text-[11px] text-sidebar-foreground/70">ShT Elektrike “Gjergj Canco”</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto p-3 md:flex-col">
          <Link to="/paneli" className={link} activeProps={active}><LayoutDashboard className="h-4 w-4" />Paneli</Link>
          <NotificationLink />
          <Link to="/katalogu" className={link} activeProps={active}><Package className="h-4 w-4" />Katalogu</Link>
          <Link to="/kerkesat" search={{ statusi: "" }} className={link} activeProps={active} activeOptions={{ includeSearch: false }}><FileText className="h-4 w-4" />Kërkesat</Link>
          {isAdmin && <Link to="/kerkesat" search={{ statusi: "derguar" }} className={link}><Inbox className="h-4 w-4" />Për miratim</Link>}
          {(isAdmin || hasRole(ctx, "magazinier") || hasRole(ctx, "shef_departamenti")) && <Link to="/magazina" className={link} activeProps={active}><Warehouse className="h-4 w-4" />Magazina</Link>}
          <Link to="/raportet" className={link} activeProps={active}><FileText className="h-4 w-4" />Raportet Excel</Link>
          {isAdmin && (
            <>
              <Link to="/importe" className={link} activeProps={active}><Inbox className="h-4 w-4" />Importet Excel</Link>
              <Link to="/konfigurim/$seksioni" params={{ seksioni: "vitet" }} className={link} activeProps={active}><Settings className="h-4 w-4" />Konfigurimi</Link>
              <Link to="/perdoruesit" className={link} activeProps={active}><Users className="h-4 w-4" />Përdoruesit</Link>
              <Link to="/auditimi" className={link} activeProps={active}><ScrollText className="h-4 w-4" />Auditimi</Link>
            </>
          )}
        </nav>
        <div className="hidden border-t border-sidebar-border p-4 md:block">
          <p className="truncate text-xs text-sidebar-foreground">{ctx?.email}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {ctx?.roles.map((r, i) => (
              <span key={i} className="rounded bg-sidebar-accent px-1.5 py-0.5 text-[10px] text-sidebar-accent-foreground">
                {ROLE_LABELS[r.role]}{r.department ? ` · ${r.department}` : ""}
              </span>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="mt-3 w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <LogOut className="mr-2 h-4 w-4" />Dil
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mb-4 flex justify-end md:hidden">
          <Button variant="outline" size="sm" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Dil</Button>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
