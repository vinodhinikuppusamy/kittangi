import {
  createPersistentStore,
  usePersistentStore,
} from "@/lib/stores/persistentStore";

/**
 * Global system settings — financial parameters that drive new originations
 * and the legal-vs-company interest split. Hydrated from backend settings so
 * the Settings → Rates & Fees tab is the single source of truth, and every
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
  /**
   * Legacy flat processing fee (₹). Kept for backward-compatibility with
   * persisted Settings blobs from earlier builds; no live surface reads it
   * anymore — origination forms now derive the fee from
   * `processingFeePer1000` (per-₹1,000 slab pricing).
   */
  processingFeeFlat: number;
  /**
   * Processing fee charged per ₹1,000 of loan principal at origination.
   * Pawn + Vehicle origination forms multiply this by the requested loan
   * amount to auto-compute the fee — there is no per-loan override field.
   */
  processingFeePer1000: number;
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
  pawnRatePctPerMonth: 0,
  vehicleRatePctPerAnnum: 0,
  penaltyRatePctPerMonth: 0,
  processingFeeFlat: 0,
  processingFeePer1000: 0,
  globalLegalInterestRatePct: 0,
};

const settingsStore = createPersistentStore<GlobalSettings>(
  STORAGE_KEY,
  DEFAULT_SETTINGS,
);

/**
 * One-time forward migration. When the persisted settings blob is missing
 * any field that the current `GlobalSettings` shape requires (e.g. the
 * `processingFeePer1000` slab introduced April 2026), back-fill with the
 * default and rewrite the store so every downstream reader gets a stable
 * object reference. Doing this at module-load — instead of wrapping every
 * read — avoids a `useSyncExternalStore` infinite-render loop, since
 * returning a fresh `{...defaults, ...current}` from the snapshot would
 * make React think the value changed on every commit.
 */
(function backfillMissingSettingsFields(): void {
  const current = settingsStore.get() as Partial<GlobalSettings>;
  const required = Object.keys(DEFAULT_SETTINGS) as Array<keyof GlobalSettings>;
  const missing = required.some((k) => current[k] === undefined);
  if (missing) {
    settingsStore.set({ ...DEFAULT_SETTINGS, ...current } as GlobalSettings);
  }
})();

export function useSettings(): GlobalSettings {
  return usePersistentStore(settingsStore);
}

export function getSettings(): GlobalSettings {
  return settingsStore.get();
}

export function setSettings(patch: Partial<GlobalSettings>): void {
  settingsStore.set((prev) => ({ ...prev, ...patch }));
  void import("@/lib/stores/apiSync").then(({ apiPut }) => {
    for (const [key, value] of Object.entries(patch)) {
      void apiPut(`/settings/${encodeURIComponent(key)}`, { value });
    }
  });
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
