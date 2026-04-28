import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  History,
  IndianRupee,
  Receipt,
  Search,
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
import ThermalReceiptDialog, {
  type ThermalReceiptData,
} from "@/components/modules/ThermalReceipt";
import {
  addDaybookEntry,
  useDaybook,
  type DaybookAccount,
  type DaybookCategory,
  type DaybookEntry,
} from "@/lib/stores/daybookStore";
import { isDateLocked } from "@/lib/stores/dayLocksStore";

type PaymentType = "INTEREST" | "PARTIAL" | "FULL";
type PaymentMode = "CASH" | "UPI" | "BANK";
type CreditAccount = "CASH_HAND" | "HDFC" | "SBI";

type ActiveLoan = {
  id: string;
  customer: string;
  customerCode: string;
  product: "PAWN" | "VEHICLE";
  principal: number;
  accruedInterest: number;
  rate: string;
  startedOn: string;
};

type LedgerEntry = {
  receiptId: string;
  time: string;
  customer: string;
  loanId: string;
  paymentType: PaymentType;
  amount: number;
  account: CreditAccount;
};

/** Maps a CreditAccount picker value to the canonical Daybook account key. */
const ACCOUNT_TO_DAYBOOK: Record<CreditAccount, DaybookAccount> = {
  CASH_HAND: "CASH",
  HDFC: "HDFC",
  SBI: "SBI",
};

const DAYBOOK_TO_ACCOUNT: Record<DaybookAccount, CreditAccount> = {
  CASH: "CASH_HAND",
  HDFC: "HDFC",
  SBI: "SBI",
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
  creditAccount: CreditAccount | "";
  notes: string;
};

const ACTIVE_LOANS: ActiveLoan[] = [
  {
    id: "PWN-204512",
    customer: "Aanya Sharma",
    customerCode: "KTG-10042",
    product: "PAWN",
    principal: 130000,
    accruedInterest: 4225,
    rate: "13% p.a.",
    startedOn: "12 Apr 2026",
  },
  {
    id: "PWN-204519",
    customer: "Meera Iyer",
    customerCode: "KTG-10044",
    product: "PAWN",
    principal: 197600,
    accruedInterest: 5928,
    rate: "12% p.a.",
    startedOn: "14 Apr 2026",
  },
  {
    id: "PWN-204527",
    customer: "Kunal Mehta",
    customerCode: "KTG-10047",
    product: "PAWN",
    principal: 31200,
    accruedInterest: 715,
    rate: "13.5% p.a.",
    startedOn: "16 Apr 2026",
  },
  {
    id: "PWN-204540",
    customer: "Priya Menon",
    customerCode: "KTG-10059",
    product: "PAWN",
    principal: 48400,
    accruedInterest: 1089,
    rate: "13% p.a.",
    startedOn: "18 Apr 2026",
  },
  {
    id: "VEH-30021",
    customer: "Rohan Verma",
    customerCode: "KTG-10051",
    product: "VEHICLE",
    principal: 540000,
    accruedInterest: 12150,
    rate: "11.25% p.a.",
    startedOn: "02 Mar 2026",
  },
];

const PAYMENT_TYPE_LABEL: Record<PaymentType, string> = {
  INTEREST: "Interest Only",
  PARTIAL: "Partial Principal",
  FULL: "Full Settlement / Closure",
};

const ACCOUNT_LABEL: Record<CreditAccount, string> = {
  CASH_HAND: "Cash in Hand",
  HDFC: "HDFC Bank",
  SBI: "SBI Bank",
};

const ACCOUNT_SUB: Record<CreditAccount, string> = {
  CASH_HAND: "Branch cash drawer",
  HDFC: "Current A/c ••• 4521",
  SBI: "Overdraft A/c ••• 8870",
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

function accountBadge(account: CreditAccount) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border bg-white px-2 py-0.5 text-[11px] font-medium"
      style={{
        borderColor: "rgba(74,111,165,0.18)",
        color: "var(--brand-primary)",
      }}
    >
      <Wallet size={11} />
      {ACCOUNT_LABEL[account]}
    </span>
  );
}

