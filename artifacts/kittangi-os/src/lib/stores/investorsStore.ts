import {
  createPersistentStore,
  usePersistentStore,
} from "@/lib/stores/persistentStore";

export type InvestorPayout = {
  id: string;
  /** ISO date the payout was recorded. */
  dateIso: string;
  /** Free-text label for the period the payout covers, e.g. "Mar 2026". */
  period: string;
  amount: number;
};

export type Investor = {
  id: string; // INV-####
  name: string;
  contact: string;
  /** ISO date the deposit was placed. */
  depositDateIso: string;
  principal: number;
  /** Monthly interest rate, in percent. e.g. 1.5 means 1.5% per month. */
  monthlyRatePct: number;
  /** Free-text payout cycle, e.g. "1st of every month". */
  payoutCycle: string;
  payouts: InvestorPayout[];
  status: "ACTIVE" | "CLOSED";
};

const STORAGE_KEY = "kittangi:investors:v1";

function isoOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

const investorsStore = createPersistentStore<Investor[]>(
  STORAGE_KEY,
  [],
);

let nextSeq = 0;
function nextInvestorId(existing: Investor[]): string {
  const max = existing.reduce((m, i) => {
    const match = /INV-(\d+)/.exec(i.id);
    if (!match) return m;
    const n = Number(match[1]);
    return Number.isFinite(n) && n > m ? n : m;
  }, 1003);
  if (nextSeq <= max) nextSeq = max + 1;
  else nextSeq += 1;
  return `INV-${nextSeq}`;
}

export function useInvestors(): Investor[] {
  return usePersistentStore(investorsStore);
}

export function addInvestor(
  draft: Omit<Investor, "id" | "payouts" | "status"> & {
    status?: Investor["status"];
  },
): Investor {
  const created: Investor = {
    ...draft,
    id: nextInvestorId(investorsStore.get()),
    status: draft.status ?? "ACTIVE",
    payouts: [],
  };
  investorsStore.set((prev) => [created, ...prev]);
  void import("@/lib/stores/apiSync").then(({ apiCreate }) => apiCreate("/investors", created));
  return created;
}

export function updateInvestor(id: string, patch: Partial<Investor>): void {
  investorsStore.set((prev) =>
    prev.map((i) => (i.id === id ? { ...i, ...patch, id: i.id } : i)),
  );
  void import("@/lib/stores/apiSync").then(({ apiUpdate }) => apiUpdate("/investors", id, patch));
}

export function deleteInvestor(id: string): void {
  investorsStore.set((prev) => prev.filter((i) => i.id !== id));
  void import("@/lib/stores/apiSync").then(({ apiDelete }) => apiDelete("/investors", id));
}

export function recordPayout(
  investorId: string,
  payout: Omit<InvestorPayout, "id">,
): InvestorPayout {
  const created: InvestorPayout = {
    ...payout,
    id: `INV-PAY-${investorId}-${Date.now()}`,
  };
  investorsStore.set((prev) =>
    prev.map((i) =>
      i.id === investorId
        ? { ...i, payouts: [created, ...i.payouts] }
        : i,
    ),
  );
  return created;
}

export function resetInvestors(): void {
  investorsStore.set([]);
}

/**
 * Helper: monthly interest amount for a given investor (principal × rate%).
 * Centralised so the Deposits page and the metric tiles use the same formula.
 */
export function monthlyInterest(investor: Investor): number {
  return Math.round((investor.principal * investor.monthlyRatePct) / 100);
}

/**
 * Production wipe: clear ALL investor records (deposits + payouts).
 * Used by the "Wipe All Transactional Data" admin tool when a branch is
 * going live so capital is re-entered against real lenders.
 */
export function wipeInvestors(): void {
  investorsStore.set([]);
}
