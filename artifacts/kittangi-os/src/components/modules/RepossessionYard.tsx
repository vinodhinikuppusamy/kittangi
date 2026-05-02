import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bike,
  Calendar,
  Camera,
  Car,
  Download,
  FileText,
  FileWarning,
  Gavel,
  IndianRupee,
  Layers,
  Search,
  ShieldAlert,
  Sparkles,
  Truck,
  User,
  Wallet,
  Warehouse,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchAll } from "@/lib/stores/apiSync";
import { type LegalDoc, type LegalDocType } from "@/lib/stores/loansStore";

const LEGAL_DOC_LABELS: Record<LegalDocType, string> = {
  RC: "RC Book",
  INSURANCE: "Insurance Policy",
  AGREEMENT: "Loan Agreement",
  PERMIT: "Permits / Fitness",
};

type VehicleType = "TWO_WHEELER" | "FOUR_WHEELER" | "COMMERCIAL";
type YardStatus = "SEIZED" | "LEGAL_HOLD" | "AUCTION_READY";

type SeizedVehicle = {
  id: string;
  loanId: string;
  customer: string;
  makeModel: string;
  rcNumber: string;
  vehicleType: VehicleType;
  status: YardStatus;
  seizedOn: string;
  outstandingDues: number;
  estimatedRecovery: number;
  yardBay: string;
  legalDocs: LegalDoc[];
};

type ApiYardStatus = YardStatus | (string & {});

type ApiRepossessionDetails = {
  id?: string;
  status?: ApiYardStatus;
  seizedOnIso?: string;
  seizedOn?: string;
  outstandingDues?: number;
  estimatedRecovery?: number;
  yardBay?: string;
};

type ApiVehicleDetails = {
  makeModel?: string;
  regNo?: string;
  vehicleType?: VehicleType | (string & {});
};

type ApiRepossessionLoan = {
  id: string;
  product: "VEHICLE" | "PAWN" | "DOCUMENT";
  customer: string;
  principal: number;
  accruedInterest?: number;
  startedAtIso?: string;
  vehicleDetails?: ApiVehicleDetails;
  legalDocs?: LegalDoc[];
  repossessionDetails?: ApiRepossessionDetails;
};

const STATUS_META: Record<
  YardStatus,
  { label: string; bg: string; fg: string; border: string; dot: string }
> = {
  SEIZED: {
    label: "Seized",
    bg: "rgba(100,116,139,0.92)",
    fg: "#ffffff",
    border: "rgba(100,116,139,0.30)",
    dot: "#94a3b8",
  },
  LEGAL_HOLD: {
    label: "Legal Hold",
    bg: "rgba(234,179,8,0.95)",
    fg: "#3f2d04",
    border: "rgba(234,179,8,0.45)",
    dot: "#eab308",
  },
  AUCTION_READY: {
    label: "Auction Ready",
    bg: "rgba(220,38,38,0.95)",
    fg: "#ffffff",
    border: "rgba(220,38,38,0.45)",
    dot: "#dc2626",
  },
};

const VEHICLE_TYPE_META: Record<
  VehicleType,
  { label: string; icon: typeof Car }
