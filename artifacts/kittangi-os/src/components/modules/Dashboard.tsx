import { useOutletContext } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Banknote,
  Car,
  Coins,
  Gauge,
  Gavel,
  Landmark,
  LayoutDashboard,
  Receipt,
  Sparkles,
  Target,
  TrendingUp,
  Vault,
  Wallet,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Vertical } from "@/lib/navigation";

type Tone = "brand" | "amber" | "rose" | "emerald" | "sky";

type StatCardData = {
  label: string;
  value: string;
  sub: string;
  delta?: { value: string; positive?: boolean };
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  tone?: Tone;
};

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

const PAWN_STATS: StatCardData[] = [
  {
    label: "Active Pledges",
    value: "1,284",
    sub: "Across all 3 safes",
    delta: { value: "+24 this week", positive: true },
    icon: Vault,
    tone: "brand",
  },
  {
    label: "Total Loan Book",
    value: inr(48720000),
    sub: "Outstanding principal",
    delta: { value: "+3.2% MoM", positive: true },
    icon: Coins,
    tone: "emerald",
  },
  {
    label: "Today's Disbursement",
    value: inr(685000),
    sub: "8 new pledges originated",
    icon: Banknote,
    tone: "sky",
  },
  {
    label: "Collections (MTD)",
    value: inr(2845000),
    sub: "Interest + partial principal",
    delta: { value: "92% of target", positive: true },
    icon: Receipt,
    tone: "amber",
  },
];

const VEHICLE_STATS: StatCardData[] = [
  {
    label: "Total Portfolio Value",
    value: inr(38420000),
    sub: "Across 312 active vehicle loans",
    delta: { value: "+5.8% QoQ", positive: true },
    icon: Wallet,
    tone: "brand",
  },
  {
    label: "Active Vehicle Loans",
    value: "312",
    sub: "Originated and not yet closed",
    delta: { value: "+18 this month", positive: true },
    icon: Car,
    tone: "sky",
  },
  {
    label: "Repossession Count",
    value: "6",
    sub: "Vehicles in yard inventory",
    delta: { value: "2 ready for auction", positive: false },
    icon: Gavel,
    tone: "rose",
  },
  {
    label: "Monthly EMI Collection Target",
    value: inr(3850000),
    sub: "Apr 2026 target · Collected " + inr(2920000),
    delta: { value: "75.8% achieved", positive: true },
    icon: Target,
    tone: "amber",
  },
];

const PAWN_HIGHLIGHTS = [
  { icon: Landmark, label: "12 new pledges originated today", tone: "brand" as Tone },
  { icon: Vault,    label: "4 lockers approaching capacity (Safe A)", tone: "amber" as Tone },
  { icon: Receipt,  label: "₹2.84L collected in interest this week", tone: "emerald" as Tone },
];

const VEHICLE_HIGHLIGHTS = [
  { icon: Car,            label: "3 disbursals pending hypothecation endorsement", tone: "sky" as Tone },
  { icon: AlertTriangle,  label: "5 loans crossed 2 missed EMIs (NPA watch)",      tone: "rose" as Tone },
  { icon: Gavel,          label: "Auction window opens 04-May-2026",                 tone: "amber" as Tone },
];

