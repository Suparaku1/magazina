import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, 
      { title: "Baza Materiale – Shkolla Teknike Elektrike Gjergj Canco" },
      { name: "description", content: "Kërkesa, miratime dhe magazina e bazës materiale të shkollës. Akses vetëm me ftesë." },
      { property: "og:title", content: "Baza Materiale – Gjergj Canco" },
      { property: "og:description", content: "Sistemi i brendshëm i bazës materiale. Akses vetëm me ftesë." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="circuit-bg flex min-h-screen items-center justify-center bg-sidebar px-6">
      <div className="max-w-xl rounded-lg border border-sidebar-border bg-sidebar/95 p-10 text-sidebar-foreground shadow-2xl">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
          <Zap className="h-6 w-6" />
        </div>
        <p className="font-mono text-xs uppercase tracking-widest text-sidebar-primary">Shkolla Teknike Elektrike “Gjergj Canco”</p>
        <h1 className="mt-2 text-4xl font-bold text-sidebar-accent-foreground">Baza Materiale</h1>
        <p className="mt-4 text-sidebar-foreground/80">
          Kërkesat për pajisje dhe materiale, miratimet, magazina dhe raportet Excel në një vend. Llogaritë krijohen vetëm me ftesë nga administratori.
        </p>
        <Button asChild className="mt-8 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90">
          <Link to="/auth">Hyr në sistem</Link>
        </Button>
      </div>
    </div>
  );
}
