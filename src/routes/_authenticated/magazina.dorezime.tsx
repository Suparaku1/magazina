import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtNum } from "@/lib/requests";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/magazina/dorezime")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { title: "Dorëzimet – Baza Materiale" }, { name: "description", content: "Përmbushja e kërkesave të miratuara." }, { property: "og:title", content: "Dorëzimet – Baza Materiale" }, { property: "og:description", content: "Përmbushja e kërkesave të miratuara." }] }),
  component: Dorezime,
});

type L = { id: string; item_id: string; sasia_miratuar: number | null; sasia_dorezuar: number; items: { kod: string; emer: string; units: { kod: string } | null } | null; requests: { id: string; numer: string; statusi: string; teachers: { emer: string; mbiemer: string | null } | null } | null };

function Dorezime() {
  const qc = useQueryClient();
  const [qty, setQty] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"dalje" | "kthim">("dalje");
  const list = useQuery({
    queryKey: ["stock", "deliveries", mode],
    queryFn: async () => {
      const [{ data, error }, { data: bal, error: e2 }] = await Promise.all([
        supabase.from("request_lines").select("id, item_id, sasia_miratuar, sasia_dorezuar, items(kod, emer, units(kod)), requests!inner(id, numer, statusi, teachers(emer, mbiemer))").in("requests.statusi", ["miratuar", "miratuar_pjeserisht", "ne_permbushje", "permbushur"]),
        supabase.from("stock_balances").select("item_id, sasia"),
      ]);
      if (error) throw error;
      if (e2) throw e2;
      const stock = new Map((bal ?? []).map((b) => [b.item_id, Number(b.sasia)]));
      return { lines: (data as unknown as L[]).filter((l) => mode === "kthim" ? Number(l.sasia_dorezuar) > 0 : Number(l.sasia_miratuar ?? 0) > Number(l.sasia_dorezuar)), stock };
    },
  });
  const deliver = useMutation({
    mutationFn: async (l: L) => {
      const q = Number((qty[l.id] ?? "").replace(",", "."));
      if (!Number.isFinite(q) || q <= 0) throw new Error("Shkruani sasinë për dorëzim");
      const { error } = await supabase.rpc("record_stock_movement", { _item_id: l.item_id, _lloji: mode, _sasia: q, _request_line_id: l.id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success(mode === "kthim" ? "Kthimi u regjistrua" : "Dorëzimi u regjistrua"); setQty({}); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dorëzimet</h1>
          <p className="text-sm text-muted-foreground">Rreshtat e miratuar që presin dorëzim. Lejohet dorëzim i pjesshëm.</p>
        </div>
        <Button asChild variant="outline"><Link to="/magazina">Kthehu</Link></Button>
      </div>
      <div className="flex gap-2"><Button variant={mode === "dalje" ? "default" : "outline"} onClick={() => { setMode("dalje"); setQty({}); }}>Dorëzime</Button><Button variant={mode === "kthim" ? "default" : "outline"} onClick={() => { setMode("kthim"); setQty({}); }}>Kthime nga kërkesat</Button></div>
      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Kërkesa</TableHead><TableHead>Mësuesi</TableHead><TableHead>Artikulli</TableHead><TableHead className="text-right">Miratuar</TableHead><TableHead className="text-right">Dorëzuar</TableHead><TableHead className="text-right">Në magazinë</TableHead><TableHead>Dorëzo</TableHead></TableRow></TableHeader>
          <TableBody>
            {(list.data?.lines ?? []).map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.requests && <><Link to="/kerkesat/$id" params={{ id: l.requests.id }} className="underline">{l.requests.numer}</Link> <StatusBadge s={l.requests.statusi} /></>}</TableCell>
                <TableCell>{l.requests?.teachers?.emer} {l.requests?.teachers?.mbiemer}</TableCell>
                <TableCell>{l.items?.emer} <span className="font-mono text-xs text-muted-foreground">{l.items?.kod}</span></TableCell>
                <TableCell className="text-right">{fmtNum(Number(l.sasia_miratuar))} {l.items?.units?.kod}</TableCell>
                <TableCell className="text-right">{fmtNum(Number(l.sasia_dorezuar))}</TableCell>
                <TableCell className="text-right">{fmtNum(list.data?.stock.get(l.item_id) ?? 0)}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Input className="h-8 w-20" inputMode="decimal" value={qty[l.id] ?? ""} onChange={(e) => setQty({ ...qty, [l.id]: e.target.value })} />
                    <Button size="sm" onClick={() => deliver.mutate(l)} disabled={deliver.isPending}>{mode === "kthim" ? "Regjistro kthimin" : "Dorëzo"}</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!list.isLoading && !list.data?.lines.length && <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground">Nuk ka rreshta në pritje të dorëzimit.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
