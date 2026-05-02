import {
  createPersistentStore,
  usePersistentStore,
} from "@/lib/stores/persistentStore";

export type PledgedCategory = "GOLD" | "SILVER" | "DIAMOND";
export type PledgedStatus = "VAULTED" | "RELEASED" | "AUCTION";

export type PledgedItem = {
  id: string;
  title: string;
  category: PledgedCategory;
  grossWeightG: number;
  netWeightG: number;
  pledgedValue: number;
  loanId: string;
  customer: string;
  status: PledgedStatus;
  vaultLoc?: string;
  /** Base64 data URLs of high-resolution photos captured at origination. */
  photos?: string[];
  /** ISO date string of when the pledge was originated. */
  originatedAt?: string;
};

const STORAGE_KEY = "kittangi:pledged-items:v1";

const pledgedItemsStore = createPersistentStore<PledgedItem[]>(
  STORAGE_KEY,
  [],
);

let nextSeq = 0;
function nextItemId(existing: PledgedItem[]): string {
  const max = existing.reduce((m, i) => {
    const match = /PKG-(\d+)/.exec(i.id);
    if (!match) return m;
    const n = Number(match[1]);
    return Number.isFinite(n) && n > m ? n : m;
  }, 56);
  if (nextSeq <= max) nextSeq = max + 1;
  else nextSeq += 1;
  return `PKG-${nextSeq}`;
}

export function usePledgedItems(): PledgedItem[] {
  return usePersistentStore(pledgedItemsStore);
}

export function addPledgedItem(
  draft: Omit<PledgedItem, "id"> & { id?: string },
): PledgedItem {
  const created: PledgedItem = {
    ...draft,
    id: draft.id ?? nextItemId(pledgedItemsStore.get()),
  };
  pledgedItemsStore.set((prev) => [created, ...prev]);
  void import("@/lib/stores/apiSync").then(({ apiCreate }) => apiCreate("/pledged-items", created));
  return created;
}

export function updatePledgedItem(
  id: string,
  patch: Partial<PledgedItem>,
): void {
  pledgedItemsStore.set((prev) =>
    prev.map((i) => (i.id === id ? { ...i, ...patch, id: i.id } : i)),
  );
  void import("@/lib/stores/apiSync").then(({ apiUpdate }) => apiUpdate("/pledged-items", id, patch));
}

export function deletePledgedItem(id: string): void {
  pledgedItemsStore.set((prev) => prev.filter((i) => i.id !== id));
  void import("@/lib/stores/apiSync").then(({ apiDelete }) => apiDelete("/pledged-items", id));
}

/**
 * Move a vaulted pledged item from its current locker to a new one without
 * touching the linked loan. Used by Vault Management → Transfer to reflect
 * physical relocation of the asset (e.g. moving a packet from Safe A · L-101
 * to Safe B · L-205) while the underlying loan stays ACTIVE.
 *
 * Throws if:
 *   - the item is missing,
 *   - the item is not currently VAULTED (transferring a RELEASED/AUCTION
 *     item would silently re-occupy a locker),
 *   - the target locker string is empty/whitespace, OR
 *   - another VAULTED item already occupies the target locker — this is the
 *     critical invariant: the Vault Management UI keys occupancy by
 *     `safe::locker`, so two items at the same address would silently hide
 *     one of them in the visualizer (and corrupt audits).
 */
export function transferPledgedItem(id: string, newVaultLoc: string): void {
  const all = pledgedItemsStore.get();
  const item = all.find((i) => i.id === id);
  if (!item) throw new Error(`Pledged item ${id} not found.`);
  if (item.status !== "VAULTED") {
    throw new Error(
      `Cannot transfer ${id} — only VAULTED items can be moved between lockers.`,
    );
  }
  const target = newVaultLoc.trim();
  if (!target) {
    throw new Error("Target locker is required for transfer.");
  }
  // Reject if any *other* VAULTED item is already at the destination.
  // Comparison is whitespace-insensitive on the canonical "Safe · Locker"
  // string used everywhere in the app.
  const norm = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
  const targetNorm = norm(target);
  const conflict = all.find(
    (i) =>
      i.id !== id && i.status === "VAULTED" && norm(i.vaultLoc) === targetNorm,
  );
  if (conflict) {
    throw new Error(
      `Locker ${target} is already occupied by ${conflict.id} (${conflict.loanId}). Pick a different locker.`,
    );
  }
  updatePledgedItem(id, { vaultLoc: target });
}

export function resetPledgedItems(): void {
  pledgedItemsStore.set([]);
}

export function wipePledgedItems(): void {
  pledgedItemsStore.set([]);
}