> = {
  TWO_WHEELER: { label: "2-Wheeler", icon: Bike },
  FOUR_WHEELER: { label: "4-Wheeler", icon: Car },
  COMMERCIAL: { label: "Commercial", icon: Truck },
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

function normalizeYardStatus(value: unknown): YardStatus {
  if (value === "SEIZED" || value === "LEGAL_HOLD" || value === "AUCTION_READY") {
    return value;
  }
  return "SEIZED";
}

function normalizeVehicleType(value: unknown): VehicleType {
  if (value === "TWO_WHEELER" || value === "FOUR_WHEELER" || value === "COMMERCIAL") {
    return value;
  }
  return "FOUR_WHEELER";
}

function formatYardDate(isoOrRaw: string | undefined, fallbackIso: string | undefined): string {
  const raw = (isoOrRaw ?? "").trim();
  const candidate = raw || (fallbackIso ?? "").trim();
  if (!candidate) return "-";
  const d = new Date(candidate);
  if (Number.isNaN(d.getTime())) return candidate;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function mapApiLoanToSeizedVehicle(loan: ApiRepossessionLoan): SeizedVehicle {
  const details = loan.repossessionDetails ?? {};
  const vehicle = loan.vehicleDetails ?? {};
  const outstanding =
    typeof details.outstandingDues === "number"
      ? details.outstandingDues
      : Math.max(0, (loan.principal || 0) + (loan.accruedInterest || 0));
  const estimatedRecovery =
    typeof details.estimatedRecovery === "number"
      ? details.estimatedRecovery
      : outstanding;

  return {
    id: details.id?.trim() || `RPV-${loan.id}`,
    loanId: loan.id,
    customer: loan.customer,
    makeModel: vehicle.makeModel?.trim() || "Vehicle",
    rcNumber: vehicle.regNo?.trim() || "RC Pending",
    vehicleType: normalizeVehicleType(vehicle.vehicleType),
    status: normalizeYardStatus(details.status),
    seizedOn: formatYardDate(details.seizedOnIso ?? details.seizedOn, loan.startedAtIso),
    outstandingDues: outstanding,
    estimatedRecovery,
    yardBay: details.yardBay?.trim() || "Unassigned",
    legalDocs: Array.isArray(loan.legalDocs) ? loan.legalDocs : [],
  };
}

export default function RepossessionYard() {
  const [search, setSearch] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType | "ALL">("ALL");
  const [status, setStatus] = useState<YardStatus | "ALL">("ALL");
  const [seizedVehicles, setSeizedVehicles] = useState<SeizedVehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadFromBackend = async () => {
      setLoading(true);
      const rows = await fetchAll<ApiRepossessionLoan>("/loans/repossession-yard");
      if (cancelled) return;
      setSeizedVehicles((rows ?? []).map(mapApiLoanToSeizedVehicle));
      setLoading(false);
    };
    void loadFromBackend();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return seizedVehicles.filter((v) => {
      if (vehicleType !== "ALL" && v.vehicleType !== vehicleType) return false;
      if (status !== "ALL" && v.status !== status) return false;
      if (!q) return true;
      return (
        v.rcNumber.toLowerCase().includes(q) ||
        v.makeModel.toLowerCase().includes(q) ||
        v.customer.toLowerCase().includes(q) ||
        v.loanId.toLowerCase().includes(q)
      );
    });
  }, [search, vehicleType, status, seizedVehicles]);

  const stats = useMemo(() => {
    const total = seizedVehicles.length;
    const legal = seizedVehicles.filter((v) => v.status === "LEGAL_HOLD").length;
    const auction = seizedVehicles.filter((v) => v.status === "AUCTION_READY").length;
    const recovery = seizedVehicles.reduce((s, v) => s + v.estimatedRecovery, 0);
    return { total, legal, auction, recovery };
  }, [seizedVehicles]);

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* ===== Page Header ===== */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ background: "var(--brand-light)" }}
          >
            <Warehouse className="h-6 w-6" style={{ color: "var(--brand-primary)" }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: "var(--brand-primary)" }}
            >
              Repossession Yard (Seized Assets)
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Live inventory of repossessed vehicles, legal status, and recovery pipeline.
            </p>
          </div>
        </div>

        <div
          className="flex items-center gap-3 rounded-xl border bg-white px-4 py-2.5 text-sm"
          style={{ borderColor: "rgba(74,111,165,0.18)" }}
        >
          <Layers className="h-4 w-4" style={{ color: "var(--brand-primary)" }} />
          <span className="text-slate-500">Showing</span>
          <span className="font-semibold" style={{ color: "var(--brand-primary)" }}>
            {filtered.length}
          </span>
          <span className="text-slate-500">of {seizedVehicles.length} units</span>
        </div>
      </div>

      {/* ===== Top-Level Metrics ===== */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Vehicles Seized"
          value={stats.total.toString()}
          sub="All units across all yard bays"
          icon={Warehouse}
        />
        <StatCard
          label="Pending Legal Clearance"
          value={stats.legal.toString()}
          sub="Awaiting court / RTO orders"
          icon={ShieldAlert}
          tone="amber"
        />
        <StatCard
          label="Ready for Auction"
          value={stats.auction.toString()}
          sub="Cleared for disposal"
          icon={Gavel}
          tone="rose"
        />
        <StatCard
          label="Estimated Recovery Value (₹)"
          value={inr(stats.recovery)}
          sub="Aggregate appraised resale"
          icon={Wallet}
          tone="emerald"
        />
      </div>

      {/* ===== Controls & Filters ===== */}
      <Card className="mb-6 border bg-white" style={{ borderColor: "rgba(74,111,165,0.12)" }}>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by RC, Make/Model, or Customer..."
              className="h-11 pl-9"
              style={inputBaseStyle}
              aria-label="Search seized vehicles"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:flex md:gap-3">
            <Select
              value={vehicleType}
              onValueChange={(v) => setVehicleType(v as VehicleType | "ALL")}
            >
              <SelectTrigger
                className="h-11 w-full bg-white md:w-45"
                style={inputBaseStyle}
                aria-label="Filter by vehicle type"
              >
                <SelectValue placeholder="Vehicle Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Vehicle Types</SelectItem>
                <SelectItem value="TWO_WHEELER">2-Wheeler</SelectItem>
                <SelectItem value="FOUR_WHEELER">4-Wheeler</SelectItem>
                <SelectItem value="COMMERCIAL">Commercial</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={status}
              onValueChange={(v) => setStatus(v as YardStatus | "ALL")}
            >
              <SelectTrigger
                className="h-11 w-full bg-white md:w-45"
                style={inputBaseStyle}
                aria-label="Filter by status"
              >
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="SEIZED">Seized</SelectItem>
                <SelectItem value="LEGAL_HOLD">Legal Hold</SelectItem>
                <SelectItem value="AUCTION_READY">Auction Ready</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ===== Yard Grid ===== */}
      {loading ? (
        <Card className="border bg-white" style={{ borderColor: "rgba(74,111,165,0.12)" }}>
          <CardContent className="p-6 text-sm text-slate-500">
            Loading repossession inventory from backend...
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyYardState onClear={() => { setSearch(""); setVehicleType("ALL"); setStatus("ALL"); }} />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => (
            <YardVehicleCard key={v.id} vehicle={v} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================== */
/*                          subcomponents                          */
/* ============================================================== */

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "brand",
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  tone?: "brand" | "amber" | "rose" | "emerald";
}) {
  const toneMap: Record<string, { bg: string; fg: string }> = {
    brand: { bg: "var(--brand-light)", fg: "var(--brand-primary)" },
    amber: { bg: "rgba(234,179,8,0.16)", fg: "#a16207" },
    rose: { bg: "rgba(244,63,94,0.14)", fg: "#be123c" },
    emerald: { bg: "rgba(16,185,129,0.14)", fg: "#047857" },
  };
  const t = toneMap[tone];
  return (
    <Card className="border bg-white" style={{ borderColor: "rgba(74,111,165,0.12)" }}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {label}
            </p>
            <p
              className="mt-1.5 truncate text-2xl font-bold leading-tight"
              style={{ color: "var(--brand-primary)" }}
              title={value}
            >
              {value}
            </p>
            <p className="mt-1 text-xs text-slate-500">{sub}</p>
          </div>
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{ background: t.bg }}
          >
            <Icon className="h-5 w-5" style={{ color: t.fg }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const LEGAL_DOC_ORDER: LegalDocType[] = [
  "RC",
  "INSURANCE",
  "AGREEMENT",
  "PERMIT",
];

function YardVehicleCard({ vehicle }: { vehicle: SeizedVehicle }) {
  const docsByType = useMemo(() => {
    const map: Partial<Record<LegalDocType, LegalDoc>> = {};
    for (const d of vehicle.legalDocs) map[d.type] = d;
    return map;
  }, [vehicle.legalDocs]);
  const presentCount = LEGAL_DOC_ORDER.filter((t) => docsByType[t]).length;
  const [docsOpen, setDocsOpen] = useState(false);
  const sm = STATUS_META[vehicle.status];
  const tm = VEHICLE_TYPE_META[vehicle.vehicleType];
  const TypeIcon = tm.icon;

  return (
    <Card
      className="overflow-hidden border bg-white transition-shadow hover:shadow-md"
      style={{ borderColor: "rgba(74,111,165,0.14)" }}
    >
      {/* ----- Top half: photo placeholder ----- */}
      <div
        className="relative h-48 w-full overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 50%, #94a3b8 100%)",
        }}
        role="img"
        aria-label={`${vehicle.makeModel} photo placeholder — image pending upload`}
      >
        {/* faux grid texture */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
          aria-hidden
        />

        {/* center icon stack */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-600">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white/70 shadow-sm backdrop-blur"
          >
            <Camera className="h-6 w-6 text-slate-500" />
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 backdrop-blur">
            <TypeIcon className="h-3.5 w-3.5" />
            {tm.label} • Photo Pending
          </div>
        </div>

        {/* status badge (absolute) */}
        <span
          className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide shadow-sm"
          style={{
            background: sm.bg,
            color: sm.fg,
            border: `1px solid ${sm.border}`,
          }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: "currentColor", opacity: 0.85 }}
            aria-hidden
          />
          {sm.label}
        </span>

        {/* yard bay tag (absolute, bottom-left) */}
        <span
          className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-md bg-white/85 px-2 py-0.5 text-[11px] font-semibold backdrop-blur"
          style={{ color: "var(--brand-primary)" }}
        >
          <Warehouse className="h-3 w-3" />
          {vehicle.yardBay}
        </span>
      </div>

      {/* ----- Bottom half: details ----- */}
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="truncate text-base font-semibold text-slate-900" title={vehicle.makeModel}>
          {vehicle.makeModel}
        </CardTitle>
        <CardDescription className="font-mono text-sm font-bold tracking-wide text-slate-700">
          {vehicle.rcNumber}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 pt-0 pb-4">
        <div
          className="grid grid-cols-2 gap-2 rounded-lg border p-2.5 text-[11px]"
          style={{
            borderColor: "rgba(74,111,165,0.12)",
            background: "var(--bg-main)",
          }}
        >
          <DetailRow icon={FileText} label="Loan" value={vehicle.loanId} />
          <DetailRow icon={User} label="Customer" value={vehicle.customer} truncate />
          <DetailRow icon={Calendar} label="Seized On" value={vehicle.seizedOn} />
          <DetailRow
            icon={IndianRupee}
            label="Outstanding"
            value={inr(vehicle.outstandingDues)}
            emphasized
          />
        </div>

        <div className="flex items-center justify-between rounded-md px-1 text-[11px]">
          <span className="text-slate-500">Est. Recovery</span>
          <span className="font-semibold" style={{ color: "var(--brand-primary)" }}>
            {inr(vehicle.estimatedRecovery)}
          </span>
        </div>

        {/* footer actions */}
        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 flex-1 gap-1.5 text-xs"
            style={{
              borderColor: "rgba(74,111,165,0.30)",
              color: "var(--brand-primary)",
            }}
            onClick={() => setDocsOpen(true)}
            title={
              presentCount === 0
                ? "No legal documents on file for this loan"
                : `${presentCount} of 4 documents on file`
            }
          >
            <FileText className="h-3.5 w-3.5" />
            View Legal Docs
            {presentCount > 0 && (
              <span
                className="ml-1 rounded-full px-1.5 py-px text-[10px] font-semibold"
                style={{
                  backgroundColor:
                    presentCount === 4
                      ? "rgba(16,185,129,0.14)"
                      : "rgba(234,179,8,0.18)",
                  color: presentCount === 4 ? "#047857" : "#a16207",
                }}
              >
                {presentCount}/4
              </span>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 flex-1 gap-1.5 text-xs"
            disabled={vehicle.status !== "AUCTION_READY"}
            style={{
              borderColor:
                vehicle.status === "AUCTION_READY"
                  ? "rgba(220,38,38,0.50)"
                  : "rgba(100,116,139,0.30)",
              color:
                vehicle.status === "AUCTION_READY" ? "#be123c" : "#94a3b8",
            }}
            onClick={() =>
              toast.success("Auction scheduled", {
                icon: <Sparkles className="h-4 w-4" />,
                description: `${vehicle.makeModel} (${vehicle.rcNumber}) queued for next auction window.`,
              })
            }
            title={
              vehicle.status === "AUCTION_READY"
                ? "Schedule auction"
                : "Vehicle must be Auction Ready to schedule"
            }
          >
            <Gavel className="h-3.5 w-3.5" />
            Schedule Auction
          </Button>
        </div>
      </CardContent>

      <Dialog open={docsOpen} onOpenChange={setDocsOpen}>
        <DialogContent className="sm:max-w-130">
          <DialogHeader>
            <DialogTitle
              className="flex items-center gap-2 text-base font-semibold"
              style={{ color: "var(--brand-primary)" }}
            >
              <FileText size={16} />
              Legal Documents — {vehicle.loanId}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {vehicle.makeModel} · {vehicle.rcNumber} · {vehicle.customer}
            </DialogDescription>
          </DialogHeader>

          {presentCount === 0 ? (
            <div
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs"
              style={{
                borderColor: "rgba(234,179,8,0.40)",
                backgroundColor: "rgba(234,179,8,0.08)",
                color: "#a16207",
              }}
            >
              <FileWarning size={14} />
              No legal documents were attached at origination for this loan.
            </div>
          ) : (
            <div className="space-y-2">
              {LEGAL_DOC_ORDER.map((type) => {
                const doc = docsByType[type];
                if (!doc) {
                  return (
                    <div
                      key={type}
                      className="flex items-center justify-between rounded-md border bg-white px-3 py-2 text-xs"
                      style={{
                        borderColor: "rgba(100,116,139,0.20)",
                        color: "#94a3b8",
                      }}
                    >
                      <span className="font-medium">
                        {LEGAL_DOC_LABELS[type]}
                      </span>
                      <span className="text-[11px] italic">Not on file</span>
                    </div>
                  );
                }
                return (
                  <div
                    key={type}
                    className="flex items-center justify-between gap-2 rounded-md border bg-white px-3 py-2"
                    style={{ borderColor: "rgba(16,185,129,0.30)" }}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900">
                        {LEGAL_DOC_LABELS[type]}
                      </div>
                      <div className="truncate text-[11px] text-slate-500">
                        {doc.name} ·{" "}
                        {new Date(doc.uploadedAtIso).toLocaleDateString(
                          "en-IN",
                          { day: "2-digit", month: "short", year: "numeric" },
                        )}
                      </div>
                    </div>
                    <a
                      href={doc.dataUrl}
                      download={doc.name}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium hover:bg-slate-50"
                      style={{
                        borderColor: "rgba(74,111,165,0.35)",
                        color: "var(--brand-primary)",
                      }}
                    >
                      <Download size={12} />
                      Open
                    </a>
                  </div>
                );
              })}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDocsOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  truncate,
  emphasized,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  truncate?: boolean;
  emphasized?: boolean;
}) {
  return (
    <div className="flex items-start gap-1.5">
      <Icon className="mt-0.5 h-3 w-3 shrink-0" style={{ color: "var(--brand-primary)" }} />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
        <div
          className={`text-[11px] ${emphasized ? "font-semibold text-slate-900" : "font-medium text-slate-700"} ${truncate ? "truncate" : ""}`}
          title={truncate ? value : undefined}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function EmptyYardState({ onClear }: { onClear: () => void }) {
  return (
    <Card className="border bg-white" style={{ borderColor: "rgba(74,111,165,0.12)" }}>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: "var(--brand-light)" }}
        >
          <Wrench className="h-7 w-7" style={{ color: "var(--brand-primary)" }} />
        </div>
        <div>
          <p className="text-base font-semibold text-slate-800">No seized vehicles match these filters</p>
          <p className="mt-1 text-sm text-slate-500">
            Try a different search term or reset the filters to see the full yard.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClear}
          style={{ borderColor: "rgba(74,111,165,0.30)", color: "var(--brand-primary)" }}
        >
          Clear filters
        </Button>
      </CardContent>
    </Card>
  );
}
