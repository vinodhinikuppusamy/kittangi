import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  Banknote,
  Building2,
  Calendar,
  Car,
  CheckCircle2,
  CreditCard,
  History,
  IndianRupee,
  Receipt,
  Search,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type CreditAccount = "CASH_HAND" | "HDFC" | "SBI";

type VehicleLoan = {
  id: string;
  customer: string;
  vehicle: string;
  rcNumber: string;
  emiDue: number;
  monthsOverdue: number;
};

type VehicleReceipt = {
  receiptId: string;
  recordedAt: string;
  loanId: string;
  customer: string;
  vehicle: string;
  paymentMonth: string; // e.g., 2026-04
  emi: number;
  penalty: number;
  total: number;
  account: CreditAccount;
};

type FormValues = {
  loanId: string;
  paymentMonth: string;
  emiAmount: string;
  latePenalty: string;
  creditAccount: CreditAccount | "";
};

const VEHICLE_LOANS: VehicleLoan[] = [
  {
    id: "VEH-30021",
    customer: "Rohan Verma",
    vehicle: "Hyundai Creta SX",
    rcNumber: "KA01AB1234",
    emiDue: 18250,
    monthsOverdue: 3,
  },
  {
    id: "VEH-30044",
    customer: "Meera Iyer",
    vehicle: "Honda Activa 6G",
    rcNumber: "KA02CD7788",
    emiDue: 2850,
    monthsOverdue: 4,
  },
  {
    id: "VEH-30077",
    customer: "Ashok Logistics Pvt Ltd",
    vehicle: "Tata Ace Gold",
    rcNumber: "KA05EF2210",
    emiDue: 9400,
    monthsOverdue: 2,
  },
  {
    id: "VEH-30091",
    customer: "Aanya Sharma",
    vehicle: "Maruti Swift VXi",
    rcNumber: "KA03GH5512",
    emiDue: 11200,
    monthsOverdue: 0,
  },
  {
    id: "VEH-30103",
    customer: "Kunal Mehta",
    vehicle: "Royal Enfield Classic 350",
    rcNumber: "KA04JK1190",
    emiDue: 4150,
    monthsOverdue: 1,
  },
  {
    id: "VEH-30118",
    customer: "Priya Menon",
    vehicle: "Mahindra Bolero Pickup",
    rcNumber: "KA06LM3340",
    emiDue: 8900,
    monthsOverdue: 0,
  },
];

const CREDIT_ACCOUNTS: { value: CreditAccount; label: string; sub: string; icon: typeof Wallet }[] = [
  { value: "CASH_HAND", label: "Cash in Hand", sub: "Branch cash drawer", icon: Wallet },
  { value: "HDFC", label: "HDFC Bank", sub: "Current A/c ••• 4521", icon: Building2 },
  { value: "SBI", label: "SBI Bank", sub: "Overdraft A/c ••• 8870", icon: Banknote },
];

const ACCOUNT_LABEL: Record<CreditAccount, string> = {
  CASH_HAND: "Cash",
  HDFC: "HDFC",
  SBI: "SBI",
};

const RECENT_RECEIPTS: VehicleReceipt[] = [
  {
    receiptId: "RCV-50118",
    recordedAt: "Today · 09:34 AM",
    loanId: "VEH-30091",
    customer: "Aanya Sharma",
    vehicle: "Maruti Swift VXi",
    paymentMonth: "2026-04",
    emi: 11200,
    penalty: 0,
    total: 11200,
    account: "HDFC",
  },
  {
    receiptId: "RCV-50117",
    recordedAt: "Today · 09:12 AM",
    loanId: "VEH-30118",
    customer: "Priya Menon",
    vehicle: "Mahindra Bolero Pickup",
    paymentMonth: "2026-04",
    emi: 8900,
    penalty: 0,
    total: 8900,
    account: "CASH_HAND",
  },
  {
    receiptId: "RCV-50116",
    recordedAt: "Yesterday · 04:48 PM",
    loanId: "VEH-30103",
    customer: "Kunal Mehta",
    vehicle: "Royal Enfield Classic 350",
    paymentMonth: "2026-03",
    emi: 4150,
    penalty: 415,
    total: 4565,
    account: "CASH_HAND",
  },
  {
    receiptId: "RCV-50115",
    recordedAt: "Yesterday · 02:21 PM",
    loanId: "VEH-30077",
    customer: "Ashok Logistics Pvt Ltd",
    vehicle: "Tata Ace Gold",
    paymentMonth: "2026-03",
    emi: 9400,
    penalty: 940,
    total: 10340,
    account: "SBI",
  },
  {
    receiptId: "RCV-50114",
    recordedAt: "Yesterday · 11:05 AM",
    loanId: "VEH-30044",
    customer: "Meera Iyer",
    vehicle: "Honda Activa 6G",
    paymentMonth: "2026-02",
    emi: 2850,
    penalty: 570,
    total: 3420,
    account: "HDFC",
  },
];

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

