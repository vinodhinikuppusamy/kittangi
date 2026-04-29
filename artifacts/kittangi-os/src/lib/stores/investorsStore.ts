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

const SEED_INVESTORS: Investor[] = [
  {
    id: "INV-1001",
    name: "Ramesh Subramanyam",
    contact: "+91 98450 11220",
    depositDateIso: isoOffset(180),
    principal: 1000000,
    monthlyRatePct: 1.5,
    payoutCycle: "1st of every month",
    status: "ACTIVE",
    payouts: [
      {
        id: "INV-PAY-1001-A",
        dateIso: isoOffset(60),
        period: "Feb 2026",
        amount: 15000,
      },
      {
        id: "INV-PAY-1001-B",
        dateIso: isoOffset(30),
        period: "Mar 2026",
        amount: 15000,
      },
    ],
  },
  {
    id: "INV-1002",
    name: "Saraswathi Rao",
    contact: "saras.rao@example.com",
    depositDateIso: isoOffset(120),
    principal: 500000,
    monthlyRatePct: 1.25,
    payoutCycle: "5th of every month",
    status: "ACTIVE",
    payouts: [
      {
        id: "INV-PAY-1002-A",
        dateIso: isoOffset(28),
        period: "Mar 2026",
        amount: 6250,
      },
    ],
  },
  {
    id: "INV-1003",
    name: "Vivek Bhat",
    contact: "+91 99022 33710",
    depositDateIso: isoOffset(45),
    principal: 750000,
    monthlyRatePct: 1.4,
    payoutCycle: "10th of every month",
    status: "ACTIVE",
    payouts: [],
  },
];

const investorsStore = createPersistentStore<Investor[]>(
  STORAGE_KEY,
  SEED_INVESTORS,
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
  return created;
}

export function updateInvestor(id: string, patch: Partial<Investor>): void {
  investorsStore.set((prev) =>
    prev.map((i) => (i.id === id ? { ...i, ...patch, id: i.id } : i)),
  );
}

export function deleteInvestor(id: string): void {
  investorsStore.set((prev) => prev.filter((i) => i.id !== id));
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
  investorsStore.set(SEED_INVESTORS);
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
