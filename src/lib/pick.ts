// Reading payloads whose shape no guide spells out (GET /companies/{id}, the
// contractuels demande): take the first field that is there, print nothing
// when none is. Paths may be dotted (`prestataire.nom`).

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function at(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split('.')) {
    const rec = asRecord(cur);
    if (!rec) return undefined;
    cur = rec[part];
  }
  return cur;
}

/** The first non-empty string (numbers printed) among `paths`, or null. */
export function pickText(obj: unknown, ...paths: string[]): string | null {
  for (const path of paths) {
    const v = at(obj, path);
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return null;
}

/** The first array among `paths` (a bare array payload counts as the empty path ''). */
export function pickArray(obj: unknown, ...paths: string[]): unknown[] {
  if (Array.isArray(obj) && paths.includes('')) return obj;
  for (const path of paths) {
    const v = path ? at(obj, path) : obj;
    if (Array.isArray(v)) return v;
  }
  return [];
}
