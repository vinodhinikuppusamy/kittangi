import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  Banknote,
  CalendarClock,
  Camera,
  CheckCircle2,
  IndianRupee,
  Landmark,
  Lock,
  Percent,
  Scale,
  ScanLine,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ItemImageUploader from "@/components/shared/ItemImageUploader";
import { addPledgedItem } from "@/lib/stores/pledgedItemsStore";
import { addLoan } from "@/lib/stores/loansStore";
import {
  getCurrentActor,
  logActivity,
} from "@/lib/stores/activityLogStore";
import { useSettings } from "@/lib/stores/settingsStore";
import { computeProcessingFee } from "@/lib/interest";
import { useCustomers } from "@/lib/stores/customersStore";
import {
  addDaybookEntry,
  DayLockedError,
} from "@/lib/stores/daybookStore";
import { isDateLocked } from "@/lib/stores/dayLocksStore";
import { useAccounts } from "@/lib/stores/accountsStore";

type ItemType = "GOLD" | "SILVER";
type SafeNumber = "SAFE_A" | "SAFE_B" | "SAFE_C";

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
  // Processing fee is no longer captured here — it is auto-derived from
  // Settings → Rates & Fees → Processing Fee per ₹1,000 at submit time.
  /** Account id (from accountsStore) the disbursement is paid out from. */
  paymentSource: string;
  /** Annual interest rate captured at origination. */
  interestRatePct: string;
  legalInterestPct: string;
  /** ISO date the loan principal becomes due. */
  maturityDate: string;
};

/** Default loan tenor (months) when the cashier hasn't typed a maturity date. */
const DEFAULT_TENOR_MONTHS = 6;

