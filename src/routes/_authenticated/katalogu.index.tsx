import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { searchItems, fmtLek, dbErr, type CatalogItem } from "@/lib/catalog";
import { useMyContext, hasRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Pencil, Plus, Lightbulb, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/katalogu/")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { title: "Katalogu – Baza Materiale" }, { name: "description", content: "Katalogu i centralizuar i artikujve." }, { property: "og:title", content: "Katalogu – Baza Materiale" }, { property: "og:description", content: "Katalogu i centralizuar i artikujve." }] }),
  component: Katalogu,
});

type Edit = { id?: string; emer: string; specifikime: string; unit_id: string; category_id: string; cmim_reference: string; aktiv: boolean };
const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

function Katalogu() {
  const { data: ctx } = useMyContext();
  const isAdmin = hasRole(ctx, "admin");
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  useEffect(() => { const t = setTimeout(() => setDq(q), 250); return () => clearTimeout(t); }, [q]);
  const items = useQuery({ queryKey: ["catalog", dq], queryFn: () => searchItems(dq, 200) });
  const units = useQuery({ queryKey: ["units"], queryFn: async () => (await supabase.from("units").select("id, kod, emer").order("kod")).data ?? [] });
  const cats = useQuery({ queryKey: ["categories"], queryFn: async () => (await supabase.from("categories").select("id, emer").order("emer")).data ?? [] });

  const [edit, setEdit] = useState<Edit | null>(null);
  const [synFor, setSynFor] = useState<CatalogItem | null>(null);
  const [syn, setSyn] = useState("");
  const [sug, setSug] = useState<{ emer: string; specifikime: string; njesia: string; arsye: string } | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["catalog"] });

  const save = useMutation({
    mutationFn: async (e: Edit) => {
      const p = {
        emer: e.emer.trim(),
        specifikime: e.specifikime.trim() || null,
        unit_id: e.unit_id,
        category_id: e.category_id || null,
        cmim_reference: e.cmim_reference.trim() === "" ? null : Number(e.cmim_reference),
        aktiv: e.aktiv,
      };
      const r = e.id ? await supabase.from("items").update(p).eq("id", e.id) : await supabase.from("items").insert(p);
      if (r.error) throw r.error;
    },
    onSuccess: () => { toast.success("Artikulli u ruajt."); setEdit(null); invalidate(); },
    onError: (e) => toast.error(dbErr(e as never)),
  });

  const addSyn = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("item_synonyms").insert({ item_id: synFor!.id, sinonim: syn.trim() });
      if (error) throw error;
    },
    onSuccess: () => { setSyn(""); invalidate(); setSynFor(null); toast.success("Sinonimi u shtua."); },
    onError: (e: { code?: string }) => toast.error(e.code === "23505" ? "Ky sinonim përdoret tashmë për një artikull." : "Sinonimi nuk u shtua."),
  });
  const delSyn = useMutation({
    mutationFn: async (v: { item_id: string; sinonim: string }) => {
      const { error } = await supabase.from("item_synonyms").delete().eq("item_id", v.item_id).eq("sinonim", v.sinonim);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });

  const suggest = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("item_suggestions").insert({
        sugjeruar_nga: ctx!.userId, emer: sug!.emer.trim(), specifikime: sug!.specifikime.trim() || null, njesia: sug!.njesia.trim() || null, arsye: sug!.arsye.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Sugjerimi u dërgua për shqyrtim."); setSug(null); qc.invalidateQueries({ queryKey: ["suggestions"] }); },
    onError: () => toast.error("Sugjerimi nuk u dërgua."),
  });

  const openEdit = (i?: CatalogItem) =>
    setEdit(i ? {
      id: i.id, emer: i.emer, specifikime: i.specifikime ?? "", unit_id: units.data?.find((u) => u.kod === i.njesia)?.id ?? "",
      category_id: cats.data?.find((c) => c.emer === i.kategoria)?.id ?? "", cmim_reference: i.cmim_reference === null ? "" : String(i.cmim_reference), aktiv: i.aktiv,
    } : { emer: "", specifikime: "", unit_id: "", category_id: "", cmim_reference: "", aktiv: true });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Katalogu i artikujve</h1>
          <p className="text-sm text-muted-foreground">Çdo artikull ka kod unik. Emri, specifikimi dhe njësia nuk mund të përsëriten.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Kërko sipas emrit, kodit, specifikimit ose sinonimit…" value={q} onChange={(e) => setQ(e.target.value)} className="w-80" />
          <Button variant="outline" onClick={() => setSug({ emer: q, specifikime: "", njesia: "", arsye: "" })}><Lightbulb className="mr-1 h-4 w-4" />Sugjero artikull</Button>
          <Button variant="outline" asChild><Link to="/katalogu/sugjerime">Sugjerimet</Link></Button>
          {isAdmin && <Button onClick={() => openEdit()}><Plus className="mr-1 h-4 w-4" />Artikull i ri</Button>}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Kodi</TableHead><TableHead>Emri</TableHead><TableHead>Specifikime</TableHead><TableHead>Njësia</TableHead><TableHead>Kategoria</TableHead><TableHead className="text-right">Çmim ref.</TableHead><TableHead>Sinonime</TableHead>{isAdmin && <TableHead />}</TableRow></TableHeader>
          <TableBody>
            {items.isLoading && <TableRow><TableCell colSpan={8}>Duke ngarkuar…</TableCell></TableRow>}
            {items.data?.length === 0 && <TableRow><TableCell colSpan={8} className="text-muted-foreground">{dq ? "Asnjë artikull nuk përputhet. Mund të dërgoni një sugjerim." : "Katalogu është bosh. Administratori shton artikujt e parë."}</TableCell></TableRow>}
            {items.data?.map((i) => (
              <TableRow key={i.id} className={i.aktiv ? "" : "opacity-50"}>
                <TableCell className="font-mono text-xs">{i.kod}</TableCell>
                <TableCell className="font-medium">{i.emer}{!i.aktiv && " (joaktiv)"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{i.specifikime}</TableCell>
                <TableCell>{i.njesia}</TableCell>
                <TableCell>{i.kategoria ?? <span className="text-xs italic text-muted-foreground">Për konfigurim</span>}</TableCell>
                <TableCell className="text-right font-mono text-sm">{i.cmim_reference === null ? <span className="text-xs italic text-muted-foreground">e panjohur</span> : fmtLek(i.cmim_reference)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {i.sinonime.map((s) => (
                      <span key={s} className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-xs">{s}
                        {isAdmin && <button aria-label="Hiq" onClick={() => delSyn.mutate({ item_id: i.id, sinonim: s })}><X className="h-3 w-3" /></button>}
                      </span>
                    ))}
                    {isAdmin && <button className="text-xs text-accent-foreground underline" onClick={() => setSynFor(i)}>+ sinonim</button>}
                  </div>
                </TableCell>
                {isAdmin && <TableCell><Button size="icon" variant="ghost" aria-label="Redakto" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button></TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Redakto artikullin" : "Artikull i ri"}</DialogTitle></DialogHeader>
          {edit && (
            <form id="item-form" className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!edit.unit_id) { toast.error("Zgjidhni njësinë."); return; } save.mutate(edit); }}>
              <div className="space-y-1"><Label>Emri *</Label><Input required value={edit.emer} onChange={(e) => setEdit({ ...edit, emer: e.target.value })} /></div>
              <div className="space-y-1"><Label>Specifikime</Label><Input value={edit.specifikime} onChange={(e) => setEdit({ ...edit, specifikime: e.target.value })} placeholder="p.sh. 1 kΩ, 0.25 W" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Njësia *</Label>
                  <select className={sel} value={edit.unit_id} onChange={(e) => setEdit({ ...edit, unit_id: e.target.value })}>
                    <option value="">Zgjidh…</option>{units.data?.map((u) => <option key={u.id} value={u.id}>{u.kod} – {u.emer}</option>)}
                  </select></div>
                <div className="space-y-1"><Label>Kategoria</Label>
                  <select className={sel} value={edit.category_id} onChange={(e) => setEdit({ ...edit, category_id: e.target.value })}>
                    <option value="">— Për konfigurim —</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.emer}</option>)}
                  </select></div>
              </div>
              <div className="space-y-1"><Label>Çmimi i referencës (Lek)</Label><Input type="number" min="0" step="0.01" value={edit.cmim_reference} onChange={(e) => setEdit({ ...edit, cmim_reference: e.target.value })} placeholder="Bosh nëse nuk dihet" /></div>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={edit.aktiv} onCheckedChange={(c) => setEdit({ ...edit, aktiv: !!c })} />Aktiv</label>
            </form>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Anulo</Button><Button type="submit" form="item-form" disabled={save.isPending}>Ruaj</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!synFor} onOpenChange={(o) => !o && setSynFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Sinonim për “{synFor?.emer}”</DialogTitle></DialogHeader>
          <Input value={syn} onChange={(e) => setSyn(e.target.value)} placeholder="p.sh. rezistor" />
          <DialogFooter><Button disabled={!syn.trim() || addSyn.isPending} onClick={() => addSyn.mutate()}>Shto</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!sug} onOpenChange={(o) => !o && setSug(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Sugjero artikull të ri</DialogTitle></DialogHeader>
          {sug && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Kontrolloni fillimisht katalogun. Administratori e shqyrton sugjerimin dhe e shton ose e bashkon me një artikull ekzistues.</p>
              <div className="space-y-1"><Label>Emri *</Label><Input value={sug.emer} onChange={(e) => setSug({ ...sug, emer: e.target.value })} /></div>
              <div className="space-y-1"><Label>Specifikime</Label><Input value={sug.specifikime} onChange={(e) => setSug({ ...sug, specifikime: e.target.value })} /></div>
              <div className="space-y-1"><Label>Njësia e propozuar</Label><Input value={sug.njesia} onChange={(e) => setSug({ ...sug, njesia: e.target.value })} placeholder="copë, m, pako…" /></div>
              <div className="space-y-1"><Label>Arsyeja / përdorimi</Label><Textarea value={sug.arsye} onChange={(e) => setSug({ ...sug, arsye: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button disabled={!sug?.emer.trim() || suggest.isPending} onClick={() => suggest.mutate()}>Dërgo</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
