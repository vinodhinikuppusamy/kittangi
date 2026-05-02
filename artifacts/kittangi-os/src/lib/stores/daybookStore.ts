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
  | "Internal Transfer"
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
  /**
   * Contra-pair id (e.g. `XFR-7`) shared by the matching Debit and Credit
   * legs of an Internal Transfer. Used by the P&L computation to exclude
   * both legs from Income and Expense (a contra entry is a movement of
   * funds, not a revenue/cost event).
   */
  pairId?: string;
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

const daybookStore = createPersistentStore<DaybookEntry[]>(STORAGE_KEY, []);

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
  void import("@/lib/stores/apiSync").then(({ apiCreate }) => apiCreate("/daybook", created));
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
  void import("@/lib/stores/apiSync").then(({ apiDelete }) => apiDelete("/daybook", id));
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

/**
 * Internal Transfer (contra entry) — moves funds between two of the
 * branch's own accounts (e.g. HDFC Bank → Cash in Hand). Posts two paired
 * Daybook entries that share a `pairId`:
 *
 *   - Debit leg on `fromAccount`  (decreases that account's balance)
 *   - Credit leg on `toAccount`   (increases that account's balance)
 *
 * Both legs use category "Internal Transfer", which the Financials P&L
 * computation explicitly excludes from Income and Expense. This is the
 * canonical book-keeping treatment of contra entries.
 *
 * Throws on day-lock, missing accounts, identical from/to, or non-positive
 * amounts. Returns both created entries.
 */
export function addInternalTransfer(args: {
  dateIso: string;
  time?: string;
  fromAccount: DaybookAccount;
  toAccount: DaybookAccount;
  amount: number;
  particulars: string;
  notes?: string;
}): { debit: DaybookEntry; credit: DaybookEntry } {
  const { dateIso, fromAccount, toAccount, amount, particulars, notes } = args;
  if (isDateLocked(dateIso)) throw new DayLockedError(dateIso);
  if (fromAccount === toAccount) {
    throw new Error("Source and destination accounts must be different.");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Transfer amount must be a positive number.");
  }
  if (!particulars.trim()) {
    throw new Error("Transfer particulars are required.");
  }
  // Generate a fresh contra-pair id from the current store. Format: XFR-N.
  const all = daybookStore.get();
  const maxXfr = all.reduce((m, e) => {
    const match = /^XFR-(\d+)$/.exec(e.pairId ?? "");
    if (!match) return m;
    const n = Number(match[1]);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  const pairId = `XFR-${maxXfr + 1}`;
  const time =
    args.time ??
    new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  const debit = addDaybookEntry({
    dateIso,
    time,
    side: "DEBIT",
    category: "Internal Transfer",
    particulars: `Transfer to ${toAccount} — ${particulars.trim()}`,
    refId: pairId,
    pairId,
    account: fromAccount,
    amount,
    notes: notes?.trim() || undefined,
  });
  const credit = addDaybookEntry({
    dateIso,
    time,
    side: "CREDIT",
    category: "Internal Transfer",
    particulars: `Transfer from ${fromAccount} — ${particulars.trim()}`,
    refId: pairId,
    pairId,
    account: toAccount,
    amount,
    notes: notes?.trim() || undefined,
  });
  return { debit, credit };
}

export function resetDaybook(): void {
  daybookStore.set([]);
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
