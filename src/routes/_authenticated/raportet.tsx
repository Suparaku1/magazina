import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { exportReport } from "@/lib/excel.functions";
import { REPORTS, workbookBytes, downloadBytes, type ReportId } from "@/lib/excel";
import { useMyContext, hasRole } from "@/lib/auth";
import { STATUS_LABELS } from "@/lib/requests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/raportet")({ head: () => ({ meta: [{ title: "Raportet Excel – Baza Materiale" }, { name: "description", content: "Raportet e kërkesave, katalogut dhe magazinës." }, { property: "og:title", content: "Raportet Excel – Baza Materiale" }, { property: "og:description", content: "Eksportet e bazës materiale sipas të drejtave të përdoruesit." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: Reports });
function Reports() {
  const { data: ctx } = useMyContext(); const run = useServerFn(exportReport);
  const [year, setYear] = useState(""); const [department, setDepartment] = useState(""); const [status, setStatus] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [busy, setBusy] = useState<ReportId | null>(null);
  const options = useQuery({ queryKey: ["report-options"], queryFn: async () => {
    const [y, d] = await Promise.all([supabase.from("school_years").select("id,emer"), supabase.from("departments").select("id,emer")]);
    if (y.error || d.error) throw new Error("Filtrat nuk u lexuan."); return { years: y.data, departments: d.data };
  } });
  const stock = hasRole(ctx, "admin") || hasRole(ctx, "magazinier") || hasRole(ctx, "shef_departamenti");
  const cls = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
  async function download(id: ReportId) {
    setBusy(id); try {
      if (from && to && from > to) throw new Error("Data e fillimit është pas datës së mbarimit.");
      const rows = await run({ data: { report: id, year, department, status, from, to } });
      const movement = id === "levizjet"; const catalog = id === "katalog" || id === "gjendja";
      const filters = catalog ? [] : [...(movement ? [] : [{ Filtri: "Viti", Vlera: options.data?.years.find((y) => y.id === year)?.emer ?? "Të gjithë" }, { Filtri: "Departamenti", Vlera: options.data?.departments.find((d) => d.id === department)?.emer ?? "Të gjithë" }, { Filtri: "Statusi", Vlera: STATUS_LABELS[status] ?? "Të gjithë" }]), { Filtri: "Nga", Vlera: from || "Pa kufi" }, { Filtri: "Deri", Vlera: to || "Pa kufi" }];
      downloadBytes(await workbookBytes(REPORTS.find((r) => r.id === id)?.title ?? id, rows, filters), `baza-materiale-${id}.xlsx`);
      toast.success(`U eksportuan ${rows.length} rreshta.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Eksporti dështoi."); } finally { setBusy(null); }
  }
  return <div className="space-y-6"><h1 className="text-2xl font-bold">Raportet Excel</h1>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div><Label>Viti shkollor</Label><select aria-label="Viti shkollor" className={cls} value={year} onChange={(e) => setYear(e.target.value)}><option value="">Të gjithë</option>{options.data?.years.map((y) => <option key={y.id} value={y.id}>{y.emer}</option>)}</select></div>
      <div><Label>Departamenti</Label><select aria-label="Departamenti" className={cls} value={department} onChange={(e) => setDepartment(e.target.value)}><option value="">Të gjithë</option>{options.data?.departments.map((d) => <option key={d.id} value={d.id}>{d.emer}</option>)}</select></div>
      <div><Label>Statusi</Label><select aria-label="Statusi" className={cls} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Të gjithë</option>{Object.entries(STATUS_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
      <div><Label>Nga data</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div><div><Label>Deri më</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
    </div>
    <div className="divide-y border-y">{REPORTS.filter((r) => r.id !== "gjendja" || stock).filter((r) => r.id !== "levizjet" || hasRole(ctx, "admin") || hasRole(ctx, "magazinier")).map((r, i) => <div key={r.id} className="flex items-center justify-between gap-4 py-4"><div className="flex items-center gap-3"><span className="font-mono text-sm text-muted-foreground">{String(i + 1).padStart(2, "0")}</span><h2 className="font-medium">{r.title}</h2></div><Button variant="outline" onClick={() => download(r.id)} disabled={busy !== null}><Download className="mr-2 h-4 w-4" />{busy === r.id ? "Duke eksportuar…" : ".xlsx"}</Button></div>)}</div>
  </div>;
}