function todayIso(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function timeNow(): string {
  return new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function addMonthsIso(iso: string, months: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function monthsBetween(startIso: string, endIso: string): number {
  const a = new Date(startIso + "T00:00:00");
  const b = new Date(endIso + "T00:00:00");
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  const months =
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  return Math.max(0, months);
}


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
  const navigate = useNavigate();
  const accounts = useAccounts();
  const allCustomers = useCustomers();
  // Origination is gated on completed KYC — only customers flagged
  // `kycStatus === "Verified"` in the Global Customers store may pledge.
  const verifiedCustomers = useMemo(
    () =>
      allCustomers
        .filter((c) => c.kycStatus === "Verified")
        .map((c) => ({ id: c.id, name: c.fullName, phone: c.phone })),
    [allCustomers],
  );
  const settings = useSettings();
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
      paymentSource: "",
      // Pulled from the Global Settings store so a Settings → Rates change
      // flows directly into new originations without per-form drift.
      interestRatePct: String(settings.pawnRatePctPerMonth * 12),
      legalInterestPct: String(settings.globalLegalInterestRatePct),
      maturityDate: addMonthsIso(todayIso(), DEFAULT_TENOR_MONTHS),
    },
  });

  const values = useWatch({ control });

  /**
   * Captured/uploaded photos of the gold or jewel item.
   *
   * IMPORTANT: When the pawn ticket is generated, these images are forwarded
   * straight into the persistent Pledged Inventory store via
   * `addPledgedItem({ ..., photos })`. The Pledged Inventory gallery (and its
   * "Manage Item" modal) read from the same store, so any photo captured here
   * is immediately visible there — there is no separate upload step.
   */
  const [itemPhotos, setItemPhotos] = useState<string[]>([]);

  /**
   * Holds the just-issued ticket so we can render the success Vault QR
   * dialog. The QR encodes a JSON envelope of {loanId, customer, customerCode,
   * vaultLoc} which the vault scanner uses to confirm the right packet went
   * into the right locker.
   */
  const [successTicket, setSuccessTicket] = useState<{
    loanId: string;
    customer: string;
    customerCode: string;
    safeLabel: string;
    locker: string;
    vaultLoc: string;
    netDisbursement: number;
    sourceAccount: string;
    itemTitle: string;
  } | null>(null);

  const selectedCustomer = useMemo(
    () => verifiedCustomers.find((c) => c.id === values.customerId),
    [values.customerId, verifiedCustomers],
  );

  const lockersForSafe = values.safeNumber
    ? LOCKERS_BY_SAFE[values.safeNumber as SafeNumber] ?? []
    : [];

  const netWeight = parseFloat(values.netWeight || "0");
  const lendingRate = parseFloat(values.lendingRate || "0");
  const marketRate = parseFloat(values.marketRate || "0");
  const requested = parseFloat(values.requestedLoanAmount || "0");
  // Auto-derived processing fee — Settings → Rates & Fees is the single
  // source of truth for the per-₹1,000 slab.
  const processingFee = computeProcessingFee({
    loanAmount: requested,
    feePerThousand: settings.processingFeePer1000,
  });

  const maxLoanValue = Math.max(0, netWeight * lendingRate);
  const marketValue = Math.max(0, netWeight * marketRate);
  const netDisbursement = Math.max(0, requested - processingFee);
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
    const ratePct = parseFloat(data.interestRatePct || "0");
    if (!Number.isFinite(ratePct) || ratePct <= 0) {
      toast.error("Enter a valid annual interest rate.");
      return;
    }
    if (!data.maturityDate) {
      toast.error("Set a maturity date for the loan.");
      return;
    }

    // ---------------------------------------------------------------
    // Day-lock pre-check. The disbursement entry below would throw a
    // DayLockedError on its own, but checking up-front gives a much
    // cleaner UX (no half-applied side-effects on the pledged-items
    // store) and a more actionable error message.
    // ---------------------------------------------------------------
    const today = todayIso();
    if (isDateLocked(today)) {
      toast.error(
        "Today's Daybook is locked. Unlock the day in the Chitta page before originating new loans.",
      );
      return;
    }

    const ticketNo = `PWN-${Math.floor(100000 + Math.random() * 899999)}`;
    const sourceAccount = accounts.find((a) => a.id === data.paymentSource);
    const safe = SAFES.find((s) => s.value === data.safeNumber);
    const itemTitle =
      data.itemType === "GOLD"
        ? `${parseFloat(data.netWeight).toFixed(2)}g Gold Item`
        : `${parseFloat(data.netWeight).toFixed(2)}g Silver Item`;

    // Atomic three-way commit (cash ↔ loan ↔ pledged item):
    // 1. Post the cash DEBIT to the Daybook FIRST. This is the only step
    //    that can fail (DayLockedError). If it throws we abort BEFORE
    //    creating the pledged item or loan record, so we can never end up
    //    with an orphan pledge / loan that has no matching disbursement.
    // 2. Only after the post succeeds do we add the pledged item, then
    //    commit the loan referencing the pledged item id. Both store
    //    helpers are pure synchronous Zustand mutations and cannot fail.
    try {
      addDaybookEntry({
        dateIso: today,
        time: timeNow(),
        side: "DEBIT",
        category: "Loan Disbursement",
        particulars: `Pawn loan disbursement to ${
          selectedCustomer?.name ?? data.customerId
        } (${data.itemType.toLowerCase()})`,
        refId: ticketNo,
        account: data.paymentSource,
        amount: netDisbursement,
        customerName: selectedCustomer?.name,
        customerId: data.customerId,
      });
    } catch (err) {
      if (err instanceof DayLockedError) {
        toast.error(
          "Today's Daybook was locked just now — disbursement was not posted.",
        );
        return;
      }
      throw err;
    }

    // Forward the newly originated pledge — including any captured photos —
    // into the shared Pledged Inventory store. The PledgedItems gallery and
    // "Manage Item" modal subscribe to the same store and pick this up
    // immediately without a refresh.
    const pledged = addPledgedItem({
      title: itemTitle,
      category: data.itemType,
      grossWeightG: parseFloat(data.grossWeight || data.netWeight) || 0,
      netWeightG: netWeight,
      pledgedValue: requested,
      loanId: ticketNo,
      customer: selectedCustomer?.name ?? data.customerId,
      status: "VAULTED",
      vaultLoc: safe ? `${safe.label} · ${data.lockerNumber}` : data.lockerNumber,
      photos: itemPhotos.length > 0 ? itemPhotos : undefined,
      originatedAt: new Date().toISOString(),
    });

    // Persist the canonical Loan record. The Loan Management module + the
    // Loan Lifecycle detail page (`/loans/:id`) read straight from this
    // store, so the new ticket appears there immediately.
    const tenorMonths = monthsBetween(today, data.maturityDate);
    addLoan({
      id: ticketNo,
      product: "PAWN",
      customer: selectedCustomer?.name ?? data.customerId,
      customerCode: data.customerId,
      principal: requested,
      ratePctPerAnnum: ratePct,
      startedAtIso: today,
      durationLabel: tenorMonths > 0 ? `${tenorMonths} months` : undefined,
      maturityIso: data.maturityDate,
      status: "ACTIVE",
      disbursedFromAccountId: data.paymentSource,
      pledgedItemId: pledged?.id,
      // Per-loan override of the global Legal Interest %. The receipt-time
      // splitInterest() helper reads this first, then falls back to the
      // settings store value.
      legalInterestPct: parseFloat(data.legalInterestPct || "0") || undefined,
    });

    setSuccessTicket({
      loanId: ticketNo,
      customer: selectedCustomer?.name ?? data.customerId,
      customerCode: data.customerId,
      safeLabel: safe?.label ?? data.safeNumber,
      locker: data.lockerNumber,
      vaultLoc: safe ? `${safe.label} · ${data.lockerNumber}` : data.lockerNumber,
      netDisbursement,
      sourceAccount: sourceAccount?.name ?? data.paymentSource,
      itemTitle,
    });
    try {
      logActivity({
        actor: getCurrentActor(),
        kind: "LOAN",
        summary: `Pawn loan ${ticketNo} disbursed — ${selectedCustomer?.name ?? data.customerId} · ₹${requested.toLocaleString("en-IN")}`,
        link: `/loans/${ticketNo}`,
      });
    } catch {
      /* best effort */
    }
    reset();
    setItemPhotos([]);
  };

  return (
    <div className="mx-auto max-w-7xl pb-10">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{
              backgroundColor: "rgba(245,158,11,0.14)",
              boxShadow: "inset 0 0 0 1px rgba(245,158,11,0.32)",
            }}
          >
            <Landmark size={22} style={{ color: "#b45309" }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold text-slate-900"
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
            color: "var(--text-main)",
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
                  <User size={16} style={{ color: "var(--text-main)" }} />
                </div>
                <div>
                  <CardTitle
                    className="text-base font-semibold"
                    style={{ color: "var(--text-main)" }}
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
                  disabled={verifiedCustomers.length === 0}
                >
                  <SelectTrigger
                    className="h-10 w-full bg-white"
                    style={inputBaseStyle}
                  >
                    <SelectValue
                      placeholder={
                        verifiedCustomers.length === 0
                          ? "No verified customers found"
                          : "Select KYC-verified customer..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {verifiedCustomers.map((c) => (
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
                {verifiedCustomers.length === 0 && (
                  <div
                    className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-2 text-xs"
                    style={{
                      borderColor: "rgba(234,179,8,0.45)",
                      backgroundColor: "rgba(234,179,8,0.08)",
                      color: "#92400E",
                    }}
                  >
                    <span>
                      No KYC-verified customers found. Verify a customer in
                      Global Customers before disbursing a pawn loan.
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => navigate("/customers")}
                    >
                      Open KYC
                    </Button>
                  </div>
                )}
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
                  <Lock size={14} style={{ color: "var(--text-main)" }} />
                  <h3
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--text-main)" }}
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
                      color: "var(--text-main)",
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
                      style={{ color: "var(--text-main)" }}
                    />
                  </div>
                  <div>
                    <CardTitle
                      className="text-base font-semibold"
                      style={{ color: "var(--text-main)" }}
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
                        style={{ color: "var(--text-main)" }}
                      >
                        Maximum Loan Value
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        Net Weight × Lending Rate
                      </div>
                    </div>
                    <div
                      className="text-2xl font-bold tracking-tight"
                      style={{ color: "var(--text-main)" }}
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
                      style={{ color: "var(--text-main)" }}
                    />
                  </div>
                  <div>
                    <CardTitle
                      className="text-base font-semibold"
                      style={{ color: "var(--text-main)" }}
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
                        exceedsMax ? "text-slate-900" : "text-slate-500"
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
                      Processing Fee (auto)
                    </Label>
                    <div
                      className="flex h-10 items-center justify-between rounded-md border bg-slate-50 px-3"
                      style={{ borderColor: "rgba(74,111,165,0.20)" }}
                    >
                      <span className="text-xs text-slate-500">
                        ₹{settings.processingFeePer1000} × (Loan ÷ 1,000)
                      </span>
                      <span
                        className="text-sm font-semibold"
                        style={{ color: "var(--text-main)" }}
                      >
                        {inr(processingFee)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Auto-computed from Settings → Rates &amp; Fees. Deducted
                      from disbursement.
                    </p>
                  </div>
                </div>

                {/* Loan Terms — interest rate, legal split & maturity */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600">
                      Interest Rate (% p.a.)
                    </Label>
                    <div className="relative">
                      <Percent
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="36"
                        placeholder="13"
                        className="h-10 bg-white pl-8"
                        style={inputBaseStyle}
                        {...register("interestRatePct")}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Annual rate quoted to the customer.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600">
                      Legal Interest Component (%)
                    </Label>
                    <div className="relative">
                      <Percent
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="36"
                        placeholder="12"
                        className="h-10 bg-white pl-8"
                        style={inputBaseStyle}
                        {...register("legalInterestPct")}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Portion booked to the legal-rate ledger.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600">
                      Maturity Date
                    </Label>
                    <div className="relative">
                      <CalendarClock
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <Input
                        type="date"
                        className="h-10 bg-white pl-8"
                        style={inputBaseStyle}
                        {...register("maturityDate")}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Principal becomes due on this date.
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
                        Requested − Processing Fee
                      </div>
                    </div>
                    <div
                      className="text-4xl font-extrabold tracking-tight"
                      style={{ color: "var(--text-main)" }}
                    >
                      {inr(netDisbursement)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Item Photographs — full width */}
        {/*
         * The images attached here are forwarded into the Pledged Inventory
         * gallery on submit (see addPledgedItem call above) so staff can later
         * view them in the high-resolution viewer of the "Manage Item" modal.
         */}
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
                <Camera size={16} style={{ color: "var(--text-main)" }} />
              </div>
              <div>
                <CardTitle
                  className="text-base font-semibold"
                  style={{ color: "var(--text-main)" }}
                >
                  Item Photographs
                </CardTitle>
                <CardDescription className="text-xs">
                  Capture clear, high-resolution photos of the gold or jewel
                  item. These will be passed straight into the Pledged
                  Inventory gallery.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ItemImageUploader
              value={itemPhotos}
              onChange={setItemPhotos}
              max={6}
            />
          </CardContent>
        </Card>

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
                <Wallet size={16} style={{ color: "var(--text-main)" }} />
              </div>
              <div>
                <CardTitle
                  className="text-base font-semibold"
                  style={{ color: "var(--text-main)" }}
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
                  onValueChange={(v) => setValue("paymentSource", v)}
                >
                  <SelectTrigger
                    className="h-10 w-full bg-white"
                    style={inputBaseStyle}
                  >
                    <SelectValue placeholder="Select payment source..." />
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
              <div
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
                style={{
                  borderColor: "rgba(74,111,165,0.18)",
                  backgroundColor: "var(--bg-main)",
                  color: "var(--text-main)",
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
            onClick={() => {
              reset();
              setItemPhotos([]);
            }}
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
          <p className="text-xs text-slate-900">
            Please fix the highlighted fields above.
          </p>
        )}
      </form>

      <Dialog
        open={successTicket !== null}
        onOpenChange={(o) => {
          if (!o) setSuccessTicket(null);
        }}
      >
        <DialogContent className="sm:max-w-115">
          <DialogHeader>
            <DialogTitle
              className="flex items-center gap-2 text-base font-semibold"
              style={{ color: "var(--text-main)" }}
            >
              <CheckCircle2 size={18} />
              Pawn Ticket Generated
            </DialogTitle>
            <DialogDescription className="text-xs">
              Affix this Vault QR to the sealed packet before stowing it in the
              locker. Vault staff scan it during locker handover to confirm
              packet ↔ locker integrity.
            </DialogDescription>
          </DialogHeader>

          {successTicket && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="font-semibold uppercase tracking-wide text-slate-500">
                    Ticket No.
                  </div>
                  <div
                    className="mt-0.5 font-mono text-sm font-semibold"
                    style={{ color: "var(--text-main)" }}
                  >
                    {successTicket.loanId}
                  </div>
                </div>
                <div>
                  <div className="font-semibold uppercase tracking-wide text-slate-500">
                    Disbursed
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">
                    {inr(successTicket.netDisbursement)}
                  </div>
                </div>
                <div>
                  <div className="font-semibold uppercase tracking-wide text-slate-500">
                    Customer
                  </div>
                  <div className="mt-0.5 text-sm font-medium text-slate-900">
                    {successTicket.customer}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {successTicket.customerCode}
                  </div>
                </div>
                <div>
                  <div className="font-semibold uppercase tracking-wide text-slate-500">
                    Vault Location
                  </div>
                  <div
                    className="mt-0.5 text-sm font-semibold"
                    style={{ color: "var(--text-main)" }}
                  >
                    {successTicket.vaultLoc}
                  </div>
                </div>
              </div>

              <div
                className="flex flex-col items-center gap-2 rounded-xl border bg-white p-4"
                style={{ borderColor: "rgba(74,111,165,0.20)" }}
              >
                <QRCodeSVG
                  size={184}
                  level="M"
                  includeMargin
                  value={JSON.stringify({
                    type: "kittangi.vault.packet",
                    loanId: successTicket.loanId,
                    customer: successTicket.customer,
                    customerCode: successTicket.customerCode,
                    safe: successTicket.safeLabel,
                    locker: successTicket.locker,
                    item: successTicket.itemTitle,
                  })}
                  bgColor="#ffffff"
                  fgColor="#1f2937"
                />
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                  <ScanLine size={12} />
                  Scan at Vault counter to confirm packet placement
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSuccessTicket(null)}
            >
              Originate Another
            </Button>
            <Button
              type="button"
              className="font-semibold text-white"
              style={{ backgroundColor: "var(--brand-primary)" }}
              onClick={() => {
                const id = successTicket?.loanId;
                setSuccessTicket(null);
                if (id) navigate(`/loans/${id}`);
              }}
            >
              Open Loan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