export default function ReceiptsLedger() {
  const allEntries = useDaybook();
  const [loanQuery, setLoanQuery] = useState("");
  const [pendingReceipt, setPendingReceipt] =
    useState<ThermalReceiptData | null>(null);

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
      creditAccount: "",
      notes: "",
    },
  });

  const values = useWatch({ control });

  const selectedLoan = useMemo(
    () => ACTIVE_LOANS.find((l) => l.id === values.loanId) ?? null,
    [values.loanId],
  );

  const filteredLoans = useMemo(() => {
    const q = loanQuery.trim().toLowerCase();
    if (!q) return ACTIVE_LOANS;
    return ACTIVE_LOANS.filter(
      (l) =>
        l.id.toLowerCase().includes(q) ||
        l.customer.toLowerCase().includes(q) ||
        l.customerCode.toLowerCase().includes(q),
    );
  }, [loanQuery]);

  const principal = selectedLoan?.principal ?? 0;
  const interest = selectedLoan?.accruedInterest ?? 0;
  const totalDue = principal + interest;

  // Today's Receipts Ledger is derived from the persisted daybook so it stays
  // in sync with anything posted from this module (or seeded in the store).
  const ledger = useMemo<LedgerEntry[]>(() => {
    const today = todayIsoString();
    return allEntries
      .filter(
        (e: DaybookEntry) =>
          e.dateIso === today &&
          e.side === "CREDIT" &&
          RECEIPT_CATEGORIES.has(e.category),
      )
      .map((e) => ({
        receiptId: deriveReceiptId(e.refId, e.id),
        time: e.time,
        customer: e.customerName ?? "—",
        loanId: deriveLoanId(e.refId),
        paymentType: categoryToPaymentType(e.category),
        amount: e.amount,
        account: DAYBOOK_TO_ACCOUNT[e.account],
      }));
  }, [allEntries]);

  const todayTotal = useMemo(
    () => ledger.reduce((s, e) => s + e.amount, 0),
    [ledger],
  );

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
    if (!data.creditAccount) {
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

    const account = data.creditAccount as CreditAccount;
    const dbAccount = ACCOUNT_TO_DAYBOOK[account];
    const refId = `${receiptId} • ${selectedLoan.id}`;
    const interestCategory: DaybookCategory =
      selectedLoan.product === "VEHICLE" ? "EMI Received" : "Interest Income";

    // ------------------------------------------------------------
    // Post to the persisted Daybook. We split mixed payments into two
    // line items (interest + principal) so per-category reports and the
    // Customer 360 lifetime totals stay accurate. Full Settlement is
    // posted as a single line so the closure event is easy to surface
    // in reports — its principal share equals `principalPortion`.
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
        account: dbAccount,
        amount,
        customerName: selectedLoan.customer,
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
          account: dbAccount,
          amount: interestPortion,
          customerName: selectedLoan.customer,
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
          account: dbAccount,
          amount: principalPortion,
          customerName: selectedLoan.customer,
        });
      }
    }

    toast.success("Receipt generated", {
      description: `${receiptId} • ${inr(amount)} credited to ${ACCOUNT_LABEL[account]}`,
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
      paymentMode:
        data.paymentMode === "CASH"
          ? "Cash"
          : data.paymentMode === "UPI"
            ? "UPI"
            : "Bank Transfer",
      accountLabel: ACCOUNT_LABEL[account],
      amountPaid: amount,
      interestPortion,
      principalPortion,
      outstandingBalance,
      cashier: "Cashier",
      notes: data.notes?.trim() || undefined,
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
                                {l.rate} • Started {l.startedOn}
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
                      {selectedLoan.rate}
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
                      Read-only summary as of today.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <DueRow
                    label="Principal Balance"
                    value={selectedLoan ? inr(principal) : "—"}
                  />
                  <DueRow
                    label="Accrued Interest"
                    value={selectedLoan ? inr(interest) : "—"}
                  />
                </div>
                <div
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: "rgba(74,111,165,0.20)",
                    background:
                      "linear-gradient(135deg, rgba(191,221,245,0.35) 0%, rgba(233,244,251,0.65) 100%)",
                  }}
                >
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <div
                        className="text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: "var(--brand-primary)" }}
                      >
                        Total Due
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        Principal + Accrued Interest
                      </div>
                    </div>
                    <div
                      className="text-3xl font-extrabold tracking-tight"
                      style={{ color: "var(--brand-primary)" }}
                    >
                      {selectedLoan ? inr(totalDue) : "—"}
                    </div>
                  </div>
                </div>
                {!selectedLoan && (
                  <p className="text-[11px] text-slate-500">
                    Select a loan above to view outstanding dues.
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
                    Record Payment
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Captures the receipt and posts a credit entry into the
                    daybook.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">
                    Payment Type
                  </Label>
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
                      <SelectItem value="PARTIAL">
                        Partial Principal
                      </SelectItem>
                      <SelectItem value="FULL">
                        Full Settlement / Closure
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">
                    Amount Paid
                  </Label>
                  <div className="relative">
                    <IndianRupee
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      placeholder="0"
                      className="h-10 bg-white pl-8"
                      style={inputBaseStyle}
                      {...register("amountPaid")}
                    />
                  </div>
                  {selectedLoan && values.paymentType === "FULL" && (
                    <p className="text-[11px] text-slate-500">
                      Settlement requires {inr(totalDue)}.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                      <SelectValue placeholder="Select mode..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="BANK">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">
                    Credit To Account
                  </Label>
                  <Select
                    value={values.creditAccount || ""}
                    onValueChange={(v) =>
                      setValue("creditAccount", v as CreditAccount)
                    }
                  >
                    <SelectTrigger
                      className="h-10 w-full bg-white"
                      style={inputBaseStyle}
                    >
                      <SelectValue placeholder="Select account..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        [
                          "CASH_HAND",
                          "HDFC",
                          "SBI",
                        ] as CreditAccount[]
                      ).map((a) => (
                        <SelectItem key={a} value={a}>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {ACCOUNT_LABEL[a]}
                            </span>
                            <span className="text-xs text-slate-500">
                              {ACCOUNT_SUB[a]}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">
                  Internal Notes / Remarks
                </Label>
                <Textarea
                  rows={3}
                  placeholder="Any reference notes for the cashier or accountant..."
                  className="bg-white"
                  style={inputBaseStyle}
                  {...register("notes")}
                />
              </div>

              {selectedLoan && parseFloat(values.amountPaid || "0") > 0 && (
                <div
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
                  style={{
                    borderColor: "rgba(74,111,165,0.18)",
                    backgroundColor: "var(--bg-main)",
                    color: "var(--brand-primary)",
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Banknote size={14} />
                    Posting{" "}
                    <span className="font-semibold">
                      {inr(parseFloat(values.amountPaid || "0"))}
                    </span>{" "}
                    to{" "}
                    <span className="font-semibold">
                      {values.creditAccount
                        ? ACCOUNT_LABEL[values.creditAccount as CreditAccount]
                        : "—"}
                    </span>
                  </span>
                  <span className="text-slate-500">
                    {PAYMENT_TYPE_LABEL[values.paymentType as PaymentType]}
                  </span>
                </div>
              )}

              <Button
                type="submit"
                className="h-12 w-full text-sm font-semibold text-white shadow-md transition-transform active:scale-[0.99]"
                style={{
                  backgroundColor: "var(--brand-primary)",
                  boxShadow:
                    "0 8px 20px rgba(74,111,165,0.30), 0 2px 6px rgba(74,111,165,0.20)",
                }}
              >
                <Receipt size={18} className="mr-2" />
                Record Payment &amp; Generate Receipt
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Today's Receipts Ledger */}
        <Card
          className="border bg-white shadow-sm"
          style={{ borderColor: "rgba(74,111,165,0.12)" }}
        >
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
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
                    Today’s Receipts Ledger
                  </CardTitle>
                  <CardDescription className="text-xs">
                    All payments recorded today, in chronological order.
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">
                  {ledger.length} receipts
                </span>
                <span
                  className="rounded-md px-2.5 py-1 text-xs font-semibold"
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((row) => (
                    <TableRow key={row.receiptId} className="hover:bg-slate-50/60">
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
                      <TableCell>{accountBadge(row.account)}</TableCell>
                    </TableRow>
                  ))}
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
