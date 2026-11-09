import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMyContext } from "@/lib/auth";
import { CONTEXT_LABELS } from "@/lib/requests";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/kerkesat/re")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { title: "Kërkesë e re – Baza Materiale" }, { name: "description", content: "Krijo një kërkesë të re për materiale." }, { property: "og:title", content: "Kërkesë e re – Baza Materiale" }, { property: "og:description", content: "Krijo një kërkesë të re për materiale." }] }),
  component: NewRequest,
});

type Option = { key: string; konteksti: string; label: string; class_group_id: string | null; subject_id: string | null; laboratory_id: string | null };

function NewRequest() {
  const { data: ctx } = useMyContext();
  const navigate = useNavigate();
  const [sel, setSel] = useState("");
  const [arsye, setArsye] = useState("");

  const year = useQuery({ queryKey: ["active-year"], queryFn: async () => (await supabase.from("school_years").select("id, emer").eq("aktiv", true).maybeSingle()).data });
  const opts = useQuery({
    queryKey: ["my-request-options", ctx?.teacher?.id, year.data?.id],
    enabled: !!ctx?.teacher && !!year.data,
    queryFn: async (): Promise<Option[]> => {
      const tid = ctx!.teacher!.id, yid = year.data!.id;
      const [ta, ha, la] = await Promise.all([
        supabase.from("teaching_assignments").select("class_group_id, subject_id, class_groups(emer), subjects(emer, lloji)").eq("teacher_id", tid).eq("school_year_id", yid).eq("aktiv", true),
        supabase.from("homeroom_assignments").select("class_group_id, class_groups(emer)").eq("teacher_id", tid).eq("school_year_id", yid).eq("aktiv", true),
        supabase.from("lab_assignments").select("laboratory_id, laboratories(emer)").eq("teacher_id", tid).eq("school_year_id", yid).eq("aktiv", true),
      ]);
      const out: Option[] = [];
      for (const a of ta.data ?? []) {
        const s = a.subjects as { emer: string; lloji: string | null } | null;
        const c = a.class_groups as { emer: string } | null;
        if (!s?.lloji) continue;
        out.push({ key: `t-${a.class_group_id}-${a.subject_id}`, konteksti: s.lloji, label: `${c?.emer} · ${s.emer}`, class_group_id: a.class_group_id, subject_id: a.subject_id, laboratory_id: null });
      }
      for (const h of ha.data ?? []) out.push({ key: `h-${h.class_group_id}`, konteksti: "kujdestari", label: `Kujdestari · ${(h.class_groups as { emer: string } | null)?.emer}`, class_group_id: h.class_group_id, subject_id: null, laboratory_id: null });
      for (const l of la.data ?? []) out.push({ key: `l-${l.laboratory_id}`, konteksti: "laborator", label: `Laborator · ${(l.laboratories as { emer: string } | null)?.emer}`, class_group_id: null, subject_id: null, laboratory_id: l.laboratory_id });
      return out;
    },
  });
  const unconfigured = useQuery({
    queryKey: ["my-unconfigured", ctx?.teacher?.id, year.data?.id],
    enabled: !!ctx?.teacher && !!year.data,
    queryFn: async () => {
      const { data } = await supabase.from("teaching_assignments").select("subjects!inner(lloji)").eq("teacher_id", ctx!.teacher!.id).eq("school_year_id", year.data!.id).eq("aktiv", true).is("subjects.lloji", null);
      return data?.length ?? 0;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const o = opts.data!.find((x) => x.key === sel)!;
      const { data, error } = await supabase.from("requests").insert({
        school_year_id: year.data!.id, teacher_id: ctx!.teacher!.id, krijuar_nga: ctx!.userId,
        konteksti: o.konteksti as never, class_group_id: o.class_group_id, subject_id: o.subject_id, laboratory_id: o.laboratory_id,
        arsyetimi: arsye.trim() || null,
      }).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => navigate({ to: "/kerkesat/$id", params: { id } }),
    onError: (e) => toast.error((e as Error).message),
  });

  if (!ctx?.teacher) return <p className="text-muted-foreground">Llogaria juaj nuk është e lidhur me një mësues. Kontaktoni administratorin.</p>;
  if (year.data === null) return <p className="text-muted-foreground">Nuk ka vit shkollor aktiv. Administratori duhet ta konfigurojë.</p>;

  const groups = Object.keys(CONTEXT_LABELS).map((k) => ({ k, items: (opts.data ?? []).filter((o) => o.konteksti === k) })).filter((g) => g.items.length);

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Kërkesë e re</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">Viti {year.data?.emer}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Konteksti (nga caktimet tuaja aktive) *</Label>
            <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={sel} onChange={(e) => setSel(e.target.value)}>
              <option value="">Zgjidh…</option>
              {groups.map((g) => (
                <optgroup key={g.k} label={CONTEXT_LABELS[g.k]}>
                  {g.items.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </optgroup>
              ))}
            </select>
            {opts.data && opts.data.length === 0 && <p className="text-sm text-destructive">Nuk keni caktime aktive. Kërkesat mund të krijohen vetëm brenda caktimeve tuaja.</p>}
            {!!unconfigured.data && <p className="text-xs text-muted-foreground">{unconfigured.data} caktim(e) nuk shfaqen sepse lloji i lëndës është “Për konfigurim”.</p>}
          </div>
          <div className="space-y-1"><Label>Arsyetimi</Label><Textarea value={arsye} onChange={(e) => setArsye(e.target.value)} placeholder="Për çfarë do të përdoren materialet?" /></div>
          <Button disabled={!sel || create.isPending} onClick={() => create.mutate()}>Krijo draftin</Button>
        </CardContent>
      </Card>
    </div>
  );
}