const toNum = (v: string | undefined) => {
  const n = Number((v ?? "").toString().replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const inputBaseStyle: React.CSSProperties = {
  borderColor: "rgba(74,111,165,0.20)",
  "--tw-ring-color": "var(--brand-light)",
} as React.CSSProperties;

const monthYearOptions = (() => {
  // 12 months ending April 2026
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const out: { value: string; label: string }[] = [];
  let y = 2026, m = 3; // April 2026
  for (let i = 0; i < 12; i++) {
    const value = `${y}-${String(m + 1).padStart(2, "0")}`;
    out.push({ value, label: `${months[m]} ${y}` });
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }
  return out;
})();

export default function VehicleReceipts() {
  const [receipts, setReceipts] = useState<VehicleReceipt[]>(RECENT_RECEIPTS);
  const [search, setSearch] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      loanId: "",
      paymentMonth: monthYearOptions[0].value,
      emiAmount: "",
      latePenalty: "",
      creditAccount: "",
    },
  });

  const values = useWatch({ control });
  const selectedLoan = useMemo(
    () => VEHICLE_LOANS.find((l) => l.id === values.loanId),
    [values.loanId],
  );

  const emi = toNum(values.emiAmount);
  const penalty = toNum(values.latePenalty);
  const totalCollected = Math.max(emi + penalty, 0);

  const filteredReceipts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return receipts;
    return receipts.filter(
      (r) =>
        r.receiptId.toLowerCase().includes(q) ||
        r.loanId.toLowerCase().includes(q) ||
        r.customer.toLowerCase().includes(q) ||
        r.vehicle.toLowerCase().includes(q),
    );
  }, [search, receipts]);

  const todayCollected = useMemo(
    () =>
      receipts
        .filter((r) => r.recordedAt.toLowerCase().startsWith("today"))
        .reduce((s, r) => s + r.total, 0),
    [receipts],
  );

  const onPrefillEMI = () => {
    if (selectedLoan) {
      setValue("emiAmount", String(selectedLoan.emiDue), { shouldDirty: true });
      const suggestedPenalty = selectedLoan.monthsOverdue > 0
        ? Math.round(selectedLoan.emiDue * 0.1 * selectedLoan.monthsOverdue)
        : 0;
      setValue("latePenalty", String(suggestedPenalty), { shouldDirty: true });
    }
  };

  const onSubmit = (data: FormValues) => {
    if (!data.loanId) {
      toast.error("Select a vehicle loan first.");
      return;
    }
    if (!data.creditAccount) {
      toast.error("Choose the credit account (Cash or Bank).");
      return;
    }
    if (totalCollected <= 0) {
      toast.error("Total collected must be greater than zero.");
      return;
    }

    const loan = VEHICLE_LOANS.find((l) => l.id === data.loanId)!;
    const monthLabel =
      monthYearOptions.find((m) => m.value === data.paymentMonth)?.label ?? data.paymentMonth;

    const newReceipt: VehicleReceipt = {
      receiptId: `RCV-${(50118 + receipts.length + 1).toString()}`,
      recordedAt: "Today · just now",
      loanId: loan.id,
      customer: loan.customer,
      vehicle: loan.vehicle,
      paymentMonth: data.paymentMonth,
      emi,
      penalty,
      total: totalCollected,
      account: data.creditAccount as CreditAccount,
    };

    setReceipts((prev) => [newReceipt, ...prev]);
    toast.success("Vehicle EMI receipt recorded", {
      icon: <CheckCircle2 className="h-4 w-4" />,
      description: `${loan.customer} · ${monthLabel} · ${inr(totalCollected)} → ${ACCOUNT_LABEL[data.creditAccount as CreditAccount]} (posted to Daybook)`,
    });
    reset({
      loanId: "",
      paymentMonth: monthYearOptions[0].value,
      emiAmount: "",
      latePenalty: "",
      creditAccount: "",
    });
  };

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{
              background: "rgba(16,185,129,0.14)",
              boxShadow: "inset 0 0 0 1px rgba(16,185,129,0.30)",
            }}
          >
            <Receipt className="h-6 w-6" style={{ color: "#047857" }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold tracking-tight text-slate-900"
            >
              Vehicle Receipts
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Record monthly EMI, interest, and late-payment penalties — posts to the unified Daybook.
            </p>
          </div>
        </div>

        <div
          className="flex items-center gap-3 rounded-xl border bg-white px-4 py-2.5 text-sm"
          style={{ borderColor: "rgba(74,111,165,0.18)" }}
        >
          <CreditCard className="h-4 w-4" style={{ color: "var(--brand-primary)" }} />
          <span className="text-slate-500">Today's Vehicle Collection</span>
          <span className="font-semibold" style={{ color: "var(--brand-primary)" }}>
            {inr(todayCollected)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* ----- LEFT: Form ----- */}
        <div className="lg:col-span-2">
          <Card className="border bg-white" style={{ borderColor: "rgba(74,111,165,0.12)" }}>
            <CardHeader>
              <div className="flex items-start gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ background: "var(--brand-light)" }}
                >
                  <Car className="h-5 w-5" style={{ color: "var(--brand-primary)" }} />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Record EMI / Interest Payment
                  </CardTitle>
                  <CardDescription className="text-sm text-slate-500">
                    Generates a vehicle receipt and posts to Cash or Bank.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {/* Loan ID */}
                <Field label="Loan ID" htmlFor="loanId" error={errors.loanId?.message}>
                  <Select
                    value={values.loanId || ""}
                    onValueChange={(v) => setValue("loanId", v, { shouldDirty: true })}
                  >
                    <SelectTrigger
                      id="loanId"
                      className="h-11 w-full bg-white"
                      style={inputBaseStyle}
                      aria-label="Loan ID"
                    >
                      <SelectValue placeholder="Select a vehicle loan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {VEHICLE_LOANS.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {l.id} · {l.vehicle}
                            </span>
                            <span className="text-xs text-slate-500">
                              {l.customer} · EMI {inr(l.emiDue)}
                              {l.monthsOverdue > 0 && ` · ${l.monthsOverdue}m overdue`}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedLoan && (
                    <div
                      className="mt-2 flex items-center justify-between rounded-lg border px-3 py-2"
                      style={{
                        borderColor: "rgba(74,111,165,0.15)",
                        backgroundColor: "var(--bg-main)",
                      }}
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-800">
                          {selectedLoan.vehicle}
                        </div>
                        <div className="text-xs text-slate-500">
                          {selectedLoan.customer} · {selectedLoan.rcNumber} · EMI {inr(selectedLoan.emiDue)}
                        </div>
                      </div>
                      {selectedLoan.monthsOverdue > 0 ? (
                        <Badge
                          variant="secondary"
                          className="bg-amber-100 text-amber-800 hover:bg-amber-100"
                        >
                          {selectedLoan.monthsOverdue}m overdue
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                        >
                          Current
                        </Badge>
                      )}
                    </div>
                  )}
                  {selectedLoan && (
                    <button
                      type="button"
                      onClick={onPrefillEMI}
                      className="mt-2 text-xs font-medium underline-offset-2 hover:underline"
                      style={{ color: "var(--brand-primary)" }}
                    >
                      Prefill EMI &amp; suggested penalty
                    </button>
                  )}
                </Field>

                {/* Payment Month/Year */}
                <Field label="Payment Month / Year" htmlFor="paymentMonth">
                  <Select
                    value={values.paymentMonth || monthYearOptions[0].value}
                    onValueChange={(v) => setValue("paymentMonth", v, { shouldDirty: true })}
                  >
                    <SelectTrigger
                      id="paymentMonth"
                      className="h-11 w-full bg-white"
                      style={inputBaseStyle}
                      aria-label="Payment Month / Year"
                    >
                      <SelectValue placeholder="Choose month..." />
                    </SelectTrigger>
                    <SelectContent>
                      {monthYearOptions.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-slate-500" />
                            <span className="text-sm">{m.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {/* EMI + Penalty */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="EMI Amount (₹)"
                    htmlFor="emiAmount"
                    error={errors.emiAmount?.message}
                  >
                    <RupeeInput
                      id="emiAmount"
                      placeholder="e.g., 18,250"
                      {...register("emiAmount", {
                        validate: (v) => toNum(v) >= 0 || "EMI cannot be negative",
                      })}
                    />
                  </Field>

                  <Field
                    label="Late Payment Penalty (₹)"
                    htmlFor="latePenalty"
                    error={errors.latePenalty?.message}
                  >
                    <RupeeInput
                      id="latePenalty"
                      placeholder="e.g., 1,825"
                      {...register("latePenalty", {
                        validate: (v) => toNum(v) >= 0 || "Penalty cannot be negative",
                      })}
                    />
                  </Field>
                </div>

                {/* Total Collected (auto-calc) */}
                <div
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: "rgba(74,111,165,0.30)",
                    background:
                      "linear-gradient(135deg, rgba(191,221,245,0.45) 0%, rgba(137,207,240,0.25) 100%)",
                  }}
                >
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                        Total Collected
                      </p>
                      <p
                        className="mt-1 text-2xl font-extrabold leading-tight"
                        style={{ color: "var(--brand-primary)" }}
                      >
                        {inr(totalCollected)}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        EMI {inr(emi)} + Penalty {inr(penalty)}
                      </p>
                    </div>
                    <IndianRupee
                      className="h-10 w-10 opacity-30"
                      style={{ color: "var(--brand-primary)" }}
                    />
                  </div>
                </div>

                {/* Credit Account */}
                <Field label="Credit Account" htmlFor="creditAccount">
                  <Select
                    value={values.creditAccount || ""}
                    onValueChange={(v) =>
                      setValue("creditAccount", v as CreditAccount, { shouldDirty: true })
                    }
                  >
                    <SelectTrigger
                      id="creditAccount"
                      className="h-11 w-full bg-white"
                      style={inputBaseStyle}
                      aria-label="Credit Account"
                    >
                      <SelectValue placeholder="Cash or Bank account..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CREDIT_ACCOUNTS.map((a) => {
                        const Icon = a.icon;
                        return (
                          <SelectItem key={a.value} value={a.value}>
                            <div className="flex items-center gap-2.5">
                              <Icon className="h-4 w-4" style={{ color: "var(--brand-primary)" }} />
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">{a.label}</span>
                                <span className="text-xs text-slate-500">{a.sub}</span>
                              </div>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Same Cash / HDFC / SBI accounts as Pawn — keeps the Daybook unified.
                  </p>
                </Field>

                <Button
                  type="submit"
                  size="lg"
                  className="h-12 w-full gap-2 text-sm font-semibold text-white shadow-md"
                  style={{ background: "var(--brand-primary)" }}
                >
                  <Receipt className="h-4 w-4" />
                  Record Receipt &amp; Post to Daybook
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* ----- RIGHT: Recent Receipts ----- */}
        <div className="lg:col-span-3">
          <Card className="border bg-white" style={{ borderColor: "rgba(74,111,165,0.12)" }}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ background: "var(--brand-light)" }}
                  >
                    <History className="h-5 w-5" style={{ color: "var(--brand-primary)" }} />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold text-slate-900">
                      Recent Vehicle Receipts
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-500">
                      Last {receipts.length} EMI / penalty postings.
                    </CardDescription>
                  </div>
                </div>

                <div className="relative w-64">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by RCV, loan, customer..."
                    className="h-10 pl-9"
                    style={inputBaseStyle}
                    aria-label="Search receipts"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow style={{ background: "var(--bg-main)" }}>
                      <TableHead className="text-[11px] uppercase tracking-wide text-slate-500">
                        Receipt
                      </TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wide text-slate-500">
                        Loan / Customer
                      </TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wide text-slate-500">
                        Month
                      </TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wide text-slate-500">
                        EMI
                      </TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wide text-slate-500">
                        Penalty
                      </TableHead>
                      <TableHead className="text-right text-[11px] uppercase tracking-wide text-slate-500">
                        Total
                      </TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wide text-slate-500">
                        Account
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReceipts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">
                          No receipts match your search.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredReceipts.map((r) => (
                        <TableRow key={r.receiptId} className="text-sm">
                          <TableCell>
                            <div
                              className="font-mono text-xs font-semibold"
                              style={{ color: "var(--brand-primary)" }}
                            >
                              {r.receiptId}
                            </div>
                            <div className="text-[11px] text-slate-500">{r.recordedAt}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-slate-800">{r.customer}</div>
                            <div className="text-[11px] text-slate-500">
                              {r.loanId} · {r.vehicle}
                            </div>
                          </TableCell>
                          <TableCell className="text-[12px] text-slate-600">
                            {monthYearOptions.find((m) => m.value === r.paymentMonth)?.label ?? r.paymentMonth}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{inr(r.emi)}</TableCell>
                          <TableCell className="text-right tabular-nums text-amber-700">
                            {r.penalty > 0 ? inr(r.penalty) : "—"}
                          </TableCell>
                          <TableCell
                            className="text-right font-semibold tabular-nums"
                            style={{ color: "var(--brand-primary)" }}
                          >
                            {inr(r.total)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="font-medium"
                              style={{
                                borderColor: "rgba(74,111,165,0.30)",
                                color: "var(--brand-primary)",
                              }}
                            >
                              {ACCOUNT_LABEL[r.account]}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* -------------------- helpers -------------------- */

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </Label>
      {children}
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}

const RupeeInput = ({
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id?: string }) => (
  <div
    className="flex h-11 items-center overflow-hidden rounded-md border bg-white focus-within:ring-4"
    style={inputBaseStyle}
  >
    <span
      className="flex h-full items-center justify-center px-3"
      style={{
        background: "rgba(191,221,245,0.35)",
        color: "var(--brand-primary)",
        borderRight: "1px solid rgba(74,111,165,0.18)",
      }}
    >
      <IndianRupee className="h-4 w-4" />
    </span>
    <input
      id={id}
      inputMode="decimal"
      className="flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-slate-400"
      {...props}
    />
  </div>
);
