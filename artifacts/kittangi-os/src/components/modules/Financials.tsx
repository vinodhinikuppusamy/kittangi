import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Banknote,
  Building2,
  Download,
  HandCoins,
  LineChart,
  Minus,
  Plus,
  Receipt,
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { exportXlsx, num, fmtDate as fmtDateXlsx } from "@/lib/xlsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDaybook } from "@/lib/stores/daybookStore";
import {
  monthlyInterest,
  useInvestors,
  type Investor,
} from "@/lib/stores/investorsStore";
import {
  useAccounts,
  useAllAccountBalances,
} from "@/lib/stores/accountsStore";
import { useLoans } from "@/lib/stores/loansStore";
import { useSettings } from "@/lib/stores/settingsStore";
import { accruedInterestForLoan } from "@/lib/interest";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

// ---------------------------------------------------------------------------
// Financial-year helpers
//
// The Indian Financial Year runs Apr 1 → Mar 31. We label years as "YYYY-YY"
// (e.g. the year starting Apr 2025 → "2025-26"). All aggregation in this
// module passes through these helpers so the same definition is enforced
// everywhere.
// ---------------------------------------------------------------------------

type FinancialYear = {
  /** Calendar year the FY starts in (e.g. 2025 for FY 2025-26). */
  startYear: number;
  /** Inclusive ISO start date (YYYY-04-01). */
  startIso: string;
  /** Inclusive ISO end date (YYYY-03-31 of the following year). */
  endIso: string;
  /** Display label, e.g. "2025-26". */
  label: string;
};

function buildFinancialYear(startYear: number): FinancialYear {
  const next = startYear + 1;
  return {
    startYear,
    startIso: `${startYear}-04-01`,
    endIso: `${next}-03-31`,
    label: `${startYear}-${String(next).slice(-2)}`,
  };
}

function fyForDate(iso: string): FinancialYear | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const m = d.getMonth(); // 0-11
  const y = d.getFullYear();
  // Jan-Mar belongs to the FY that started the previous April.
  return buildFinancialYear(m >= 3 ? y : y - 1);
}

function isWithinFY(iso: string, fy: FinancialYear): boolean {
  return iso >= fy.startIso && iso <= fy.endIso;
}

// ---------------------------------------------------------------------------
// Header sub-components
// ---------------------------------------------------------------------------

