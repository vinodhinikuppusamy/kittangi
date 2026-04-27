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

const SEED_CUSTOMERS: Customer[] = [
  {
    id: "KTG-10042",
    fullName: "Aanya Sharma",
    phone: "+91 98212 44510",
    email: "aanya.sharma@gmail.com",
    kycStatus: "Verified",
    activeLoans: 2,
  },
  {
    id: "KTG-10043",
    fullName: "Ravi Krishnan",
    phone: "+91 90031 78902",
    email: "ravi.k@outlook.com",
    kycStatus: "Pending",
    activeLoans: 1,
  },
  {
    id: "KTG-10044",
    fullName: "Meera Iyer",
    phone: "+91 99450 11236",
    email: "meera.iyer@yahoo.com",
    kycStatus: "Verified",
    activeLoans: 3,
  },
  {
    id: "KTG-10045",
    fullName: "Suresh Patel",
    phone: "+91 98455 90218",
    email: "suresh.patel@kittangi.in",
    kycStatus: "Rejected",
    activeLoans: 0,
  },
  {
    id: "KTG-10046",
    fullName: "Divya Nair",
    phone: "+91 99002 18443",
    email: "divya.nair@gmail.com",
    kycStatus: "Pending",
    activeLoans: 0,
  },
  {
    id: "KTG-10047",
    fullName: "Kunal Mehta",
    phone: "+91 98990 23311",
    email: "kunal.mehta@gmail.com",
    kycStatus: "Verified",
    activeLoans: 1,
  },
];

const customersStore = createPersistentStore<Customer[]>(
  STORAGE_KEY,
  SEED_CUSTOMERS,
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
  return created;
}

export function updateCustomer(id: string, patch: Partial<Customer>): void {
  customersStore.set((prev) =>
    prev.map((c) => (c.id === id ? { ...c, ...patch, id: c.id } : c)),
  );
}

export function deleteCustomer(id: string): void {
  customersStore.set((prev) => prev.filter((c) => c.id !== id));
}

/** Reset to the seed data. Useful for the debug "reset demo" affordance. */
export function resetCustomers(): void {
  customersStore.set(SEED_CUSTOMERS);
}
