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

const SEED_ITEMS: PledgedItem[] = [
  {
    id: "PKG-45",
    title: "22K Gold Chain",
    category: "GOLD",
    grossWeightG: 45,
    netWeightG: 42,
    pledgedValue: 210000,
    loanId: "PWN-204512",
    customer: "Anand",
    status: "VAULTED",
    vaultLoc: "Safe-A · L-101",
  },
  {
    id: "PKG-46",
    title: "Gold Bangles (Set of 4)",
    category: "GOLD",
    grossWeightG: 88,
    netWeightG: 85,
    pledgedValue: 425000,
    loanId: "PWN-204519",
    customer: "Meera Iyer",
    status: "VAULTED",
    vaultLoc: "Safe-A · L-104",
  },
  {
    id: "PKG-47",
    title: "Diamond Solitaire Ring",
    category: "DIAMOND",
    grossWeightG: 6,
    netWeightG: 5,
    pledgedValue: 185000,
    loanId: "PWN-204527",
    customer: "Kunal Mehta",
    status: "VAULTED",
    vaultLoc: "Safe-B · L-203",
  },
  {
    id: "PKG-48",
    title: "Silver Pooja Set",
    category: "SILVER",
    grossWeightG: 720,
    netWeightG: 710,
    pledgedValue: 62000,
    loanId: "PWN-204533",
    customer: "Suresh Patel",
    status: "VAULTED",
    vaultLoc: "Safe-B · L-208",
  },
  {
    id: "PKG-49",
    title: "22K Gold Earrings (Pair)",
    category: "GOLD",
    grossWeightG: 14,
    netWeightG: 13,
    pledgedValue: 64000,
    loanId: "PWN-204540",
    customer: "Priya Menon",
    status: "VAULTED",
    vaultLoc: "Safe-A · L-112",
  },
  {
    id: "PKG-50",
    title: "Gold Mangalsutra",
    category: "GOLD",
    grossWeightG: 22,
    netWeightG: 20,
    pledgedValue: 98000,
    loanId: "PWN-204555",
    customer: "Ravi Krishnan",
    status: "RELEASED",
  },
  {
    id: "PKG-51",
    title: "18K Diamond Pendant",
    category: "DIAMOND",
    grossWeightG: 8,
    netWeightG: 7,
    pledgedValue: 142000,
    loanId: "PWN-204561",
    customer: "Divya Nair",
    status: "VAULTED",
    vaultLoc: "Safe-B · L-211",
  },
  {
    id: "PKG-52",
    title: "Gold Coin (50g · 24K)",
    category: "GOLD",
    grossWeightG: 50,
    netWeightG: 50,
    pledgedValue: 305000,
    loanId: "PWN-204402",
    customer: "Aanya Sharma",
    status: "AUCTION",
  },
  {
    id: "PKG-53",
    title: "Silver Anklets (Pair)",
    category: "SILVER",
    grossWeightG: 280,
    netWeightG: 275,
    pledgedValue: 24500,
    loanId: "PWN-204415",
    customer: "Rohan Verma",
    status: "RELEASED",
  },
  {
    id: "PKG-54",
    title: "22K Gold Ring (Mens)",
    category: "GOLD",
    grossWeightG: 11,
    netWeightG: 10,
    pledgedValue: 51000,
    loanId: "PWN-204421",
    customer: "Karthik R",
    status: "VAULTED",
    vaultLoc: "Safe-A · L-118",
  },
  {
    id: "PKG-55",
    title: "Diamond Stud Earrings",
    category: "DIAMOND",
    grossWeightG: 4,
    netWeightG: 3,
    pledgedValue: 96000,
    loanId: "PWN-204428",
    customer: "Sneha B",
    status: "AUCTION",
  },
  {
    id: "PKG-56",
    title: "Gold Necklace (Antique)",
    category: "GOLD",
    grossWeightG: 62,
    netWeightG: 58,
    pledgedValue: 295000,
    loanId: "PWN-204430",
    customer: "Lakshmi V",
    status: "VAULTED",
    vaultLoc: "Safe-A · L-121",
  },
];

const pledgedItemsStore = createPersistentStore<PledgedItem[]>(STORAGE_KEY, []);

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
