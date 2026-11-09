import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { consolidate, type Line, type ExcelRow } from "@/lib/excel";

const filters = z.object({ report: z.enum(["detaje", "konsoliduar", "gjendja", "levizjet", "mungesat", "mesues", "kurrikula", "katalog"]), year: z.string().uuid().or(z.literal("")), department: z.string().uuid().or(z.literal("")), status: z.string().max(40), from: z.string().max(10), to: z.string().max(10) });
async function allRows(client: any, table: string, select: string, order = "id") {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from(table).select(select).order(order).range(offset, offset + 499);
    if (error) throw new Error("Të dhënat nuk u lexuan. Provoni përsëri.");
    rows.push(...(data ?? [])); if (!data || data.length < 500) break;
  }
  return rows;
}

export const exportReport = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => filters.parse(d)).handler(async ({ data: f, context }) => {
  const client = context.supabase;
  const inDate = (s: string) => (!f.from || s >= f.from) && (!f.to || s.slice(0, 10) <= f.to);
  if (f.report === "katalog" || f.report === "gjendja") {
    if (f.report === "gjendja") {
      const { data: roles, error } = await client.from("user_roles").select("role").eq("user_id", context.userId);
      if (error || !roles?.some((r) => ["admin", "magazinier", "shef_departamenti"].includes(r.role))) throw new Error("Nuk keni akses në magazinë.");
    }
    const items = await allRows(client, "items", "id,kod,emer,specifikime,cmim_reference,units(kod),categories(emer)");
    const balances = f.report === "gjendja" ? await allRows(client, "stock_balances", "item_id,sasia", "item_id") : [];
    const stock = new Map(balances.map((b) => [b.item_id, Number(b.sasia)]));
    return items.map((i): ExcelRow => ({ "ID artikulli": i.id, Kodi: i.kod, Artikulli: i.emer, Specifikime: i.specifikime, Njësia: i.units?.kod ?? null, ...(f.report === "gjendja" ? { Gjendja: stock.get(i.id) ?? 0 } : { Kategoria: i.categories?.emer ?? null, "Çmimi (Lek)": i.cmim_reference }) }));
  }
  if (f.report === "levizjet") {
    const rows = await allRows(client, "stock_movements", "id,kur,lloji,sasia,bilanci_pas,cmim_njesi,dokument,arsye,items(kod,emer,units(kod))");
    return rows.filter((r) => inDate(r.kur)).map((r): ExcelRow => ({ Data: r.kur, Kodi: r.items?.kod, Artikulli: r.items?.emer, Njësia: r.items?.units?.kod, Lloji: r.lloji, Sasia: Number(r.sasia), "Bilanci pas": Number(r.bilanci_pas), "Çmimi (Lek)": r.cmim_njesi, Dokumenti: r.dokument, Arsyeja: r.arsye }));
  }
  const raw = await allRows(client, "request_lines", "id,item_id,sasia,sasia_miratuar,sasia_dorezuar,cmim_njesi,vlera,items(kod,emer,units(kod)),requests!inner(id,numer,teacher_id,curriculum_id,department_id,school_year_id,statusi,created_at,konteksti,teachers(emer,mbiemer),curricula(kod,profili),class_groups(emer),subjects(emer),school_years(emer),departments(emer))");
  const rows = raw.filter((l) => { const r = l.requests; return (!f.year || r.school_year_id === f.year) && (!f.department || r.department_id === f.department) && (!f.status || r.statusi === f.status) && inDate(r.created_at); });
  const lines: Line[] = rows.map((l) => ({ ...l, teacher_id: l.requests.teacher_id, curriculum_id: l.requests.curriculum_id }));
  if (["konsoliduar", "mesues", "kurrikula"].includes(f.report)) {
    const group = f.report === "mesues" ? "teacher_id" : f.report === "kurrikula" ? "curriculum_id" : "item_id";
    return consolidate(lines, group).map((r): ExcelRow => {
      const l = rows.find((l) => (group === "item_id" ? l.item_id : l.requests[group] ?? "") === r.id);
      return { ID: r.id, Emri: group === "item_id" ? l?.items?.emer : group === "teacher_id" ? `${l?.requests.teachers?.emer ?? ""} ${l?.requests.teachers?.mbiemer ?? ""}` : l?.requests.curricula?.kod ?? "Për konfigurim", ...(group === "item_id" ? { Njësia: l?.items?.units?.kod ?? null } : {}), "Sasia e kërkuar": r.sasia, Miratuar: r.miratuar, Dorëzuar: r.dorezuar, "Vlera e njohur (Lek)": r.vlera, "Rreshta pa çmim": r.cmime_mungojne };
    });
  }
  return rows.filter((l) => f.report !== "mungesat" || (["miratuar", "miratuar_pjeserisht", "ne_permbushje"].includes(l.requests.statusi) && Number(l.sasia_miratuar ?? 0) > Number(l.sasia_dorezuar))).map((l): ExcelRow => ({ Kërkesa: l.requests.numer, Data: l.requests.created_at, Viti: l.requests.school_years?.emer ?? null, Departamenti: l.requests.departments?.emer ?? null, Mësuesi: `${l.requests.teachers?.emer ?? ""} ${l.requests.teachers?.mbiemer ?? ""}`, Klasa: l.requests.class_groups?.emer ?? null, Lënda: l.requests.subjects?.emer ?? null, Skeletkurrikula: l.requests.curricula?.kod ?? null, Profili: l.requests.curricula?.profili ?? null, Statusi: l.requests.statusi, "ID artikulli": l.item_id, Kodi: l.items?.kod, Artikulli: l.items?.emer, Njësia: l.items?.units?.kod, Sasia: Number(l.sasia), Miratuar: l.sasia_miratuar, Dorëzuar: Number(l.sasia_dorezuar), Paplotësuar: Math.max(0, Number(l.sasia_miratuar ?? 0) - Number(l.sasia_dorezuar)), "Çmimi (Lek)": l.cmim_njesi, "Vlera (Lek)": l.vlera }));
});

