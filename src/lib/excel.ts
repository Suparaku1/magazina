export const REPORTS = [
  { id: "detaje", title: "Kërkesat e detajuara" },
  { id: "konsoliduar", title: "Artikujt e konsoliduar" },
  { id: "gjendja", title: "Gjendja e magazinës" },
  { id: "levizjet", title: "Regjistri i hyrje-daljeve" },
  { id: "mungesat", title: "Mungesat dhe sasitë e paplotësuara" },
  { id: "mesues", title: "Kërkesat sipas mësuesit" },
  { id: "kurrikula", title: "Kërkesat sipas skeletkurrikulës / profilit" },
  { id: "katalog", title: "Katalogu i artikujve" },
] as const;
export type ReportId = typeof REPORTS[number]["id"];
export type ExcelRow = Record<string, string | number | null>;
export type Line = { item_id: string; teacher_id: string; curriculum_id: string | null; sasia: number; sasia_miratuar: number | null; sasia_dorezuar: number; cmim_njesi: number | null; [key: string]: unknown };

export function consolidate(lines: Line[], group: "item_id" | "teacher_id" | "curriculum_id" = "item_id") {
  const out = new Map<string, { id: string; sasia: number; miratuar: number; dorezuar: number; vlera: number | null; cmime_mungojne: number }>();
  for (const l of lines) {
    const id = l[group] ?? "";
    const r = out.get(id) ?? { id, sasia: 0, miratuar: 0, dorezuar: 0, vlera: null, cmime_mungojne: 0 };
    r.sasia += Number(l.sasia); r.miratuar += Number(l.sasia_miratuar ?? 0); r.dorezuar += Number(l.sasia_dorezuar);
    if (l.cmim_njesi == null) r.cmime_mungojne++; else r.vlera = (r.vlera ?? 0) + Number(l.sasia) * Number(l.cmim_njesi);
    out.set(id, r);
  }
  return [...out.values()];
}

export async function workbookBytes(title: string, rows: ExcelRow[], filters: ExcelRow[] = []) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Baza Materiale – Gjergj Canco";
  const addSheet = (name: string, data: ExcelRow[]) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    const keys = Object.keys(data[0] ?? { "Të dhëna": null });
    ws.columns = keys.map((key) => ({ header: key, key, width: Math.min(48, Math.max(18, key.length + 3)) }));
    data.forEach((row) => ws.addRow(row));
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial" };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF264653" } };
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, ws.rowCount), column: keys.length } };
    ws.eachRow((row, n) => { if (n > 1) row.font = { name: "Arial", size: 11 }; row.eachCell((cell, col) => {
      const key = keys[col - 1] ?? "";
      if (key.includes("Lek")) cell.numFmt = '#,##0.00 "Lek"';
      if (key === "Data" && typeof cell.value === "string") { cell.value = new Date(cell.value); cell.numFmt = "dd.mm.yyyy"; }
    }); });
    return ws;
  };
  addSheet("Të dhënat", rows);
  addSheet("Përmbledhje", [{ Raporti: title, Rreshta: rows.length }]);
  addSheet("Filtrat e aplikuar", filters.length ? filters : [{ Filtri: "Aksesi", Vlera: "Sipas të drejtave të përdoruesit" }]);
  return wb.xlsx.writeBuffer();
}

export function downloadBytes(bytes: ArrayBuffer | Uint8Array, name: string) {
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

export const IMPORT_COLUMNS: Record<"mesues" | "klasa" | "caktime" | "katalog" | "inventar", string[]> = {
  mesues: ["emer", "mbiemer", "email", "department_id", "lendet_sipas_listes"],
  klasa: ["emer", "nivel", "school_year_id", "department_id", "curriculum_id"],
  caktime: ["teacher_id", "school_year_id", "class_group_id", "subject_id"],
  katalog: ["emer", "specifikime", "unit_id", "category_id", "cmim_reference"],
  inventar: ["item_id", "sasia", "cmim_njesi", "dokument"],
};