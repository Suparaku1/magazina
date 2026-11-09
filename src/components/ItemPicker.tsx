import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { searchItems, type CatalogItem } from "@/lib/catalog";
import { Input } from "@/components/ui/input";

/** Dropdown me kërkim mbi katalogun (emër, kod, specifikim, sinonime). Kthen item_id. */
export function ItemPicker({ onPick, placeholder = "Kërko artikull…" }: { onPick: (i: CatalogItem) => void; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  const res = useQuery({ queryKey: ["item-search", debounced], queryFn: () => searchItems(debounced, 20), enabled: open });

  return (
    <div className="relative">
      <Input value={q} placeholder={placeholder} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onChange={(e) => setQ(e.target.value)} />
      {open && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover shadow-lg">
          {res.isLoading && <p className="p-3 text-sm text-muted-foreground">Duke kërkuar…</p>}
          {res.data?.filter((i) => i.aktiv).map((i) => (
            <button key={i.id} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-muted" onMouseDown={() => { onPick(i); setQ(""); setOpen(false); }}>
              <span className="font-medium">{i.emer}</span>
              {i.specifikime && <span className="text-muted-foreground"> · {i.specifikime}</span>}
              <span className="ml-2 font-mono text-xs text-muted-foreground">{i.kod} · {i.njesia}</span>
            </button>
          ))}
          {res.data && res.data.length === 0 && <p className="p-3 text-sm text-muted-foreground">Nuk u gjet. Dërgoni një sugjerim për artikull të ri.</p>}
        </div>
      )}
    </div>
  );
}
