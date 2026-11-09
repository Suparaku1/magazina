import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate, fmtNum } from "@/lib/requests";
import { fmtLek } from "@/lib/catalog";
import { MOVEMENT_LABELS } from "@/lib/stock";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/magazina/levizje")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { title: "Lëvizjet e magazinës – Baza Materiale" }, { name: "description", content: "Regjistri i hyrje-daljeve." }, { property: "og:title", content: "Lëvizjet e magazinës – Baza Materiale" }, { property: "og:description", content: "Regjistri i hyrje-daljeve." }] }),
  component: Levizje,
});

type Mv = { id: number; lloji: string; sasia: number; bilanci_pas: number; cmim_njesi: number | null; dokument: string | null; arsye: string | null; kur: string; request_line_id: string | null; items: { kod: string; emer: string; units: { kod: string } | null } | null; request_lines: { requests: { id: string; numer: string } | null } | null };

function Levizje() {
  const [lloji, setLloji] = useState("");
  const list = useQuery({
    queryKey: ["stock", "movements", lloji],
    queryFn: async () => {
      let qb = supabase.from("stock_movements").select("id, lloji, sasia, bilanci_pas, cmim_njesi, dokument, arsye, kur, request_line_id, items(kod, emer, units(kod)), request_lines(requests(id, numer))").order("kur", { ascending: false }).limit(500);
      if (lloji) qb = qb.eq("lloji", lloji as never);
      const { data, error } = await qb;
      if (error) throw error;
      return data as unknown as Mv[];
    },
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Regjistri i lëvizjeve</h1>
          <p className="text-sm text-muted-foreground">Historik i pandryshueshëm. Gabimet ndreqen me korrigjim të ri.</p>
        </div>
        <div className="flex gap-2">
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={lloji} onChange={(e) => setLloji(e.target.value)}>
            <option value="">Të gjitha llojet</option>
            {Object.entries(MOVEMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <Button asChild variant="outline"><Link to="/magazina">Kthehu</Link></Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Lloji</TableHead><TableHead>Artikulli</TableHead><TableHead className="text-right">Sasia</TableHead><TableHead className="text-right">Gjendja pas</TableHead><TableHead className="text-right">Çmimi</TableHead><TableHead>Kërkesa</TableHead><TableHead>Dokument / arsye</TableHead></TableRow></TableHeader>
          <TableBody>
            {(list.data ?? []).map((m) => (
              <TableRow key={m.id}>
                <TableCell>{fmtDate(m.kur)}</TableCell>
                <TableCell>{MOVEMENT_LABELS[m.lloji]}</TableCell>
                <TableCell>{m.items?.emer} <span className="font-mono text-xs text-muted-foreground">{m.items?.kod}</span></TableCell>
                <TableCell className={`text-right ${Number(m.sasia) < 0 ? "text-destructive" : "text-success"}`}>{Number(m.sasia) > 0 ? "+" : ""}{fmtNum(Number(m.sasia))} {m.items?.units?.kod}</TableCell>
                <TableCell className="text-right">{fmtNum(Number(m.bilanci_pas))}</TableCell>
                <TableCell className="text-right">{fmtLek(m.cmim_njesi)}</TableCell>
                <TableCell>{m.request_lines?.requests ? <Link to="/kerkesat/$id" params={{ id: m.request_lines.requests.id }} className="underline">{m.request_lines.requests.numer}</Link> : ""}</TableCell>
                <TableCell className="text-sm">{[m.dokument, m.arsye].filter(Boolean).join(" · ")}</TableCell>
              </TableRow>
            ))}
            {!list.isLoading && !list.data?.length && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground">Nuk ka lëvizje.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
