import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  Eye,
  History,
  IndianRupee,
  Receipt,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ThermalReceiptDialog, {
  type ThermalReceiptData,
} from "@/components/modules/ThermalReceipt";
import {
  addDaybookEntry,
  removeDaybookEntriesByRefId,
  useDaybook,
  type DaybookCategory,
  type DaybookEntry,
} from "@/lib/stores/daybookStore";
import { isDateLocked } from "@/lib/stores/dayLocksStore";
import { useAccounts, getAccount } from "@/lib/stores/accountsStore";
import { useLoans } from "@/lib/stores/loansStore";
import { accruedInterestFor, accruedInterestForLoan } from "@/lib/interest";
import { useIsAdmin } from "@/lib/stores/userRoleStore";
import { splitInterest, useSettings } from "@/lib/stores/settingsStore";

type PaymentType = "INTEREST" | "PARTIAL" | "FULL";
type PaymentMode = "CASH" | "UPI" | "BANK";

type LedgerRow = {
  /** Receipt id derived from the daybook entry's refId. */
  receiptId: string;
  /** Stable ref grouping all entries that belong to this receipt. */
  refId: string;
  time: string;
  customer: string;
  loanId: string;
  paymentType: PaymentType;
  amount: number;
  accountId: string;
  /** Daybook entries that compose this receipt (1 for FULL, 1-2 for split). */
  entries: DaybookEntry[];
};

/** Categories that count as a customer payment receipt for today's ledger. */
const RECEIPT_CATEGORIES = new Set<DaybookCategory>([
  "Interest Income",
  "Principal Recovery",
  "Full Settlement",
  "EMI Received",
]);

function categoryToPaymentType(c: DaybookCategory): PaymentType {
  if (c === "Interest Income" || c === "EMI Received") return "INTEREST";
  if (c === "Full Settlement") return "FULL";
  return "PARTIAL"; // Principal Recovery
}

function todayIsoString(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function deriveReceiptId(refId: string | undefined, fallbackId: string): string {
  // refId convention written by this module is "RCP-XXXXX • LOAN-ID". Older
  // seed entries follow the same convention. Anything else falls back to the
  // entry id so the table never shows blanks.
  if (refId) {
    const m = refId.match(/(RCP-[A-Z0-9-]+)/i);
    if (m) return m[1];
  }
  return fallbackId;
}

function deriveLoanId(refId: string | undefined): string {
  if (!refId) return "—";
  const parts = refId.split("•").map((p) => p.trim());
  if (parts.length >= 2) return parts[1];
  return parts[0] ?? "—";
}

type FormValues = {
  loanId: string;
  paymentType: PaymentType;
  amountPaid: string;
  paymentMode: PaymentMode | "";
  creditAccountId: string;
  notes: string;
};

const PAYMENT_TYPE_LABEL: Record<PaymentType, string> = {
  INTEREST: "Interest Only",
  PARTIAL: "Partial Principal",
  FULL: "Full Settlement / Closure",
};

const PAYMENT_MODE_LABEL: Record<PaymentMode, string> = {
  CASH: "Cash",
  UPI: "UPI",
  BANK: "Bank Transfer",
};

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

const inputBaseStyle: React.CSSProperties = {
  borderColor: "rgba(74,111,165,0.20)",
  "--tw-ring-color": "var(--brand-light)",
} as React.CSSProperties;

function paymentTypeBadge(type: PaymentType) {
  switch (type) {
    case "INTEREST":
      return (
        <Badge
          className="border-transparent font-medium"
          style={{
            backgroundColor: "rgba(74,111,165,0.12)",
            color: "var(--brand-primary)",
          }}
        >
          Interest Only
        </Badge>
      );
    case "PARTIAL":
      return (
        <Badge
          className="border-transparent font-medium"
          style={{
            backgroundColor: "rgba(245,158,11,0.16)",
            color: "rgb(180,83,9)",
          }}
        >
          Partial Principal
        </Badge>
      );
    case "FULL":
      return (
        <Badge
          className="border-transparent font-medium"
          style={{
            backgroundColor: "rgba(34,197,94,0.14)",
            color: "rgb(21,128,61)",
          }}
        >
          Full Settlement
        </Badge>
      );
  }
}

function accountBadge(accountId: string) {
  const account = getAccount(accountId);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border bg-white px-2 py-0.5 text-[11px] font-medium"
      style={{
        borderColor: "rgba(74,111,165,0.18)",
        color: "var(--brand-primary)",
      }}
    >
      <Wallet size={11} />
      {account?.name ?? accountId}
    </span>
  );
}

