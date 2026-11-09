import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyContext, hasRole, ROLE_LABELS } from "@/lib/auth";
import { dashboardQuery, recentRequestsQuery } from "@/lib/dashboard";
import { STATUS_LABELS, fmtDate } from "@/lib/requests";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Plus, PackageCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/paneli")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { title: "Paneli – Baza Materiale" }, { name: "description", content: "Kërkesat, miratimet dhe gjendja e materialeve sipas rolit tuaj." }, { property: "og:title", content: "Paneli – Baza Materiale" }, { property: "og:description", content: "Përmbledhje personale e kërkesave dhe magazinës." }] }),
  loader: async ({ context }) => { await Promise.all([context.queryClient.ensureQueryData(dashboardQuery), context.queryClient.ensureQueryData(recentRequestsQuery)]); },
  component: Paneli,
});

function Metrics({ values }: { values: [string, number][] }) {
  return <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y py-5 lg:grid-cols-4">{values.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 font-mono text-3xl font-semibold">{value}</dd></div>)}</dl>;
}

function Paneli() {
  const { data: ctx } = useMyContext();
  const { data: stats } = useSuspenseQuery(dashboardQuery);
  const { data: recent } = useSuspenseQuery(recentRequestsQuery);
  const teacherId = ctx?.teacher?.id;
  const assignments = useQuery({
    queryKey: ["my-assignments", teacherId], enabled: !!teacherId,
    queryFn: async () => {
      if (!teacherId) return { teaching: [], homeroom: [], lab: [] };
      const [t, h, l] = await Promise.all([
        supabase.from("teaching_assignments").select("id,class_groups(emer),subjects(emer)").eq("teacher_id", teacherId).eq("aktiv", true),
        supabase.from("homeroom_assignments").select("id,class_groups(emer)").eq("teacher_id", teacherId).eq("aktiv", true),
        supabase.from("lab_assignments").select("id,laboratories(emer)").eq("teacher_id", teacherId).eq("aktiv", true),
      ]);
      if (t.error || h.error || l.error) throw t.error || h.error || l.error;
      return { teaching: t.data ?? [], homeroom: h.data ?? [], lab: l.data ?? [] };
    },
  });
  const s = (key: string) => stats.statuses[key] ?? 0;
  const waiting = s("miratuar") + s("miratuar_pjeserisht") + s("ne_permbushje");
  return <div className="space-y-8">
    <header><h1 className="text-3xl font-bold">Paneli{ctx?.teacher ? ` · ${ctx.teacher.emer}` : ""}</h1><p className="mt-2 text-sm text-muted-foreground">{ctx?.roles.map(r => ROLE_LABELS[r.role] + (r.department ? ` · ${r.department}` : "")).join(" / ") || "Për konfigurim"}</p></header>
    {hasRole(ctx, "admin") && <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Administrimi</h2><Button asChild variant="outline" size="sm"><Link to="/kerkesat" search={{ statusi: "derguar" }}>Për miratim<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div><Metrics values={[["Për shqyrtim", s("derguar")], ["Në pritje të dorëzimit", waiting], ["Sugjerime për shqyrtim", stats.pendingSuggestions ?? 0], ["Klasa për konfigurim", stats.unconfiguredClasses ?? 0]]} /><p className="text-sm text-muted-foreground">{stats.teachers} mësues · {stats.classes} grupe klasash · {stats.curricula} skeletkurrikula</p></section>}
    {hasRole(ctx, "shef_departamenti") && <section className="space-y-4"><h2 className="text-xl font-semibold">Departamenti{ctx?.roles.filter(r => r.role === "shef_departamenti").map(r => r.department ? ` · ${r.department}` : "")}</h2><Metrics values={[["Dërguar", s("derguar")], ["Në pritje të dorëzimit", waiting], ["Përmbushur", s("permbushur")], ["Kthyer për korrigjim", s("kthyer_per_korrigjim")]]} /></section>}
    {hasRole(ctx, "magazinier") && <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Magazina</h2><Button asChild size="sm"><Link to="/magazina/dorezime"><PackageCheck className="mr-2 h-4 w-4" />Dorëzimet</Link></Button></div><Metrics values={[["Kërkesa për dorëzim", waiting], ["Në përmbushje", s("ne_permbushje")], ["Artikuj me stok", stats.stockItems ?? 0], ["Artikuj pa stok", stats.zeroStock ?? 0]]} /></section>}
    {hasRole(ctx, "mesues") && <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Mësimdhënia</h2><Button asChild size="sm"><Link to="/kerkesat/re"><Plus className="mr-2 h-4 w-4" />Kërkesë e re</Link></Button></div><h3 className="font-medium">Caktimet e mia aktive</h3>{assignments.isError ? <p className="text-destructive">Caktimet nuk u ngarkuan.</p> : assignments.isPending ? <p className="text-muted-foreground">Duke ngarkuar…</p> : <ul className="divide-y text-sm">{assignments.data?.teaching.map(a => <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{a.subjects?.emer}</span><span className="text-muted-foreground">{a.class_groups?.emer}</span></li>)}{assignments.data?.homeroom.map(a => <li key={a.id} className="py-2">Kujdestari · {a.class_groups?.emer}</li>)}{assignments.data?.lab.map(a => <li key={a.id} className="py-2">Laborator · {a.laboratories?.emer}</li>)}{!assignments.data?.teaching.length && !assignments.data?.homeroom.length && !assignments.data?.lab.length && <li className="py-3 text-muted-foreground">Për konfigurim — nuk keni caktime aktive.</li>}</ul>}</section>}
    <section className="space-y-4"><h2 className="text-xl font-semibold">Kërkesat sipas statusit</h2><div className="flex flex-wrap gap-2">{Object.entries(stats.statuses).map(([status, count]) => <Button asChild variant="outline" size="sm" key={status}><Link to="/kerkesat" search={{ statusi: status }}>{STATUS_LABELS[status] ?? status}<span className="ml-2 font-mono">{count}</span></Link></Button>)}</div><div className="divide-y border-y">{recent.length ? recent.map(r => <Link key={r.id} to="/kerkesat/$id" params={{ id: r.id }} className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-muted"><div><p className="font-mono text-sm font-semibold">{r.numer}</p><p className="text-sm text-muted-foreground">{r.teachers?.emer} {r.teachers?.mbiemer} · {r.departments?.emer ?? "Për konfigurim"}</p></div><div className="flex items-center gap-3"><time className="text-xs text-muted-foreground">{fmtDate(r.updated_at)}</time><StatusBadge s={r.statusi} /></div></Link>) : <p className="py-8 text-sm text-muted-foreground">Nuk ka ende kërkesa.</p>}</div></section>
  </div>;
}
