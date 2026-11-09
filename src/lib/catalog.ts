import { supabase } from "@/integrations/supabase/client";

export type CatalogItem = {
  id: string;
  kod: string;
  emer: string;
  specifikime: string | null;
  njesia: string;
  kategoria: string | null;
  cmim_reference: number | null;
  aktiv: boolean;
  sinonime: string[];
};

export async function searchItems(q: string, limit = 50): Promise<CatalogItem[]> {
  const { data, error } = await supabase.rpc("search_items", { _q: q, _limit: limit });
  if (error) throw error;
  return (data ?? []) as CatalogItem[];
}

export const fmtLek = (v: number | null | undefined) =>
  v === null || v === undefined ? "" : `${new Intl.NumberFormat("sq-AL", { maximumFractionDigits: 2 }).format(v)} Lek`;

export function dbErr(e: { code?: string; message?: string }) {
  if (e.code === "23505") return "Ky artikull ekziston tashmë me të njëjtin emër, specifikim dhe njësi. Përdorni artikullin ekzistues.";
  if (e.code === "42501") return "Nuk keni të drejtë për këtë veprim.";
  if (e.code === "23503") return "Artikulli përdoret diku tjetër dhe nuk mund të fshihet.";
  return e.message ?? "Veprimi dështoi.";
}
