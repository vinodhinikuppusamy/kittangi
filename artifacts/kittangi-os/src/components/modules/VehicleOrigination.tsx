import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, useWatch, type Control } from "react-hook-form";
import { toast } from "sonner";
import {
  Bike,
  CalendarClock,
  Calculator,
  Car,
  CheckCircle2,
  FileCheck2,
  FileSignature,
  FileText,
  Gauge,
  IndianRupee,
  Paperclip,
  Percent,
  Printer,
  QrCode,
  ShieldCheck,
  Truck,
  UploadCloud,
  UserRoundCheck,
  Wallet,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { openLockerTagPrintWindow } from "@/lib/printLockerTag";
import {
  getCurrentActor,
  logActivity,
} from "@/lib/stores/activityLogStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  addLoan,
  deleteLoan,
  type LegalDoc,
  type LegalDocType,
} from "@/lib/stores/loansStore";
import {
  addDaybookEntry,
  DayLockedError,
} from "@/lib/stores/daybookStore";
import { isDateLocked } from "@/lib/stores/dayLocksStore";
import { useAccounts } from "@/lib/stores/accountsStore";
import { useCustomers } from "@/lib/stores/customersStore";
import { useSettings } from "@/lib/stores/settingsStore";
import { computeProcessingFee } from "@/lib/interest";

type VehicleType = "TWO_WHEELER" | "FOUR_WHEELER" | "COMMERCIAL";

type VehicleForm = {
  customerId: string;
  vehicleType: VehicleType | "";
  makeModel: string;
  year: string;
  rcNumber: string;
  engineNumber: string;
  chassisNumber: string;
  marketValue: string;
  loanAmount: string;
  // Processing fee is no longer captured manually — it is auto-derived from
  // Settings → Rates & Fees → Processing Fee per ₹1,000 at submit time.
  docCharges: string;
  ratePctPerAnnum: string;
  legalInterestPct: string;
  tenureMonths: string;
  paymentSource: string;
  hypothecation: boolean;
};

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

