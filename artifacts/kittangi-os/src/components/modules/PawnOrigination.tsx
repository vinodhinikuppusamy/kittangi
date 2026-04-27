import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  Banknote,
  CheckCircle2,
  IndianRupee,
  Landmark,
  Lock,
  Scale,
  Sparkles,
  User,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type ItemType = "GOLD" | "SILVER";
type SafeNumber = "SAFE_A" | "SAFE_B" | "SAFE_C";
type PaymentSource = "CASH" | "HDFC" | "SBI";

type PawnFormValues = {
  customerId: string;
  safeNumber: SafeNumber | "";
  lockerNumber: string;
  itemType: ItemType;
  grossWeight: string;
  netWeight: string;
  marketRate: string;
  lendingRate: string;
  requestedLoanAmount: string;
  chitExpense: string;
  paymentSource: PaymentSource | "";
};

const VERIFIED_CUSTOMERS = [
  { id: "KTG-10042", name: "Aanya Sharma", phone: "+91 98212 44510" },
  { id: "KTG-10044", name: "Meera Iyer", phone: "+91 99450 11236" },
  { id: "KTG-10047", name: "Kunal Mehta", phone: "+91 98990 23311" },
  { id: "KTG-10051", name: "Rohan Verma", phone: "+91 98456 77810" },
  { id: "KTG-10059", name: "Priya Menon", phone: "+91 99878 21006" },
];

const SAFES: { value: SafeNumber; label: string }[] = [
  { value: "SAFE_A", label: "Safe A — Main Vault" },
  { value: "SAFE_B", label: "Safe B — Secondary" },
  { value: "SAFE_C", label: "Safe C — High-Value" },
];

const LOCKERS_BY_SAFE: Record<SafeNumber, string[]> = {
  SAFE_A: ["L-101", "L-102", "L-103", "L-104", "L-105"],
  SAFE_B: ["L-201", "L-202", "L-203", "L-204"],
  SAFE_C: ["L-301", "L-302", "L-303"],
};

const PAYMENT_SOURCES: { value: PaymentSource; label: string; sub: string }[] =
  [
    { value: "CASH", label: "Cash in Hand", sub: "Branch cash drawer" },
    { value: "HDFC", label: "HDFC Bank", sub: "Current A/c ••• 4521" },
    { value: "SBI", label: "SBI Bank", sub: "Overdraft A/c ••• 8870" },
  ];

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

