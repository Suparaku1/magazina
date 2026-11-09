import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMyContext, hasRole } from "@/lib/auth";
import { CONTEXT_LABELS, STATUS_LABELS, fmtDate } from "@/lib/requests";
import { fmtLek } from "@/lib/catalog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/kerkesat/")({
  validateSearch: (s: Record<string, unknown>) => ({ statusi: typeof s["statusi"] === "string" ? (s["statusi"] as string) : "" }),
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { title: "Kërkesat – Baza Materiale" }, { name: "description", content: "Lista e kërkesave për materiale." }, { property: "og:title", content: "Kërkesat – Baza Materiale" }, { property: "og:description", content: "Lista e kërkesave për materiale." }] }),
  component: Kerkesat,
});

type Req = {
  id: string; numer: string; konteksti: string; statusi: string; created_at: string; derguar_me: string | null;
  teachers: { emer: string; mbiemer: string | null } | null; class_groups: { emer: string } | null; subjects: { emer: string } | null;
  laboratories: { emer: string } | null; departments: { emer: string } | null; request_lines: { vlera: number | null; cmim_njesi: number | null }[];
};

function Kerkesat() {
  const { statusi } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: ctx } = useMyContext();
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["requests", statusi],
    queryFn: async () => {
      let qb = supabase.from("requests").select("id, numer, konteksti, statusi, created_at, derguar_me, teachers(emer, mbiemer), class_groups(emer), subjects(emer), laboratories(emer), departments(emer), request_lines(vlera, cmim_njesi)").order("created_at", { ascending: false });
      if (statusi) qb = qb.eq("statusi", statusi as never);
      const { data, error } = await qb;
      if (error) throw error;
      return data as unknown as Req[];
    },
  });
  const rows = (list.data ?? []).filter((r) => !q || `${r.numer} ${r.teachers?.emer} ${r.teachers?.mbiemer} ${r.class_groups?.emer} ${r.subjects?.emer}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Kërkesat</h1>
          <p className="text-sm text-muted-foreground">Shfaqen vetëm kërkesat që keni të drejtë të shihni.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Kërko…" value={q} onChange={(e) => setQ(e.target.value)} className="w-48" />
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={statusi} onChange={(e) => navigate({ search: { statusi: e.target.value } })}>
            <option value="">Të gjitha statuset</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {ctx?.teacher && <Button asChild><Link to="/kerkesat/re"><Plus className="mr-1 h-4 w-4" />Kërkesë e re</Link></Button>}
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Nr.</TableHead><TableHead>Mësuesi</TableHead><TableHead>Konteksti</TableHead><TableHead>Klasa / Laboratori</TableHead><TableHead>Lënda</TableHead>{(hasRole(ctx, "admin") || hasRole(ctx, "shef_departamenti")) && <TableHead>Departamenti</TableHead>}<TableHead>Dërguar</TableHead><TableHead className="text-right">Vlera</TableHead><TableHead>Statusi</TableHead></TableRow></TableHeader>
          <TableBody>
            {list.isLoading && <TableRow><TableCell colSpan={9}>Duke ngarkuar…</TableCell></TableRow>}
            {list.data && rows.length === 0 && <TableRow><TableCell colSpan={9} className="text-muted-foreground">Asnjë kërkesë.</TableCell></TableRow>}
            {rows.map((r) => {
              const known = r.request_lines.filter((l) => l.vlera !== null);
              const total = known.reduce((s, l) => s + Number(l.vlera), 0);
              const missing = r.request_lines.length - known.length;
              return (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate({ to: "/kerkesat/$id", params: { id: r.id } })}>
                  <TableCell className="font-mono text-xs">{r.numer}</TableCell>
                  <TableCell>{r.teachers?.emer} {r.teachers?.mbiemer}</TableCell>
                  <TableCell className="text-sm">{CONTEXT_LABELS[r.konteksti]}</TableCell>
                  <TableCell>{r.class_groups?.emer ?? r.laboratories?.emer}</TableCell>
                  <TableCell className="text-sm">{r.subjects?.emer}</TableCell>
                  {(hasRole(ctx, "admin") || hasRole(ctx, "shef_departamenti")) && <TableCell className="text-sm">{r.departments?.emer ?? <span className="italic text-muted-foreground">Për konfigurim</span>}</TableCell>}
                  <TableCell className="font-mono text-xs">{fmtDate(r.derguar_me)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{known.length ? fmtLek(total) : ""}{missing > 0 && <span className="block text-[10px] text-muted-foreground">{missing} pa çmim</span>}</TableCell>
                  <TableCell><StatusBadge s={r.statusi} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