export default function ReceiptsLedger() {
  const allEntries = useDaybook();
  const accounts = useAccounts();
  const settings = useSettings();
  const allLoans = useLoans();
  const isAdmin = useIsAdmin();
  const [loanQuery, setLoanQuery] = useState("");
  const [pendingReceipt, setPendingReceipt] =
    useState<ThermalReceiptData | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LedgerRow | null>(null);

  const activeLoans = useMemo(
    () => allLoans.filter((l) => l.status === "ACTIVE"),
    [allLoans],
  );

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
  } = useForm<FormValues>({
    defaultValues: {
      loanId: "",
      paymentType: "INTEREST",
      amountPaid: "",
      paymentMode: "",
      creditAccountId: "",
      notes: "",
    },
  });

  const values = useWatch({ control });

  const selectedLoan = useMemo(
    () => activeLoans.find((l) => l.id === values.loanId) ?? null,
    [values.loanId, activeLoans],
  );

  const filteredLoans = useMemo(() => {
    const q = loanQuery.trim().toLowerCase();
    if (!q) return activeLoans;
    return activeLoans.filter(
      (l) =>
        l.id.toLowerCase().includes(q) ||
        l.customer.toLowerCase().includes(q) ||
        l.customerCode.toLowerCase().includes(q),
    );
  }, [loanQuery, activeLoans]);

  const principal = selectedLoan?.principal ?? 0;
  // Live accrued interest using the floor + pro-rata engine. The first
  // 30 days of a loan always charge a full month of interest; after that,
  // interest accrues per day at the daily-equivalent rate.
  const interest = selectedLoan ? accruedInterestForLoan(selectedLoan) : 0;
  const totalDue = principal + interest;

  // ---------------------------------------------------------------------------
  // Today's Receipts Ledger — derived live from the persisted Daybook so
  // anything posted from this module (or seeded in the store) shows up
  // immediately. We GROUP by refId to collapse split mixed-payment receipts
  // (one interest line + one principal line) into a single visible row that
  // can be re-printed or deleted as a unit.
  // ---------------------------------------------------------------------------
  const ledger = useMemo<LedgerRow[]>(() => {
    const today = todayIsoString();
    const todays = allEntries.filter(
      (e) =>
        e.dateIso === today &&
        e.side === "CREDIT" &&
        RECEIPT_CATEGORIES.has(e.category),
    );

    // Group by refId — entries without a refId fall back to their own id so
    // they remain individually visible. We preserve the time of the first
    // (newest) entry encountered so sort order matches the daybook.
    const groups = new Map<string, DaybookEntry[]>();
    const order: string[] = [];
    for (const e of todays) {
      const key = e.refId ?? e.id;
      if (!groups.has(key)) {
        groups.set(key, []);
        order.push(key);
      }
      groups.get(key)!.push(e);
    }

    return order.map((key) => {
      const entries = groups.get(key)!;
      // Pick the "primary" entry for display purposes — Full Settlement wins,
      // otherwise the first (newest) entry in the group.
      const primary =
        entries.find((e) => e.category === "Full Settlement") ?? entries[0];
      return {
        receiptId: deriveReceiptId(primary.refId, primary.id),
        refId: key,
        time: primary.time,
        customer: primary.customerName ?? "—",
        loanId: deriveLoanId(primary.refId),
        paymentType: categoryToPaymentType(primary.category),
        amount: entries.reduce((s, e) => s + e.amount, 0),
        accountId: primary.account,
        entries,
      };
    });
  }, [allEntries]);

  const todayTotal = useMemo(
    () => ledger.reduce((s, e) => s + e.amount, 0),
    [ledger],
  );

  // ---------------------------------------------------------------------------
  // Re-print: rebuild ThermalReceiptData from a row's underlying daybook
  // entries. Mixed payments are reconstructed by summing the interest +
  // principal splits; FULL settlement uses the single combined entry.
  // ---------------------------------------------------------------------------
  const handleViewReceipt = (row: LedgerRow) => {
    const interestEntry = row.entries.find(
      (e) => e.category === "Interest Income" || e.category === "EMI Received",
    );
    const principalEntry = row.entries.find(
      (e) => e.category === "Principal Recovery",
    );
    const fullEntry = row.entries.find((e) => e.category === "Full Settlement");

    let interestPortion = interestEntry?.amount ?? 0;
    let principalPortion = principalEntry?.amount ?? 0;

    // For Full Settlement we don't have an explicit split on the entry, but
    // we can reconstruct it from the loan record (interest accrued at the
    // time the receipt was generated equals what was owed in interest).
    if (fullEntry) {
      const loan = allLoans.find((l) => l.id === row.loanId);
      // Reconstruct the interest slice using the same live engine the
      // cashier sees so re-prints stay consistent with the dues panel.
      const accrued = loan
        ? accruedInterestFor(
            {
              principal: loan.principal,
              ratePctPerAnnum: loan.ratePctPerAnnum,
              startedAtIso: loan.startedAtIso,
            },
            fullEntry.dateIso,
          )
        : 0;
      interestPortion = Math.min(accrued, fullEntry.amount);
      principalPortion = fullEntry.amount - interestPortion;
    }

    const dateLabel = new Date(row.entries[0].dateIso + "T00:00:00")
      .toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

    const account = getAccount(row.accountId);
    const primary = fullEntry ?? interestEntry ?? principalEntry ?? row.entries[0];
    const outstanding = primary.outstandingAfter ?? 0;
    const mode = primary.paymentMode;

    setPendingReceipt({
      receiptId: row.receiptId,
      dateLabel,
      timeLabel: row.time,
      customerName: row.customer,
      loanId: row.loanId,
      paymentTypeLabel: PAYMENT_TYPE_LABEL[row.paymentType],
      paymentMode: mode ? PAYMENT_MODE_LABEL[mode] : "—",
      accountLabel: account?.name ?? row.accountId,
      amountPaid: row.amount,
      interestPortion,
      principalPortion,
      outstandingBalance: outstanding,
      cashier: "Cashier",
      notes: primary.notes,
    });
  };

  // ---------------------------------------------------------------------------
  // Admin-only: fully reverse a receipt by removing every Daybook entry that
  // shares its refId. The corresponding account balance is derived live from
  // the ledger so it recomputes automatically once the entries are gone.
  // ---------------------------------------------------------------------------
  const handleConfirmDelete = () => {
    if (!pendingDelete) return;
    try {
      const removed = removeDaybookEntriesByRefId(pendingDelete.refId);
      const reversedTotal = removed.reduce((s, e) => s + e.amount, 0);
      const accountName =
        getAccount(pendingDelete.accountId)?.name ?? pendingDelete.accountId;
      toast.success(`Receipt ${pendingDelete.receiptId} deleted`, {
        icon: <Trash2 size={16} />,
        description: `${inr(reversedTotal)} reversed from ${accountName} • ${removed.length} ledger ${
          removed.length === 1 ? "entry" : "entries"
        } removed.`,
      });
    } catch (err) {
      toast.error("Could not delete receipt", {
        description:
          err instanceof Error
            ? err.message
            : "Day-lock or persistence error.",
      });
    } finally {
      setPendingDelete(null);
    }
  };

  const onSubmit = (data: FormValues) => {
    if (!data.loanId || !selectedLoan) {
      toast.error("Please select an active loan first.");
      return;
    }
    const amount = parseFloat(data.amountPaid || "0");
    if (!amount || amount <= 0) {
      toast.error("Enter a valid payment amount.");
      return;
    }
    if (!data.paymentMode) {
      toast.error("Select a payment mode.");
      return;
    }
    if (!data.creditAccountId) {
      toast.error("Select an account to credit (for the daybook).");
      return;
    }
    if (data.paymentType === "INTEREST" && amount > interest + 0.5) {
      toast.error(
        `Interest-only payment cannot exceed accrued interest (${inr(
          interest,
        )}). Switch to "Partial Principal" to also reduce the principal.`,
      );
      return;
    }
    if (data.paymentType === "FULL" && amount !== totalDue) {
      toast.error(
        `Full settlement must equal exactly ${inr(totalDue)} (Principal + Interest).`,
      );
      return;
    }
    if (data.paymentType === "PARTIAL" && amount > totalDue) {
      toast.error(
        `Partial payment cannot exceed total dues (${inr(
          totalDue,
        )}). Use "Full Settlement" to close the loan.`,
      );
      return;
    }

    // ------------------------------------------------------------
    // Split the payment into interest + principal portions.
    // Interest is always serviced first (industry-standard waterfall);
    // anything left over reduces principal.
    // ------------------------------------------------------------
    const interestPortion = Math.min(amount, interest);
    const principalPortion = amount - interestPortion;

    const outstandingBalance = Math.max(0, totalDue - amount);

    const receiptId = `RCP-${Math.floor(80000 + Math.random() * 19999)}`;
    const now = new Date();
    const time = now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    const dateIso = todayIsoString();
    const dateLabel = now.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    // Pre-check the day lock so a closed Chitta cannot accept new receipts.
    // This must run before ANY persistence (Daybook splits a mixed payment
    // into two entries; we cannot allow only the first to land).
    if (isDateLocked(dateIso)) {
      toast.error("Day is locked", {
        description:
          "Today's Chitta is closed. Unlock it from the Daybook page before generating receipts.",
      });
      return;
    }

    const accountId = data.creditAccountId;
    const account = getAccount(accountId);
    const refId = `${receiptId} • ${selectedLoan.id}`;
    const interestCategory: DaybookCategory =
      selectedLoan.product === "VEHICLE" ? "EMI Received" : "Interest Income";
    const paymentMode = data.paymentMode as PaymentMode;
    const noteText = data.notes?.trim() || undefined;

    // ------------------------------------------------------------
    // Interest split — break the interest portion into the legal-rate
    // ledger vs the company ledger so admin Reports can show both.
    // The per-loan `legalInterestPct` overrides the global setting.
    // For Full Settlement we split only the interest share, never the
    // principal part of the lump payment.
    // ------------------------------------------------------------
    const legalRate =
      selectedLoan.legalInterestPct ?? settings.globalLegalInterestRatePct;
    const split = splitInterest({
      totalInterest: interestPortion,
      loanAnnualRatePct: selectedLoan.ratePctPerAnnum,
      legalRatePctPerAnnum: legalRate,
    });

    // ------------------------------------------------------------
    // Post to the persisted Daybook. We split mixed payments into two
    // line items (interest + principal) so per-category reports and the
    // Customer 360 lifetime totals stay accurate. Full Settlement is
    // posted as a single line so the closure event is easy to surface
    // in reports — its principal share equals `principalPortion`.
    // The receipt-only fields (paymentMode, outstandingAfter, notes) are
    // attached so re-print can faithfully reconstruct the thermal slip.
    // ------------------------------------------------------------
    if (data.paymentType === "FULL") {
      addDaybookEntry({
        dateIso,
        time,
        side: "CREDIT",
        category: "Full Settlement",
        particulars: `${selectedLoan.customer} — Full Settlement (Principal ${inr(
          principalPortion,
        )} + Interest ${inr(interestPortion)})`,
        refId,
        account: accountId,
        amount,
        customerName: selectedLoan.customer,
        paymentMode,
        outstandingAfter: outstandingBalance,
        notes: noteText,
        // Even on a single-line Full Settlement we attach the split so
        // Reports/Customer 360 can show legal vs company breakdowns.
        legalInterestPortion: split.legal,
        companyInterestPortion: split.company,
      });
    } else {
      if (interestPortion > 0) {
        addDaybookEntry({
          dateIso,
          time,
          side: "CREDIT",
          category: interestCategory,
          particulars: `${selectedLoan.customer} — ${
            selectedLoan.product === "VEHICLE" ? "EMI Received" : "Interest Paid"
          }`,
          refId,
          account: accountId,
          amount: interestPortion,
          customerName: selectedLoan.customer,
          paymentMode,
          outstandingAfter: outstandingBalance,
          notes: noteText,
          legalInterestPortion: split.legal,
          companyInterestPortion: split.company,
        });
      }
      if (principalPortion > 0) {
        addDaybookEntry({
          dateIso,
          time,
          side: "CREDIT",
          category: "Principal Recovery",
          particulars: `${selectedLoan.customer} — Partial Principal`,
          refId,
          account: accountId,
          amount: principalPortion,
          customerName: selectedLoan.customer,
          paymentMode,
          outstandingAfter: outstandingBalance,
          notes: noteText,
        });
      }
    }

    toast.success("Receipt generated", {
      description: `${receiptId} • ${inr(amount)} credited to ${account?.name ?? accountId}`,
      icon: <CheckCircle2 size={18} />,
    });

    // Stage the printable receipt — opens the 80mm preview dialog.
    setPendingReceipt({
      receiptId,
      dateLabel,
      timeLabel: time,
      customerName: selectedLoan.customer,
      loanId: selectedLoan.id,
      paymentTypeLabel: PAYMENT_TYPE_LABEL[data.paymentType],
      paymentMode: PAYMENT_MODE_LABEL[paymentMode],
      accountLabel: account?.name ?? accountId,
      amountPaid: amount,
      interestPortion,
      principalPortion,
      outstandingBalance,
      cashier: "Cashier",
      notes: noteText,
    });

    reset();
  };

  return (
    <div className="mx-auto max-w-7xl pb-10">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: "var(--brand-light)" }}
          >
            <Receipt size={22} style={{ color: "var(--brand-primary)" }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--brand-primary)" }}
            >
              Receipts &amp; Ledger
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Record customer repayments and post entries into the daily
              Chitta.
            </p>
          </div>
        </div>

        <div
          className="flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs font-medium"
          style={{
            borderColor: "rgba(74,111,165,0.18)",
            color: "var(--brand-primary)",
          }}
        >
          <History size={14} />
          Today’s Collections: {inr(todayTotal)}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* LEFT: Loan Search + Outstanding Dues */}
          <div className="space-y-5">
            {/* Select Active Loan */}
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
                    <Search
                      size={16}
                      style={{ color: "var(--brand-primary)" }}
                    />
                  </div>
                  <div>
                    <CardTitle
                      className="text-base font-semibold"
                      style={{ color: "var(--brand-primary)" }}
                    >
                      Select Active Loan
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Search by customer name or loan ID.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <Input
                    placeholder="Search e.g. ‘Aanya’ or ‘PWN-204512’"
                    value={loanQuery}
                    onChange={(e) => setLoanQuery(e.target.value)}
                    className="h-10 bg-white pl-9"
                    style={inputBaseStyle}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">Active Loan</Label>
                  <Select
                    value={values.loanId || ""}
                    onValueChange={(v) => setValue("loanId", v)}
                  >
                    <SelectTrigger
                      className="h-10 w-full bg-white"
                      style={inputBaseStyle}
                    >
                      <SelectValue placeholder="Select an active loan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredLoans.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs text-slate-500">
                          No matching loans
                        </div>
                      ) : (
                        filteredLoans.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                {l.customer} — {l.id}
                              </span>
                              <span className="text-xs text-slate-500">
                                {l.product === "PAWN" ? "Pawn" : "Vehicle"} •{" "}
                                {l.ratePctPerAnnum}% p.a.
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {selectedLoan && (
                  <div
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                    style={{
                      borderColor: "rgba(74,111,165,0.15)",
                      backgroundColor: "var(--bg-main)",
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: "var(--brand-primary)" }}
                      >
                        {selectedLoan.customer
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">
                          {selectedLoan.customer}
                        </div>
                        <div className="text-xs text-slate-500">
                          {selectedLoan.customerCode} • {selectedLoan.id}
                        </div>
                      </div>
                    </div>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                      style={{
                        backgroundColor: "rgba(74,111,165,0.12)",
                        color: "var(--brand-primary)",
                      }}
                    >
                      {selectedLoan.product === "PAWN" ? "Pawn" : "Vehicle"} •{" "}
                      {selectedLoan.ratePctPerAnnum}% p.a.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Outstanding Dues */}
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
                    <CircleDollarSign
                      size={16}
                      style={{ color: "var(--brand-primary)" }}
                    />
                  </div>
                  <div>
                    <CardTitle
                      className="text-base font-semibold"
                      style={{ color: "var(--brand-primary)" }}
                    >
                      Outstanding Dues
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Live snapshot of what the borrower owes today.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  <DueRow label="Principal" value={inr(principal)} />
                  <DueRow label="Accrued Interest" value={inr(interest)} />
                  <DueRow label="Total Due" value={inr(totalDue)} />
                </div>
                {!selectedLoan && (
                  <p className="mt-3 text-[11px] text-slate-500">
                    Pick a loan above to populate the dues breakdown.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: Record Payment */}
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
                  <IndianRupee
                    size={16}
                    style={{ color: "var(--brand-primary)" }}
                  />
                </div>
                <div>
                  <CardTitle
                    className="text-base font-semibold"
                    style={{ color: "var(--brand-primary)" }}
                  >
                    Record Payment
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Captures interest + principal split and posts a credit to
                    the chosen account.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">Payment Type</Label>
                <Select
                  value={values.paymentType || "INTEREST"}
                  onValueChange={(v) =>
                    setValue("paymentType", v as PaymentType)
                  }
                >
                  <SelectTrigger
                    className="h-10 w-full bg-white"
                    style={inputBaseStyle}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INTEREST">Interest Only</SelectItem>
                    <SelectItem value="PARTIAL">Partial Principal</SelectItem>
                    <SelectItem value="FULL">
                      Full Settlement / Closure
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">
                    Amount Paid (₹)
                  </Label>
                  <Input
                    type="number"
                    step="1"
                    placeholder="0"
                    className="h-10"
                    style={inputBaseStyle}
                    {...register("amountPaid")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">
                    Payment Mode
                  </Label>
                  <Select
                    value={values.paymentMode || ""}
                    onValueChange={(v) =>
                      setValue("paymentMode", v as PaymentMode)
                    }
                  >
                    <SelectTrigger
                      className="h-10 w-full bg-white"
                      style={inputBaseStyle}
                    >
                      <SelectValue placeholder="Cash / UPI / Bank Transfer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="BANK">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">
                  Account to Credit (Daybook)
                </Label>
                <Select
                  value={values.creditAccountId || ""}
                  onValueChange={(v) => setValue("creditAccountId", v)}
                >
                  <SelectTrigger
                    className="h-10 w-full bg-white"
                    style={inputBaseStyle}
                  >
                    <SelectValue placeholder="Select an account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{a.name}</span>
                          <span className="text-xs text-slate-500">
                            {a.subtitle ?? a.id}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">Notes</Label>
                <Textarea
                  rows={3}
                  placeholder="Optional — e.g. cashier notes, partial-payment context."
                  className="bg-white"
                  style={inputBaseStyle}
                  {...register("notes")}
                />
              </div>

              <Button
                type="submit"
                className="h-10 w-full font-semibold text-white shadow-sm"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                <Banknote size={14} className="mr-1.5" />
                Generate Receipt
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* TODAY'S RECEIPTS LEDGER */}
        <Card
          className="border bg-white shadow-sm"
          style={{ borderColor: "rgba(74,111,165,0.12)" }}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "var(--brand-light)" }}
                >
                  <History
                    size={16}
                    style={{ color: "var(--brand-primary)" }}
                  />
                </div>
                <div>
                  <CardTitle
                    className="text-base font-semibold"
                    style={{ color: "var(--brand-primary)" }}
                  >
                    Today’s Receipts
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Live ledger sourced from the Daybook. Use{" "}
                    <strong>View</strong> to re-print.
                    {isAdmin
                      ? " Admin Mode is on — receipts can be deleted."
                      : " Enable Admin Mode in Settings → Users to delete."}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">Today’s total</span>
                <span
                  className="rounded-md px-2.5 py-1 text-sm font-bold"
                  style={{
                    backgroundColor: "var(--brand-light)",
                    color: "var(--brand-primary)",
                  }}
                >
                  {inr(todayTotal)}
                </span>
              </div>
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
                    style={{ backgroundColor: "rgba(191,221,245,0.25)" }}
                  >
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                      Receipt ID
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                      Time
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                      Customer
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                      Payment Type
                    </TableHead>
                    <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                      Amount
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                      Account Credited
                    </TableHead>
                    <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-12 text-center text-sm text-slate-500"
                      >
                        No receipts posted yet today.
                      </TableCell>
                    </TableRow>
                  ) : (
                    ledger.map((row) => (
                      <TableRow
                        key={row.refId}
                        className="hover:bg-slate-50/60"
                      >
                        <TableCell
                          className="font-mono text-xs"
                          style={{ color: "var(--brand-primary)" }}
                        >
                          {row.receiptId}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {row.time}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-semibold text-slate-800">
                            {row.customer}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {row.loanId}
                          </div>
                        </TableCell>
                        <TableCell>{paymentTypeBadge(row.paymentType)}</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-slate-800">
                          {inr(row.amount)}
                        </TableCell>
                        <TableCell>{accountBadge(row.accountId)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                handleViewReceipt(row);
                              }}
                              className="h-8 px-2 text-xs font-medium"
                              style={{ color: "var(--brand-primary)" }}
                              aria-label={`View ${row.receiptId}`}
                            >
                              <Eye size={13} className="mr-1" />
                              View
                            </Button>
                            {isAdmin && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setPendingDelete(row);
                                }}
                                className="h-8 w-8 p-0"
                                style={{ color: "#B91C1C" }}
                                aria-label={`Delete ${row.receiptId}`}
                              >
                                <Trash2 size={13} />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
              <span>
                Live · sourced from the persisted Daybook (today only).
              </span>
              <span>
                Showing <strong>{ledger.length}</strong> of {ledger.length}{" "}
                receipts
              </span>
            </div>
          </CardContent>
        </Card>
      </form>

      <ThermalReceiptDialog
        open={!!pendingReceipt}
        onOpenChange={(o) => {
          if (!o) setPendingReceipt(null);
        }}
        data={pendingReceipt}
      />

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this receipt?</AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong>permanently reverse</strong>{" "}
              {pendingDelete ? inr(pendingDelete.amount) : "—"} from{" "}
              <strong>
                {pendingDelete
                  ? getAccount(pendingDelete.accountId)?.name ??
                    pendingDelete.accountId
                  : "—"}
              </strong>{" "}
              and remove every Daybook entry tied to{" "}
              <span className="font-mono">
                {pendingDelete?.receiptId ?? ""}
              </span>
              . This action cannot be undone and will fail if today’s Chitta
              has been locked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              style={{ backgroundColor: "#B91C1C", color: "#fff" }}
            >
              Delete &amp; Reverse
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DueRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg border bg-white px-3 py-3"
      style={{ borderColor: "rgba(74,111,165,0.12)" }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className="mt-1 text-xl font-bold tracking-tight"
        style={{ color: "var(--brand-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}
