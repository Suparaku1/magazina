import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Upload, Check } from "lucide-react";
import { importRows } from "@/lib/excel.functions";
import { IMPORT_COLUMNS, downloadBytes, workbookBytes, type ExcelRow } from "@/lib/excel";
import { useMyContext, hasRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
export const Route = createFileRoute("/_authenticated/importe")({ head: () => ({ meta: [{ title: "Importet Excel – Baza Materiale" }, { name: "description", content: "Importi i të dhënave me kontroll për çdo rresht." }, { property: "og:title", content: "Importet Excel – Baza Materiale" }, { property: "og:description", content: "Parapamja dhe validimi i skedarëve Excel." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: Imports });
type Kind = "mesues" | "klasa" | "caktime" | "katalog" | "inventar";
const labels: Record<Kind, string> = { mesues: "Mësuesit", klasa: "Klasat", caktime: "Caktimet mësimore", katalog: "Katalogu", inventar: "Inventari fillestar" };
function Imports() {
  const { data: ctx } = useMyContext(); const run = useServerFn(importRows);
  const [kind, setKind] = useState<Kind>("katalog"); const [rows, setRows] = useState<ExcelRow[]>([]); const [result, setResult] = useState<{ row: number; ok: boolean; error: string }[]>([]); const [busy, setBusy] = useState(false); const [saved, setSaved] = useState(false); const [name, setName] = useState("");
  async function load(file?: File) {
    if (!file) return; setBusy(true); setRows([]); setResult([]); setSaved(false);
    try {
      if (!file.name.toLowerCase().endsWith(".xlsx") || file.size > 5 * 1024 * 1024) throw new Error("Zgjidhni një skedar .xlsx deri në 5 MB.");
      const { default: ExcelJS } = await import("exceljs"); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0]; if (!ws || ws.rowCount < 2 || ws.rowCount > 1001) throw new Error("Skedari duhet të ketë 1–1000 rreshta të dhënash.");
      const columns = IMPORT_COLUMNS[kind]; const header = ws.getRow(1); const indexes = new Map(columns.map((key) => [key, 0]));
      header.eachCell((c, i) => { if (indexes.has(c.text.trim())) indexes.set(c.text.trim(), i); });
      if (columns.some((key) => !indexes.get(key))) throw new Error("Kolonat nuk përputhen me modelin e zgjedhur.");
      const parsed: ExcelRow[] = [];
      for (let i = 2; i <= ws.rowCount; i++) {
        const row: ExcelRow = {}; for (const key of columns) { const cell = ws.getRow(i).getCell(indexes.get(key) ?? 0); if (cell.type === ExcelJS.ValueType.Formula) throw new Error(`Rreshti ${i}: formulat nuk pranohen në import.`); const v = cell.value;
          if (v == null || cell.text.trim() === "") row[key] = null;
          else if (["nivel", "sasia", "cmim_reference", "cmim_njesi"].includes(key)) row[key] = Number(cell.text.replace(",", "."));
          else row[key] = cell.text.trim();
        } parsed.push(row);
      }
      setRows(parsed); setName(file.name); setResult(await run({ data: { kind, rows: parsed, confirm: false, filename: file.name } }));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Skedari nuk u lexua."); } finally { setBusy(false); }
  }
  async function confirmImport() {
    setBusy(true); setSaved(true); try { const res = await run({ data: { kind, rows, confirm: true, filename: name } }); setResult(res); if (res.every((r) => r.ok)) toast.success(`U ruajtën ${res.length} rreshta.`); else { setSaved(false); toast.error("Importi nuk u ruajt. Kontrolloni raportin e gabimeve."); } } catch (e) { toast.error(e instanceof Error ? e.message : "Rezultati i importit nuk u konfirmua. Kontrolloni të dhënat para përsëritjes."); } finally { setBusy(false); }
  }
  if (!hasRole(ctx, "admin")) return <p className="text-muted-foreground">Importet janë vetëm për administratorin.</p>;
  return <div className="space-y-5"><h1 className="text-2xl font-bold">Importet Excel</h1><div className="flex flex-wrap items-center gap-3">
    <select aria-label="Lloji i importit" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={kind} onChange={(e) => { setKind(e.target.value as Kind); setRows([]); setResult([]); setSaved(false); }}>{Object.entries(labels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
    <Button variant="outline" onClick={async () => { downloadBytes(await workbookBytes(labels[kind], [Object.fromEntries(IMPORT_COLUMNS[kind].map((c) => [c, null]))]), `model-${kind}.xlsx`); }}><Download className="mr-2 h-4 w-4" />Modeli bosh</Button>
    <label className="flex items-center gap-2 text-sm"><Upload className="h-4 w-4" /><Input aria-label="Skedari Excel" type="file" accept=".xlsx" disabled={busy} onChange={(e) => { void load(e.target.files?.[0]); e.target.value = ""; }} /></label>
  </div>
    {rows.length > 0 && <><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm">{name} · {rows.length} rreshta · {result.filter((r) => !r.ok).length} gabime{saved ? " · Importi përfundoi" : ""}</p><div className="flex gap-2"><Button variant="outline" onClick={async () => downloadBytes(await workbookBytes("Rezultati i importit", result.map((r) => ({ Rreshti: r.row, Statusi: r.ok ? (saved ? "U ruajt" : "I vlefshëm") : "Gabim", Gabimi: r.error }))), "raport-importi.xlsx")}><Download className="mr-2 h-4 w-4" />Raporti</Button><Button disabled={busy || saved || result.length !== rows.length || result.some((r) => !r.ok)} onClick={confirmImport}><Check className="mr-2 h-4 w-4" />Konfirmo importin</Button></div></div>
    <div className="max-h-[600px] overflow-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>Rreshti</TableHead>{IMPORT_COLUMNS[kind].map((c) => <TableHead key={c}>{c}</TableHead>)}<TableHead>Rezultati</TableHead></TableRow></TableHeader><TableBody>{rows.map((r, i) => <TableRow key={i}><TableCell>{i + 2}</TableCell>{IMPORT_COLUMNS[kind].map((c) => <TableCell key={c}>{r[c] ?? "Për konfigurim"}</TableCell>)}<TableCell className={result[i]?.ok ? "text-foreground" : "text-destructive"}>{result[i]?.error || (saved ? "U ruajt" : "I vlefshëm")}</TableCell></TableRow>)}</TableBody></Table></div></>}
  </div>;
}