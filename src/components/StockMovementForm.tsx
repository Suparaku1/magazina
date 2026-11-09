import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ItemPicker } from "@/components/ItemPicker";
import type { CatalogItem } from "@/lib/catalog";
import { MOVEMENT_LABELS } from "@/lib/stock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

/** Regjistron lëvizje magazine pa lidhje me kërkesë (dorëzimet bëhen te "Dorëzimet"). */
export function StockMovementForm() {
  const qc = useQueryClient();
  const [item, setItem] = useState<CatalogItem | null>(null);
  const [lloji, setLloji] = useState("hyrje");
  const [sasia, setSasia] = useState("");
  const [cmim, setCmim] = useState("");
  const [dokument, setDokument] = useState("");
  const [arsye, setArsye] = useState("");

  const m = useMutation({
    mutationFn: async () => {
      if (!item) throw new Error("Zgjidhni artikullin");
      const q = Number(sasia.replace(",", "."));
      if (!Number.isFinite(q) || q === 0) throw new Error("Sasia nuk është e vlefshme");
      const args: { _item_id: string; _lloji: string; _sasia: number; _cmim_njesi?: number; _dokument?: string; _arsye?: string } = { _item_id: item.id, _lloji: lloji, _sasia: q };
      if (cmim.trim()) args._cmim_njesi = Number(cmim.replace(",", "."));
      if (dokument.trim()) args._dokument = dokument;
      if (arsye.trim()) args._arsye = arsye;
      const { error } = await supabase.rpc("record_stock_movement", args);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Lëvizja u regjistrua");
      setItem(null); setSasia(""); setCmim(""); setDokument(""); setArsye("");
      qc.invalidateQueries({ queryKey: ["stock"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Regjistro lëvizje</CardTitle></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2 space-y-1">
          <Label>Artikulli</Label>
          {item ? (
            <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>{item.emer}{item.specifikime ? ` · ${item.specifikime}` : ""} <span className="font-mono text-xs text-muted-foreground">{item.kod} · {item.njesia}</span></span>
              <Button variant="ghost" size="sm" onClick={() => setItem(null)}>Ndrysho</Button>
            </div>
          ) : <ItemPicker onPick={setItem} />}
        </div>
        <div className="space-y-1">
          <Label>Lloji</Label>
          <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={lloji} onChange={(e) => setLloji(e.target.value)}>
            {["inventar_fillestar", "hyrje", "dalje", "kthim", "korrigjim"].map((k) => <option key={k} value={k}>{MOVEMENT_LABELS[k]}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Sasia {lloji === "korrigjim" && <span className="text-xs text-muted-foreground">(negative për ulje)</span>}</Label>
          <Input inputMode="decimal" value={sasia} onChange={(e) => setSasia(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Çmimi për njësi (Lek, opsional)</Label>
          <Input inputMode="decimal" value={cmim} onChange={(e) => setCmim(e.target.value)} placeholder="Bosh nëse nuk dihet" />
        </div>
        <div className="space-y-1">
          <Label>Dokumenti (nr. fature / fletëhyrje)</Label>
          <Input value={dokument} onChange={(e) => setDokument(e.target.value)} />
        </div>
        <div className="md:col-span-2 space-y-1">
          <Label>Arsyeja {(lloji === "korrigjim" || lloji === "kthim") && <span className="text-destructive">*</span>}</Label>
          <Textarea rows={2} value={arsye} onChange={(e) => setArsye(e.target.value)} />
        </div>
        <div className="md:col-span-2"><Button onClick={() => m.mutate()} disabled={m.isPending}>Regjistro</Button></div>
      </CardContent>
    </Card>
  );
}
