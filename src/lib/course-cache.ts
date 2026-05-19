const TTL = 30 * 60 * 1000; // 30 minutes

let _cache: { data: unknown; ts: number } | null = null;

export function getCachedCourse(): unknown | null {
  if (_cache && Date.now() - _cache.ts < TTL) return _cache.data;
  return null;
}

export function setCachedCourse(data: unknown): void {
  _cache = { data, ts: Date.now() };
}

export function bustCourseCache(): void {
  _cache = null;
}
