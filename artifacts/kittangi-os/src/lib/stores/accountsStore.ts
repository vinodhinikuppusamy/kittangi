import { useMemo } from "react";
import {
  createPersistentStore,
  usePersistentStore,
} from "@/lib/stores/persistentStore";
import { useDaybook, type DaybookEntry } from "@/lib/stores/daybookStore";

/**
 * Account types control how the account is rendered (cash drawer vs bank
 * account chips, icons) and have no effect on balance arithmetic. All
 * accounts are treated as ASSET accounts: CREDIT entries increase the
 * balance and DEBIT entries decrease it, in line with cashier-side
 * book-keeping conventions used across the rest of the app.
 */
export type AccountType = "CASH" | "BANK";

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  /** A short subtitle shown beneath the name in pickers (e.g. "A/c ••• 4521"). */
  subtitle?: string;
  /** Opening balance set when the account was first opened on the books. */
  openingBalance: number;
  /** ISO date the account was opened. Used for audit + reporting. */
  openedAtIso: string;
};

const STORAGE_KEY = "kittangi:accounts:v1";

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------
//
// IMPORTANT: The seed account ids ("CASH", "HDFC", "SBI") match the
// literal strings written into the existing Daybook seed (and into
// hydrated datasets from returning devices) so balance computations work
// correctly out of the box without any data migration.
// ---------------------------------------------------------------------------

const SEED_ACCOUNTS: Account[] = [
  {
    id: "CASH",
    name: "Cash in Hand",
    type: "CASH",
    subtitle: "Branch cash drawer",
    openingBalance: 218430,
    openedAtIso: "2025-04-01",
  },
  {
    id: "HDFC",
    name: "HDFC Bank",
    type: "BANK",
    subtitle: "Current A/c ••• 4521",
    openingBalance: 1250000,
    openedAtIso: "2025-04-01",
  },
  {
    id: "SBI",
    name: "SBI Bank",
    type: "BANK",
    subtitle: "Overdraft A/c ••• 8870",
    openingBalance: 875000,
    openedAtIso: "2025-04-01",
  },
];

const accountsStore = createPersistentStore<Account[]>(STORAGE_KEY, []);

let nextSeq = 0;
function nextAccountId(existing: Account[]): string {
  const max = existing.reduce((m, a) => {
    const match = /ACC-(\d+)/.exec(a.id);
    if (!match) return m;
    const n = Number(match[1]);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  if (nextSeq <= max) nextSeq = max + 1;
  else nextSeq += 1;
  return `ACC-${nextSeq}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function useAccounts(): Account[] {
  return usePersistentStore(accountsStore);
}

export function getAccount(id: string): Account | undefined {
  return accountsStore.get().find((a) => a.id === id);
}

export function addAccount(
  draft: Omit<Account, "id"> & { id?: string },
): Account {
  const created: Account = {
    ...draft,
    id: draft.id ?? nextAccountId(accountsStore.get()),
  };
  accountsStore.set((prev) => [...prev, created]);
  void import("@/lib/stores/apiSync").then(({ apiCreate }) => apiCreate("/accounts", { ...created, openedAtIso: created.openedAtIso ?? new Date().toISOString() }));
  return created;
}

export function updateAccount(id: string, patch: Partial<Account>): void {
  accountsStore.set((prev) =>
    prev.map((a) => (a.id === id ? { ...a, ...patch, id: a.id } : a)),
  );
  void import("@/lib/stores/apiSync").then(({ apiUpdate }) => apiUpdate("/accounts", id, patch));
}

export function deleteAccount(id: string): void {
  accountsStore.set((prev) => prev.filter((a) => a.id !== id));
  void import("@/lib/stores/apiSync").then(({ apiDelete }) => apiDelete("/accounts", id));
}

export function resetAccounts(): void {
  accountsStore.set([]);
}

// ---------------------------------------------------------------------------
// Balance computation
// ---------------------------------------------------------------------------

/**
 * Pure helper: compute an account's running balance from a list of Daybook
 * entries plus the opening balance. CREDIT entries increase the balance
 * (cash IN), DEBIT entries decrease it (cash OUT).
 *
 * Always passes through ALL entries (no date filter) so the balance reflects
 * the entire ledger to date — callers that want a slice should pre-filter.
 */
export function computeAccountBalance(
  account: Account | undefined,
  entries: DaybookEntry[],
): number {
  if (!account) return 0;
  let balance = account.openingBalance;
  for (const e of entries) {
    if (e.account !== account.id) continue;
    balance += e.side === "CREDIT" ? e.amount : -e.amount;
  }
  return balance;
}

/**
 * Reactive helper: returns the live balance for an account by combining the
 * account's opening balance with every persisted Daybook entry posted to it.
 */
export function useAccountBalance(accountId: string | undefined): number {
  const accounts = useAccounts();
  const entries = useDaybook();
  return useMemo(() => {
    if (!accountId) return 0;
    const acc = accounts.find((a) => a.id === accountId);
    return computeAccountBalance(acc, entries);
  }, [accountId, accounts, entries]);
}

/**
 * Reactive helper: returns balances for every account in the store, keyed by
 * account id. Intended for the Settings → Accounts tab and the Financials
 * Health Snapshot, both of which render every account in one pass.
 */
export function useAllAccountBalances(): Record<string, number> {
  const accounts = useAccounts();
  const entries = useDaybook();
  return useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of accounts) {
      map[a.id] = computeAccountBalance(a, entries);
    }
    return map;
  }, [accounts, entries]);
}
