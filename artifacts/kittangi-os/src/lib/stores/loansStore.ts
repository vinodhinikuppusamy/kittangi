import {
  createPersistentStore,
  usePersistentStore,
} from "@/lib/stores/persistentStore";
import { updatePledgedItem } from "@/lib/stores/pledgedItemsStore";

/**
 * Unified Loan record covering pawn, vehicle, and unsecured "document" loans.
 * The Loan Management module renders one row per record; the per-loan
 * Lifecycle page pulls the matching pledged item, vehicle details, and
 * receipts from the other persisted stores using the loan id as the join key.
 */

export type LoanProduct = "PAWN" | "VEHICLE" | "DOCUMENT";
export type LoanStatus = "ACTIVE" | "CLOSED" | "AUCTION";

export type VehicleDetails = {
  makeModel: string;
  regNo?: string;
  year?: string;
  vehicleType?: "TWO_WHEELER" | "FOUR_WHEELER" | "COMMERCIAL";
};

/**
 * A scanned/uploaded legal document attached to a loan. Currently used by
 * Vehicle Origination to capture the four mandatory documents (RC, Insurance,
 * Hypothecation Agreement, Permits) which are surfaced again from the
 * Repossession Yard "View Legal Docs" action.
 */
export type LegalDocType = "RC" | "INSURANCE" | "AGREEMENT" | "PERMIT";

export type LegalDoc = {
  type: LegalDocType;
  /** Original file name as uploaded by the operator. */
  name: string;
  /** Base64 data URL. Persisted alongside the loan record. */
  dataUrl: string;
  /** ISO timestamp when the document was attached. */
  uploadedAtIso: string;
};

export type Loan = {
  id: string;
  product: LoanProduct;
  customer: string;
  customerCode: string;
  /** Principal amount disbursed (gross of any chit/processing fees). */
  principal: number;
  /** Annual interest rate as a percentage (e.g. 13 for 13% p.a.). */
  ratePctPerAnnum: number;
  startedAtIso: string;
  /** Optional duration label captured at origination, e.g. "12 months". */
  durationLabel?: string;
  /** ISO date when the loan matures (principal becomes due). */
  maturityIso?: string;
  status: LoanStatus;
  /** Account id (from accountsStore) the disbursement was paid from. */
  disbursedFromAccountId?: string;
  /** Pledged item id linking to pledgedItemsStore (Pawn loans only). */
  pledgedItemId?: string;
  /** Captured at origination for vehicle loans. */
  vehicleDetails?: VehicleDetails;
  /** Free-form notes shown on the Loan Lifecycle page. */
  notes?: string;
  /**
   * Accrued (but unpaid) interest displayed at origination time. Receipts
   * decrement this as they are posted; the seed values approximate one
   * billing cycle of interest. Optional so newly originated loans can be
   * inserted without computing it.
   */
  accruedInterest?: number;
  /** Scanned legal documents (vehicle loans). */
  legalDocs?: LegalDoc[];
};

const STORAGE_KEY = "kittangi:loans:v1";

// ---------------------------------------------------------------------------
// Seed data — derived from the original ACTIVE_LOANS constant in
// ReceiptsLedger plus a couple of closed examples so the lifecycle page
// has both states to demo.
// ---------------------------------------------------------------------------