function addMonthsIso(startIso: string, months: number): string {
  const d = new Date(startIso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return startIso;
  const target = new Date(d);
  target.setMonth(target.getMonth() + months);
  return [
    target.getFullYear(),
    String(target.getMonth() + 1).padStart(2, "0"),
    String(target.getDate()).padStart(2, "0"),
  ].join("-");
}

const LEGAL_DOC_LABELS: Record<LegalDocType, string> = {
  RC: "RC Book",
  INSURANCE: "Insurance Policy",
  AGREEMENT: "Loan Agreement",
  PERMIT: "Permits / Fitness",
};

const LEGAL_DOC_HINTS: Record<LegalDocType, string> = {
  RC: "Vehicle Registration Certificate (front + back).",
  INSURANCE: "Active comprehensive insurance certificate.",
  AGREEMENT: "Signed loan agreement & promissory note.",
  PERMIT: "Permit, road tax, or fitness certificate.",
};

const LEGAL_DOC_ORDER: LegalDocType[] = [
  "RC",
  "INSURANCE",
  "AGREEMENT",
  "PERMIT",
];

const VEHICLE_TYPES: { value: VehicleType; label: string; icon: typeof Car; sub: string }[] = [
  { value: "TWO_WHEELER", label: "2-Wheeler", icon: Bike, sub: "Bike, scooter, moped" },
  { value: "FOUR_WHEELER", label: "4-Wheeler", icon: Car, sub: "Car, SUV, sedan" },
  { value: "COMMERCIAL", label: "Commercial", icon: Truck, sub: "Truck, tempo, bus" },
];

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

const toNum = (v: string | undefined) => {
  const n = Number((v ?? "").toString().replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const inputBaseStyle: React.CSSProperties = {
  borderColor: "rgba(74,111,165,0.20)",
  "--tw-ring-color": "var(--brand-light)",
} as React.CSSProperties;

export default function VehicleOrigination() {
  const settings = useSettings();
  const allCustomers = useCustomers();
  const verifiedCustomers = useMemo(
    () =>
      allCustomers
        .filter((c) => c.kycStatus === "Verified")
        .map((c) => ({ id: c.id, name: c.fullName, phone: c.phone })),
    [allCustomers],
  );
  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<VehicleForm>({
    defaultValues: {
      customerId: "",
      vehicleType: "",
      makeModel: "",
      year: "",
      rcNumber: "",
      engineNumber: "",
      chassisNumber: "",
      marketValue: "",
      loanAmount: "",
      docCharges: "",
      ratePctPerAnnum: String(settings.vehicleRatePctPerAnnum),
      legalInterestPct: String(settings.globalLegalInterestRatePct),
      tenureMonths: "36",
      paymentSource: "",
      hypothecation: false,
    },
  });

  const navigate = useNavigate();
  const accounts = useAccounts();
  const values = useWatch({ control });

  /**
   * Scanned legal documents captured at origination. Each slot stores a
   * single base64 dataUrl alongside its original filename and an upload
   * timestamp; on submit we serialise the populated slots into the new
   * loan's `legalDocs` array so Repossession Yard can display them later.
   */
  const [legalDocs, setLegalDocs] = useState<
    Partial<Record<LegalDocType, LegalDoc>>
  >({});

  /**
   * Success ticket — when populated, opens a modal showing the new vehicle
   * loan summary plus a QR code (loanId + customer + product) the operator
   * can stick on the physical file or share with the customer. Cleared by
   * the dialog close action.
   */
  const [successTicket, setSuccessTicket] = useState<{
    loanId: string;
    customer: string;
    customerCode: string;
    netDisbursement: number;
    sourceAccount: string;
    vehicleSummary: string;
    rcNumber: string;
  } | null>(null);

  const handleDocUpload = async (
    type: LegalDocType,
    file: File | null,
  ): Promise<void> => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Document too large — please attach a file under 4 MB.");
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onerror = () => reject(fr.error ?? new Error("read failed"));
        fr.onload = () => resolve(String(fr.result ?? ""));
        fr.readAsDataURL(file);
      });
      setLegalDocs((prev) => ({
        ...prev,
        [type]: {
          type,
          name: file.name,
          dataUrl,
          uploadedAtIso: new Date().toISOString(),
        },
      }));
    } catch {
      toast.error("Could not read the selected file. Please try again.");
    }
  };

  const removeDoc = (type: LegalDocType) =>
    setLegalDocs((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
  const selectedCustomer = useMemo(
    () => verifiedCustomers.find((c) => c.id === values.customerId),
    [values.customerId, verifiedCustomers],
  );

  const marketValue = toNum(values.marketValue);
  const loanAmount = toNum(values.loanAmount);
  // Auto-derived processing fee — Settings → Rates & Fees is the single
  // source of truth for the per-₹1,000 slab.
  const rtoFee = computeProcessingFee({
    loanAmount,
    feePerThousand: settings.processingFeePer1000,
  });
  const docCharges = toNum(values.docCharges);
  const tenureMonths = toNum(values.tenureMonths);
  const startIso = todayIso();
  const maturityIso = tenureMonths > 0 ? addMonthsIso(startIso, tenureMonths) : "";

  const ltv = marketValue > 0 ? (loanAmount / marketValue) * 100 : 0;
  const netDisbursement = Math.max(loanAmount - rtoFee - docCharges, 0);

  const ltvBand =
    ltv === 0
      ? { label: "Awaiting Inputs", bg: "rgba(100,116,139,0.10)", fg: "#475569", border: "rgba(100,116,139,0.30)" }
      : ltv <= 70
        ? { label: "Healthy LTV", bg: "rgba(16,185,129,0.12)", fg: "#047857", border: "rgba(16,185,129,0.35)" }
        : ltv <= 85
          ? { label: "Moderate LTV", bg: "rgba(234,179,8,0.16)", fg: "#a16207", border: "rgba(234,179,8,0.40)" }
          : { label: "High LTV — Review", bg: "rgba(244,63,94,0.12)", fg: "#be123c", border: "rgba(244,63,94,0.35)" };

  const onSubmit = (data: VehicleForm) => {
    if (!data.customerId) {
      toast.error("Please select a KYC-verified customer.");
      return;
    }
    if (!data.vehicleType) {
      toast.error("Please choose a vehicle type.");
      return;
    }
    if (!data.rcNumber || !data.chassisNumber) {
      toast.error("RC number and chassis number are required.");
      return;
    }
    if (marketValue <= 0 || loanAmount <= 0) {
      toast.error("Market value and requested loan amount must be greater than zero.");
      return;
    }
    if (ltv > 100) {
      toast.error("Loan amount cannot exceed market value (LTV > 100%).");
      return;
    }
    if (docCharges < 0) {
      toast.error("Documentation charges cannot be negative.");
      return;
    }
    if (loanAmount - rtoFee - docCharges <= 0) {
      toast.error("Fees and charges cannot meet or exceed the loan amount — net disbursement must be positive.");
      return;
    }
    const ratePct = toNum(data.ratePctPerAnnum);
    if (ratePct <= 0 || ratePct > 60) {
      toast.error("Interest rate must be between 0 and 60% per annum.");
      return;
    }
    if (tenureMonths <= 0 || tenureMonths > 84) {
      toast.error("Tenure must be between 1 and 84 months.");
      return;
    }
    if (!data.paymentSource) {
      toast.error("Please choose the source account from which the loan will be disbursed.");
      return;
    }
    if (!data.hypothecation) {
      toast.error("RTO Hypothecation endorsement is mandatory before generating the agreement.");
      return;
    }
    // All four legal documents are mandatory before disbursement so the
    // Repossession Yard always has a complete folio to work from.
    const requiredDocs: LegalDocType[] = [
      "RC",
      "INSURANCE",
      "AGREEMENT",
      "PERMIT",
    ];
    const missingDoc = requiredDocs.find((t) => !legalDocs[t]);
    if (missingDoc) {
      toast.error(
        `Attach all four legal documents before disbursing — missing ${LEGAL_DOC_LABELS[missingDoc]}.`,
      );
      return;
    }

    // Day-lock precheck — never let a disbursement post into a frozen day.
    if (isDateLocked(startIso)) {
      toast.error(
        "Today's Daybook is locked — unlock it before disbursing a new vehicle loan.",
      );
      return;
    }

    // Generate a stable VEH-NNNNN id following the same shape as PWN ids
    // already in the seed (`VEH-30091`, etc.).
    const loanId = `VEH-${Math.floor(100000 + Math.random() * 899999)}`;
    const vehicleTypeLabel =
      data.vehicleType === "TWO_WHEELER"
        ? "2W"
        : data.vehicleType === "FOUR_WHEELER"
          ? "4W"
          : "Comm";

    // 1) Persist the loan in the global store so it appears in
    //    Loan Management, Customer 360, and Vehicle Reports.
    addLoan({
      id: loanId,
      product: "VEHICLE",
      customer: selectedCustomer?.name ?? "Unknown",
      customerCode: data.customerId,
      principal: loanAmount,
      ratePctPerAnnum: ratePct,
      startedAtIso: startIso,
      durationLabel: `${tenureMonths} months`,
      maturityIso,
      status: "ACTIVE",
      disbursedFromAccountId: data.paymentSource,
      legalInterestPct: parseFloat(data.legalInterestPct || "0") || undefined,
      vehicleDetails: {
        makeModel: data.makeModel || vehicleTypeLabel,
        regNo: data.rcNumber,
        year: data.year || undefined,
        vehicleType: data.vehicleType as VehicleType,
      },
      notes: `Hypothecation endorsed. Engine: ${data.engineNumber || "—"} / Chassis: ${data.chassisNumber}.`,
      legalDocs: requiredDocs
        .map((t) => legalDocs[t])
        .filter((d): d is LegalDoc => d !== undefined),
    });

    // 2) Post the actual cash movement so the chosen account balance
    //    drops by the net disbursement on the Settings → Accounts tab.
    //    If the daybook write fails for any reason (day-lock race, etc.)
    //    roll back the loan so the books never carry an orphan disbursement.
    try {
      addDaybookEntry({
        dateIso: startIso,
        time: timeNow(),
        side: "DEBIT",
        category: "Loan Disbursement",
        particulars: `${selectedCustomer?.name ?? "Customer"} — ${data.makeModel || "Vehicle"} loan disbursed`,
        refId: loanId,
        account: data.paymentSource,
        amount: netDisbursement,
        customerName: selectedCustomer?.name,
        customerId: data.customerId,
      });
    } catch (err) {
      deleteLoan(loanId);
      if (err instanceof DayLockedError) {
        toast.error(
          "Today's Daybook is locked — unlock it before disbursing a new vehicle loan.",
        );
        return;
      }
      throw err;
    }

    try {
      logActivity({
        actor: getCurrentActor(),
        kind: "LOAN",
        summary: `Vehicle loan ${loanId} disbursed — ${selectedCustomer?.name ?? "Customer"} · ₹${loanAmount.toLocaleString("en-IN")}`,
        link: `/loans/${loanId}`,
      });
    } catch {
      /* best effort */
    }

    setSuccessTicket({
      loanId,
      customer: selectedCustomer?.name ?? "Customer",
      customerCode: data.customerId,
      netDisbursement,
      sourceAccount:
        accounts.find((a) => a.id === data.paymentSource)?.name ??
        data.paymentSource,
      vehicleSummary: `${data.makeModel || vehicleTypeLabel}${data.year ? ` · ${data.year}` : ""
        }`,
      rcNumber: data.rcNumber,
    });
    reset();
    setLegalDocs({});
  };

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{
              background: "rgba(59,130,246,0.14)",
              boxShadow: "inset 0 0 0 1px rgba(59,130,246,0.30)",
            }}
          >
            <Car className="h-6 w-6" style={{ color: "#1d4ed8" }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold tracking-tight text-slate-900"
            >
              Vehicle Loan Origination
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Capture KYC, asset details, valuation, and hypothecation in a single workflow.
            </p>
          </div>
        </div>

        <div
          className="flex items-center gap-3 rounded-xl border bg-white px-4 py-2.5 text-sm"
          style={{ borderColor: "rgba(74,111,165,0.18)" }}
        >
          <Gauge className="h-4 w-4" style={{ color: "var(--brand-primary)" }} />
          <span className="text-slate-500">Live LTV</span>
          <span
            className="font-bold"
            style={{ color: "var(--brand-primary)" }}
          >
            {ltv.toFixed(1)}%
          </span>
          <span className="h-5 w-px bg-slate-200" />
          <span className="text-slate-500">Net Disbursement</span>
          <span
            className="font-semibold"
            style={{ color: "var(--brand-primary)" }}
          >
            {inr(netDisbursement)}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* ----- LEFT COLUMN ----- */}
          <div className="space-y-6">
            {/* Customer & KYC */}
            <Card className="border bg-white" style={{ borderColor: "rgba(74,111,165,0.12)" }}>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ background: "var(--brand-light)" }}
                  >
                    <UserRoundCheck className="h-5 w-5" style={{ color: "var(--brand-primary)" }} />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold text-slate-900">
                      Customer &amp; KYC
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-500">
                      Borrower identification verified through Global Customers.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Customer Search
                  </Label>
                  <Select
                    value={values.customerId || ""}
                    onValueChange={(v) => setValue("customerId", v, { shouldDirty: true })}
                    disabled={verifiedCustomers.length === 0}
                  >
                    <SelectTrigger
                      className="h-11 w-full bg-white"
                      style={inputBaseStyle}
                      aria-label="Customer Search"
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
                        Global Customers before disbursing a vehicle loan.
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
              </CardContent>
            </Card>

            {/* Vehicle Asset Details */}
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
                      Vehicle Asset Details
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-500">
                      Identification stamped on the RC, engine, and chassis.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Vehicle Type */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Vehicle Type
                  </Label>
                  <Select
                    value={values.vehicleType || ""}
                    onValueChange={(v) => setValue("vehicleType", v as VehicleType, { shouldDirty: true })}
                  >
                    <SelectTrigger
                      className="h-11 w-full bg-white"
                      style={inputBaseStyle}
                      aria-label="Vehicle Type"
                    >
                      <SelectValue placeholder="Choose vehicle category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {VEHICLE_TYPES.map((vt) => {
                        const Icon = vt.icon;
                        return (
                          <SelectItem key={vt.value} value={vt.value}>
                            <div className="flex items-center gap-2.5">
                              <Icon className="h-4 w-4" style={{ color: "var(--brand-primary)" }} />
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">{vt.label}</span>
                                <span className="text-xs text-slate-500">{vt.sub}</span>
                              </div>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Make &amp; Model" htmlFor="makeModel" error={errors.makeModel?.message}>
                    <Input
                      id="makeModel"
                      placeholder="e.g., Hyundai Creta SX"
                      style={inputBaseStyle}
                      className="h-11"
                      {...register("makeModel", { required: "Make & model is required" })}
                    />
                  </Field>

                  <Field label="Year of Manufacture" htmlFor="year" error={errors.year?.message}>
                    <Input
                      id="year"
                      type="number"
                      inputMode="numeric"
                      placeholder="e.g., 2023"
                      style={inputBaseStyle}
                      className="h-11"
                      {...register("year", {
                        required: "Year is required",
                        pattern: { value: /^(19|20)\d{2}$/, message: "Enter a valid 4-digit year" },
                      })}
                    />
                  </Field>

                  <Field label="Registration Number (RC)" htmlFor="rcNumber" error={errors.rcNumber?.message}>
                    <Input
                      id="rcNumber"
                      placeholder="KA01AB1234"
                      style={inputBaseStyle}
                      className="h-11 font-mono uppercase tracking-wide"
                      {...register("rcNumber", { required: "RC number is required" })}
                    />
                  </Field>

                  <Field label="Engine Number" htmlFor="engineNumber" error={errors.engineNumber?.message}>
                    <Input
                      id="engineNumber"
                      placeholder="ENG number stamped on block"
                      style={inputBaseStyle}
                      className="h-11 font-mono uppercase tracking-wide"
                      {...register("engineNumber")}
                    />
                  </Field>

                  <div className="md:col-span-2">
                    <Field
                      label="Chassis Number"
                      htmlFor="chassisNumber"
                      error={errors.chassisNumber?.message}
                    >
                      <Input
                        id="chassisNumber"
                        placeholder="VIN / Chassis identifier"
                        style={inputBaseStyle}
                        className="h-11 font-mono uppercase tracking-wide"
                        {...register("chassisNumber", { required: "Chassis number is required" })}
                      />
                    </Field>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ----- RIGHT COLUMN ----- */}
          <div className="space-y-6">
            <Card className="border bg-white" style={{ borderColor: "rgba(74,111,165,0.12)" }}>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ background: "var(--brand-light)" }}
                  >
                    <Calculator className="h-5 w-5" style={{ color: "var(--brand-primary)" }} />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold text-slate-900">
                      Valuation &amp; Disbursement
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-500">
                      Live LTV and net payout recompute as you type.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field
                    label="Estimated Market Value (₹)"
                    htmlFor="marketValue"
                    error={errors.marketValue?.message}
                  >
                    <RupeeInput
                      id="marketValue"
                      placeholder="e.g., 8,50,000"
                      {...register("marketValue", {
                        required: "Market value is required",
                        validate: (v) =>
                          toNum(v) > 0 || "Market value must be greater than zero",
                      })}
                    />
                  </Field>

                  <Field
                    label="Requested Loan Amount (₹)"
                    htmlFor="loanAmount"
                    error={errors.loanAmount?.message}
                  >
                    <RupeeInput
                      id="loanAmount"
                      placeholder="e.g., 6,00,000"
                      {...register("loanAmount", {
                        required: "Loan amount is required",
                        validate: (v) =>
                          toNum(v) > 0 || "Loan amount must be greater than zero",
                      })}
                    />
                  </Field>
                </div>

                {/* Auto-calc: LTV */}
                <div
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: "rgba(74,111,165,0.15)",
                    background: "rgba(191,221,245,0.18)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        LTV (Loan-to-Value) Ratio
                      </p>
                      <p
                        className="mt-1 text-2xl font-bold leading-tight"
                        style={{ color: "var(--brand-primary)" }}
                      >
                        {ltv.toFixed(1)}
                        <span className="ml-1 text-base font-semibold text-slate-500">%</span>
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        (Requested Loan ÷ Market Value) × 100
                      </p>
                    </div>
                    <span
                      className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
                      style={{
                        background: ltvBand.bg,
                        color: ltvBand.fg,
                        borderColor: ltvBand.border,
                      }}
                    >
                      {ltvBand.label}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field
                    label="Processing Fee (auto)"
                    htmlFor="processingFeeAuto"
                  >
                    <div
                      className="flex h-10 items-center justify-between rounded-md border bg-slate-50 px-3"
                      style={{ borderColor: "rgba(74,111,165,0.20)" }}
                    >
                      <span className="text-xs text-slate-500">
                        ₹{settings.processingFeePer1000} × (Loan ÷ 1,000)
                      </span>
                      <span
                        className="text-sm font-semibold"
                        style={{ color: "var(--brand-primary)" }}
                      >
                        {inr(rtoFee)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      From Settings → Rates &amp; Fees.
                    </p>
                  </Field>

                  <Field
                    label="Documentation Charges (₹)"
                    htmlFor="docCharges"
                    error={errors.docCharges?.message}
                  >
                    <RupeeInput
                      id="docCharges"
                      placeholder="e.g., 2,500"
                      {...register("docCharges")}
                    />
                  </Field>
                </div>

                {/* Auto-calc: Net Disbursement (prominent) */}
                <div
                  className="rounded-xl border p-5 shadow-sm"
                  style={{
                    borderColor: "rgba(74,111,165,0.30)",
                    background:
                      "linear-gradient(135deg, rgba(191,221,245,0.45) 0%, rgba(137,207,240,0.25) 100%)",
                  }}
                >
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4" style={{ color: "var(--brand-primary)" }} />
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                          Net Disbursement Amount
                        </p>
                      </div>
                      <p
                        className="mt-1 text-3xl font-extrabold leading-tight tracking-tight"
                        style={{ color: "var(--brand-primary)" }}
                      >
                        {inr(netDisbursement)}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Loan Amount − Processing Fee − Documentation Charges
                      </p>
                    </div>

                    <BreakdownPill
                      loanAmount={loanAmount}
                      rtoFee={rtoFee}
                      docCharges={docCharges}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ----- LOAN TERMS + DISBURSEMENT SOURCE ----- */}
        <Card className="border bg-white" style={{ borderColor: "rgba(74,111,165,0.12)" }}>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: "var(--brand-light)" }}
              >
                <CalendarClock className="h-5 w-5" style={{ color: "var(--brand-primary)" }} />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  Loan Terms &amp; Disbursement Source
                </CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  Sets repayment schedule and the account that funds the disbursement.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Field label="Interest Rate (% p.a.)" htmlFor="ratePctPerAnnum">
              <div className="relative">
                <Percent
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                />
                <Input
                  id="ratePctPerAnnum"
                  type="number"
                  step="0.5"
                  min="0"
                  max="60"
                  className="h-11 pl-9 text-base"
                  placeholder="13"
                  style={inputBaseStyle}
                  {...register("ratePctPerAnnum")}
                />
              </div>
            </Field>
            <Field
              label="Legal Interest Component (%)"
              htmlFor="legalInterestPct"
            >
              <div className="relative">
                <Percent
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                />
                <Input
                  id="legalInterestPct"
                  type="number"
                  step="0.1"
                  min="0"
                  max="60"
                  className="h-11 pl-9 text-base"
                  placeholder="12"
                  style={inputBaseStyle}
                  {...register("legalInterestPct")}
                />
              </div>
            </Field>
            <Field label="Tenure (months)" htmlFor="tenureMonths">
              <Input
                id="tenureMonths"
                type="number"
                step="1"
                min="1"
                max="84"
                className="h-11 text-base"
                placeholder="36"
                style={inputBaseStyle}
                {...register("tenureMonths")}
              />
            </Field>
            <Field label="Maturity Date" htmlFor="maturityIso">
              <Input
                id="maturityIso"
                type="date"
                value={maturityIso}
                readOnly
                className="h-11 bg-slate-50 text-base"
                style={inputBaseStyle}
              />
            </Field>
            <Field label="Disburse From" htmlFor="paymentSource">
              <Select
                value={values.paymentSource || ""}
                onValueChange={(v) =>
                  setValue("paymentSource", v, { shouldDirty: true })
                }
              >
                <SelectTrigger
                  id="paymentSource"
                  className="h-11 w-full bg-white text-base"
                  style={inputBaseStyle}
                  aria-label="Source Account"
                >
                  <SelectValue placeholder="Select account..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{a.name}</span>
                        {a.subtitle ? (
                          <span className="text-xs text-slate-500">
                            {a.subtitle}
                          </span>
                        ) : null}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </CardContent>
        </Card>

        {/* ----- LEGAL DOCUMENTS ----- */}
        <Card
          className="border bg-white"
          style={{ borderColor: "rgba(74,111,165,0.12)" }}
        >
          <CardHeader>
            <div className="flex items-start gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: "var(--brand-light)" }}
              >
                <Paperclip
                  className="h-5 w-5"
                  style={{ color: "var(--brand-primary)" }}
                />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  Legal Documents
                </CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  Attach scanned copies of all four documents. Repossession
                  Yard reads these directly from the loan record.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {LEGAL_DOC_ORDER.map((type) => {
                const doc = legalDocs[type];
                const inputId = `legal-doc-${type}`;
                return (
                  <div
                    key={type}
                    className="flex flex-col gap-2 rounded-lg border bg-white p-3"
                    style={{
                      borderColor: doc
                        ? "rgba(16,185,129,0.40)"
                        : "rgba(74,111,165,0.18)",
                      backgroundColor: doc
                        ? "rgba(16,185,129,0.04)"
                        : "white",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileText
                          size={16}
                          style={{
                            color: doc
                              ? "#047857"
                              : "var(--brand-primary)",
                          }}
                        />
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {LEGAL_DOC_LABELS[type]}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {LEGAL_DOC_HINTS[type]}
                          </div>
                        </div>
                      </div>
                      {doc ? (
                        <FileCheck2
                          size={16}
                          className="shrink-0"
                          style={{ color: "#047857" }}
                        />
                      ) : null}
                    </div>

                    {doc ? (
                      <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-white px-2.5 py-1.5">
                        <span className="truncate text-xs font-medium text-slate-700">
                          {doc.name}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${LEGAL_DOC_LABELS[type]}`}
                          onClick={() => removeDoc(type)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <label
                        htmlFor={inputId}
                        className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        style={{ borderColor: "rgba(74,111,165,0.30)" }}
                      >
                        <UploadCloud size={14} />
                        Upload file (PDF / image)
                      </label>
                    )}
                    <input
                      id={inputId}
                      type="file"
                      accept="application/pdf,image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        void handleDocUpload(type, f);
                        e.target.value = "";
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ----- HYPOTHECATION + ACTION ----- */}
        <Card className="border bg-white" style={{ borderColor: "rgba(74,111,165,0.12)" }}>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: "var(--brand-light)" }}
              >
                <ShieldCheck className="h-5 w-5" style={{ color: "var(--brand-primary)" }} />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  Hypothecation Status
                </CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  RTO endorsement is mandatory before disbursing any vehicle loan.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <HypothecationToggle control={control} setValue={setValue} />

            <div className="flex flex-col items-stretch gap-3 border-t pt-5 md:flex-row md:items-center md:justify-between"
              style={{ borderColor: "rgba(74,111,165,0.10)" }}
            >
              <div className="text-xs text-slate-500">
                Submitting will lock the LTV, generate the agreement, and queue the disbursement.
              </div>
              <Button
                type="submit"
                size="lg"
                className="h-12 w-full gap-2 px-8 text-base font-semibold text-white shadow-md md:w-auto"
                style={{ background: "var(--brand-primary)" }}
              >
                <FileSignature className="h-5 w-5" />
                Generate Vehicle Loan Agreement
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Success dialog with QR + Print Tag */}
      <Dialog
        open={successTicket !== null}
        onOpenChange={(open) => {
          if (!open) setSuccessTicket(null);
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          data-testid="dialog-vehicle-success"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2
                className="h-5 w-5"
                style={{ color: "#047857" }}
              />
              Vehicle loan disbursed
            </DialogTitle>
            <DialogDescription>
              Scan the QR for the loan reference, or print the tag for the
              physical file jacket.
            </DialogDescription>
          </DialogHeader>

          {successTicket && (
            <div className="grid gap-4 py-2 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="space-y-1.5 text-sm">
                <p className="font-mono text-base font-bold" style={{ color: "var(--brand-primary)" }}>
                  {successTicket.loanId}
                </p>
                <p className="text-slate-700">{successTicket.customer}</p>
                <p className="text-xs text-slate-500">
                  {successTicket.vehicleSummary}
                  {successTicket.rcNumber ? ` · ${successTicket.rcNumber}` : ""}
                </p>
                <p className="text-xs text-slate-500">
                  Disbursed{" "}
                  <span className="font-semibold text-slate-800">
                    {inr(successTicket.netDisbursement)}
                  </span>{" "}
                  from {successTicket.sourceAccount}
                </p>
              </div>
              <div
                className="flex flex-col items-center gap-1 rounded-lg border bg-white p-3"
                style={{ borderColor: "rgba(74,111,165,0.18)" }}
              >
                <QRCodeSVG
                  value={JSON.stringify({
                    type: "kittangi.vehicle.loan",
                    loanId: successTicket.loanId,
                    customer: successTicket.customer,
                    rc: successTicket.rcNumber,
                  })}
                  size={108}
                  level="M"
                  includeMargin={false}
                />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <QrCode className="mr-1 inline h-3 w-3" />
                  Loan QR
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!successTicket) return;
                openLockerTagPrintWindow({
                  packageId: successTicket.loanId,
                  loanId: successTicket.loanId,
                  customerName: successTicket.customer,
                  safeName: "Vehicle File",
                  lockerId: successTicket.rcNumber || successTicket.loanId,
                });
              }}
              className="gap-2"
              data-testid="button-vehicle-print-tag"
            >
              <Printer className="h-4 w-4" />
              Print Tag
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSuccessTicket(null)}
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (!successTicket) return;
                  const id = successTicket.loanId;
                  setSuccessTicket(null);
                  navigate(`/loans/${id}`);
                }}
                style={{ background: "var(--brand-primary)", color: "#fff" }}
              >
                View Loan
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  htmlFor: string;
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

function BreakdownPill({
  loanAmount,
  rtoFee,
  docCharges,
}: {
  loanAmount: number;
  rtoFee: number;
  docCharges: number;
}) {
  if (loanAmount <= 0) return null;
  return (
    <div
      className="rounded-lg border bg-white/70 px-3 py-2 text-[11px]"
      style={{ borderColor: "rgba(74,111,165,0.18)" }}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-500">Loan</span>
        <span className="font-semibold text-slate-700">{inr(loanAmount)}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-500">− Processing Fee</span>
        <span className="font-semibold text-slate-700">{inr(rtoFee)}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-500">− Doc Charges</span>
        <span className="font-semibold text-slate-700">{inr(docCharges)}</span>
      </div>
    </div>
  );
}

function HypothecationToggle({
  control,
  setValue,
}: {
  control: Control<VehicleForm>;
  setValue: (name: "hypothecation", value: boolean) => void;
}) {
  const checked = !!useWatch({ control, name: "hypothecation" });

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4"
      style={{
        borderColor: checked ? "rgba(16,185,129,0.40)" : "rgba(74,111,165,0.20)",
        background: checked ? "rgba(16,185,129,0.06)" : "var(--bg-main)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{
            background: checked ? "rgba(16,185,129,0.15)" : "rgba(74,111,165,0.10)",
          }}
        >
          <ShieldCheck
            className="h-5 w-5"
            style={{ color: checked ? "#047857" : "var(--brand-primary)" }}
          />
        </div>
        <div>
          <Label htmlFor="hypothecation" className="text-sm font-semibold text-slate-900">
            RTO Hypothecation Endorsed
          </Label>
          <p className="text-xs text-slate-500">
            Confirms the lender's lien is recorded against the RC at the regional transport office.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
          style={{
            background: checked ? "rgba(16,185,129,0.12)" : "rgba(100,116,139,0.12)",
            color: checked ? "#047857" : "#475569",
          }}
        >
          {checked ? "Endorsed" : "Pending"}
        </span>
        <Switch
          id="hypothecation"
          checked={checked}
          onCheckedChange={(v) => setValue("hypothecation", v)}
        />
      </div>
    </div>
  );
}
