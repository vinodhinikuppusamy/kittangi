import {
  createPersistentStore,
  usePersistentStore,
} from "@/lib/stores/persistentStore";

/**
 * Shared branch profile used by Settings (editable form), the thermal receipt
 * header, and the customer statement print-out. Persisting it keeps every
 * surface that prints branch identity in lockstep.
 */
export type BranchProfile = {
  branchName: string;
  branchCode: string;
  gstin: string;
  address: string;
  contact: string;
};

const STORAGE_KEY = "kittangi:branch-profile:v1";

const DEFAULT: BranchProfile = {
  branchName: "Kittangi Main",
  branchCode: "KTG-001",
  gstin: "29ABCDE1234F1Z5",
  address: "No. 14, MG Road, Bengaluru, Karnataka — 560001",
  contact: "+91 98450 12345",
};

const store = createPersistentStore<BranchProfile>(STORAGE_KEY, DEFAULT);

export function useBranchProfile(): BranchProfile {
  return usePersistentStore(store);
}

export function getBranchProfile(): BranchProfile {
  return store.get();
}

export function updateBranchProfile(patch: Partial<BranchProfile>): void {
  store.set((prev) => ({ ...prev, ...patch }));
  void import("@/lib/stores/apiSync").then(({ apiPut }) => apiPut("/branch-profile", patch));
}

export function resetBranchProfile(): void {
  store.set(DEFAULT);
}
