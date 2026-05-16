import { useState, useRef, type ElementType } from "react";
import { Search } from "lucide-react";

export type SearchSuggestion = {
  id: string;
  label: string;
  sublabel?: string;
  onSelect: () => void;
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  suggestions: SearchSuggestion[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  icon?: ElementType;
  clearOnSelect?: boolean;
  onEnter?: () => void;
};

export function SearchInput({ value, onChange, suggestions, placeholder, className, inputClassName, icon, clearOnSelect = true, onEnter }: Props) {
  const Icon = icon ?? Search;
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const visible = open && value.trim().length > 0 && suggestions.length > 0;
  const capped = suggestions.slice(0, 6);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!visible) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, capped.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, -1));
    } else if (e.key === "Enter" && cursor >= 0) {
      capped[cursor].onSelect();
      setOpen(false);
      setCursor(-1);
    } else if (e.key === "Escape") {
      setOpen(false);
      setCursor(-1);
    } else if (e.key === "Enter" && cursor < 0) {
      onEnter?.();
    }
  }

  return (
    <div className={`relative ${className ?? ""}`}>
      <Icon className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setCursor(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => { setOpen(false); setCursor(-1); }, 150)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={inputClassName ?? "h-10 w-full rounded-2xl border border-border bg-background pl-10 pr-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"}
      />
      {visible && (
        <ul className="absolute left-0 top-full z-50 mt-1.5 w-full overflow-hidden rounded-2xl border border-border bg-background shadow-elegant">
          {capped.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); s.onSelect(); setOpen(false); setCursor(-1); if (clearOnSelect) onChange(""); }}
                onMouseEnter={() => setCursor(i)}
                className={`flex w-full flex-col px-4 py-2.5 text-left transition-colors ${
                  cursor === i ? "bg-primary-soft" : "hover:bg-muted/50"
                }`}
              >
                <span className="text-sm font-medium">{s.label}</span>
                {s.sublabel && <span className="text-xs text-muted-foreground">{s.sublabel}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