const nullableText = z.string().trim().max(1000).nullable().optional();
const uuid = z.string().uuid();
const optionalUuid = uuid.nullable().optional();
const price = z.number().finite().min(0).nullable().optional();
export const importSchemas = {
  mesues: z.object({ emer: z.string().trim().min(1).max(100), mbiemer: nullableText, email: z.string().email().nullable().optional(), department_id: optionalUuid, lendet_sipas_listes: nullableText }),
  klasa: z.object({ emer: z.string().trim().min(1).max(100), nivel: z.number().int().min(10).max(13), school_year_id: uuid, department_id: optionalUuid, curriculum_id: optionalUuid }),
  caktime: z.object({ teacher_id: uuid, school_year_id: uuid, class_group_id: uuid, subject_id: uuid }),
  katalog: z.object({ emer: z.string().trim().min(1).max(200), specifikime: nullableText, unit_id: uuid, category_id: optionalUuid, cmim_reference: price }),
  inventar: z.object({ item_id: uuid, sasia: z.number().finite().positive(), cmim_njesi: price, dokument: nullableText }),
};
export const importRows = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => z.object({ kind: z.enum(["mesues", "klasa", "caktime", "katalog", "inventar"]), rows: z.array(z.record(z.unknown())).min(1).max(1000), confirm: z.boolean(), filename: z.string().max(255).default("Import Excel") }).parse(d)).handler(async ({ data, context }) => {
  const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!admin) throw new Error("Importet kryhen vetëm nga administratori.");
  const result: { row: number; ok: boolean; error: string }[] = [];
  const validatedRows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const [i, row] of data.rows.entries()) {
    const parsed = importSchemas[data.kind].safeParse(row);
    if (!parsed.success) { result.push({ row: i + 2, ok: false, error: parsed.error.issues.map((e) => `${e.path.join(".")}: vlerë e pavlefshme`).join("; ") }); continue; }
    const r = parsed.data as Record<string, unknown>;
    const refs: Record<string, string> = { department_id: "departments", curriculum_id: "curricula", school_year_id: "school_years", teacher_id: "teachers", class_group_id: "class_groups", subject_id: "subjects", unit_id: "units", category_id: "categories", item_id: "items" };
    let invalidRef = "";
    for (const [field, table] of Object.entries(refs)) {
      if (!r[field]) continue;
      const { data: ref, error } = await (context.supabase as any).from(table).select("id").eq("id", r[field]).maybeSingle();
      if (error || !ref) { invalidRef = `${field}: lidhja nuk u gjet`; break; }
    }
    if (invalidRef) { result.push({ row: i + 2, ok: false, error: invalidRef }); continue; }
    const normalize = (v: unknown) => String(v ?? "").trim().toLowerCase();
    const duplicateKey = data.kind === "katalog" ? JSON.stringify([normalize(r['emer']), normalize(r['specifikime']), r['unit_id']]) : data.kind === "inventar" ? String(r['item_id']) : data.kind === "klasa" ? JSON.stringify([r['school_year_id'], normalize(r['emer'])]) : data.kind === "caktime" ? JSON.stringify([r['teacher_id'], r['school_year_id'], r['class_group_id'], r['subject_id']]) : r['email'] ? normalize(r['email']) : "";
    if (duplicateKey && seen.has(duplicateKey)) { result.push({ row: i + 2, ok: false, error: "Rresht i dyfishuar brenda skedarit." }); continue; }
    if (duplicateKey) seen.add(duplicateKey);
    if (data.kind === "inventar") {
      const { data: existing } = await context.supabase.from("stock_movements").select("id").eq("item_id", String(r['item_id'])).limit(1);
      if (existing?.length) { result.push({ row: i + 2, ok: false, error: "Artikulli ka lëvizje; inventari fillestar nuk mund të përsëritet." }); continue; }
    }
    validatedRows.push(r);
    result.push({ row: i + 2, ok: true, error: "" });
  }
  if (data.confirm) {
    if (result.some((r) => !r.ok)) {
      return result.map((r) => r.ok ? { ...r, ok: false, error: "Importi nuk u ruajt sepse ka rreshta me gabime." } : r);
    }
    const { error } = await context.supabase.rpc("commit_excel_import", { _kind: data.kind, _rows: validatedRows as import("@/integrations/supabase/types").Json, _filename: data.filename });
    if (error) {
      const message = error.code === "23505" ? "Importi nuk u ruajt: ka të dhëna të dyfishuara." : "Importi nuk u ruajt. Kontrolloni lidhjet dhe gjendjen e të dhënave; asnjë rresht nuk u shtua.";
      return result.map((r) => ({ ...r, ok: false, error: message }));
    }
  }
  return result;
});
