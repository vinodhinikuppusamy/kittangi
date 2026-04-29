import {
  createPersistentStore,
  usePersistentStore,
} from "@/lib/stores/persistentStore";

/**
 * A "Day Lock" is the audit-trail snapshot taken when a cashier closes the
 * Chitta for a given calendar date. Once locked, the totals are frozen and
 * persisted across refreshes. The Daybook page surfaces the snapshot in a
 * read-only banner and disables further edits for that date (UI-level only —
 * the underlying daybook entries are not removed, just visually frozen).
 */
export type DayLock = {
  /** ISO date this lock covers (YYYY-MM-DD). */
  dateIso: string;
  /** ISO timestamp of when the day was locked. */
  lockedAtIso: string;
  /** Sum of all CREDIT entries for the date at lock time. */
  totalCashIn: number;
  /** Sum of all DEBIT entries for the date at lock time. */
  totalCashOut: number;
  /** totalCashIn − totalCashOut. */
  netChange: number;
  /** Number of entries the lock was computed against. */
  entryCount: number;
};

const STORAGE_KEY = "kittangi:day-locks:v1";

const dayLocksStore = createPersistentStore<DayLock[]>(STORAGE_KEY, []);

export function useDayLocks(): DayLock[] {
  return usePersistentStore(dayLocksStore);
}

export function getDayLock(dateIso: string): DayLock | undefined {
  return dayLocksStore.get().find((l) => l.dateIso === dateIso);
}

export function lockDay(lock: DayLock): void {
  dayLocksStore.set((prev) => {
    // Replace any existing lock for the same date so re-closing overwrites.
    const others = prev.filter((l) => l.dateIso !== lock.dateIso);
    return [lock, ...others];
  });
}

export function unlockDay(dateIso: string): void {
  dayLocksStore.set((prev) => prev.filter((l) => l.dateIso !== dateIso));
}

/**
 * Wipe every persisted day-lock. Used by the admin "System Reset" action so
 * a freshly-reset demo can post into the new (empty) Daybook without
 * tripping the lock on what used to be "today".
 */
export function resetDayLocks(): void {
  dayLocksStore.set([]);
}

/**
 * Non-reactive helper to check if a date is currently locked. Used by the
 * write paths in `daybookStore` (and any other module that posts to the
 * Chitta) so that locked dates are protected from new entries.
 */
export function isDateLocked(dateIso: string): boolean {
  return dayLocksStore.get().some((l) => l.dateIso === dateIso);
}
