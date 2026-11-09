import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMyContext, hasRole } from "@/lib/auth";
import { ItemPicker } from "@/components/ItemPicker";
import { dbErr, type CatalogItem } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/katalogu/sugjerime")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { title: "Sugjerimet e artikujve – Baza Materiale" }, { name: "description", content: "Shqyrtimi i artikujve të sugjeruar." }, { property: "og:title", content: "Sugjerimet – Baza Materiale" }, { property: "og:description", content: "Shqyrtimi i artikujve të sugjeruar." }] }),
  component: Sugjerimet,
});

const STATUS: Record<string, string> = { ne_shqyrtim: "Në shqyrtim", pranuar: "Pranuar (artikull i ri)", bashkuar: "Bashkuar me ekzistues", refuzuar: "Refuzuar" };
const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
type Sug = { id: string; emer: string; specifikime: string | null; njesia: string | null; arsye: string | null; statusi: string; shenim_admin: string | null; created_at: string; items: { kod: string; emer: string } | null };

function Sugjerimet() {
  const { data: ctx } = useMyContext();
  const isAdmin = hasRole(ctx, "admin");
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["suggestions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("item_suggestions").select("id, emer, specifikime, njesia, arsye, statusi, shenim_admin, created_at, items(kod, emer)").order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Sug[];
    },
  });
  const units = useQuery({ queryKey: ["units"], queryFn: async () => (await supabase.from("units").select("id, kod, emer").order("kod")).data ?? [] });
  const cats = useQuery({ queryKey: ["categories"], queryFn: async () => (await supabase.from("categories").select("id, emer").order("emer")).data ?? [] });

  const [rev, setRev] = useState<{ s: Sug; mode: "pranuar" | "bashkuar" | "refuzuar"; emer: string; specifikime: string; unit_id: string; category_id: string; item: CatalogItem | null; shenim: string } | null>(null);

  const review = useMutation({
    mutationFn: async () => {
      const r = rev!;
      const args: Record<string, string> = { _id: r.s.id, _veprimi: r.mode, _emer: r.emer };
      if (r.item) args["_item_id"] = r.item.id;
      if (r.specifikime) args["_specifikime"] = r.specifikime;
      if (r.unit_id) args["_unit_id"] = r.unit_id;
      if (r.category_id) args["_category_id"] = r.category_id;
      if (r.shenim) args["_shenim"] = r.shenim;
      const { error } = await supabase.rpc("review_suggestion", args as { _id: string; _veprimi: string });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Sugjerimi u shqyrtua."); setRev(null); qc.invalidateQueries({ queryKey: ["suggestions"] }); qc.invalidateQueries({ queryKey: ["catalog"] }); },
    onError: (e) => toast.error(dbErr(e as never)),
  });

  const start = (s: Sug, mode: "pranuar" | "bashkuar" | "refuzuar") =>
    setRev({ s, mode, emer: s.emer, specifikime: s.specifikime ?? "", unit_id: units.data?.find((u) => u.kod.toLowerCase() === (s.njesia ?? "").toLowerCase().trim())?.id ?? "", category_id: "", item: null, shenim: "" });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sugjerimet për artikuj</h1>
          <p className="text-sm text-muted-foreground">{isAdmin ? "Pranoni si artikull të ri, bashkoni me një ekzistues ose refuzoni me arsye." : "Sugjerimet tuaja dhe statusi i tyre."}</p>
        </div>
        <Button variant="outline" asChild><Link to="/katalogu">Kthehu te katalogu</Link></Button>
      </div>
      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Emri</TableHead><TableHead>Specifikime</TableHead><TableHead>Njësia</TableHead><TableHead>Arsyeja</TableHead><TableHead>Statusi</TableHead>{isAdmin && <TableHead />}</TableRow></TableHeader>
          <TableBody>
            {list.data?.length === 0 && <TableRow><TableCell colSpan={7} className="text-muted-foreground">Asnjë sugjerim.</TableCell></TableRow>}
            {list.data?.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{new Date(s.created_at).toLocaleDateString("sq-AL", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, ".")}</TableCell>
                <TableCell className="font-medium">{s.emer}</TableCell>
                <TableCell>{s.specifikime}</TableCell>
                <TableCell>{s.njesia}</TableCell>
                <TableCell className="max-w-xs text-sm text-muted-foreground">{s.arsye}</TableCell>
                <TableCell className="text-sm">{STATUS[s.statusi]}{s.items && <span className="block font-mono text-xs text-muted-foreground">{s.items.kod} – {s.items.emer}</span>}{s.shenim_admin && <span className="block text-xs text-muted-foreground">{s.shenim_admin}</span>}</TableCell>
                {isAdmin && (
                  <TableCell className="whitespace-nowrap">
                    {s.statusi === "ne_shqyrtim" && (
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => start(s, "pranuar")}>Prano</Button>
                        <Button size="sm" variant="outline" onClick={() => start(s, "bashkuar")}>Bashko</Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => start(s, "refuzuar")}>Refuzo</Button>
                      </div>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!rev} onOpenChange={(o) => !o && setRev(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{rev?.mode === "pranuar" ? "Prano si artikull të ri" : rev?.mode === "bashkuar" ? "Bashko me artikull ekzistues" : "Refuzo sugjerimin"}</DialogTitle></DialogHeader>
          {rev && (
            <div className="space-y-3">
              {rev.mode === "pranuar" && (
                <>
                  <div className="space-y-1"><Label>Emri</Label><Input value={rev.emer} onChange={(e) => setRev({ ...rev, emer: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Specifikime</Label><Input value={rev.specifikime} onChange={(e) => setRev({ ...rev, specifikime: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Njësia *</Label>
                    <select className={sel} value={rev.unit_id} onChange={(e) => setRev({ ...rev, unit_id: e.target.value })}>
                      <option value="">Zgjidh…</option>{units.data?.map((u) => <option key={u.id} value={u.id}>{u.kod} – {u.emer}</option>)}
                    </select></div>
                  <div className="space-y-1"><Label>Kategoria</Label>
                    <select className={sel} value={rev.category_id} onChange={(e) => setRev({ ...rev, category_id: e.target.value })}>
                      <option value="">— Për konfigurim —</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.emer}</option>)}
                    </select></div>
                </>
              )}
              {rev.mode === "bashkuar" && (
                <>
                  <ItemPicker onPick={(i) => setRev({ ...rev, item: i })} />
                  {rev.item && <p className="text-sm">Zgjedhur: <b>{rev.item.emer}</b> {rev.item.specifikime} ({rev.item.njesia}). Emri “{rev.s.emer}” shtohet si sinonim.</p>}
                </>
              )}
              <div className="space-y-1"><Label>Shënim{rev.mode === "refuzuar" && " / arsyeja *"}</Label><Input value={rev.shenim} onChange={(e) => setRev({ ...rev, shenim: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setRev(null)}>Anulo</Button><Button disabled={review.isPending} onClick={() => review.mutate()}>Konfirmo</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
