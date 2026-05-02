import {
  createPersistentStore,
  usePersistentStore,
} from "@/lib/stores/persistentStore";

export type KycStatus = "Verified" | "Pending" | "Rejected";

export type CustomerAddress = {
  street: string;
  city: string;
  state: string;
  pincode: string;
};

export type Customer = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  kycStatus: KycStatus;
  activeLoans: number;
  /** Base64 data URL of the captured / uploaded profile photo. */
  photoDataUrl?: string;
  /** Optional extended KYC fields captured at intake. */
  dob?: string;
  aadhar?: string;
  pan?: string;
  address?: CustomerAddress;
};

const STORAGE_KEY = "kittangi:customers:v1";

const customersStore = createPersistentStore<Customer[]>(
  STORAGE_KEY,
  [],
);

let nextSeq = 0;
function nextCustomerId(existing: Customer[]): string {
  // Compute the highest existing KTG-#### sequence so freshly added customers
  // continue the same numeric series even after refresh.
  const max = existing.reduce((m, c) => {
    const match = /KTG-(\d+)/.exec(c.id);
    if (!match) return m;
    const n = Number(match[1]);
    return Number.isFinite(n) && n > m ? n : m;
  }, 10047);
  if (nextSeq <= max) nextSeq = max + 1;
  else nextSeq += 1;
  return `KTG-${nextSeq}`;
}

export function useCustomers(): Customer[] {
  return usePersistentStore(customersStore);
}

export function addCustomer(
  draft: Omit<Customer, "id" | "kycStatus" | "activeLoans"> & {
    kycStatus?: KycStatus;
    activeLoans?: number;
  },
): Customer {
  const created: Customer = {
    id: nextCustomerId(customersStore.get()),
    kycStatus: draft.kycStatus ?? "Pending",
    activeLoans: draft.activeLoans ?? 0,
    fullName: draft.fullName,
    phone: draft.phone,
    email: draft.email,
    photoDataUrl: draft.photoDataUrl,
    dob: draft.dob,
    aadhar: draft.aadhar,
    pan: draft.pan,
    address: draft.address,
  };
  customersStore.set((prev) => [created, ...prev]);
  void import("@/lib/stores/apiSync").then(({ apiCreate }) => apiCreate("/customers", { ...created, createdAtIso: new Date().toISOString() }));
  return created;
}

export function updateCustomer(id: string, patch: Partial<Customer>): void {
  customersStore.set((prev) =>
    prev.map((c) => (c.id === id ? { ...c, ...patch, id: c.id } : c)),
  );
  void import("@/lib/stores/apiSync").then(({ apiUpdate }) => apiUpdate("/customers", id, patch));
}

export function deleteCustomer(id: string): void {
  customersStore.set((prev) => prev.filter((c) => c.id !== id));
  void import("@/lib/stores/apiSync").then(({ apiDelete }) => apiDelete("/customers", id));
}

/** Reset to the seed data. Useful for the debug "reset demo" affordance. */
export function resetCustomers(): void {
  customersStore.set([]);
}

/**
 * Production wipe: clear ALL customer records. Used by the
 * "Wipe All Transactional Data" admin tool when a branch is going live.
 */
export function wipeCustomers(): void {
  customersStore.set([]);
}
