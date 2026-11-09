export const CONTEXT_LABELS: Record<string, string> = {
  teori_pergjithshme: "Teori e përgjithshme",
  teori_profesionale: "Teori profesionale",
  praktike_profesionale: "Praktikë profesionale",
  kujdestari: "Kujdestari",
  laborator: "Laborator",
};

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  derguar: "Dërguar",
  kthyer_per_korrigjim: "Kthyer për korrigjim",
  miratuar: "Miratuar",
  miratuar_pjeserisht: "Miratuar pjesërisht",
  refuzuar: "Refuzuar",
  ne_permbushje: "Në përmbushje",
  permbushur: "Përmbushur",
  mbyllur: "Mbyllur",
};

export const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  derguar: "bg-primary text-primary-foreground",
  kthyer_per_korrigjim: "bg-warning text-warning-foreground",
  miratuar: "bg-success text-primary-foreground",
  miratuar_pjeserisht: "bg-accent text-accent-foreground",
  refuzuar: "bg-destructive text-destructive-foreground",
  ne_permbushje: "bg-secondary text-secondary-foreground",
  permbushur: "bg-success text-primary-foreground",
  mbyllur: "bg-muted text-muted-foreground",
};

export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("sq-AL", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, ".") : "";

export const fmtNum = (v: number | null | undefined) =>
  v === null || v === undefined ? "" : new Intl.NumberFormat("sq-AL", { maximumFractionDigits: 2 }).format(v);
