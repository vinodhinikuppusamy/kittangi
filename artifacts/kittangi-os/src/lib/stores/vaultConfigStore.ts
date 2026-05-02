import {
  createPersistentStore,
  usePersistentStore,
} from "@/lib/stores/persistentStore";

/**
 * A single physical safe. Locker IDs are derived from `prefix + (startNumber
 * + i)` for i in 0..lockerCount-1, so renaming a prefix or shifting the start
 * number renames every locker inside the safe in one step.
 */
export type SafeConfig = {
  id: string;
  name: string;
  subtitle: string;
  prefix: string;
  startNumber: number;
  lockerCount: number;
};

const STORAGE_KEY = "kittangi:vault-config:v1";

const store = createPersistentStore<SafeConfig[]>(STORAGE_KEY, []);

let nextSeq = 0;
function nextSafeId(existing: SafeConfig[]): string {
  const max = existing.reduce((m, s) => {
    const match = /SAFE_(\d+)/.exec(s.id);
    if (!match) return m;
    const n = Number(match[1]);
    return Number.isFinite(n) && n > m ? n : m;
  }, 2);
  if (nextSeq <= max) nextSeq = max + 1;
  else nextSeq += 1;
  return `SAFE_${nextSeq}`;
}

export function useVaultConfig(): SafeConfig[] {
  return usePersistentStore(store);
}

export function addSafe(
  draft: Omit<SafeConfig, "id"> & { id?: string },
): SafeConfig {
  const created: SafeConfig = {
    ...draft,
    id: draft.id ?? nextSafeId(store.get()),
  };
  store.set((prev) => [...prev, created]);
  return created;
}

export function updateSafe(id: string, patch: Partial<SafeConfig>): void {
  store.set((prev) =>
    prev.map((s) => (s.id === id ? { ...s, ...patch, id: s.id } : s)),
  );
}

export function deleteSafe(id: string): void {
  store.set((prev) => prev.filter((s) => s.id !== id));
}

export function resetVaultConfig(): void {
  store.set([]);
}

/** Generate the ordered list of locker IDs for a given safe. */
export function generateLockerIds(safe: SafeConfig): string[] {
  const out: string[] = [];
  for (let i = 0; i < safe.lockerCount; i++) {
    out.push(`${safe.prefix}${safe.startNumber + i}`);
  }
  return out;
}

/** Display range, e.g. "L-101 → L-116". */
export function lockerRangeLabel(safe: SafeConfig): string {
  if (safe.lockerCount === 0) return "—";
  const last = safe.startNumber + safe.lockerCount - 1;
  if (safe.lockerCount === 1) return `${safe.prefix}${safe.startNumber}`;
  return `${safe.prefix}${safe.startNumber} → ${safe.prefix}${last}`;
}

/**
 * Normalise a free-form safe name so "Safe A", "Safe-A", and "safe a" all
 * collapse to the same key. Used when matching pledged items' `vaultLoc`
 * strings (which were captured before vault config was dynamic) back to a
 * configured safe.
 */
export function normalizeSafeKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Parse a `vaultLoc` string like "Safe-A · L-101" into its parts. Returns
 * null if the string doesn't follow the expected `<safeName> <sep> <lockerId>`
 * pattern.
 */
export function parseVaultLoc(
  loc: string | undefined,
): { safeKey: string; lockerId: string } | null {
  if (!loc) return null;
  // Split on the bullet/dot separators commonly used in seed data.
  const parts = loc.split(/[·•|]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return {
    safeKey: normalizeSafeKey(parts[0]),
    lockerId: parts[parts.length - 1],
  };
}
