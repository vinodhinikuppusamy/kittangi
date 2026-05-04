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
  Building,
  Landmark,
} from "lucide-react";

import { useLoans, type Loan } from "@/lib/stores/loansStore";
import { useAccounts } from "@/lib/stores/accountsStore";
import { useDaybook, addDaybookEntry, DayLockedError } from "@/lib/stores/daybookStore";
import { getCurrentActor, logActivity } from "@/lib/stores/activityLogStore";

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

type FormValues = {
  loanId: string;
  paymentMonth: string;
  emiAmount: string;
  latePenalty: string;
  creditAccount: string;
};


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
  const allLoans = useLoans();
  const accounts = useAccounts();
  const daybook = useDaybook();
  const [search, setSearch] = useState("");

  const vehicleLoans = useMemo(
    () => allLoans.filter((l) => l.product === "VEHICLE" && l.status === "ACTIVE"),
    [allLoans],
  );

  const recentReceipts = useMemo(() => {
    return daybook
      .filter((e) => e.side === "CREDIT" && e.category === "EMI Received")
      .map((e) => {
        const loan = allLoans.find((l) => l.id === (e.refId ?? "").split("•").pop()?.trim());
        return {
          receiptId: e.id,
          recordedAt: e.dateIso,
          loanId: e.refId?.split("•").pop()?.trim() ?? "—",
          customer: e.customerName ?? "—",
          vehicle: loan?.vehicleDetails?.makeModel ?? "Vehicle",
          paymentMonth: "—", // Month info not stored in daybook currently
          emi: e.amount,
          penalty: 0, // Split info not stored in daybook currently
          total: e.amount,
          account: e.account,
        };
      })
      .sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1))
      .slice(0, 20);
  }, [daybook, allLoans]);

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
    () => vehicleLoans.find((l) => l.id === values.loanId),
    [values.loanId, vehicleLoans],
  );

  const emi = toNum(values.emiAmount);
  const penalty = toNum(values.latePenalty);
  const totalCollected = Math.max(emi + penalty, 0);

  const filteredReceipts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recentReceipts;
    return recentReceipts.filter(
      (r) =>
        r.receiptId.toLowerCase().includes(q) ||
        r.loanId.toLowerCase().includes(q) ||
        r.customer.toLowerCase().includes(q) ||
        r.vehicle.toLowerCase().includes(q),
    );
  }, [search, recentReceipts]);

  const todayCollected = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return recentReceipts
      .filter((r) => r.recordedAt === today)
      .reduce((s, r) => s + r.total, 0);
  }, [recentReceipts]);

  const onPrefillEMI = () => {
    if (selectedLoan) {
      // Estimate EMI as Principal / Duration (crude but dynamic)
      const months = parseInt(selectedLoan.durationLabel?.split(" ")[0] ?? "36");
      const suggestedEMI = Math.round(selectedLoan.principal / months);
      setValue("emiAmount", String(suggestedEMI), { shouldDirty: true });
      setValue("latePenalty", "0", { shouldDirty: true });
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

    const loan = vehicleLoans.find((l) => l.id === data.loanId)!;
    const account = accounts.find((a) => a.id === data.creditAccount);
    const monthLabel =
      monthYearOptions.find((m) => m.value === data.paymentMonth)?.label ?? data.paymentMonth;

    const today = new Date().toISOString().split("T")[0];
    const time = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    try {
      addDaybookEntry({
        dateIso: today,
        time,
        side: "CREDIT",
        category: "EMI Received",
        particulars: `Vehicle EMI — ${loan.customer} · ${monthLabel}`,
        refId: `RCV-${Date.now()} • ${loan.id}`,
        account: data.creditAccount,
        amount: totalCollected,
        customerName: loan.customer,
        customerId: loan.customerCode,
      });

      logActivity({
        actor: getCurrentActor(),
        kind: "DAYBOOK",
        summary: `Vehicle EMI received: ${loan.customer} · ${inr(totalCollected)}`,
        link: `/loans/${loan.id}`,
      });

      toast.success("Vehicle EMI receipt recorded", {
        icon: <CheckCircle2 className="h-4 w-4" />,
        description: `${loan.customer} · ${monthLabel} · ${inr(totalCollected)} → ${account?.name ?? data.creditAccount} (posted to Daybook)`,
      });

      reset({
        loanId: "",
        paymentMonth: monthYearOptions[0].value,
        emiAmount: "",
        latePenalty: "",
        creditAccount: "",
      });
    } catch (err) {
      if (err instanceof DayLockedError) {
        toast.error("Today's Daybook is locked. Unlock it in the Chitta page first.");
      } else {
        toast.error("Failed to record receipt. Please try again.");
      }
    }
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
          <CreditCard className="h-4 w-4" style={{ color: "var(--text-main)" }} />
          <span className="text-slate-500">Today's Vehicle Collection</span>
          <span className="font-semibold" style={{ color: "var(--text-main)" }}>
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
                  <Car className="h-5 w-5" style={{ color: "var(--text-main)" }} />
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
                      {vehicleLoans.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {l.id} · {l.vehicleDetails?.makeModel ?? "Vehicle"}
                            </span>
                            <span className="text-xs text-slate-500">
                              {l.customer} · Principal {inr(l.principal)}
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
                          {selectedLoan.vehicleDetails?.makeModel ?? "Vehicle"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {selectedLoan.customer} · {selectedLoan.vehicleDetails?.regNo ?? "No RC"} · Principal {inr(selectedLoan.principal)}
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                      >
                        {selectedLoan.status}
                      </Badge>
                    </div>
                  )}
                  {selectedLoan && (
                    <button
                      type="button"
                      onClick={onPrefillEMI}
                      className="mt-2 text-xs font-medium underline-offset-2 hover:underline"
                      style={{ color: "var(--text-main)" }}
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
                        style={{ color: "var(--text-main)" }}
                      >
                        {inr(totalCollected)}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        EMI {inr(emi)} + Penalty {inr(penalty)}
                      </p>
                    </div>
                    <IndianRupee
                      className="h-10 w-10 opacity-30"
                      style={{ color: "var(--text-main)" }}
                    />
                  </div>
                </div>

                {/* Credit Account */}
                <Field label="Credit Account" htmlFor="creditAccount">
                  <Select
                    value={values.creditAccount || ""}
                    onValueChange={(v) =>
                      setValue("creditAccount", v, { shouldDirty: true })
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
                      {accounts.map((a) => {
                        const Icon = a.type === "CASH" ? Wallet : Landmark;
                        return (
                          <SelectItem key={a.id} value={a.id}>
                            <div className="flex items-center gap-2.5">
                              <Icon className="h-4 w-4" style={{ color: "var(--text-main)" }} />
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">{a.name}</span>
                                <span className="text-xs text-slate-500">{a.subtitle}</span>
                              </div>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Same accounts as Pawn — keeps the Daybook unified.
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
                    <History className="h-5 w-5" style={{ color: "var(--text-main)" }} />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold text-slate-900">
                      Recent Vehicle Receipts
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-500">
                      Last {recentReceipts.length} EMI / penalty postings.
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
                              style={{ color: "var(--text-main)" }}
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
                          <TableCell className="text-right tabular-nums text-slate-900">
                            {r.penalty > 0 ? inr(r.penalty) : "—"}
                          </TableCell>
                          <TableCell
                            className="text-right font-semibold tabular-nums"
                            style={{ color: "var(--text-main)" }}
                          >
                            {inr(r.total)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="font-medium"
                              style={{
                                borderColor: "rgba(74,111,165,0.30)",
                                color: "var(--text-main)",
                              }}
                            >
                              {accounts.find(acc => acc.id === r.account)?.name ?? r.account}
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
      {error && <p className="text-xs font-medium text-slate-900">{error}</p>}
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
        color: "var(--text-main)",
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
