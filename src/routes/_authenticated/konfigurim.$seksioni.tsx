import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SECTIONS, type Field, type Section } from "@/lib/config-sections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

type Row = Record<string, unknown> & { id: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const Route = createFileRoute("/_authenticated/konfigurim/$seksioni")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { title: "Konfigurimi – Baza Materiale" }, { name: "description", content: "Konfigurimi i të dhënave bazë." }, { property: "og:title", content: "Konfigurimi – Baza Materiale" }, { property: "og:description", content: "Konfigurimi i të dhënave bazë." }] }),
  loader: ({ params }) => {
    const s = SECTIONS.find((x) => x.slug === params.seksioni);
    if (!s) throw notFound();
    return s;
  },
  component: ConfigPage,
});

function pgError(e: { code?: string; message?: string }) {
  if (e.code === "23505") return "Ky rekord ekziston tashmë (dublikat).";
  if (e.code === "23503") return "Rekordi përdoret diku tjetër ose lidhja nuk është e vlefshme.";
  if (e.code === "23514") return "Vlerat nuk respektojnë rregullat (p.sh. klasa 10–13).";
  if (e.code === "42501") return "Nuk keni të drejtë për këtë veprim.";
  return e.message ?? "Veprimi dështoi.";
}

function ConfigPage() {
  const section = Route.useLoaderData() as Section;
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Row> | null>(null);
  const [q, setQ] = useState("");

  const rows = useQuery({
    queryKey: ["cfg", section.table],
    queryFn: async () => {
      const { data, error } = await db.from(section.table).select("*").order(section.order);
      if (error) throw error;
      return data as Row[];
    },
  });

  const refFields = section.fields.filter((f) => f.ref);
  const refs = useQueries({
    queries: refFields.map((f) => ({
      queryKey: ["cfg-ref", f.ref!.table],
      queryFn: async () => {
        const { data, error } = await db.from(f.ref!.table).select(f.ref!.select);
        if (error) throw error;
        return data as Row[];
      },
    })),
  });
  const refMap = useMemo(() => {
    const m: Record<string, { value: string; label: string }[]> = {};
    refFields.forEach((f, i) => {
      m[f.key] = (refs[i]?.data ?? []).map((r) => ({ value: r.id, label: f.ref!.label(r) })).sort((a, b) => a.label.localeCompare(b.label, "sq"));
    });
    return m;
  }, [refs, refFields]);

  const display = (f: Field, v: unknown) => {
    if (v === null || v === undefined || v === "") return <span className="text-xs italic text-warning-foreground/70">Për konfigurim</span>;
    if (f.type === "bool") return v ? "Po" : "Jo";
    if (f.type === "select") return refMap[f.key]?.find((o) => o.value === v)?.label ?? "…";
    if (f.type === "enum") return f.options?.find((o) => o.value === v)?.label ?? String(v);
    if (f.type === "date") return new Date(String(v)).toLocaleDateString("sq-AL", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, ".");
    return String(v);
  };

  const save = useMutation({
    mutationFn: async (r: Partial<Row>) => {
      const payload: Record<string, unknown> = {};
      for (const f of section.fields) {
        let v = r[f.key];
        if (v === "" || v === undefined) v = f.type === "bool" ? false : null;
        if (f.type === "number" && v !== null) v = Number(v);
        payload[f.key] = v;
      }
      const res = r.id ? await db.from(section.table).update(payload).eq("id", r.id) : await db.from(section.table).insert(payload);
      if (res.error) throw res.error;
    },
    onSuccess: () => {
      toast.success("U ruajt.");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["cfg"] });
      qc.invalidateQueries({ queryKey: ["cfg-ref"] });
    },
    onError: (e) => toast.error(pgError(e as never)),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from(section.table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("U fshi.");
      qc.invalidateQueries({ queryKey: ["cfg"] });
    },
    onError: (e) => toast.error(pgError(e as never)),
  });

  const filtered = (rows.data ?? []).filter((r) =>
    !q || section.fields.some((f) => String(f.type === "select" ? refMap[f.key]?.find((o) => o.value === r[f.key])?.label ?? "" : r[f.key] ?? "").toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b pb-3">
        {SECTIONS.map((s) => (
          <Link key={s.slug} to="/konfigurim/$seksioni" params={{ seksioni: s.slug }} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted" activeProps={{ className: "bg-primary text-primary-foreground hover:bg-primary" }}>
            {s.title}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{section.title}</h1>
          <p className="text-sm text-muted-foreground">{rows.data?.length ?? 0} rekorde</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Kërko…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          <Button onClick={() => setEditing({})}><Plus className="mr-1 h-4 w-4" />Shto</Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {section.fields.map((f) => <TableHead key={f.key}>{f.label}</TableHead>)}
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.isLoading && <TableRow><TableCell colSpan={99}>Duke ngarkuar…</TableCell></TableRow>}
            {rows.error && <TableRow><TableCell colSpan={99} className="text-destructive">Gabim gjatë leximit.</TableCell></TableRow>}
            {!rows.isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={99} className="text-muted-foreground">Asnjë rekord.</TableCell></TableRow>}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                {section.fields.map((f) => <TableCell key={f.key} className="max-w-xs truncate">{display(f, r[f.key])}</TableCell>)}
                <TableCell className="whitespace-nowrap">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(r)} aria-label="Redakto"><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label="Fshi" onClick={() => confirm("Ta fshij këtë rekord?") && del.mutate(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Redakto" : "Shto"} – {section.title}</DialogTitle></DialogHeader>
          {editing && (
            <form id="cfg-form" className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(editing); }}>
              {section.fields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label>{f.label}{f.required && " *"}</Label>
                  {f.type === "bool" ? (
                    <div><Checkbox checked={!!editing[f.key]} onCheckedChange={(c) => setEditing({ ...editing, [f.key]: !!c })} /></div>
                  ) : f.type === "select" || f.type === "enum" ? (
                    <select required={f.required} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={String(editing[f.key] ?? "")} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })}>
                      <option value="">— Për konfigurim —</option>
                      {(f.type === "enum" ? f.options! : refMap[f.key] ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <Input required={f.required} type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} value={String(editing[f.key] ?? "")} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} />
                  )}
                </div>
              ))}
            </form>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Anulo</Button>
            <Button type="submit" form="cfg-form" disabled={save.isPending}>Ruaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
