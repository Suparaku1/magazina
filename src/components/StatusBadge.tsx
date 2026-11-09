import { STATUS_LABELS, STATUS_TONE } from "@/lib/requests";

export function StatusBadge({ s }: { s: string }) {
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_TONE[s] ?? ""}`}>{STATUS_LABELS[s] ?? s}</span>;
}
