/**
 * Shared Interest Engine
 * ----------------------
 * Single source of truth for "how much interest does a loan owe right now?".
 *
 * Pricing rule (matches Kittangi's lending policy, April 2026 onwards):
 *
 *   1. The first 30 days of a loan's life always charge a FULL one-month
 *      slice of interest (the "minimum month" floor). A borrower who
 *      redeems on day 5 still pays the full first month — this protects the
 *      lender from same-day pawn-and-redeem cycling.
 *
 *   2. Beyond day 30, interest accrues PER DAY at the daily rate
 *      (monthlyInterest / 30). So at day 45 a borrower owes one full month
 *      plus 15 days of pro-rata interest.
 *
 * Worked example — ₹1,00,000 @ 30% p.a. (= 2.5% per month, monthly = ₹2,500):
 *   • Day  0 →   ₹0       (loan just disbursed, nothing accrued yet)
 *   • Day  5 →   ₹2,500   (first-month floor)
 *   • Day 27 →   ₹2,500   (still inside first month)
 *   • Day 30 →   ₹2,500   (boundary — full month)
 *   • Day 45 →   ₹3,750   (₹2,500 + 15 days × ₹83.33)
 *   • Day 60 →   ₹5,000   (two equivalent months)
 *
 * The engine is intentionally pure & deterministic so it can be reused from
 * Receipts (cashier preview), Loan Lifecycle (settlement dialog), Loan
 * Management (live "Accrued Interest" column) and any future report.
 */

export type InterestBreakdown = {
  /** Whole calendar days elapsed between `startedAtIso` and `asOfIso`. */
  daysElapsed: number;
  /** One month of interest at the loan's annual rate (rounded to ₹1). */
  monthlyInterest: number;
  /** Always 1 once the loan has accrued anything (the floor). */
  fullMonths: number;
  /** Days beyond the first 30 that contribute pro-rata interest. */
  proRataDays: number;
  /** Total interest owed today in rupees, rounded. */
  totalInterest: number;
};

function startOfDay(iso: string): Date {
  // Accept either "YYYY-MM-DD" or full ISO timestamps. We always normalise to
  // local midnight so calendar-day diffs aren't off-by-one across DST or TZ.
  const stamp = iso.includes("T") ? iso.slice(0, 10) : iso;
  return new Date(stamp + "T00:00:00");
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function computeAccruedInterest(args: {
  principal: number;
  ratePctPerAnnum: number;
  startedAtIso: string;
  /** Defaults to today (local). */
  asOfIso?: string;
}): InterestBreakdown {
  const principal = Math.max(0, args.principal);
  const annualRate = Math.max(0, args.ratePctPerAnnum);
  const monthlyInterest = (principal * annualRate) / 12 / 100;

  const start = startOfDay(args.startedAtIso);
  const asOf = startOfDay(args.asOfIso ?? todayIso());
  const days = Math.max(
    0,
    Math.floor((asOf.getTime() - start.getTime()) / 86_400_000),
  );

  let total = 0;
  let fullMonths = 0;
  let proRataDays = 0;

  if (days === 0) {
    total = 0;
  } else if (days <= 30) {
    fullMonths = 1;
    total = monthlyInterest;
  } else {
    fullMonths = 1;
    proRataDays = days - 30;
    total = monthlyInterest + (monthlyInterest / 30) * proRataDays;
  }

  return {
    daysElapsed: days,
    monthlyInterest: Math.round(monthlyInterest),
    fullMonths,
    proRataDays,
    totalInterest: Math.round(total),
  };
}

/**
 * Convenience wrapper for callers that only want the rupee amount (e.g. a
 * table cell). Equivalent to `computeAccruedInterest(...).totalInterest`.
 */
export function accruedInterestFor(loan: {
  principal: number;
  ratePctPerAnnum: number;
  startedAtIso: string;
}, asOfIso?: string): number {
  return computeAccruedInterest({
    principal: loan.principal,
    ratePctPerAnnum: loan.ratePctPerAnnum,
    startedAtIso: loan.startedAtIso,
    asOfIso,
  }).totalInterest;
}

/**
 * Status-aware variant. For ACTIVE loans this accrues live up to today; for
 * loans that have transitioned out of ACTIVE (CLOSED, AUCTION, …) the accrual
 * is frozen at `closedAtIso`. If a closed loan predates the closure-timestamp
 * field (legacy data) the accrual is forced to ₹0 — closed loans must never
 * appear to keep ticking up in Loan Management, the Lifecycle dialog, or the
 * Balance Sheet's accrued-interest asset line.
 */
export function accruedInterestForLoan(loan: {
  principal: number;
  ratePctPerAnnum: number;
  startedAtIso: string;
  status: string;
  closedAtIso?: string;
}): number {
  if (loan.status === "ACTIVE") {
    return accruedInterestFor(loan);
  }
  if (loan.closedAtIso) {
    return accruedInterestFor(loan, loan.closedAtIso);
  }
  return 0;
}

/**
 * Compute the origination processing fee from a per-₹1,000 rate.
 *
 * Example: a ₹1,00,000 loan at ₹15 / ₹1,000 ⇒ ₹1,500 fee.
 * The result is rounded to the nearest rupee.
 */
export function computeProcessingFee(args: {
  loanAmount: number;
  feePerThousand: number;
}): number {
  const amt = Math.max(0, args.loanAmount);
  const rate = Math.max(0, args.feePerThousand);
  return Math.round((amt / 1000) * rate);
}
