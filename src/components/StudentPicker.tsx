import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, X, Loader2 } from "lucide-react";

export type StudentStatus = "sent" | "draft" | "none";
export type StudentItem = { uid: string; email: string; displayName: string | null };

type Props = {
  users: StudentItem[];
  selected: StudentItem | null;
  onSelect: (u: StudentItem) => void;
  loading?: boolean;
  statusMap?: Map<string, StudentStatus>;
};

const STATUS_LABELS: Record<StudentStatus, string> = {
  sent: "Envoyée",
  draft: "Brouillon",
  none: "Sans routine",
};

export function StudentPicker({ users, selected, onSelect, loading, statusMap }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | StudentStatus>("all");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      u.email.toLowerCase().includes(q) ||
      (u.displayName?.toLowerCase().includes(q) ?? false);
    if (!matchesSearch) return false;
    if (filter === "all" || !statusMap) return true;
    const status = statusMap.get(u.uid) ?? "none";
    return status === filter;
  });

  function handleSelect(u: StudentItem) {
    onSelect(u);
    setOpen(false);
    setSearch("");
  }

  const hasStatusFilter = !!statusMap;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
          open
            ? "border-primary bg-card shadow-soft"
            : "border-border/60 bg-card shadow-soft hover:border-border"
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            <span className="flex-1 text-sm text-muted-foreground">Chargement…</span>
          </>
        ) : selected ? (
          <>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-warm text-sm font-semibold">
              {(selected.displayName ?? selected.email).slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{selected.displayName ?? "—"}</p>
              <p className="truncate text-xs text-muted-foreground">{selected.email}</p>
            </div>
            {hasStatusFilter && <StatusBadge status={statusMap!.get(selected.uid) ?? "none"} />}
          </>
        ) : (
          <>
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-sm text-muted-foreground">
              {users.length > 0
                ? `Rechercher parmi ${users.length} élève${users.length > 1 ? "s" : ""}…`
                : "Aucun élève disponible"}
            </span>
          </>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-2xl border border-border bg-background shadow-elegant">
          <div className="p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nom ou email…"
                autoComplete="off"
                className="h-9 w-full rounded-xl border border-border bg-muted/50 pl-9 pr-8 text-sm outline-none focus:border-primary"
              />
              {search && (
                <button
                  onMouseDown={(e) => { e.preventDefault(); setSearch(""); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {hasStatusFilter && (
            <div className="flex gap-1.5 overflow-x-auto px-2 pb-2 scrollbar-none">
              {(["all", "sent", "draft", "none"] as const).map((f) => (
                <button
                  key={f}
                  onMouseDown={(e) => { e.preventDefault(); setFilter(f); }}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    filter === f
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f === "all" ? "Tous" : STATUS_LABELS[f]}
                </button>
              ))}
            </div>
          )}

          <ul className="max-h-64 divide-y divide-border/40 overflow-y-auto border-t border-border/40">
            {filtered.length === 0 ? (
              <li className="py-8 text-center text-sm text-muted-foreground">Aucun élève trouvé</li>
            ) : (
              filtered.map((u) => (
                <li key={u.uid}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(u); }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 ${
                      selected?.uid === u.uid ? "bg-primary-soft" : ""
                    }`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-warm text-sm font-semibold">
                      {(u.displayName ?? u.email).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{u.displayName ?? "—"}</p>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    {hasStatusFilter && <StatusBadge status={statusMap!.get(u.uid) ?? "none"} />}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: StudentStatus }) {
  if (status === "sent") {
    return (
      <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary">
        Envoyée
      </span>
    );
  }
  if (status === "draft") {
    return (
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        Brouillon
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground/60">
      Sans routine
    </span>
  );
}
