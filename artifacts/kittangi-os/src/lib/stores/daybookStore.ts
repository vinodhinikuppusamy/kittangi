import {
  createPersistentStore,
  usePersistentStore,
} from "@/lib/stores/persistentStore";
import { isDateLocked } from "@/lib/stores/dayLocksStore";

/**
 * Thrown by `addDaybookEntry` when a caller attempts to post to a date that
 * has been frozen via the Daybook "Lock Day & Generate Report" workflow.
 * Callers (Receipts, Loan Disbursement, Investor Payout, etc.) should catch
 * this and surface a friendly toast so cashiers know the day is closed.
 */
export class DayLockedError extends Error {
  readonly dateIso: string;
  constructor(dateIso: string) {
    super(
      `Daybook for ${dateIso} is locked. Unlock the day from the Chitta page before posting new entries.`,
    );
    this.name = "DayLockedError";
    this.dateIso = dateIso;
  }
}

export type DaybookSide = "CREDIT" | "DEBIT";

/**
 * Account identifier — references an Account record managed by
 * `accountsStore`. Kept as a free-form string so the Centralized Financial
 * Engine can introduce new accounts (additional banks, wallets, etc.)
 * without having to widen a literal union here. Existing seed data still
 * uses "CASH" | "HDFC" | "SBI" which match the seeded account ids.
 */
export type DaybookAccount = string;

/**
 * Canonical set of accounting categories shown across the Daybook and the
 * Customer 360 transaction history. New categories are added to this union as
 * features are introduced (e.g. "Interest Expense" was added with the Investor
 * Deposits module so investor payouts land in the same ledger).
 */
export type DaybookCategory =
  | "Interest Income"
  | "Principal Recovery"
  | "Full Settlement"
  | "EMI Received"
  | "Loan Disbursement"
  | "Cash Movement"
  | "Branch Expense"
  | "Salary"
  | "Utilities"
  | "Interest Expense"
  | "Other Income"
  | "Other Expense";

export type DaybookEntry = {
  id: string;
  /** ISO date (YYYY-MM-DD) the transaction belongs to. */
  dateIso: string;
  /** Display time, e.g. "09:42 AM". */
  time: string;
  side: DaybookSide;
  category: DaybookCategory;
  particulars: string;
  refId?: string;
  account: DaybookAccount;
  amount: number;
  /**
   * If the entry is associated with a customer, this carries their display
   * name so the Customer 360 view can chronologically reconstruct passbook
   * history without an explicit join.
   */
  customerName?: string;
  customerId?: string;
  /**
   * Receipt-specific extensions. These are populated only when the entry
   * was created from the Record Payment flow in ReceiptsLedger and are used
   * to faithfully re-render the printable thermal receipt without keeping a
   * second store in sync. Optional everywhere else.
   */
  paymentMode?: "CASH" | "UPI" | "BANK";
  /** Outstanding balance on the loan AFTER this receipt was applied. */
  outstandingAfter?: number;
  /** Cashier-entered note attached to the receipt. */
  notes?: string;
  /**
   * Legal Interest split — populated by ReceiptsLedger when an interest
   * receipt (Interest Income, EMI Received, or the interest share of a
   * Full Settlement) is posted. The two values always satisfy
   * `legalInterestPortion + companyInterestPortion === <interest amount>`.
   * They drive the per-row split in the Daybook UI and the dedicated
   * Legal vs Company columns in the Interest Collections report. Hidden
   * from STAFF users via RBAC.
   */
  legalInterestPortion?: number;
  companyInterestPortion?: number;
};

const STORAGE_KEY = "kittangi:daybook:v1";