export default function Dashboard() {
  const ctx = useOutletContext<{ activeVertical: Vertical } | undefined>();
  const vertical: Vertical = ctx?.activeVertical ?? "PAWN";

  const isPawn = vertical === "PAWN";
  const stats = isPawn ? PAWN_STATS : VEHICLE_STATS;
  const highlights = isPawn ? PAWN_HIGHLIGHTS : VEHICLE_HIGHLIGHTS;

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ background: "var(--brand-light)" }}
          >
            <LayoutDashboard className="h-6 w-6" style={{ color: "var(--brand-primary)" }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: "var(--brand-primary)" }}
            >
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {isPawn
                ? "Pawn broking overview — pledges, disbursals, collections, and vault health."
                : "Vehicle finance overview — portfolio, EMI performance, and repossession pipeline."}
            </p>
          </div>
        </div>

        {/* Vertical toggle (mirrors the sidebar switcher, read-only here) */}
        <div className="flex items-center gap-2 rounded-xl border bg-white p-1 text-sm shadow-sm"
          style={{ borderColor: "rgba(74,111,165,0.18)" }}
          role="status"
          aria-label="Active vertical"
        >
          <VerticalPill active={isPawn} icon={Landmark} label="Pawn Broking" />
          <VerticalPill active={!isPawn} icon={Car} label="Vehicle Finance" />
        </div>
      </div>

      {/* Note about switcher source-of-truth */}
      <p className="mb-4 flex items-center gap-1.5 text-xs text-slate-500">
        <Sparkles className="h-3 w-3" style={{ color: "var(--brand-primary)" }} />
        Switch verticals using the dropdown at the top of the sidebar — every shared module
        (Receipts &amp; Ledger, Reports, Daybook) follows the active selection.
      </p>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Two-column lower section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border bg-white lg:col-span-2" style={{ borderColor: "rgba(74,111,165,0.12)" }}>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: "var(--brand-light)" }}
              >
                <Activity className="h-5 w-5" style={{ color: "var(--brand-primary)" }} />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  {isPawn ? "Pawn Activity Pulse" : "Vehicle Activity Pulse"}
                </CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  Top operational signals for the active vertical.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {highlights.map((h) => {
              const Icon = h.icon;
              const tone = TONE_MAP[h.tone];
              return (
                <div
                  key={h.label}
                  className="flex items-center gap-3 rounded-lg border px-3 py-3"
                  style={{
                    borderColor: "rgba(74,111,165,0.10)",
                    background: "var(--bg-main)",
                  }}
                >
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-md"
                    style={{ background: tone.bg }}
                  >
                    <Icon className="h-4 w-4" style={{ color: tone.fg }} />
                  </div>
                  <div className="flex-1 text-sm font-medium text-slate-800">{h.label}</div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border bg-white" style={{ borderColor: "rgba(74,111,165,0.12)" }}>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: "var(--brand-light)" }}
              >
                {isPawn ? (
                  <TrendingUp className="h-5 w-5" style={{ color: "var(--brand-primary)" }} />
                ) : (
                  <Gauge className="h-5 w-5" style={{ color: "var(--brand-primary)" }} />
                )}
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  {isPawn ? "This Week" : "Portfolio Health"}
                </CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  {isPawn ? "Pawn KPI snapshot." : "Vehicle KPI snapshot."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(isPawn
              ? [
                  { label: "Avg LTV", value: "62%" },
                  { label: "Loan Book Yield", value: "21.4%" },
                  { label: "Vault Utilization", value: "78%" },
                ]
              : [
                  { label: "Avg LTV", value: "74%" },
                  { label: "Collection Rate (MTD)", value: "75.8%" },
                  { label: "NPA Ratio", value: "1.6%" },
                ]
            ).map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "rgba(74,111,165,0.10)", background: "var(--bg-main)" }}
              >
                <span className="text-slate-600">{row.label}</span>
                <span className="font-semibold tabular-nums" style={{ color: "var(--brand-primary)" }}>
                  {row.value}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* -------------------- helpers -------------------- */

const TONE_MAP: Record<Tone, { bg: string; fg: string }> = {
  brand:   { bg: "var(--brand-light)",          fg: "var(--brand-primary)" },
  amber:   { bg: "rgba(234,179,8,0.16)",        fg: "#a16207" },
  rose:    { bg: "rgba(244,63,94,0.14)",        fg: "#be123c" },
  emerald: { bg: "rgba(16,185,129,0.14)",       fg: "#047857" },
  sky:     { bg: "rgba(56,189,248,0.16)",       fg: "#0369a1" },
};

function StatCard({ label, value, sub, delta, icon: Icon, tone = "brand" }: StatCardData) {
  const t = TONE_MAP[tone];
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
            {delta && (
              <p
                className={`mt-2 text-[11px] font-semibold ${
                  delta.positive ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {delta.value}
              </p>
            )}
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

function VerticalPill({
  active,
  icon: Icon,
  label,
}: {
  active: boolean;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
        active ? "" : "text-slate-500"
      }`}
      style={
        active
          ? { background: "var(--brand-light)", color: "var(--brand-primary)" }
          : undefined
      }
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

export { Dashboard };
