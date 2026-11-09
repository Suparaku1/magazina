import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, 
      { title: "Hyrje – Baza Materiale" },
      { name: "description", content: "Hyrje në sistemin e bazës materiale." },
      { property: "og:title", content: "Hyrje – Baza Materiale" },
      { property: "og:description", content: "Hyrje në sistemin e bazës materiale." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/paneli" });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Nëse llogaria ekziston, do të merrni një email për rivendosjen e fjalëkalimit.");
      }
    } catch (err) {
      toast.error(err instanceof Error && err.message.includes("Invalid") ? "Email ose fjalëkalim i pasaktë." : "Veprimi dështoi. Provoni përsëri.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="circuit-bg flex min-h-screen items-center justify-center bg-sidebar px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-8 shadow-xl">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-accent">Baza Materiale</p>
          <h1 className="mt-1 text-2xl font-bold">{mode === "login" ? "Hyrje" : "Rivendos fjalëkalimin"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Llogaritë krijohen vetëm me ftesë nga administratori.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {mode === "login" && (
          <div className="space-y-2">
            <Label htmlFor="pw">Fjalëkalimi</Label>
            <Input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {mode === "login" ? "Hyr" : "Dërgo lidhjen"}
        </Button>
        <button type="button" className="w-full text-center text-sm text-muted-foreground underline" onClick={() => setMode(mode === "login" ? "forgot" : "login")}>
          {mode === "login" ? "Harruat fjalëkalimin?" : "Kthehu te hyrja"}
        </button>
      </form>
    </div>
  );
}
