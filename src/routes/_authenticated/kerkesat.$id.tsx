import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMyContext, hasRole } from "@/lib/auth";
import { CONTEXT_LABELS, STATUS_LABELS, fmtDate, fmtNum } from "@/lib/requests";
import { fmtLek } from "@/lib/catalog";
import { ItemPicker } from "@/components/ItemPicker";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/kerkesat/$id")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { title: "Kërkesa – Baza Materiale" }, { name: "description", content: "Detajet e kërkesës." }, { property: "og:title", content: "Kërkesa – Baza Materiale" }, { property: "og:description", content: "Detajet e kërkesës." }] }),
  component: RequestDetail,
});

type Line = { id: string; item_id: string; sasia: number; cmim_njesi: number | null; vlera: number | null; sasia_miratuar: number | null; sasia_dorezuar: number; shenim: string | null; items: { kod: string; emer: string; specifikime: string | null; units: { kod: string } | null } | null };

const errMsg = (e: unknown) => {
  const x = e as { code?: string; message?: string };
  if (x.code === "23505") return "Ky artikull është tashmë në kërkesë. Ndryshoni sasinë e rreshtit ekzistues.";
  return x.message ?? "Veprimi dështoi.";
};

function RequestDetail() {
  const { id } = Route.useParams();
  const { data: ctx } = useMyContext();
  const qc = useQueryClient();
  const isAdmin = hasRole(ctx, "admin");

  const req = useQuery({
    queryKey: ["request", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("requests").select("*, teachers(emer, mbiemer), class_groups(emer), subjects(emer), laboratories(emer), departments(emer), curricula(kod, emer), school_years(emer)").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const lines = useQuery({
    queryKey: ["request-lines", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("request_lines").select("id, item_id, sasia, cmim_njesi, vlera, sasia_miratuar, sasia_dorezuar, shenim, items(kod, emer, specifikime, units(kod))").eq("request_id", id).order("created_at");
      if (error) throw error;
      return data as unknown as Line[];
    },
  });
  const comments = useQuery({
    queryKey: ["request-comments", id],
    queryFn: async () => (await supabase.from("request_comments").select("*").eq("request_id", id).order("created_at")).data ?? [],
  });
  const history = useQuery({
    queryKey: ["request-history", id],
    queryFn: async () => {
      const [h, d] = await Promise.all([
        supabase.from("request_status_history").select("*").eq("request_id", id).order("kur"),
        supabase.from("request_decisions").select("*").eq("request_id", id).order("kur"),
      ]);
      return { h: h.data ?? [], d: d.data ?? [] };
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["request", id] });
    qc.invalidateQueries({ queryKey: ["request-lines", id] });
    qc.invalidateQueries({ queryKey: ["request-history", id] });
    qc.invalidateQueries({ queryKey: ["requests"] });
  };

  const r = req.data;
  const isOwner = !!r && r.teacher_id === ctx?.teacher?.id;
  const editable = isOwner && (r?.statusi === "draft" || r?.statusi === "kthyer_per_korrigjim");
  const canDecide = isAdmin && r?.statusi === "derguar";
  const isHead = !!r?.department_id && !!ctx?.roles.some((x) => x.role === "shef_departamenti" && x.department_id === r.department_id);

  const addLine = useMutation({
    mutationFn: async (i: { id: string; cmim_reference: number | null }) => {
      const { error } = await supabase.from("request_lines").insert({ request_id: id, item_id: i.id, sasia: 1, cmim_njesi: i.cmim_reference });
      if (error) throw error;
    },
    onSuccess: refresh, onError: (e) => toast.error(errMsg(e)),
  });
  const updLine = useMutation({
    mutationFn: async (v: { id: string; patch: { sasia?: number; cmim_njesi?: number | null; shenim?: string | null } }) => {
      const { error } = await supabase.from("request_lines").update(v.patch).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: refresh, onError: (e) => toast.error(errMsg(e)),
  });
  const delLine = useMutation({
    mutationFn: async (lid: string) => { const { error } = await supabase.from("request_lines").delete().eq("id", lid); if (error) throw error; },
    onSuccess: refresh, onError: (e) => toast.error(errMsg(e)),
  });
  const submit = useMutation({
    mutationFn: async () => { const { error } = await supabase.rpc("submit_request", { _id: id }); if (error) throw error; },
    onSuccess: () => { toast.success("Kërkesa u dërgua te administratori."); refresh(); }, onError: (e) => toast.error(errMsg(e)),
  });
  const delReq = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("requests").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Drafti u fshi."); window.history.back(); }, onError: (e) => toast.error(errMsg(e)),
  });

  // Vendimi i administratorit
  const [approved, setApproved] = useState<Record<string, string>>({});
  const [arsye, setArsye] = useState("");
  useEffect(() => {
    if (lines.data) setApproved(Object.fromEntries(lines.data.map((l) => [l.id, String(l.sasia_miratuar ?? l.sasia)])));
  }, [lines.data]);
  const decide = useMutation({
    mutationFn: async (vendimi: "mirato" | "kthe" | "refuzo") => {
      const payload = vendimi === "mirato" ? Object.entries(approved).map(([line_id, v]) => ({ line_id, sasia_miratuar: Number(v) })) : undefined;
      const args: { _id: string; _vendimi: string; _arsye?: string; _lines?: never } = { _id: id, _vendimi: vendimi };
      if (arsye.trim()) args._arsye = arsye.trim();
      if (payload) args._lines = payload as never;
      const { data, error } = await supabase.rpc("decide_request", args);
      if (error) throw error;
      return data;
    },
    onSuccess: (s) => { toast.success(`Vendimi u ruajt: ${STATUS_LABELS[String(s)]}`); setArsye(""); refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  // Komentet
  const [koment, setKoment] = useState("");
  const [lloji, setLloji] = useState<"koment" | "rekomandim">("koment");
  const addComment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("request_comments").insert({ request_id: id, autor: ctx!.userId, lloji, tekst: koment.trim() });
      if (error) throw error;
    },
    onSuccess: () => { setKoment(""); qc.invalidateQueries({ queryKey: ["request-comments", id] }); },
    onError: () => toast.error("Komenti nuk u ruajt."),
  });

  if (req.isLoading) return <p className="text-muted-foreground">Duke ngarkuar…</p>;
  if (!r) return <p className="text-muted-foreground">Kërkesa nuk u gjet ose nuk keni akses. <Link to="/kerkesat" search={{ statusi: "" }} className="underline">Kthehu</Link></p>;

  const L = lines.data ?? [];
  const known = L.filter((l) => l.vlera !== null);
  const total = known.reduce((s, l) => s + Number(l.vlera), 0);
  const rel = <T,>(x: unknown) => x as T | null;
  const decision = history.data?.d.at(-1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{r.numer}</p>
          <h1 className="text-2xl font-bold">{CONTEXT_LABELS[r.konteksti]} · {rel<{ emer: string }>(r.class_groups)?.emer ?? rel<{ emer: string }>(r.laboratories)?.emer}</h1>
          <p className="text-sm text-muted-foreground">
            {rel<{ emer: string; mbiemer: string | null }>(r.teachers)?.emer} {rel<{ emer: string; mbiemer: string | null }>(r.teachers)?.mbiemer}
            {r.subjects && ` · ${rel<{ emer: string }>(r.subjects)?.emer}`}
            {` · ${rel<{ emer: string }>(r.school_years)?.emer}`}
            {r.curricula ? ` · ${rel<{ kod: string }>(r.curricula)?.kod}` : " · Kurrikula: Për konfigurim"}
            {r.departments ? ` · ${rel<{ emer: string }>(r.departments)?.emer}` : ""}
          </p>
        </div>
        <StatusBadge s={r.statusi} />
      </div>

      {r.arsyetimi && <p className="rounded-md border bg-card p-3 text-sm"><b>Arsyetimi:</b> {r.arsyetimi}</p>}
      {decision?.arsye && (r.statusi === "kthyer_per_korrigjim" || r.statusi === "refuzuar" || r.statusi === "miratuar_pjeserisht") && (
        <p className="rounded-md border border-warning bg-warning/20 p-3 text-sm"><b>Arsyeja e administratorit:</b> {decision.arsye}</p>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Artikujt</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {editable && <ItemPicker onPick={(i) => addLine.mutate(i)} placeholder="Shto artikull nga katalogu…" />}
          {editable && <p className="text-xs text-muted-foreground">Artikulli mungon? <Link to="/katalogu" className="underline">Dërgoni sugjerim nga katalogu.</Link></p>}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Kodi</TableHead><TableHead>Artikulli</TableHead><TableHead>Njësia</TableHead><TableHead className="text-right">Sasia</TableHead><TableHead className="text-right">Çmimi/njësi</TableHead><TableHead className="text-right">Vlera</TableHead><TableHead className="text-right">Miratuar</TableHead><TableHead>Shënim</TableHead>{editable && <TableHead />}</TableRow></TableHeader>
              <TableBody>
                {L.length === 0 && <TableRow><TableCell colSpan={9} className="text-muted-foreground">Asnjë artikull.</TableCell></TableRow>}
                {L.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">{l.items?.kod}</TableCell>
                    <TableCell>{l.items?.emer}{l.items?.specifikime && <span className="block text-xs text-muted-foreground">{l.items.specifikime}</span>}</TableCell>
                    <TableCell>{l.items?.units?.kod}</TableCell>
                    <TableCell className="text-right">
                      {editable ? <Input type="number" min="0.01" step="0.01" defaultValue={l.sasia} className="ml-auto h-8 w-24 text-right" onBlur={(e) => { const v = Number(e.target.value); if (v > 0 && v !== Number(l.sasia)) updLine.mutate({ id: l.id, patch: { sasia: v } }); }} /> : fmtNum(l.sasia)}
                    </TableCell>
                    <TableCell className="text-right">
                      {editable ? <Input type="number" min="0" step="0.01" placeholder="e panjohur" defaultValue={l.cmim_njesi ?? ""} className="ml-auto h-8 w-28 text-right" onBlur={(e) => { const raw = e.target.value.trim(); const v = raw === "" ? null : Number(raw); if (v !== (l.cmim_njesi === null ? null : Number(l.cmim_njesi))) updLine.mutate({ id: l.id, patch: { cmim_njesi: v } }); }} /> : l.cmim_njesi === null ? <span className="text-xs italic text-muted-foreground">e panjohur</span> : fmtLek(l.cmim_njesi)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{l.vlera === null ? "" : fmtLek(l.vlera)}</TableCell>
                    <TableCell className="text-right">
                      {canDecide ? <Input type="number" min="0" max={l.sasia} step="0.01" value={approved[l.id] ?? ""} className="ml-auto h-8 w-24 text-right" onChange={(e) => setApproved({ ...approved, [l.id]: e.target.value })} /> : fmtNum(l.sasia_miratuar)}
                    </TableCell>
                    <TableCell>{editable ? <Input defaultValue={l.shenim ?? ""} className="h-8" onBlur={(e) => { if (e.target.value !== (l.shenim ?? "")) updLine.mutate({ id: l.id, patch: { shenim: e.target.value || null } }); }} /> : <span className="text-sm">{l.shenim}</span>}</TableCell>
                    {editable && <TableCell><Button size="icon" variant="ghost" aria-label="Hiq" onClick={() => delLine.mutate(l.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
              {L.length > 0 && (
                <TableFooter><TableRow><TableCell colSpan={5} className="text-right">Totali i njohur{known.length < L.length && ` (${L.length - known.length} rreshta pa çmim)`}</TableCell><TableCell className="text-right font-mono">{fmtLek(total)}</TableCell><TableCell colSpan={3} /></TableRow></TableFooter>
              )}
            </Table>
          </div>
          {editable && (
            <div className="flex flex-wrap gap-2">
              <Button disabled={!L.length || submit.isPending} onClick={() => confirm("Ta dërgoj kërkesën? Pas dërgimit nuk mund ta ndryshoni.") && submit.mutate()}>Dërgo te administratori</Button>
              {r.statusi === "draft" && <Button variant="ghost" className="text-destructive" onClick={() => confirm("Ta fshij draftin?") && delReq.mutate()}>Fshi draftin</Button>}
            </div>
          )}
        </CardContent>
      </Card>

      {canDecide && (
        <Card className="border-primary">
          <CardHeader><CardTitle className="text-base">Vendimi i administratorit</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Rregulloni kolonën “Miratuar” për miratim të pjesshëm. Arsyeja kërkohet për miratim të pjesshëm, kthim dhe refuzim.</p>
            <div className="space-y-1"><Label>Arsyeja / shënim</Label><Textarea value={arsye} onChange={(e) => setArsye(e.target.value)} /></div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={decide.isPending} onClick={() => decide.mutate("mirato")}>Mirato</Button>
              <Button variant="outline" disabled={decide.isPending} onClick={() => decide.mutate("kthe")}>Kthe për korrigjim</Button>
              <Button variant="destructive" disabled={decide.isPending} onClick={() => confirm("Ta refuzoj kërkesën?") && decide.mutate("refuzo")}>Refuzo</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Komente dhe rekomandime</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {comments.data?.length === 0 && <p className="text-sm text-muted-foreground">Asnjë koment.</p>}
            {comments.data?.map((c) => (
              <div key={c.id} className={`rounded-md border p-2 text-sm ${c.lloji === "rekomandim" ? "border-accent bg-accent/10" : ""}`}>
                <p className="text-xs text-muted-foreground">{c.lloji === "rekomandim" ? "Rekomandim i shefit të departamentit" : "Koment"} · {fmtDate(c.created_at)}{c.autor === ctx?.userId ? " · ju" : ""}</p>
                <p>{c.tekst}</p>
              </div>
            ))}
            {r.statusi !== "draft" || isOwner ? (
              <div className="space-y-2">
                <Textarea value={koment} onChange={(e) => setKoment(e.target.value)} placeholder="Shkruani një koment…" />
                <div className="flex gap-2">
                  {isHead && (
                    <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={lloji} onChange={(e) => setLloji(e.target.value as never)}>
                      <option value="koment">Koment</option><option value="rekomandim">Rekomandim</option>
                    </select>
                  )}
                  <Button size="sm" disabled={!koment.trim() || addComment.isPending} onClick={() => addComment.mutate()}>Shto</Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Historiku</CardTitle></CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              {history.data?.h.map((h) => (
                <li key={h.id} className="flex justify-between gap-2 border-b pb-1">
                  <span>{h.nga ? `${STATUS_LABELS[h.nga]} → ` : "Krijuar: "}{STATUS_LABELS[h.ne]}</span>
                  <span className="font-mono text-xs text-muted-foreground">{new Date(h.kur).toLocaleString("sq-AL")}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
