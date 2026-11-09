import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyContext, hasRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Database } from "@/integrations/supabase/types";

const OPS: Record<string, string> = { INSERT: "Shtim", UPDATE: "Ndryshim", DELETE: "Fshirje" };
const TABLE_NAMES: Record<string, string> = { teachers: "Mësuesit", class_groups: "Klasat", curricula: "Skeletkurrikulat", subjects: "Lëndët", departments: "Departamentet", school_years: "Vitet shkollore", user_roles: "Rolet", pending_role_grants: "Rolet në pritje", teaching_assignments: "Caktimet mësimore", homeroom_assignments: "Kujdestaritë", lab_assignments: "Caktimet laboratorike", laboratories: "Laboratorët", items: "Artikujt", item_suggestions: "Sugjerimet", item_synonyms: "Sinonimet", categories: "Kategoritë", units: "Njësitë", requests: "Kërkesat", request_lines: "Rreshtat e kërkesave", request_decisions: "Vendimet", request_comments: "Komentet", stock_movements: "Lëvizjet e magazinës", import_batches: "Importet" };
type Filters = { page: number; table: string; operation: string; from: string; to: string };
const initial: Filters = { page: 0, table: "all", operation: "all", from: "", to: "" };
const auditQuery = (f: Filters) => queryOptions({
  queryKey: ["audit", f],
  queryFn: async () => {
    let q = supabase.from("audit_log").select("*", { count: "exact" }).order("kur", { ascending: false }).order("id", { ascending: false });
    if (f.table !== "all") q = q.eq("tabela", f.table);
    if (f.operation !== "all") q = q.eq("veprimi", f.operation);
    if (f.from) q = q.gte("kur", `${f.from}T00:00:00`);
    if (f.to) { const next = new Date(`${f.to}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1); q = q.lt("kur", next.toISOString()); }
    const { data, count, error } = await q.range(f.page * 50, f.page * 50 + 49);
    if (error) throw error;
    return { rows: data ?? [], count: count ?? 0 };
  },
});
export const Route = createFileRoute("/_authenticated/auditimi")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { title: "Auditimi – Baza Materiale" }, { name: "description", content: "Regjistri i ndryshimeve me filtra dhe detaje." }, { property: "og:title", content: "Auditimi – Baza Materiale" }, { property: "og:description", content: "Historiku i pandryshueshëm i veprimeve të sistemit." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(auditQuery(initial)),
  component: AuditPage,
});
function AuditPage() {
  const { data: ctx } = useMyContext();
  const [filters, setFilters] = useState(initial);
  const { data } = useSuspenseQuery(auditQuery(filters));
  const [selected, setSelected] = useState<Database["public"]["Tables"]["audit_log"]["Row"] | null>(null);
  const update = (key: keyof Filters, value: string) => setFilters(f => ({ ...f, [key]: value, page: 0 }));
  if (!hasRole(ctx, "admin")) return <p className="text-muted-foreground">Auditimi është i disponueshëm vetëm për administratorin.</p>;
  return <div className="space-y-5">
    <h1 className="text-2xl font-bold">Auditimi</h1>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div><Label>Të dhënat</Label><Select value={filters.table} onValueChange={v => update("table", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Të gjitha</SelectItem>{Object.entries(TABLE_NAMES).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Veprimi</Label><Select value={filters.operation} onValueChange={v => update("operation", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Të gjitha</SelectItem>{Object.entries(OPS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
      <div><Label htmlFor="audit-from">Nga data</Label><Input id="audit-from" type="date" value={filters.from} onChange={e => update("from", e.target.value)} /></div>
      <div><Label htmlFor="audit-to">Deri më</Label><Input id="audit-to" type="date" min={filters.from} value={filters.to} onChange={e => update("to", e.target.value)} /></div>
    </div>
    <div className="overflow-x-auto rounded-md border bg-card"><Table><TableHeader><TableRow><TableHead>Koha</TableHead><TableHead>Të dhënat</TableHead><TableHead>Veprimi</TableHead><TableHead>Përdoruesi</TableHead><TableHead>Detaje</TableHead></TableRow></TableHeader><TableBody>{data.rows.map(a => <TableRow key={a.id}><TableCell className="whitespace-nowrap font-mono text-xs">{new Date(a.kur).toLocaleString("sq-AL")}</TableCell><TableCell>{TABLE_NAMES[a.tabela] ?? a.tabela}</TableCell><TableCell>{OPS[a.veprimi] ?? a.veprimi}</TableCell><TableCell className="font-mono text-xs">{a.user_id?.slice(0,8) ?? "sistem"}</TableCell><TableCell><Button variant="ghost" size="icon" aria-label="Shiko detajet" title="Shiko detajet" onClick={() => setSelected(a)}><Eye className="h-4 w-4" /></Button></TableCell></TableRow>)}{!data.rows.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nuk ka ndryshime për këta filtra.</TableCell></TableRow>}</TableBody></Table></div>
    <div className="flex items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{data.count} ndryshime · Faqja {filters.page + 1}</p><div className="flex gap-2"><Button variant="outline" size="icon" title="Faqja e mëparshme" aria-label="Faqja e mëparshme" disabled={filters.page === 0} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" title="Faqja tjetër" aria-label="Faqja tjetër" disabled={(filters.page + 1) * 50 >= data.count} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}><ChevronRight className="h-4 w-4" /></Button></div></div>
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Detajet e ndryshimit</DialogTitle><DialogDescription>{selected ? `${TABLE_NAMES[selected.tabela] ?? selected.tabela} · ${OPS[selected.veprimi] ?? selected.veprimi}` : ""}</DialogDescription></DialogHeader><p className="break-all text-xs text-muted-foreground">Përdoruesi: {selected?.user_id ?? "sistem"}</p>{[["Para", selected?.te_vjetra], ["Pas", selected?.te_rejat]].map(([label, value]) => <div key={String(label)}><h3 className="mb-2 font-medium">{String(label)}</h3><pre className="overflow-x-auto rounded bg-muted p-3 font-mono text-xs">{value ? JSON.stringify(value, null, 2) : "—"}</pre></div>)}</DialogContent></Dialog>
  </div>;
}
