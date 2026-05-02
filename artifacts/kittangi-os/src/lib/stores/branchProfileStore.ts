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

const EMPTY: BranchProfile = {
  branchName: "",
  branchCode: "",
  gstin: "",
  address: "",
  contact: "",
};

const store = createPersistentStore<BranchProfile>(STORAGE_KEY, EMPTY);

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
  store.set(EMPTY);
}