function HeroMetric({
  label,
  value,
  hint,
  positive,
}: {
  label: string;
  value: string;
  hint: string;
  positive: boolean;
}) {
  return (
    <Card
      className="border-2 shadow-sm"
      style={{
        borderColor: positive
          ? "rgba(74,111,165,0.30)"
          : "rgba(220,38,38,0.30)",
        background: positive
          ? "linear-gradient(135deg, #FFFFFF 0%, rgba(191,221,245,0.40) 100%)"
          : "linear-gradient(135deg, #FFFFFF 0%, rgba(254,202,202,0.30) 100%)",
      }}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {label}
            </div>
            <div
              className="mt-2 text-4xl font-extrabold tracking-tight"
              style={{
                color: positive ? "var(--brand-primary)" : "rgb(185,28,28)",
              }}
            >
              {value}
            </div>
            <div className="mt-2 text-xs text-slate-600">{hint}</div>
          </div>
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{
              backgroundColor: positive
                ? "var(--brand-light)"
                : "rgba(220,38,38,0.10)",
            }}
          >
            {positive ? (
              <TrendingUp size={22} style={{ color: "var(--brand-primary)" }} />
            ) : (
              <TrendingDown size={22} style={{ color: "rgb(185,28,28)" }} />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniMetric({
  label,
  value,
  hint,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <Card
      className="border bg-white shadow-sm"
      style={{ borderColor: "rgba(74,111,165,0.12)" }}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {label}
            </div>
            <div
              className="mt-2 text-2xl font-bold tracking-tight"
              style={{ color: "var(--brand-primary)" }}
            >
              {value}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">{hint}</div>
          </div>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: iconBg }}
          >
            <Icon size={18} style={{ color: iconColor }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main module
// ---------------------------------------------------------------------------

export default function Financials() {
  const allEntries = useDaybook();
  const investors = useInvestors();

  // ---- Build the FY dropdown options ------------------------------------
  // We look at every dated artefact in the system (daybook entries, investor
  // deposits, investor payouts) and surface the union of FYs they touch, plus
  // the current FY, so the dropdown is always relevant to the data on hand.
  const fyOptions = useMemo<FinancialYear[]>(() => {
    const years = new Set<number>();

    for (const e of allEntries) {
      const fy = fyForDate(e.dateIso);
      if (fy) years.add(fy.startYear);
    }
    for (const inv of investors) {
      const fy = fyForDate(inv.depositDateIso);
      if (fy) years.add(fy.startYear);
      for (const p of inv.payouts) {
        const pfy = fyForDate(p.dateIso);
        if (pfy) years.add(pfy.startYear);
      }
    }
    const currentFy = fyForDate(new Date().toISOString().slice(0, 10));
    if (currentFy) years.add(currentFy.startYear);

    const sorted = Array.from(years).sort((a, b) => b - a);
    return sorted.map(buildFinancialYear);
  }, [allEntries, investors]);

  const defaultFyKey = useMemo(() => {
    const todayFy = fyForDate(new Date().toISOString().slice(0, 10));
    if (todayFy && fyOptions.some((f) => f.startYear === todayFy.startYear)) {
      return String(todayFy.startYear);
    }
    return fyOptions[0]?.startYear !== undefined
      ? String(fyOptions[0].startYear)
      : "";
  }, [fyOptions]);

  const [selectedFyKey, setSelectedFyKey] = useState<string>(defaultFyKey);
  const fy = useMemo<FinancialYear | null>(() => {
    if (!selectedFyKey) return null;
    return (
      fyOptions.find((f) => String(f.startYear) === selectedFyKey) ?? null
    );
  }, [fyOptions, selectedFyKey]);

  // ---- P&L aggregation --------------------------------------------------
  const pnl = useMemo(() => {
    if (!fy) {
      return {
        interestEarnedPawn: 0,
        interestEarnedVehicle: 0,
        interestEarned: 0,
        otherIncome: 0,
        totalIncome: 0,
        interestPaid: 0,
        opExpensesByCategory: [] as Array<{ category: string; amount: number }>,
        opExpenses: 0,
        netProfit: 0,
      };
    }

    let interestEarnedPawn = 0;
    let interestEarnedVehicle = 0;
    let otherIncome = 0;
    const expenseBuckets: Record<string, number> = {};

    for (const e of allEntries) {
      if (!isWithinFY(e.dateIso, fy)) continue;

      // ---- Internal Transfer (contra) is excluded from BOTH sides ----
      // These pair a Debit + Credit on the same date with a shared pairId so
      // the cash position stays accurate without double-counting income or
      // expense. We exclude on BOTH the explicit category and the presence
      // of a `pairId` (which only contra entries carry) so any future contra
      // category — and any orphaned half of a pair from a partial migration
      // — is still kept out of the P&L.
      if (e.category === "Internal Transfer") continue;
      if (e.pairId) continue;

      // ---- Income side ------------------------------------------------
      // Pawn interest receipts and Vehicle EMI receipts both contribute to
      // "Interest Earned" in the P&L. Principal Recovery and Full Settlement
      // are balance-sheet movements (loan book ↓, cash ↑) and never hit the
      // P&L — they're explicitly excluded here.
      if (e.side === "CREDIT") {
        if (e.category === "Interest Income") interestEarnedPawn += e.amount;
        else if (e.category === "EMI Received")
          interestEarnedVehicle += e.amount;
        else if (e.category === "Other Income") otherIncome += e.amount;
      }

      // ---- Expense side ----------------------------------------------
      // Loan Disbursements and Cash Movements are explicitly NOT expenses
      // (they are asset-side flows). Investor payouts have their own line.
      if (e.side === "DEBIT") {
        if (
          e.category === "Branch Expense" ||
          e.category === "Salary" ||
          e.category === "Utilities" ||
          e.category === "Other Expense"
        ) {
          expenseBuckets[e.category] =
            (expenseBuckets[e.category] ?? 0) + e.amount;
        }
      }
    }

    // ---- Investor interest paid (a.k.a. "Cost of Funds") --------------
    // Investor payouts are stored on the investor record (not in the
    // daybook), so we sum them separately. Anything dated within the FY
    // is included.
    let interestPaid = 0;
    for (const inv of investors) {
      for (const p of inv.payouts) {
        if (isWithinFY(p.dateIso, fy)) interestPaid += p.amount;
      }
    }

    const interestEarned = interestEarnedPawn + interestEarnedVehicle;
    const totalIncome = interestEarned + otherIncome;
    const opExpensesByCategory = Object.entries(expenseBuckets)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
    const opExpenses = opExpensesByCategory.reduce(
      (s, b) => s + b.amount,
      0,
    );
    const netProfit = totalIncome - interestPaid - opExpenses;

    return {
      interestEarnedPawn,
      interestEarnedVehicle,
      interestEarned,
      otherIncome,
      totalIncome,
      interestPaid,
      opExpensesByCategory,
      opExpenses,
      netProfit,
    };
  }, [allEntries, investors, fy]);

  // The trial-balance computation is moved below the balance-sheet block
  // because it depends on the same live aggregates (account balances,
  // outstanding principal, investor deposits). See the `trialBalance` memo
  // a few sections down.

  // ---- Balance-sheet snapshot ------------------------------------------
  // Total Assets (= current outstanding loan book principal) is computed by
  // walking the entire daybook, not just the selected FY. A loan disbursed
  // 5 years ago and still open contributes to today's loan book regardless
  // of which FY the user is viewing.
  //
  // We treat any loan id (refId) that has a "Full Settlement" entry as
  // closed and subtract its disbursement from the asset side. For loans
  // still active, we subtract any "Principal Recovery" amounts.
  const balance = useMemo(() => {
    // Pass 1 — collect the universe of disbursed loan ids so any Principal
    // Recovery that doesn't link back to a known loan is ignored (defensive
    // guard against malformed/orphan recoveries that would otherwise
    // understate Total Assets).
    const disbursedLoanIds = new Set<string>();
    for (const e of allEntries) {
      if (e.category === "Loan Disbursement" && e.side === "DEBIT") {
        const loanId = e.refId?.trim();
        if (loanId) disbursedLoanIds.add(loanId);
      }
    }

    // Pass 2 — collect the loan ids that have been fully settled.
    const closedLoanIds = new Set<string>();
    for (const e of allEntries) {
      if (e.category === "Full Settlement" && e.refId) {
        // refId convention is "RCP-XXXXX • LOAN-ID"; loan id is after the dot.
        const parts = e.refId.split("•").map((p) => p.trim());
        const loanId = parts.length >= 2 ? parts[1] : parts[0];
        if (loanId && disbursedLoanIds.has(loanId)) closedLoanIds.add(loanId);
      }
    }

    // Pass 3 — sum disbursements for still-active loans.
    let activePrincipal = 0;
    for (const e of allEntries) {
      if (e.category === "Loan Disbursement" && e.side === "DEBIT") {
        const loanId = e.refId?.trim();
        if (loanId && closedLoanIds.has(loanId)) continue;
        activePrincipal += e.amount;
      }
    }
    // Pass 4 — subtract Principal Recovery, but only when the recovery can
    // be linked to an active (disbursed but not closed) loan id. Recoveries
    // for fully-settled loans are skipped (already counted in the close).
    // Recoveries with unparseable / unknown refIds are skipped to avoid
    // silently understating the asset book.
    for (const e of allEntries) {
      if (e.category === "Principal Recovery" && e.side === "CREDIT") {
        const parts = (e.refId ?? "").split("•").map((p) => p.trim());
        const loanId = parts.length >= 2 ? parts[1] : parts[0];
        if (!loanId) continue;
        if (!disbursedLoanIds.has(loanId)) continue;
        if (closedLoanIds.has(loanId)) continue;
        activePrincipal -= e.amount;
      }
    }
    activePrincipal = Math.max(0, activePrincipal);

    const activeInvestorDeposits = investors
      .filter((i) => i.status === "ACTIVE")
      .reduce((s, i) => s + i.principal, 0);

    const netWorth = activePrincipal - activeInvestorDeposits;
    return {
      totalAssets: activePrincipal,
      totalLiabilities: activeInvestorDeposits,
      activePrincipal,
      netWorth,
      activeInvestors: investors.filter((i) => i.status === "ACTIVE"),
    };
  }, [allEntries, investors]);

  // ---- Yearly Balance Sheet --------------------------------------------
  // A formal Assets = Liabilities + Equity statement. Cash & bank balances
  // come from accountsStore (running balance after every Daybook posting),
  // the loan book is the live `activePrincipal`, and accrued interest is
  // summed from the loan ledger. Equity has two pieces: starting capital
  // (sum of opening account balances on the books on Day 1) and the plug
  // figure "Retained Earnings" derived from Assets − Liabilities − Capital,
  // so the statement always balances by construction.
  const accountBalances = useAllAccountBalances();
  const accountsList = useAccounts();
  const allLoans = useLoans();
  const balanceSheet = useMemo(() => {
    const cashOnHand = accountsList
      .filter((a) => a.type === "CASH")
      .reduce((s, a) => s + (accountBalances[a.id] ?? 0), 0);
    const bankBalances = accountsList
      .filter((a) => a.type !== "CASH")
      .reduce((s, a) => s + (accountBalances[a.id] ?? 0), 0);
    // Asset = unbilled interest on still-open principal. We use the live
    // engine (floor + per-day pro-rata) instead of the legacy
    // `loan.accruedInterest` snapshot so the Balance Sheet matches what the
    // Receipts cashier and Loan Management table show today. The helper
    // already returns 0 for non-ACTIVE loans, so no extra filter is needed.
    const accruedInterest = allLoans.reduce(
      (s, l) => s + accruedInterestForLoan(l),
      0,
    );

    const totalAssets =
      cashOnHand + bankBalances + balance.activePrincipal + accruedInterest;

    const investorDeposits = balance.totalLiabilities;
    const totalLiabilities = investorDeposits;

    const startingCapital = accountsList.reduce(
      (s, a) => s + (a.openingBalance ?? 0),
      0,
    );
    const retainedEarnings = totalAssets - totalLiabilities - startingCapital;
    const totalEquity = startingCapital + retainedEarnings;

    return {
      cashOnHand,
      bankBalances,
      activePrincipal: balance.activePrincipal,
      accruedInterest,
      totalAssets,
      investorDeposits,
      totalLiabilities,
      startingCapital,
      retainedEarnings,
      totalEquity,
      // Should always be ~0 by construction; surfaced as a tie-out check.
      tieOut: totalAssets - (totalLiabilities + totalEquity),
    };
  }, [accountsList, accountBalances, allLoans, balance]);

  // ---- Trial Balance (live, balance-sheet style) -----------------------
  // Replaces the legacy per-category sum-of-debits/sum-of-credits view —
  // that one would never balance because Daybook `side` is account-
  // perspective (CREDIT = cash IN), not strict double-entry.
  //
  // The new TB lays out the accounting identity directly:
  //
  //   DR: Outstanding Principal (gross) + Cash & Bank + Cumulative Expenses
  //   CR: Investor Deposits + Interest Collected (Legal + Company)
  //       + Processing Fees Earned + Opening Capital
  //
  // The DR principal is on the GROSS basis (loan.principal) so it lines
  // up with the CR fee credit (gross − net retained at origination); see
  // the worked-example proof in the comments below the memo.
  //
  // For an ideal series of postings the two columns tie out to ₹0; any
  // residual surfaces in the "Out by ₹X" badge so the operator can chase
  // the gap. Most often it traces to either an investor deposit whose
  // matching cash inflow was never posted to the Daybook, or seeded /
  // legacy Full Settlement entries that predate the legal/company
  // portion split fields.
  const settings = useSettings();
  const trialBalance = useMemo(() => {
    // ---- DR — Assets & Expenses ---------------------------------------

    // Identify closed loans the same way the balance memo does: a "Full
    // Settlement" entry's refId is "RCP-XXXXX • LOAN-ID". The loanId
    // after the bullet is what we key on.
    const closedLoanIds = new Set<string>();
    for (const e of allEntries) {
      if (e.category === "Full Settlement" && e.refId) {
        const parts = e.refId.split("•").map((p) => p.trim());
        const loanId = parts.length >= 2 ? parts[1] : parts[0];
        if (loanId) closedLoanIds.add(loanId);
      }
    }
    // Active loans by id for O(1) lookups inside the recovery loop.
    const activeLoanById = new Map<string, (typeof allLoans)[number]>();
    for (const l of allLoans) {
      if (l.status !== "ACTIVE") continue;
      if (closedLoanIds.has(l.id)) continue;
      activeLoanById.set(l.id, l);
    }

    // Gross outstanding principal = Σ(loan.principal for active loans)
    //   − Σ(Principal Recovery entries linked to those active loans).
    // Using the gross stored principal is what makes the fee credit
    // tie out: at origination DR_principal increases by `gross` while
    // DR_cash decreases by `net` (net = gross − fee), so the total DR
    // change is `+fee`, exactly matching the +fee on CR.
    let drOutstandingPrincipal = 0;
    for (const l of activeLoanById.values()) {
      drOutstandingPrincipal += l.principal;
    }
    for (const e of allEntries) {
      if (e.side !== "CREDIT") continue;
      if (e.category !== "Principal Recovery") continue;
      const parts = (e.refId ?? "").split("•").map((p) => p.trim());
      const loanId = parts.length >= 2 ? parts[1] : parts[0];
      if (!loanId) continue;
      if (!activeLoanById.has(loanId)) continue;
      drOutstandingPrincipal -= e.amount;
    }
    drOutstandingPrincipal = Math.max(0, drOutstandingPrincipal);

    const drCashAndBank = accountsList.reduce(
      (s, a) => s + (accountBalances[a.id] ?? 0),
      0,
    );

    // Cumulative expense outflows (DEBIT entries categorised as opex /
    // financing cost). Cash Movement and Internal Transfer are intra-book
    // and net to ₹0 across the two legs, so they're excluded by design.
    const expenseCategories = new Set([
      "Branch Expense",
      "Salary",
      "Utilities",
      "Interest Expense",
      "Other Expense",
    ]);
    let drCumExpenses = 0;
    for (const e of allEntries) {
      if (e.side === "DEBIT" && expenseCategories.has(e.category)) {
        drCumExpenses += e.amount;
      }
    }

    // ---- CR — Liabilities, Income & Equity ----------------------------
    const crInvestorDeposits = balance.totalLiabilities;
    const crOpeningCapital = accountsList.reduce(
      (s, a) => s + (a.openingBalance ?? 0),
      0,
    );

    // Interest collected — split into Legal vs Company. When the entry
    // carries the explicit portions (modern receipts), use them.
    // Otherwise fall back to the global Legal % over the standard pawn
    // book rate (30% p.a.) so legacy seed entries still produce a
    // sensible split rather than the previous hard-coded 50/50.
    const fallbackLegalShare = Math.min(
      1,
      Math.max(0, settings.globalLegalInterestRatePct / 30),
    );
    let crLegalInterest = 0;
    let crCompanyInterest = 0;
    for (const e of allEntries) {
      if (e.side !== "CREDIT") continue;
      if (
        e.category === "Interest Income" ||
        e.category === "EMI Received"
      ) {
        const lp = e.legalInterestPortion;
        const cp = e.companyInterestPortion;
        if (lp !== undefined && cp !== undefined) {
          crLegalInterest += lp;
          crCompanyInterest += cp;
        } else {
          // Legacy entry — apply the configured global Legal % as a
          // ratio against the standard 30% p.a. pawn rate. Clamped to
          // [0, 1] to handle pathological setups.
          crLegalInterest += e.amount * fallbackLegalShare;
          crCompanyInterest += e.amount * (1 - fallbackLegalShare);
        }
      } else if (e.category === "Full Settlement") {
        // Full Settlement amount = principal + interest. Only the
        // interest sub-amount is income; the principal sub-amount
        // offsets the asset side (handled via the activeLoanById /
        // closedLoanIds logic above).
        const lp = e.legalInterestPortion ?? 0;
        const cp = e.companyInterestPortion ?? 0;
        crLegalInterest += lp;
        crCompanyInterest += cp;
        // Legacy seed Full Settlement entries lack portion fields, so
        // their interest contribution is silently ₹0 here — that gap
        // will surface in the "Out by" badge so the operator knows to
        // re-issue the closure receipt or post a manual income entry.
      }
    }
    const crInterestCollected = crLegalInterest + crCompanyInterest;

    // Processing-fee income — implicit in the disbursement flow: we
    // store loan.principal as the GROSS amount but post the net (after
    // fee deduction) to the Daybook. Summed across ALL loans (active
    // and closed) because once earned at origination, fee income stays
    // on the books even after the loan is settled.
    let crFeesEarned = 0;
    const disbursementByRef = new Map<string, number>();
    for (const e of allEntries) {
      if (e.category === "Loan Disbursement" && e.side === "DEBIT") {
        const ref = e.refId?.trim();
        if (!ref) continue;
        // First disbursement entry per loan id wins (defensive against
        // duplicate postings — should never happen but guards the math).
        if (!disbursementByRef.has(ref)) {
          disbursementByRef.set(ref, e.amount);
        }
      }
    }
    for (const l of allLoans) {
      const disbursed = disbursementByRef.get(l.id);
      if (disbursed === undefined) continue;
      const fee = l.principal - disbursed;
      if (fee > 0) crFeesEarned += fee;
    }

    const drTotal =
      drOutstandingPrincipal + drCashAndBank + drCumExpenses;
    const crTotal =
      crInvestorDeposits +
      crInterestCollected +
      crFeesEarned +
      crOpeningCapital;

    return {
      // DR rows
      drOutstandingPrincipal,
      drCashAndBank,
      drCumExpenses,
      // CR rows
      crInvestorDeposits,
      crLegalInterest,
      crCompanyInterest,
      crInterestCollected,
      crFeesEarned,
      crOpeningCapital,
      // Totals
      drTotal,
      crTotal,
      // Signed gap — positive = debits exceed credits (asset overstated
      // or income/liability understated); negative = the reverse.
      outBy: drTotal - crTotal,
    };
  }, [
    allEntries,
    allLoans,
    accountsList,
    accountBalances,
    balance,
    settings.globalLegalInterestRatePct,
  ]);

  // ---- Render -----------------------------------------------------------
  return (
    <div className="mx-auto max-w-7xl pb-10">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: "var(--brand-light)" }}
          >
            <LineChart size={22} style={{ color: "var(--brand-primary)" }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--brand-primary)" }}
            >
              Financials &mdash; P&amp;L and Balance Sheet
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Annual profitability and a real-time business health snapshot,
              aggregated from the persisted Chitta and Investor records.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Financial Year
          </span>
          <Select value={selectedFyKey} onValueChange={setSelectedFyKey}>
            <SelectTrigger
              className="h-9 w-[180px] bg-white text-sm"
              style={{
                borderColor: "rgba(74,111,165,0.25)",
                color: "var(--brand-primary)",
              }}
            >
              <SelectValue placeholder="Select FY..." />
            </SelectTrigger>
            <SelectContent>
              {fyOptions.map((f) => (
                <SelectItem key={f.startYear} value={String(f.startYear)}>
                  FY {f.label} &nbsp;
                  <span className="text-[10px] text-slate-400">
                    (Apr {f.startYear} – Mar {f.startYear + 1})
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {fy && (
        <>
          {/* ============ SECTION 1 — Annual P&L ============ */}
          <Card
            className="mb-6 border bg-white shadow-sm"
            style={{ borderColor: "rgba(74,111,165,0.12)" }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "var(--brand-light)" }}
                >
                  <Receipt
                    size={16}
                    style={{ color: "var(--brand-primary)" }}
                  />
                </div>
                <div>
                  <CardTitle
                    className="text-base font-semibold"
                    style={{ color: "var(--brand-primary)" }}
                  >
                    Annual P&amp;L Statement &mdash; FY {fy.label}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Apr {fy.startYear} – Mar {fy.startYear + 1}. Sourced live
                    from receipt income and investor payouts.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Income & expense rows in a clean ledger table */}
              <div
                className="overflow-hidden rounded-lg border"
                style={{ borderColor: "rgba(74,111,165,0.12)" }}
              >
                <Table>
                  <TableHeader>
                    <TableRow style={{ backgroundColor: "rgba(74,111,165,0.04)" }}>
                      <TableHead className="w-[60%] text-[11px] font-semibold uppercase tracking-wider">
                        Particulars
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                        Detail
                      </TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                        Amount
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* INCOME ─────────────────────────── */}
                    <TableRow style={{ backgroundColor: "rgba(34,197,94,0.05)" }}>
                      <TableCell colSpan={3} className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
                        Income
                      </TableCell>
                    </TableRow>
                    <PnlRow
                      sign="+"
                      label="Interest Earned (Pawn)"
                      detail="Pawn receipts — interest portion"
                      amount={pnl.interestEarnedPawn}
                      tone="positive"
                    />
                    <PnlRow
                      sign="+"
                      label="Interest Earned (Vehicle)"
                      detail="EMI receipts — interest component"
                      amount={pnl.interestEarnedVehicle}
                      tone="positive"
                    />
                    <PnlRow
                      sign="+"
                      label="Other Income"
                      detail="Doc fees, scrap sales, miscellaneous receipts"
                      amount={pnl.otherIncome}
                      tone="positive"
                    />
                    <SubtotalRow
                      label="Total Income"
                      amount={pnl.totalIncome}
                      tone="positive"
                    />

                    {/* EXPENSES ───────────────────────── */}
                    <TableRow style={{ backgroundColor: "rgba(220,38,38,0.04)" }}>
                      <TableCell colSpan={3} className="text-[11px] font-semibold uppercase tracking-wider text-red-800">
                        Expenses
                      </TableCell>
                    </TableRow>
                    <PnlRow
                      sign="−"
                      label="Interest Paid to Investors"
                      detail={`${investors.length} deposits — payouts within the FY`}
                      amount={pnl.interestPaid}
                      tone="negative"
                    />
                    {pnl.opExpensesByCategory.length === 0 ? (
                      <PnlRow
                        sign="−"
                        label="Operating Expenses"
                        detail="No expense entries recorded for this FY"
                        amount={0}
                        tone="negative"
                      />
                    ) : (
                      pnl.opExpensesByCategory.map((bucket) => (
                        <PnlRow
                          key={bucket.category}
                          sign="−"
                          label={bucket.category}
                          detail={`Operating expense — ${bucket.category.toLowerCase()}`}
                          amount={bucket.amount}
                          tone="negative"
                        />
                      ))
                    )}
                    <SubtotalRow
                      label="Total Operating Expenses"
                      amount={pnl.opExpenses}
                      tone="negative"
                    />
                  </TableBody>
                </Table>
              </div>

              {/* Net Profit hero card */}
              <HeroMetric
                label={
                  pnl.netProfit >= 0 ? "Net Profit for the Year" : "Net Loss for the Year"
                }
                value={`${pnl.netProfit >= 0 ? "+" : "−"}${inr(
                  Math.abs(pnl.netProfit),
                )}`}
                hint={`Total Income ${inr(
                  pnl.totalIncome,
                )} − Interest Paid ${inr(
                  pnl.interestPaid,
                )} − Operating Expenses ${inr(pnl.opExpenses)}`}
                positive={pnl.netProfit >= 0}
              />
            </CardContent>
          </Card>

          {/* ============ SECTION 2 — Trial Balance ============ */}
          <Card
            className="border bg-white shadow-sm"
            style={{ borderColor: "rgba(74,111,165,0.12)" }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "var(--brand-light)" }}
                >
                  <Receipt size={16} style={{ color: "var(--brand-primary)" }} />
                </div>
                <div className="flex-1">
                  <CardTitle
                    className="text-base font-semibold"
                    style={{ color: "var(--brand-primary)" }}
                  >
                    Trial Balance
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Live balance-sheet view: Assets &amp; Expenses on the
                    debit side, Liabilities, Income &amp; Equity on the
                    credit side. The totals must tie.
                  </CardDescription>
                </div>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{
                    backgroundColor:
                      Math.abs(trialBalance.outBy) < 0.5
                        ? "rgba(34,197,94,0.14)"
                        : "rgba(244,63,94,0.14)",
                    color:
                      Math.abs(trialBalance.outBy) < 0.5
                        ? "rgb(21,128,61)"
                        : "#be123c",
                  }}
                  data-testid="badge-tb-status"
                >
                  {Math.abs(trialBalance.outBy) < 0.5
                    ? "Balanced"
                    : `Out by ${inr(Math.abs(trialBalance.outBy))}`}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ml-2 h-8 gap-1.5 px-3 text-xs font-semibold"
                  style={{
                    borderColor: "var(--brand-primary)",
                    color: "var(--brand-primary)",
                    background: "white",
                  }}
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10);
                    exportXlsx(`kittangi-trial-balance-${today}.xlsx`, [
                      {
                        name: "Trial Balance",
                        rows: [
                          [`Kittangi OS — Trial Balance`],
                          [`Generated ${fmtDateXlsx(today)}`],
                          [],
                          ["Particulars", "Debit (INR)", "Credit (INR)"],
                          ["— ASSETS & EXPENSES —", "", ""],
                          [
                            "Outstanding Loan Principal",
                            num(trialBalance.drOutstandingPrincipal),
                            "",
                          ],
                          [
                            "Cash & Bank Account Balances",
                            num(trialBalance.drCashAndBank),
                            "",
                          ],
                          [
                            "Cumulative Operating Expenses",
                            num(trialBalance.drCumExpenses),
                            "",
                          ],
                          ["— LIABILITIES, INCOME & EQUITY —", "", ""],
                          [
                            "Investor Deposits (Active)",
                            "",
                            num(trialBalance.crInvestorDeposits),
                          ],
                          [
                            "Interest Collected — Legal Portion",
                            "",
                            num(trialBalance.crLegalInterest),
                          ],
                          [
                            "Interest Collected — Company Portion",
                            "",
                            num(trialBalance.crCompanyInterest),
                          ],
                          [
                            "Processing Fees Earned",
                            "",
                            num(trialBalance.crFeesEarned),
                          ],
                          [
                            "Opening Capital",
                            "",
                            num(trialBalance.crOpeningCapital),
                          ],
                          [
                            "TOTAL",
                            num(trialBalance.drTotal),
                            num(trialBalance.crTotal),
                          ],
                          [
                            "Out by",
                            "",
                            num(Math.abs(trialBalance.outBy)),
                          ],
                        ],
                        colWidths: [40, 20, 20],
                      },
                    ]);
                    toast.success("Trial Balance exported", {
                      description: "Excel workbook downloaded.",
                    });
                  }}
                  data-testid="button-export-trial-balance-xlsx"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export XLSX
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div
                className="overflow-hidden rounded-lg border"
                style={{ borderColor: "rgba(74,111,165,0.12)" }}
              >
                <Table>
                  <TableHeader>
                    <TableRow
                      style={{ backgroundColor: "rgba(74,111,165,0.04)" }}
                    >
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                        Particulars
                      </TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                        Debit (₹)
                      </TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                        Credit (₹)
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* DR — Assets & Expenses */}
                    <TableRow
                      style={{ backgroundColor: "rgba(74,111,165,0.03)" }}
                    >
                      <TableCell
                        colSpan={3}
                        className="text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: "var(--brand-primary)" }}
                      >
                        Assets &amp; Expenses
                      </TableCell>
                    </TableRow>
                    <TableRow data-testid="row-tb-principal">
                      <TableCell className="text-sm font-medium text-slate-800">
                        Outstanding Loan Principal
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-slate-700">
                        {inr(trialBalance.drOutstandingPrincipal)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-slate-400">
                        —
                      </TableCell>
                    </TableRow>
                    <TableRow data-testid="row-tb-accounts">
                      <TableCell className="text-sm font-medium text-slate-800">
                        Cash &amp; Bank Account Balances
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-slate-700">
                        {inr(trialBalance.drCashAndBank)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-slate-400">
                        —
                      </TableCell>
                    </TableRow>
                    <TableRow data-testid="row-tb-expenses">
                      <TableCell className="text-sm font-medium text-slate-800">
                        Cumulative Operating Expenses
                        <span className="ml-1 text-[10px] text-slate-500">
                          (rent, salary, utilities, interest paid)
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-slate-700">
                        {inr(trialBalance.drCumExpenses)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-slate-400">
                        —
                      </TableCell>
                    </TableRow>

                    {/* CR — Liabilities, Income & Equity */}
                    <TableRow
                      style={{ backgroundColor: "rgba(74,111,165,0.03)" }}
                    >
                      <TableCell
                        colSpan={3}
                        className="text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: "var(--brand-primary)" }}
                      >
                        Liabilities, Income &amp; Equity
                      </TableCell>
                    </TableRow>
                    <TableRow data-testid="row-tb-investors">
                      <TableCell className="text-sm font-medium text-slate-800">
                        Investor Deposits (Active)
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-slate-400">
                        —
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-slate-700">
                        {inr(trialBalance.crInvestorDeposits)}
                      </TableCell>
                    </TableRow>
                    <TableRow data-testid="row-tb-legal">
                      <TableCell className="text-sm font-medium text-slate-800 pl-6">
                        Interest Collected &mdash; Legal Portion
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-slate-400">
                        —
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-slate-700">
                        {inr(trialBalance.crLegalInterest)}
                      </TableCell>
                    </TableRow>
                    <TableRow data-testid="row-tb-company">
                      <TableCell className="text-sm font-medium text-slate-800 pl-6">
                        Interest Collected &mdash; Company Portion
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-slate-400">
                        —
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-slate-700">
                        {inr(trialBalance.crCompanyInterest)}
                      </TableCell>
                    </TableRow>
                    <TableRow data-testid="row-tb-fees">
                      <TableCell className="text-sm font-medium text-slate-800">
                        Processing Fees Earned
                        <span className="ml-1 text-[10px] text-slate-500">
                          (gross principal − net disbursed)
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-slate-400">
                        —
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-slate-700">
                        {inr(trialBalance.crFeesEarned)}
                      </TableCell>
                    </TableRow>
                    <TableRow data-testid="row-tb-opening">
                      <TableCell className="text-sm font-medium text-slate-800">
                        Opening Capital
                        <span className="ml-1 text-[10px] text-slate-500">
                          (sum of account opening balances)
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-slate-400">
                        —
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-slate-700">
                        {inr(trialBalance.crOpeningCapital)}
                      </TableCell>
                    </TableRow>

                    {/* Totals */}
                    <TableRow
                      style={{
                        backgroundColor: "rgba(74,111,165,0.06)",
                        fontWeight: 600,
                      }}
                      data-testid="row-tb-total"
                    >
                      <TableCell
                        className="text-sm uppercase tracking-wide"
                        style={{ color: "var(--brand-primary)" }}
                      >
                        Total
                      </TableCell>
                      <TableCell
                        className="text-right text-sm tabular-nums"
                        style={{ color: "var(--brand-primary)" }}
                      >
                        {inr(trialBalance.drTotal)}
                      </TableCell>
                      <TableCell
                        className="text-right text-sm tabular-nums"
                        style={{ color: "var(--brand-primary)" }}
                      >
                        {inr(trialBalance.crTotal)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              {Math.abs(trialBalance.outBy) >= 0.5 && (
                <p className="mt-3 text-[11px] leading-snug text-slate-500">
                  Most common cause of a non-zero gap: investor deposits
                  whose corresponding cash inflow wasn&apos;t posted to the
                  Daybook. Post a CREDIT entry under category &quot;Other
                  Income&quot; (or via the dedicated capital-inflow flow)
                  to the receiving account so the books reconcile.
                </p>
              )}
            </CardContent>
          </Card>

          {/* ============ SECTION 3 — Yearly Balance Sheet ============ */}
          <Card
            className="border bg-white shadow-sm"
            style={{ borderColor: "rgba(74,111,165,0.12)" }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "var(--brand-light)" }}
                >
                  <Scale size={16} style={{ color: "var(--brand-primary)" }} />
                </div>
                <div className="flex-1">
                  <CardTitle
                    className="text-base font-semibold"
                    style={{ color: "var(--brand-primary)" }}
                  >
                    Yearly Balance Sheet — As of {fy.label.split(" ")[1]}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Assets = Liabilities + Equity. Cash &amp; bank from the
                    accounts ledger, loan book from active disbursements,
                    capital from the opening account balances.
                  </CardDescription>
                </div>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{
                    backgroundColor:
                      Math.abs(balanceSheet.tieOut) < 0.5
                        ? "rgba(34,197,94,0.14)"
                        : "rgba(244,63,94,0.14)",
                    color:
                      Math.abs(balanceSheet.tieOut) < 0.5
                        ? "rgb(21,128,61)"
                        : "#be123c",
                  }}
                >
                  {Math.abs(balanceSheet.tieOut) < 0.5
                    ? "Balanced"
                    : `Out by ${inr(Math.abs(balanceSheet.tieOut))}`}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ml-2 h-8 gap-1.5 px-3 text-xs font-semibold"
                  style={{
                    borderColor: "var(--brand-primary)",
                    color: "var(--brand-primary)",
                    background: "white",
                  }}
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10);
                    const assetsRows: Array<Array<string | number>> = [
                      ["Cash in Hand", num(balanceSheet.cashOnHand)],
                      ["Bank Balances", num(balanceSheet.bankBalances)],
                      ["Loans Outstanding", num(balanceSheet.activePrincipal)],
                      [
                        "Accrued Interest Receivable",
                        num(balanceSheet.accruedInterest),
                      ],
                      ["TOTAL ASSETS", num(balanceSheet.totalAssets)],
                    ];
                    const liabRows: Array<Array<string | number>> = [
                      ["Investor Deposits", num(balanceSheet.investorDeposits)],
                      [
                        "TOTAL LIABILITIES",
                        num(balanceSheet.totalLiabilities),
                      ],
                    ];
                    const equityRows: Array<Array<string | number>> = [
                      [
                        "Owner's Capital (opening)",
                        num(balanceSheet.startingCapital),
                      ],
                      [
                        balanceSheet.retainedEarnings >= 0
                          ? "Retained Earnings"
                          : "Accumulated Loss",
                        num(balanceSheet.retainedEarnings),
                      ],
                      ["TOTAL EQUITY", num(balanceSheet.totalEquity)],
                    ];
                    exportXlsx(
                      `kittangi-balance-sheet-${fy?.label ?? today}.xlsx`,
                      [
                        {
                          name: "Balance Sheet",
                          rows: [
                            [
                              `Kittangi OS — Balance Sheet (FY ${fy?.label ?? "—"})`,
                            ],
                            [`Generated ${fmtDateXlsx(today)}`],
                            [],
                            ["ASSETS", "Amount (INR)"],
                            ...assetsRows,
                            [],
                            ["LIABILITIES", "Amount (INR)"],
                            ...liabRows,
                            [],
                            ["EQUITY", "Amount (INR)"],
                            ...equityRows,
                            [],
                            [
                              "Liabilities + Equity",
                              num(
                                balanceSheet.totalLiabilities +
                                  balanceSheet.totalEquity,
                              ),
                            ],
                          ],
                          colWidths: [36, 22],
                        },
                      ],
                    );
                    toast.success("Balance Sheet exported", {
                      description: "Excel workbook downloaded.",
                    });
                  }}
                  data-testid="button-export-balance-sheet-xlsx"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export XLSX
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Assets column */}
                <BSColumn
                  heading="Assets"
                  rows={[
                    { label: "Cash in Hand", value: balanceSheet.cashOnHand },
                    { label: "Bank Balances", value: balanceSheet.bankBalances },
                    {
                      label: "Loans Outstanding",
                      value: balanceSheet.activePrincipal,
                    },
                    {
                      label: "Accrued Interest Receivable",
                      value: balanceSheet.accruedInterest,
                    },
                  ]}
                  total={balanceSheet.totalAssets}
                  totalLabel="Total Assets"
                />

                {/* Liabilities + Equity column */}
                <div className="space-y-4">
                  <BSColumn
                    heading="Liabilities"
                    rows={[
                      {
                        label: "Investor Deposits",
                        value: balanceSheet.investorDeposits,
                      },
                    ]}
                    total={balanceSheet.totalLiabilities}
                    totalLabel="Total Liabilities"
                  />
                  <BSColumn
                    heading="Equity"
                    rows={[
                      {
                        label: "Owner's Capital (opening)",
                        value: balanceSheet.startingCapital,
                      },
                      {
                        label:
                          balanceSheet.retainedEarnings >= 0
                            ? "Retained Earnings"
                            : "Accumulated Loss",
                        value: balanceSheet.retainedEarnings,
                        emphasizeNegative: true,
                      },
                    ]}
                    total={balanceSheet.totalEquity}
                    totalLabel="Total Equity"
                  />
                  <div
                    className="flex items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold"
                    style={{
                      backgroundColor: "var(--brand-light)",
                      color: "var(--brand-primary)",
                    }}
                  >
                    <span>Liabilities + Equity</span>
                    <span className="tabular-nums">
                      {inr(
                        balanceSheet.totalLiabilities +
                          balanceSheet.totalEquity,
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ============ SECTION 4 — Health Snapshot ============ */}
          <Card
            className="border bg-white shadow-sm"
            style={{ borderColor: "rgba(74,111,165,0.12)" }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "var(--brand-light)" }}
                >
                  <Scale size={16} style={{ color: "var(--brand-primary)" }} />
                </div>
                <div>
                  <CardTitle
                    className="text-base font-semibold"
                    style={{ color: "var(--brand-primary)" }}
                  >
                    Business Health Snapshot
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Live balance sheet view — independent of the selected FY.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <MiniMetric
                  label="Total Assets"
                  value={inr(balance.totalAssets)}
                  hint="Outstanding loan book principal"
                  icon={Banknote}
                  iconBg="rgba(34,197,94,0.12)"
                  iconColor="rgb(21,128,61)"
                />
                <MiniMetric
                  label="Total Liabilities"
                  value={inr(balance.totalLiabilities)}
                  hint={`${balance.activeInvestors.length} active investor deposits`}
                  icon={HandCoins}
                  iconBg="rgba(220,38,38,0.10)"
                  iconColor="rgb(185,28,28)"
                />
                <MiniMetric
                  label={balance.netWorth >= 0 ? "Net Worth" : "Net Deficit"}
                  value={`${balance.netWorth >= 0 ? "+" : "−"}${inr(
                    Math.abs(balance.netWorth),
                  )}`}
                  hint="Assets − Liabilities"
                  icon={Wallet}
                  iconBg="var(--brand-light)"
                  iconColor="var(--brand-primary)"
                />
              </div>

              {/* Investor breakdown */}
              <div
                className="overflow-hidden rounded-lg border"
                style={{ borderColor: "rgba(74,111,165,0.12)" }}
              >
                <Table>
                  <TableHeader>
                    <TableRow style={{ backgroundColor: "rgba(74,111,165,0.04)" }}>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                        Investor
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                        Principal
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                        Monthly Interest
                      </TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {investors.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="py-6 text-center text-xs text-slate-500"
                        >
                          No investors on file yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      investors.map((inv: Investor) => (
                        <TableRow key={inv.id}>
                          <TableCell>
                            <div className="flex items-start gap-2">
                              <div
                                className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md"
                                style={{
                                  backgroundColor: "var(--brand-light)",
                                }}
                              >
                                <Building2
                                  size={13}
                                  style={{ color: "var(--brand-primary)" }}
                                />
                              </div>
                              <div>
                                <div className="text-sm font-medium text-slate-800">
                                  {inv.name}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {inv.id} · {inv.payoutCycle}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-slate-700">
                            {inr(inv.principal)}
                          </TableCell>
                          <TableCell className="text-sm text-slate-700">
                            {inr(monthlyInterest(inv))}
                            <span className="ml-1 text-[10px] text-slate-400">
                              @ {inv.monthlyRatePct}%/mo
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium"
                              style={{
                                backgroundColor:
                                  inv.status === "ACTIVE"
                                    ? "rgba(34,197,94,0.14)"
                                    : "rgba(148,163,184,0.18)",
                                color:
                                  inv.status === "ACTIVE"
                                    ? "rgb(21,128,61)"
                                    : "rgb(71,85,105)",
                              }}
                            >
                              {inv.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <p className="text-center text-[11px] text-slate-500">
                Live · powered by the Daybook ledger and Investor records
                (persisted in browser storage).
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small ledger row helpers
// ---------------------------------------------------------------------------

function PnlRow({
  sign,
  label,
  detail,
  amount,
  tone,
}: {
  sign: "+" | "−";
  label: string;
  detail: string;
  amount: number;
  tone: "positive" | "negative";
}) {
  const color = tone === "positive" ? "text-emerald-700" : "text-red-700";
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
          {sign === "+" ? (
            <Plus size={13} className="text-emerald-600" />
          ) : (
            <Minus size={13} className="text-red-600" />
          )}
          {label}
        </div>
      </TableCell>
      <TableCell className="text-xs text-slate-500">{detail}</TableCell>
      <TableCell className={`text-right text-sm font-semibold ${color}`}>
        {sign} {inr(amount)}
      </TableCell>
    </TableRow>
  );
}

function SubtotalRow({
  label,
  amount,
  tone,
}: {
  label: string;
  amount: number;
  tone: "positive" | "negative";
}) {
  const bg =
    tone === "positive" ? "rgba(34,197,94,0.08)" : "rgba(220,38,38,0.06)";
  const color = tone === "positive" ? "text-emerald-800" : "text-red-800";
  return (
    <TableRow
      style={{ backgroundColor: bg, borderTop: "2px solid rgba(0,0,0,0.06)" }}
    >
      <TableCell colSpan={2} className={`text-xs font-bold uppercase tracking-wider ${color}`}>
        {label}
      </TableCell>
      <TableCell className={`text-right text-sm font-extrabold ${color}`}>
        {inr(amount)}
      </TableCell>
    </TableRow>
  );
}

function BSColumn({
  heading,
  rows,
  total,
  totalLabel,
}: {
  heading: string;
  rows: Array<{ label: string; value: number; emphasizeNegative?: boolean }>;
  total: number;
  totalLabel: string;
}) {
  return (
    <div
      className="overflow-hidden rounded-lg border bg-white"
      style={{ borderColor: "rgba(74,111,165,0.12)" }}
    >
      <div
        className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider"
        style={{
          backgroundColor: "rgba(74,111,165,0.06)",
          color: "var(--brand-primary)",
        }}
      >
        {heading}
      </div>
      <div className="divide-y" style={{ borderColor: "rgba(74,111,165,0.10)" }}>
        {rows.map((r) => {
          const negative = r.emphasizeNegative && r.value < 0;
          return (
            <div
              key={r.label}
              className="flex items-center justify-between px-4 py-2 text-sm"
            >
              <span className="text-slate-700">{r.label}</span>
              <span
                className="tabular-nums"
                style={{
                  color: negative ? "#be123c" : "rgb(15,23,42)",
                  fontWeight: negative ? 600 : 500,
                }}
              >
                {r.value < 0 ? `(${inr(Math.abs(r.value))})` : inr(r.value)}
              </span>
            </div>
          );
        })}
        <div
          className="flex items-center justify-between px-4 py-2.5 text-sm font-bold"
          style={{
            backgroundColor: "rgba(74,111,165,0.04)",
            color: "var(--brand-primary)",
          }}
        >
          <span>{totalLabel}</span>
          <span className="tabular-nums">{inr(total)}</span>
        </div>
      </div>
    </div>
  );
}