const SEED_LOANS: Loan[] = [
  {
    id: "PWN-204512",
    product: "PAWN",
    customer: "Aanya Sharma",
    customerCode: "KTG-10042",
    principal: 130000,
    ratePctPerAnnum: 13,
    startedAtIso: "2026-04-12",
    durationLabel: "6 months",
    maturityIso: "2026-10-12",
    status: "ACTIVE",
    disbursedFromAccountId: "CASH",
    pledgedItemId: "PKG-45",
    accruedInterest: 4225,
  },
  {
    id: "PWN-204519",
    product: "PAWN",
    customer: "Meera Iyer",
    customerCode: "KTG-10044",
    principal: 197600,
    ratePctPerAnnum: 12,
    startedAtIso: "2026-04-14",
    durationLabel: "12 months",
    maturityIso: "2027-04-14",
    status: "ACTIVE",
    disbursedFromAccountId: "HDFC",
    pledgedItemId: "PKG-46",
    accruedInterest: 5928,
  },
  {
    id: "PWN-204527",
    product: "PAWN",
    customer: "Kunal Mehta",
    customerCode: "KTG-10047",
    principal: 31200,
    ratePctPerAnnum: 13.5,
    startedAtIso: "2026-04-16",
    durationLabel: "6 months",
    maturityIso: "2026-10-16",
    status: "ACTIVE",
    disbursedFromAccountId: "CASH",
    pledgedItemId: "PKG-47",
    accruedInterest: 715,
  },
  {
    id: "PWN-204540",
    product: "PAWN",
    customer: "Priya Menon",
    customerCode: "KTG-10059",
    principal: 48400,
    ratePctPerAnnum: 13,
    startedAtIso: "2026-04-18",
    durationLabel: "12 months",
    maturityIso: "2027-04-18",
    status: "ACTIVE",
    disbursedFromAccountId: "HDFC",
    pledgedItemId: "PKG-49",
    accruedInterest: 1089,
  },
  {
    id: "VEH-30021",
    product: "VEHICLE",
    customer: "Rohan Verma",
    customerCode: "KTG-10051",
    principal: 540000,
    ratePctPerAnnum: 11.25,
    startedAtIso: "2026-03-02",
    durationLabel: "36 months",
    maturityIso: "2029-03-02",
    status: "ACTIVE",
    disbursedFromAccountId: "SBI",
    vehicleDetails: {
      makeModel: "Maruti Swift Dzire VXI",
      regNo: "KA 03 ME 7791",
      year: "2024",
      vehicleType: "FOUR_WHEELER",
    },
    accruedInterest: 12150,
  },
  {
    id: "PWN-204555",
    product: "PAWN",
    customer: "Suresh Patel",
    customerCode: "KTG-10062",
    principal: 80000,
    ratePctPerAnnum: 12,
    startedAtIso: "2026-02-10",
    durationLabel: "6 months",
    maturityIso: "2026-08-10",
    status: "CLOSED",
    disbursedFromAccountId: "SBI",
    pledgedItemId: "PKG-50",
  },
  {
    id: "PWN-204402",
    product: "PAWN",
    customer: "Aanya Sharma",
    customerCode: "KTG-10042",
    principal: 250000,
    ratePctPerAnnum: 14,
    startedAtIso: "2026-01-20",
    durationLabel: "3 months",
    maturityIso: "2026-04-20",
    status: "AUCTION",
    disbursedFromAccountId: "CASH",
    pledgedItemId: "PKG-52",
  },
];

const loansStore = createPersistentStore<Loan[]>(STORAGE_KEY, SEED_LOANS);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function useLoans(): Loan[] {
  return usePersistentStore(loansStore);
}

export function getLoan(id: string): Loan | undefined {
  return loansStore.get().find((l) => l.id === id);
}

export function addLoan(draft: Loan): Loan {
  loansStore.set((prev) => [draft, ...prev]);
  return draft;
}

export function updateLoan(id: string, patch: Partial<Loan>): void {
  loansStore.set((prev) =>
    prev.map((l) => (l.id === id ? { ...l, ...patch, id: l.id } : l)),
  );
}

export function deleteLoan(id: string): void {
  loansStore.set((prev) => prev.filter((l) => l.id !== id));
}

export function resetLoans(): void {
  loansStore.set(SEED_LOANS);
}

// ---------------------------------------------------------------------------
// Atomic lifecycle helpers
//
// These helpers exist so loan-status transitions and pledged-item state stay
// in lock-step. Callers should prefer them over a bare `updateLoan` when
// flipping ACTIVE → CLOSED or ACTIVE → AUCTION on a pawn loan, otherwise the
// vault locker can be left in an incorrect state (showing OCCUPIED for a
// closed loan or RELEASED for one in auction).
// ---------------------------------------------------------------------------

/**
 * Mark a loan as fully settled. The pledged item — if one is linked — is
 * released from the vault and its `vaultLoc` is cleared so the locker shows
 * AVAILABLE in the Vault Management view in the same render cycle.
 */
export function closeLoanWithSettlement(loanId: string): void {
  const loan = loansStore.get().find((l) => l.id === loanId);
  if (!loan) return;
  updateLoan(loanId, { status: "CLOSED" });
  if (loan.pledgedItemId) {
    updatePledgedItem(loan.pledgedItemId, {
      status: "RELEASED",
      vaultLoc: undefined,
    });
  }
}

/**
 * Move a defaulted loan to the auction queue. The pledged item moves to
 * AUCTION but its `vaultLoc` is preserved — the asset is physically still
 * in the safe pending the auction.
 */
export function markLoanForAuction(loanId: string): void {
  const loan = loansStore.get().find((l) => l.id === loanId);
  if (!loan) return;
  updateLoan(loanId, { status: "AUCTION" });
  if (loan.pledgedItemId) {
    updatePledgedItem(loan.pledgedItemId, { status: "AUCTION" });
  }
}