export default function PawnOrigination() {
  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<PawnFormValues>({
    defaultValues: {
      customerId: "",
      safeNumber: "",
      lockerNumber: "",
      itemType: "GOLD",
      grossWeight: "",
      netWeight: "",
      marketRate: "6450",
      lendingRate: "5200",
      requestedLoanAmount: "",
      chitExpense: "250",
      paymentSource: "",
    },
  });

  const values = useWatch({ control });

  const selectedCustomer = useMemo(
    () => VERIFIED_CUSTOMERS.find((c) => c.id === values.customerId),
    [values.customerId],
  );

  const lockersForSafe = values.safeNumber
    ? LOCKERS_BY_SAFE[values.safeNumber as SafeNumber] ?? []
    : [];

  const netWeight = parseFloat(values.netWeight || "0");
  const lendingRate = parseFloat(values.lendingRate || "0");
  const marketRate = parseFloat(values.marketRate || "0");
  const requested = parseFloat(values.requestedLoanAmount || "0");
  const chit = parseFloat(values.chitExpense || "0");

  const maxLoanValue = Math.max(0, netWeight * lendingRate);
  const marketValue = Math.max(0, netWeight * marketRate);
  const netDisbursement = Math.max(0, requested - chit);
  const exceedsMax = requested > maxLoanValue && requested > 0;

  const onSubmit = (data: PawnFormValues) => {
    if (!data.customerId) {
      toast.error("Please select a KYC-verified customer.");
      return;
    }
    if (!data.safeNumber || !data.lockerNumber) {
      toast.error("Please assign a Safe and Locker for the pledged item.");
      return;
    }
    if (!data.netWeight || netWeight <= 0) {
      toast.error("Enter a valid net weight for the pledged item.");
      return;
    }
    if (!data.requestedLoanAmount || requested <= 0) {
      toast.error("Enter the requested loan amount.");
      return;
    }
    if (exceedsMax) {
      toast.error(
        `Requested amount exceeds the Maximum Loan Value of ${inr(maxLoanValue)}.`,
      );
      return;
    }
    if (!data.paymentSource) {
      toast.error("Select a payment source for disbursement.");
      return;
    }

    const ticketNo = `PWN-${Math.floor(100000 + Math.random() * 899999)}`;
    toast.success("Pawn ticket generated", {
      description: `${ticketNo} • ${inr(netDisbursement)} disbursed via ${
        PAYMENT_SOURCES.find((p) => p.value === data.paymentSource)?.label
      }`,
      icon: <CheckCircle2 size={18} />,
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
            <Landmark size={22} style={{ color: "var(--brand-primary)" }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--brand-primary)" }}
            >
              Pawn Origination
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Originate a new pledge — value the item, calculate disbursement,
              and generate a ticket.
            </p>
          </div>
        </div>

        <div
          className="hidden items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs font-medium md:flex"
          style={{
            borderColor: "rgba(74,111,165,0.18)",
            color: "var(--brand-primary)",
          }}
        >
          <Sparkles size={14} />
          New Pawn Ticket
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Two-column grid */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* LEFT: Customer & Vault Details */}
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
                  <User size={16} style={{ color: "var(--brand-primary)" }} />
                </div>
                <div>
                  <CardTitle
                    className="text-base font-semibold"
                    style={{ color: "var(--brand-primary)" }}
                  >
                    Customer &amp; Vault Details
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Pledger identity and physical storage location.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Customer Search */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Customer Search
                </Label>
                <Select
                  value={values.customerId || ""}
                  onValueChange={(v) => setValue("customerId", v)}
                >
                  <SelectTrigger
                    className="h-10 w-full bg-white"
                    style={inputBaseStyle}
                  >
                    <SelectValue placeholder="Select KYC-verified customer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {VERIFIED_CUSTOMERS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{c.name}</span>
                          <span className="text-xs text-slate-500">
                            {c.id} • {c.phone}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCustomer && (
                  <div
                    className="mt-2 flex items-center justify-between rounded-lg border px-3 py-2"
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
                        {selectedCustomer.name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">
                          {selectedCustomer.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {selectedCustomer.id} • {selectedCustomer.phone}
                        </div>
                      </div>
                    </div>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                      style={{
                        backgroundColor: "rgba(34,197,94,0.12)",
                        color: "rgb(21,128,61)",
                      }}
                    >
                      KYC Verified
                    </span>
                  </div>
                )}
              </div>

              {/* Vault Assignment */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Lock size={14} style={{ color: "var(--brand-primary)" }} />
                  <h3
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--brand-primary)" }}
                  >
                    Vault Assignment
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600">
                      Safe Number
                    </Label>
                    <Select
                      value={values.safeNumber || ""}
                      onValueChange={(v) => {
                        setValue("safeNumber", v as SafeNumber);
                        setValue("lockerNumber", "");
                      }}
                    >
                      <SelectTrigger
                        className="h-10 w-full bg-white"
                        style={inputBaseStyle}
                      >
                        <SelectValue placeholder="Select Safe" />
                      </SelectTrigger>
                      <SelectContent>
                        {SAFES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600">
                      Locker Number
                    </Label>
                    <Select
                      value={values.lockerNumber || ""}
                      onValueChange={(v) => setValue("lockerNumber", v)}
                      disabled={!values.safeNumber}
                    >
                      <SelectTrigger
                        className="h-10 w-full bg-white disabled:opacity-60"
                        style={inputBaseStyle}
                      >
                        <SelectValue
                          placeholder={
                            values.safeNumber
                              ? "Select Locker"
                              : "Select Safe first"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {lockersForSafe.map((l) => (
                          <SelectItem key={l} value={l}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {values.safeNumber && values.lockerNumber && (
                  <div
                    className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs"
                    style={{
                      borderColor: "rgba(74,111,165,0.30)",
                      color: "var(--brand-primary)",
                      backgroundColor: "rgba(191,221,245,0.20)",
                    }}
                  >
                    <Lock size={12} />
                    Will be stored in{" "}
                    <span className="font-semibold">
                      {SAFES.find((s) => s.value === values.safeNumber)?.label}
                    </span>{" "}
                    — Locker{" "}
                    <span className="font-semibold">
                      {values.lockerNumber}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* RIGHT: Valuation + Disbursement (stacked) */}
          <div className="space-y-5">
            {/* Item Valuation */}
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
                    <Scale
                      size={16}
                      style={{ color: "var(--brand-primary)" }}
                    />
                  </div>
                  <div>
                    <CardTitle
                      className="text-base font-semibold"
                      style={{ color: "var(--brand-primary)" }}
                    >
                      Item Valuation
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Weight, market rate &amp; lending rate calculation.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600">Item Type</Label>
                    <Select
                      value={values.itemType || "GOLD"}
                      onValueChange={(v) =>
                        setValue("itemType", v as ItemType)
                      }
                    >
                      <SelectTrigger
                        className="h-10 w-full bg-white"
                        style={inputBaseStyle}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GOLD">Gold</SelectItem>
                        <SelectItem value="SILVER">Silver</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600">
                      Gross Weight (g)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="h-10 bg-white"
                      style={inputBaseStyle}
                      {...register("grossWeight")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600">
                      Net Weight (g)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="h-10 bg-white"
                      style={inputBaseStyle}
                      {...register("netWeight")}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600">
                      Market Rate (₹ / gram)
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
                        className="h-10 bg-white pl-8"
                        style={inputBaseStyle}
                        {...register("marketRate")}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600">
                      Lending Rate (₹ / gram)
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
                        className="h-10 bg-white pl-8"
                        style={inputBaseStyle}
                        {...register("lendingRate")}
                      />
                    </div>
                  </div>
                </div>

                {/* Maximum Loan Value */}
                <div
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: "rgba(74,111,165,0.18)",
                    background:
                      "linear-gradient(135deg, rgba(191,221,245,0.35) 0%, rgba(233,244,251,0.65) 100%)",
                  }}
                >
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div
                        className="text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: "var(--brand-primary)" }}
                      >
                        Maximum Loan Value
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        Net Weight × Lending Rate
                      </div>
                    </div>
                    <div
                      className="text-2xl font-bold tracking-tight"
                      style={{ color: "var(--brand-primary)" }}
                    >
                      {inr(maxLoanValue)}
                    </div>
                  </div>
                  {marketValue > 0 && (
                    <div className="mt-2 flex items-center justify-between border-t border-dashed pt-2 text-[11px] text-slate-500"
                      style={{ borderColor: "rgba(74,111,165,0.20)" }}
                    >
                      <span>Market Value (reference)</span>
                      <span className="font-medium text-slate-700">
                        {inr(marketValue)}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Disbursement Details */}
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
                      Disbursement Details
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Loan amount, processing fees &amp; net payout.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600">
                      Requested Loan Amount
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
                        style={
                          exceedsMax
                            ? {
                                ...inputBaseStyle,
                                borderColor: "rgba(220,38,38,0.40)",
                              }
                            : inputBaseStyle
                        }
                        {...register("requestedLoanAmount")}
                      />
                    </div>
                    <p
                      className={`text-[11px] ${
                        exceedsMax ? "text-red-600" : "text-slate-500"
                      }`}
                    >
                      {exceedsMax
                        ? `Exceeds Maximum Loan Value (${inr(maxLoanValue)}).`
                        : `Must not exceed Maximum Loan Value (${inr(
                            maxLoanValue,
                          )}).`}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600">
                      Chit Expense / Processing Fee
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
                        {...register("chitExpense")}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Deducted from the requested amount at disbursement.
                    </p>
                  </div>
                </div>

                {/* Net Disbursement Amount */}
                <div
                  className="rounded-xl border p-5"
                  style={{
                    borderColor: "rgba(74,111,165,0.20)",
                    background:
                      "linear-gradient(135deg, #FFFFFF 0%, rgba(191,221,245,0.30) 100%)",
                  }}
                >
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Net Disbursement Amount
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        Requested − Chit Expense
                      </div>
                    </div>
                    <div
                      className="text-4xl font-extrabold tracking-tight"
                      style={{ color: "var(--brand-primary)" }}
                    >
                      {inr(netDisbursement)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Payment Source — full width */}
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
                <Wallet size={16} style={{ color: "var(--brand-primary)" }} />
              </div>
              <div>
                <CardTitle
                  className="text-base font-semibold"
                  style={{ color: "var(--brand-primary)" }}
                >
                  Payment Source
                </CardTitle>
                <CardDescription className="text-xs">
                  Choose the account from which funds will be released.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">
                  Source Account
                </Label>
                <Select
                  value={values.paymentSource || ""}
                  onValueChange={(v) =>
                    setValue("paymentSource", v as PaymentSource)
                  }
                >
                  <SelectTrigger
                    className="h-10 w-full bg-white"
                    style={inputBaseStyle}
                  >
                    <SelectValue placeholder="Select payment source..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_SOURCES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {p.label}
                          </span>
                          <span className="text-xs text-slate-500">
                            {p.sub}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
                style={{
                  borderColor: "rgba(74,111,165,0.18)",
                  backgroundColor: "var(--bg-main)",
                  color: "var(--brand-primary)",
                }}
              >
                <Banknote size={14} />
                Disbursing{" "}
                <span className="font-semibold">{inr(netDisbursement)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-12 px-5"
            onClick={() => reset()}
          >
            Reset Form
          </Button>
          <Button
            type="submit"
            className="h-12 px-6 text-sm font-semibold text-white shadow-md transition-transform active:scale-[0.99]"
            style={{
              backgroundColor: "var(--brand-primary)",
              boxShadow:
                "0 8px 20px rgba(74,111,165,0.30), 0 2px 6px rgba(74,111,165,0.20)",
            }}
          >
            <Landmark size={18} className="mr-2" />
            Generate Pawn Ticket &amp; Disburse
          </Button>
        </div>

        {Object.keys(errors).length > 0 && (
          <p className="text-xs text-red-600">
            Please fix the highlighted fields above.
          </p>
        )}
      </form>
    </div>
  );
}
