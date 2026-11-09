import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listUsers, inviteUser } from "@/lib/users.functions";
import { ROLE_LABELS, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/perdoruesit")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { title: "Përdoruesit – Baza Materiale" }, { name: "description", content: "Ftesat dhe rolet e përdoruesve." }, { property: "og:title", content: "Përdoruesit – Baza Materiale" }, { property: "og:description", content: "Ftesat dhe rolet e përdoruesve." }] }),
  component: UsersPage,
});

const ROLES: AppRole[] = ["admin", "shef_departamenti", "mesues", "magazinier"];
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("sq-AL", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, ".") : "—");

function UsersPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listUsers);
  const inviteFn = useServerFn(inviteUser);
  const users = useQuery({ queryKey: ["users"], queryFn: () => listFn() });
  const roles = useQuery({
    queryKey: ["all-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("id, user_id, role, department_id, departments(emer)");
      if (error) throw error;
      return data;
    },
  });
  const teachers = useQuery({
    queryKey: ["teachers-min"],
    queryFn: async () => (await supabase.from("teachers").select("id, emer, mbiemer, email, user_id").order("emer")).data ?? [],
  });
  const depts = useQuery({ queryKey: ["depts"], queryFn: async () => (await supabase.from("departments").select("id, emer")).data ?? [] });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [sel, setSel] = useState<{ role: AppRole; department_id: string | null }[]>([]);
  const [newRole, setNewRole] = useState<AppRole>("magazinier");
  const [newDept, setNewDept] = useState("");

  const invite = useMutation({
    mutationFn: () => inviteFn({ data: { email, password: password || undefined, teacher_id: teacherId || null, roles: sel, redirectTo: `${window.location.origin}/reset-password` } }),
    onSuccess: () => {
      toast.success(password ? "Llogaria u krijua." : "Ftesa u dërgua.");
      setEmail(""); setPassword(""); setTeacherId(""); setSel([]);
      qc.invalidateQueries();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const addRole = useMutation({
    mutationFn: async (v: { user_id: string; role: AppRole; department_id: string | null }) => {
      const { error } = await supabase.from("user_roles").insert(v);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-roles"] }),
    onError: (e: { code?: string }) => toast.error(e.code === "23505" ? "Roli ekziston." : e.code === "23514" ? "Shefi i departamentit kërkon departament." : "Roli nuk u shtua."),
  });
  const removeRole = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-roles"] }),
    onError: () => toast.error("Roli nuk u hoq."),
  });

  const teacherOf = (uid: string) => teachers.data?.find((t) => t.user_id === uid);
  const selectCls = "h-9 rounded-md border border-input bg-background px-2 text-sm";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Përdoruesit dhe rolet</h1>
      <Card>
        <CardHeader><CardTitle>Fto përdorues të ri</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1"><Label>Email *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-1"><Label>Fjalëkalimi fillestar (opsional)</Label><Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Lidhe me mësuesin (opsionale)</Label>
              <select className={`${selectCls} w-full`} value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                <option value="">— Jo mësues (p.sh. magazinier) —</option>
                {teachers.data?.filter((t) => !t.user_id).map((t) => <option key={t.id} value={t.id}>{t.emer} {t.mbiemer ?? "(mbiemri për konfigurim)"}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">Mësuesit e lidhur marrin automatikisht rolin “Mësues” dhe rolet e paracaktuara.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <select className={selectCls} value={newRole} onChange={(e) => setNewRole(e.target.value as AppRole)}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            {newRole === "shef_departamenti" && (
              <select className={selectCls} value={newDept} onChange={(e) => setNewDept(e.target.value)}>
                <option value="">Departamenti…</option>
                {depts.data?.map((d) => <option key={d.id} value={d.id}>{d.emer}</option>)}
              </select>
            )}
            <Button variant="outline" onClick={() => {
              if (newRole === "shef_departamenti" && !newDept) { toast.error("Zgjidhni departamentin."); return; }
              setSel([...sel, { role: newRole, department_id: newRole === "shef_departamenti" ? newDept : null }]);
            }}>Shto rolin</Button>
            {sel.map((r, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-1 text-xs">
                {ROLE_LABELS[r.role]}{r.department_id ? ` · ${depts.data?.find((d) => d.id === r.department_id)?.emer}` : ""}
                <button onClick={() => setSel(sel.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
          <Button disabled={!email || invite.isPending || (!!password && password.length < 8)} onClick={() => invite.mutate()}>{password ? "Krijo llogarinë" : "Dërgo ftesën"}</Button>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Mësuesi</TableHead><TableHead>Rolet</TableHead><TableHead>Ftuar</TableHead><TableHead>Hyrja e fundit</TableHead></TableRow></TableHeader>
          <TableBody>
            {users.isLoading && <TableRow><TableCell colSpan={5}>Duke ngarkuar…</TableCell></TableRow>}
            {users.error && <TableRow><TableCell colSpan={5} className="text-destructive">{(users.error as Error).message}</TableCell></TableRow>}
            {users.data?.map((u) => {
              const t = teacherOf(u.id);
              return (
                <TableRow key={u.id}>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{t ? `${t.emer} ${t.mbiemer ?? ""}` : "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      {roles.data?.filter((r) => r.user_id === u.id).map((r) => (
                        <span key={r.id} className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-xs">
                          {ROLE_LABELS[r.role as AppRole]}{r.departments ? ` · ${(r.departments as { emer: string }).emer}` : ""}
                          <button aria-label="Hiq rolin" onClick={() => confirm("Ta heq këtë rol?") && removeRole.mutate(r.id)}><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                      <select className="h-7 rounded border border-input bg-background text-xs" value="" onChange={(e) => {
                        const [role, dept] = e.target.value.split("|");
                        if (role) addRole.mutate({ user_id: u.id, role: role as AppRole, department_id: dept || null });
                      }}>
                        <option value="">+ rol</option>
                        {ROLES.filter((r) => r !== "shef_departamenti").map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        {depts.data?.map((d) => <option key={d.id} value={`shef_departamenti|${d.id}`}>Shef · {d.emer}</option>)}
                      </select>
                    </div>
                  </TableCell>
                  <TableCell>{fmt(u.invited_at)}</TableCell>
                  <TableCell>{fmt(u.last_sign_in_at)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
