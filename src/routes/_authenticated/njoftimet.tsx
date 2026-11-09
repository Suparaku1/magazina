import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { notificationsQuery } from "@/lib/dashboard";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtDate } from "@/lib/requests";

export const Route = createFileRoute("/_authenticated/njoftimet")({
  head: () => ({ meta: [{ title: "Njoftimet – Baza Materiale" }, { name: "description", content: "Njoftimet personale për kërkesat, vendimet dhe dorëzimet." }, { property: "og:title", content: "Njoftimet – Baza Materiale" }, { property: "og:description", content: "Vendimet dhe dorëzimet e kërkesave tuaja." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(notificationsQuery),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { data } = useSuspenseQuery(notificationsQuery);
  const [filter, setFilter] = useState("all");
  const qc = useQueryClient();
  const mark = useMutation({
    mutationFn: async (id: string | null) => {
      let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
      if (id) q = q.eq("id", id);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notifications"] }); qc.invalidateQueries({ queryKey: ["notifications-unread"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
    onError: () => toast.error("Njoftimi nuk u shënua si i lexuar."),
  });
  const visible = filter === "unread" ? data.filter(n => !n.read_at) : data;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">Njoftimet</h1><Button variant="outline" size="sm" onClick={() => mark.mutate(null)} disabled={mark.isPending || !data.some(n => !n.read_at)}><CheckCheck className="mr-2 h-4 w-4" />Lexoji të gjitha</Button></div>
    <Tabs value={filter} onValueChange={setFilter}><TabsList><TabsTrigger value="all">Të gjitha</TabsTrigger><TabsTrigger value="unread">Të palexuara</TabsTrigger></TabsList></Tabs>
    <div className="divide-y border-y">
      {visible.length ? visible.map(n => <div key={n.id} className="flex items-start gap-3 py-4">
        <Bell className={`mt-1 h-4 w-4 shrink-0 ${n.read_at ? "text-muted-foreground" : "text-accent"}`} />
        <div className="min-w-0 flex-1"><Link to="/kerkesat/$id" params={{ id: n.request_id }} className={`break-words hover:underline ${n.read_at ? "font-medium" : "font-semibold"}`}>{n.titulli}</Link><p className="mt-1 break-words text-sm text-muted-foreground">{n.mesazhi}</p><time className="mt-2 block text-xs text-muted-foreground">{fmtDate(n.created_at)}</time></div>
        {!n.read_at && <Button variant="ghost" size="icon" title="Shëno si të lexuar" aria-label="Shëno si të lexuar" disabled={mark.isPending} onClick={() => mark.mutate(n.id)}><Check className="h-4 w-4" /></Button>}
      </div>) : <p className="py-12 text-center text-muted-foreground">Nuk ka njoftime{filter === "unread" ? " të palexuara" : ""}.</p>}
    </div>
  </div>;
}