function todayIso(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function isoOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

const TODAY = todayIso();

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

/**
 * "Today" set — preserves the original hard-coded Daybook page contents so
 * the existing visual remains unchanged after the refactor to a store.
 */
const SEED_TODAY: DaybookEntry[] = [
  // ===== INFLOWS / CREDIT =====
  {
    id: "DBK-T-1",
    dateIso: TODAY,
    time: "09:42 AM",
    side: "CREDIT",
    category: "Interest Income",
    particulars: "Ravi Krishnan — Interest Paid",
    refId: "RCP-88421 • PWN-204402",
    account: "CASH",
    amount: 2640,
    customerName: "Ravi Krishnan",
  },
  {
    id: "DBK-T-2",
    dateIso: TODAY,
    time: "10:15 AM",
    side: "CREDIT",
    category: "Principal Recovery",
    particulars: "Meera Iyer — Partial Principal",
    refId: "RCP-88422 • PWN-204415",
    account: "HDFC",
    amount: 15000,
    customerName: "Meera Iyer",
  },
  {
    id: "DBK-T-3",
    dateIso: TODAY,
    time: "10:42 AM",
    side: "CREDIT",
    category: "Cash Movement",
    particulars: "Bank Withdrawal (Counter Float Top-up)",
    refId: "TXN-CASH-IN-1102",
    account: "CASH",
    amount: 50000,
  },
  {
    id: "DBK-T-4",
    dateIso: TODAY,
    time: "11:08 AM",
    side: "CREDIT",
    category: "Full Settlement",
    particulars: "Suresh Patel — Full Settlement",
    refId: "RCP-88423 • PWN-204555",
    account: "SBI",
    amount: 86420,
    customerName: "Suresh Patel",
  },
  {
    id: "DBK-T-5",
    dateIso: TODAY,
    time: "11:51 AM",
    side: "CREDIT",
    category: "Interest Income",
    particulars: "Aanya Sharma — Interest Paid",
    refId: "RCP-88424 • PWN-204512",
    account: "CASH",
    amount: 1408,
    customerName: "Aanya Sharma",
  },
  {
    id: "DBK-T-6",
    dateIso: TODAY,
    time: "12:33 PM",
    side: "CREDIT",
    category: "Principal Recovery",
    particulars: "Divya Nair — Partial Principal",
    refId: "RCP-88425 • PWN-204561",
    account: "HDFC",
    amount: 8000,
    customerName: "Divya Nair",
  },
  {
    id: "DBK-T-7",
    dateIso: TODAY,
    time: "01:20 PM",
    side: "CREDIT",
    category: "EMI Received",
    particulars: "Rohan Verma — EMI Received",
    refId: "RCP-88426 • VEH-30021",
    account: "SBI",
    amount: 12150,
    customerName: "Rohan Verma",
  },
  {
    id: "DBK-T-8",
    dateIso: TODAY,
    time: "03:15 PM",
    side: "CREDIT",
    category: "Interest Income",
    particulars: "Kunal Mehta — Interest Paid",
    refId: "RCP-88427 • PWN-204527",
    account: "CASH",
    amount: 715,
    customerName: "Kunal Mehta",
  },

  // ===== OUTFLOWS / DEBIT =====
  {
    id: "DBK-T-9",
    dateIso: TODAY,
    time: "10:02 AM",
    side: "DEBIT",
    category: "Loan Disbursement",
    particulars: "Aanya Sharma — Pawn Loan Disbursed",
    refId: "PWN-204512",
    account: "CASH",
    amount: 38500,
    customerName: "Aanya Sharma",
  },
  {
    id: "DBK-T-10",
    dateIso: TODAY,
    time: "11:25 AM",
    side: "DEBIT",
    category: "Loan Disbursement",
    particulars: "Meera Iyer — Pawn Loan Disbursed",
    refId: "PWN-204519",
    account: "HDFC",
    amount: 197600,
    customerName: "Meera Iyer",
  },
  {
    id: "DBK-T-11",
    dateIso: TODAY,
    time: "12:10 PM",
    side: "DEBIT",
    category: "Branch Expense",
    particulars: "Branch Rent — April 2026",
    refId: "EXP-RENT-04",
    account: "HDFC",
    amount: 45000,
  },
  {
    id: "DBK-T-12",
    dateIso: TODAY,
    time: "12:45 PM",
    side: "DEBIT",
    category: "Loan Disbursement",
    particulars: "Kunal Mehta — Pawn Loan Disbursed",
    refId: "PWN-204527",
    account: "CASH",
    amount: 30950,
    customerName: "Kunal Mehta",
  },
  {
    id: "DBK-T-13",
    dateIso: TODAY,
    time: "02:08 PM",
    side: "DEBIT",
    category: "Utilities",
    particulars: "Electricity Bill (BESCOM)",
    refId: "EXP-UTIL-04-12",
    account: "SBI",
    amount: 6840,
  },
  {
    id: "DBK-T-14",
    dateIso: TODAY,
    time: "02:55 PM",
    side: "DEBIT",
    category: "Salary",
    particulars: "Staff Salary Advance — A. Patel",
    refId: "EXP-PAY-AP-04",
    account: "CASH",
    amount: 8000,
  },
  {
    id: "DBK-T-15",
    dateIso: TODAY,
    time: "03:40 PM",
    side: "DEBIT",
    category: "Loan Disbursement",
    particulars: "Priya Menon — Pawn Loan Disbursed",
    refId: "PWN-204540",
    account: "HDFC",
    amount: 47750,
    customerName: "Priya Menon",
  },
];

/**
 * Historical entries — synthesise a couple of months of passbook history for
 * the top seed customers so the Customer 360 view has chronological data on
 * day 1 of the demo.
 */
const SEED_HISTORY: DaybookEntry[] = [
  // ---- Aanya Sharma — long-running pledge with interest payments ----
  {
    id: "DBK-H-AS-1",
    dateIso: isoOffset(95),
    time: "11:00 AM",
    side: "DEBIT",
    category: "Loan Disbursement",
    particulars: "Aanya Sharma — Pawn Loan Disbursed",
    refId: "PWN-204402",
    account: "CASH",
    amount: 250000,
    customerName: "Aanya Sharma",
  },
  {
    id: "DBK-H-AS-2",
    dateIso: isoOffset(65),
    time: "10:32 AM",
    side: "CREDIT",
    category: "Interest Income",
    particulars: "Aanya Sharma — Interest Paid (Mo. 1)",
    refId: "RCP-88102 • PWN-204402",
    account: "CASH",
    amount: 5000,
    customerName: "Aanya Sharma",
  },
  {
    id: "DBK-H-AS-3",
    dateIso: isoOffset(34),
    time: "09:48 AM",
    side: "CREDIT",
    category: "Interest Income",
    particulars: "Aanya Sharma — Interest Paid (Mo. 2)",
    refId: "RCP-88298 • PWN-204402",
    account: "CASH",
    amount: 5000,
    customerName: "Aanya Sharma",
  },
  {
    id: "DBK-H-AS-4",
    dateIso: isoOffset(22),
    time: "02:14 PM",
    side: "DEBIT",
    category: "Loan Disbursement",
    particulars: "Aanya Sharma — Pawn Loan Disbursed",
    refId: "PWN-204512",
    account: "CASH",
    amount: 38500,
    customerName: "Aanya Sharma",
  },

  // ---- Ravi Krishnan ----
  {
    id: "DBK-H-RK-1",
    dateIso: isoOffset(70),
    time: "11:20 AM",
    side: "DEBIT",
    category: "Loan Disbursement",
    particulars: "Ravi Krishnan — Pawn Loan Disbursed",
    refId: "PWN-204402",
    account: "HDFC",
    amount: 88000,
    customerName: "Ravi Krishnan",
  },
  {
    id: "DBK-H-RK-2",
    dateIso: isoOffset(40),
    time: "12:05 PM",
    side: "CREDIT",
    category: "Interest Income",
    particulars: "Ravi Krishnan — Interest Paid",
    refId: "RCP-88204 • PWN-204402",
    account: "CASH",
    amount: 2640,
    customerName: "Ravi Krishnan",
  },
  {
    id: "DBK-H-RK-3",
    dateIso: isoOffset(10),
    time: "10:48 AM",
    side: "CREDIT",
    category: "Interest Income",
    particulars: "Ravi Krishnan — Interest Paid",
    refId: "RCP-88389 • PWN-204402",
    account: "CASH",
    amount: 2640,
    customerName: "Ravi Krishnan",
  },

  // ---- Meera Iyer ----
  {
    id: "DBK-H-MI-1",
    dateIso: isoOffset(55),
    time: "10:11 AM",
    side: "DEBIT",
    category: "Loan Disbursement",
    particulars: "Meera Iyer — Pawn Loan Disbursed",
    refId: "PWN-204519",
    account: "HDFC",
    amount: 197600,
    customerName: "Meera Iyer",
  },
  {
    id: "DBK-H-MI-2",
    dateIso: isoOffset(25),
    time: "03:30 PM",
    side: "CREDIT",
    category: "Interest Income",
    particulars: "Meera Iyer — Interest Paid",
    refId: "RCP-88312 • PWN-204519",
    account: "HDFC",
    amount: 4940,
    customerName: "Meera Iyer",
  },
];

const SEED: DaybookEntry[] = [...SEED_TODAY, ...SEED_HISTORY];

const daybookStore = createPersistentStore<DaybookEntry[]>(STORAGE_KEY, SEED);

let nextSeq = 1000;
function nextEntryId(existing: DaybookEntry[]): string {
  // Compute the highest auto-generated DBK-A-#### so manually-seeded ids do
  // not collide with new entries.
  const max = existing.reduce((m, e) => {
    const match = /DBK-A-(\d+)/.exec(e.id);
    if (!match) return m;
    const n = Number(match[1]);
    return Number.isFinite(n) && n > m ? n : m;
  }, 999);
  if (nextSeq <= max) nextSeq = max + 1;
  else nextSeq += 1;
  return `DBK-A-${nextSeq}`;
}

export function useDaybook(): DaybookEntry[] {
  return usePersistentStore(daybookStore);
}

export function addDaybookEntry(
  draft: Omit<DaybookEntry, "id"> & { id?: string },
): DaybookEntry {
  // Enforce day-lock integrity: once a day is closed, no new entries can be
  // appended for that date or the lock-snapshot would silently drift out of
  // sync with the underlying ledger.
  if (isDateLocked(draft.dateIso)) {
    throw new DayLockedError(draft.dateIso);
  }
  const created: DaybookEntry = {
    ...draft,
    id: draft.id ?? nextEntryId(daybookStore.get()),
  };
  // Newest-first so the Daybook table naturally bubbles fresh activity.
  daybookStore.set((prev) => [created, ...prev]);
  return created;
}

/**
 * Remove a Daybook entry by id and return the removed record (or `null` if
 * it did not exist). Day-lock is enforced at this write path too: removing a
 * frozen entry would silently invalidate the published lock snapshot, so the
 * call throws `DayLockedError` for entries dated on a locked day.
 *
 * Used by the "Delete Receipt" admin action in Receipts & Ledger to fully
 * reverse a posted transaction (the corresponding account balance is
 * derived live from the ledger via `accountsStore.useAccountBalance`, so it
 * recomputes automatically once the entry is gone).
 */
export function removeDaybookEntry(id: string): DaybookEntry | null {
  const target = daybookStore.get().find((e) => e.id === id) ?? null;
  if (!target) return null;
  if (isDateLocked(target.dateIso)) {
    throw new DayLockedError(target.dateIso);
  }
  daybookStore.set((prev) => prev.filter((e) => e.id !== id));
  return target;
}

/**
 * Remove every entry that shares a `refId`. Useful for receipt deletion
 * where a mixed payment was split into two ledger lines (interest +
 * principal) sharing the same `RCP-XXXXX • LOAN-ID` reference. Returns the
 * removed entries.
 */
export function removeDaybookEntriesByRefId(refId: string): DaybookEntry[] {
  const targets = daybookStore.get().filter((e) => e.refId === refId);
  if (targets.length === 0) return [];
  // All splits of a single receipt are by definition posted on the same
  // day (the receipt's dateIso), so checking one of them is enough.
  if (isDateLocked(targets[0].dateIso)) {
    throw new DayLockedError(targets[0].dateIso);
  }
  const ids = new Set(targets.map((t) => t.id));
  daybookStore.set((prev) => prev.filter((e) => !ids.has(e.id)));
  return targets;
}

export function resetDaybook(): void {
  daybookStore.set(SEED);
}

export function wipeDaybook(): void {
  daybookStore.set([]);
}

/** Format an ISO date (YYYY-MM-DD) for display in passbook tables. */
export function formatLedgerDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
