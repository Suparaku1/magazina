import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMyContext, hasRole } from "@/lib/auth";
import { fmtDate, fmtNum } from "@/lib/requests";
import { StockMovementForm } from "@/components/StockMovementForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/magazina/")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { title: "Magazina – Baza Materiale" }, { name: "description", content: "Gjendja aktuale e magazinës." }, { property: "og:title", content: "Magazina – Baza Materiale" }, { property: "og:description", content: "Gjendja aktuale e magazinës." }] }),
  component: Magazina,
});

type Bal = { item_id: string; sasia: number; perditesuar_me: string; items: { kod: string; emer: string; specifikime: string | null; units: { kod: string } | null } | null };

function Magazina() {
  const { data: ctx } = useMyContext();
  const canWrite = hasRole(ctx, "magazinier") || hasRole(ctx, "admin");
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["stock", "balances"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_balances").select("item_id, sasia, perditesuar_me, items(kod, emer, specifikime, units(kod))").order("perditesuar_me", { ascending: false });
      if (error) throw error;
      return data as unknown as Bal[];
    },
  });
  const rows = (list.data ?? []).filter((r) => !q || `${r.items?.kod} ${r.items?.emer} ${r.items?.specifikime}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Magazina</h1>
          <p className="text-sm text-muted-foreground">Stoku ndryshon vetëm nga lëvizjet e regjistruara; kërkesat nuk e ndryshojnë.</p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link to="/magazina/dorezime">Dorëzimet</Link></Button>
            <Button asChild variant="outline"><Link to="/magazina/levizje">Regjistri i lëvizjeve</Link></Button>
          </div>
        )}
      </div>
      {canWrite && <StockMovementForm />}
      <Input placeholder="Kërko artikull…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Kodi</TableHead><TableHead>Artikulli</TableHead><TableHead>Njësia</TableHead><TableHead className="text-right">Gjendja</TableHead><TableHead>Përditësuar</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.item_id}>
                <TableCell className="font-mono text-xs">{r.items?.kod}</TableCell>
                <TableCell>{r.items?.emer}{r.items?.specifikime ? <span className="text-muted-foreground"> · {r.items.specifikime}</span> : null}</TableCell>
                <TableCell>{r.items?.units?.kod}</TableCell>
                <TableCell className={`text-right font-medium ${Number(r.sasia) === 0 ? "text-destructive" : ""}`}>{fmtNum(Number(r.sasia))}</TableCell>
                <TableCell>{fmtDate(r.perditesuar_me)}</TableCell>
              </TableRow>
            ))}
            {!list.isLoading && rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Ende nuk ka gjendje të regjistruar.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
