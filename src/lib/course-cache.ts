const TTL = 24 * 60 * 60 * 1000; // 24h — le bust sur publish est le vrai mécanisme d'invalidation
const LS_KEY = "course_cache_v1";

// Mémoire — partagée côté serveur (SSR), valide tant que le module JS vit
let _mem: { data: unknown; ts: number } | null = null;

function lsGet(): unknown | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw) as { data: unknown; ts: number };
    if (Date.now() - ts < TTL) return data;
    localStorage.removeItem(LS_KEY);
  } catch {}
  return null;
}

function lsSet(data: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

export function getCachedCourse(): unknown | null {
  if (_mem && Date.now() - _mem.ts < TTL) return _mem.data;
  return lsGet();
}

export function setCachedCourse(data: unknown): void {
  _mem = { data, ts: Date.now() };
  lsSet(data);
}

export function bustCourseCache(): void {
  _mem = null;
  if (typeof window !== "undefined") {
    try { localStorage.removeItem(LS_KEY); } catch {}
  }
}
