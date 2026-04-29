import {
  createPersistentStore,
  usePersistentStore,
} from "@/lib/stores/persistentStore";

/**
 * Global system settings — financial parameters that drive new originations
 * and the legal-vs-company interest split. Persisted in localStorage so the
 * Settings → Rates & Fees tab is the single source of truth, and every
 * downstream surface (Pawn / Vehicle Origination, ReceiptsLedger interest
 * split, Reports) reads from this store via `useSettings()`.
 */
export type GlobalSettings = {
  /** Pawn loan default interest rate, % per month. */
  pawnRatePctPerMonth: number;
  /** Vehicle loan default interest rate, % per annum. */
  vehicleRatePctPerAnnum: number;
  /** Penalty / overdue rate applied on missed instalments, % per month. */
  penaltyRatePctPerMonth: number;
  /** Flat processing fee charged at origination (₹). */
  processingFeeFlat: number;
  /**
   * Default Legal Interest component — % per annum that is allocated to the
   * legal-rate book of accounts when an interest receipt is posted. Per-loan
   * override lives on `Loan.legalInterestPct`. The remainder of any interest
   * collection goes to the Company Interest line.
   */
  globalLegalInterestRatePct: number;
};

const STORAGE_KEY = "kittangi:settings:v1";

const DEFAULT_SETTINGS: GlobalSettings = {
  pawnRatePctPerMonth: 1.5,
  vehicleRatePctPerAnnum: 11.25,
  penaltyRatePctPerMonth: 2.0,
  processingFeeFlat: 500,
  globalLegalInterestRatePct: 12,
};

const settingsStore = createPersistentStore<GlobalSettings>(
  STORAGE_KEY,
  DEFAULT_SETTINGS,
);

export function useSettings(): GlobalSettings {
  return usePersistentStore(settingsStore);
}

export function getSettings(): GlobalSettings {
  return settingsStore.get();
}

export function setSettings(patch: Partial<GlobalSettings>): void {
  settingsStore.set((prev) => ({ ...prev, ...patch }));
}

export function resetSettings(): void {
  settingsStore.set(DEFAULT_SETTINGS);
}

/**
 * Compute the legal vs company split for a given total interest amount.
 *
 * The split is deterministic and accounting-safe:
 * - `legal = round(total * legalRatePctPerAnnum / loanRatePctPerAnnum)`
 *   clamped to `[0, total]`
 * - `company = total - legal`
 *
 * If the loan's annual rate is zero or unknown, the entire amount is treated
 * as company interest so we never divide by zero or overstate the legal book.
 */
export function splitInterest(args: {
  totalInterest: number;
  loanAnnualRatePct: number;
  legalRatePctPerAnnum: number;
}): { legal: number; company: number } {
  const total = Math.max(0, Math.round(args.totalInterest));
  if (total === 0) return { legal: 0, company: 0 };
  const loanRate = args.loanAnnualRatePct;
  const legalRate = Math.max(0, args.legalRatePctPerAnnum);
  if (!Number.isFinite(loanRate) || loanRate <= 0) {
    return { legal: 0, company: total };
  }
  const cappedLegalRate = Math.min(legalRate, loanRate);
  const legal = Math.min(
    total,
    Math.max(0, Math.round((total * cappedLegalRate) / loanRate)),
  );
  return { legal, company: total - legal };
}
