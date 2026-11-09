import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, 
      { title: "Vendos fjalëkalimin – Baza Materiale" },
      { name: "description", content: "Vendosni fjalëkalimin e llogarisë suaj." },
      { property: "og:title", content: "Vendos fjalëkalimin – Baza Materiale" },
      { property: "og:description", content: "Vendosni fjalëkalimin e llogarisë suaj." },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) { toast.error("Fjalëkalimi duhet të ketë të paktën 8 karaktere."); return; }
    if (pw !== pw2) { toast.error("Fjalëkalimet nuk përputhen."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { toast.error("Lidhja ka skaduar ose fjalëkalimi është i dobët."); return; }
    toast.success("Fjalëkalimi u vendos.");
    navigate({ to: "/paneli" });
  }

  return (
    <div className="circuit-bg flex min-h-screen items-center justify-center bg-sidebar px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-8 shadow-xl">
        <h1 className="text-2xl font-bold">Vendos fjalëkalimin</h1>
        <p className="text-sm text-muted-foreground">Përdoret si për ftesat e reja, ashtu edhe për rivendosjen.</p>
        <div className="space-y-2">
          <Label htmlFor="p1">Fjalëkalimi i ri</Label>
          <Input id="p1" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p2">Përsërit fjalëkalimin</Label>
          <Input id="p2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </div>
        <Button className="w-full" disabled={busy}>Ruaj</Button>
      </form>
    </div>
  );
}
