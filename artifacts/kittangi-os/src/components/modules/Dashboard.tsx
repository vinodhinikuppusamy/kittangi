import { useMemo } from "react";
import { Link, useOutletContext } from "react-router-dom";
import {
  Activity,
  Banknote,
  CalendarClock,
  Car,
  Coins,
  Landmark,
  LayoutDashboard,
  LogIn,
  Receipt,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLoans } from "@/lib/stores/loansStore";
import { useCustomers } from "@/lib/stores/customersStore";
import { useDaybook } from "@/lib/stores/daybookStore";
import {
  useActivityLog,
  type ActivityEntry,
  type ActivityKind,
} from "@/lib/stores/activityLogStore";
import type { Vertical } from "@/lib/navigation";

type Tone = "brand" | "amber" | "rose" | "emerald" | "sky" | "violet";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

const inrCompact = (n: number) => {
  const v = Number.isFinite(n) ? n : 0;
  if (Math.abs(v) >= 10_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`;
  if (Math.abs(v) >= 1_000) return `₹${(v / 1_000).toFixed(1)}K`;
  return `₹${v}`;
};

function startOfDayIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isInterestCategory(cat: string): boolean {
  return (
    cat === "Interest Income" ||
    cat === "EMI Received" ||
    cat === "Full Settlement"
  );
}

const TONE_MAP: Record<Tone, { bg: string; fg: string }> = {
  brand: { bg: "var(--brand-light)", fg: "var(--brand-primary)" },
  amber: { bg: "rgba(234,179,8,0.16)", fg: "#a16207" },
  rose: { bg: "rgba(244,63,94,0.14)", fg: "#be123c" },
  emerald: { bg: "rgba(16,185,129,0.14)", fg: "#047857" },
  sky: { bg: "rgba(56,189,248,0.16)", fg: "#0369a1" },
  violet: { bg: "rgba(139,92,246,0.14)", fg: "#6d28d9" },
};

const ACTIVITY_TONE: Record<ActivityKind, Tone> = {
  AUTH: "sky",
  LOAN: "brand",
  CUSTOMER: "violet",
  DAYBOOK: "emerald",
  VAULT: "amber",
  REPO: "rose",
  SETTINGS: "sky",
};

const ACTIVITY_ICON: Record<
  ActivityKind,
  React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
  AUTH: LogIn,
  LOAN: Banknote,
  CUSTOMER: UsersRound,
  DAYBOOK: Receipt,
  VAULT: ShieldCheck,
  REPO: Car,
  SETTINGS: Sparkles,
};

export default function Dashboard() {
  const ctx = useOutletContext<{ activeVertical: Vertical } | undefined>();
  const vertical: Vertical = ctx?.activeVertical ?? "PAWN";
  const isPawn = vertical === "PAWN";

  const loans = useLoans();
  const customers = useCustomers();
  const daybook = useDaybook();
  const activity = useActivityLog();

  // ---- Card 1: Total Active Loans (count + outstanding principal) -------
  const activeLoans = useMemo(() => {
    const filtered = loans.filter((l) => {
      if (l.status !== "ACTIVE") return false;
      if (vertical === "PAWN") return l.product === "PAWN";
      if (vertical === "VEHICLE") return l.product === "VEHICLE";
      return true;
    });
    const principal = filtered.reduce((s, l) => s + (l.principal ?? 0), 0);
    return { count: filtered.length, principal };
  }, [loans, vertical]);

  // ---- Card 2: Verified Customers ---------------------------------------
  const verifiedCustomers = useMemo(() => {
    const all = customers.length;
    const verified = customers.filter(
      (c) => c.kycStatus === "Verified",
    ).length;
    return { all, verified };
  }, [customers]);

  // ---- Card 3: Interest Collection (Today / Week / Month) ----------------
  const interestSlices = useMemo(() => {
    const now = new Date();
    const today = startOfDayIso(now);
    const weekAgo = startOfDayIso(
      new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
    );
    const monthAgo = startOfDayIso(
      new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000),
    );
    let dToday = 0;
    let dWeek = 0;
    let dMonth = 0;
    for (const e of daybook) {
      if (e.side !== "CREDIT") continue;
      if (!isInterestCategory(e.category)) continue;
      // For Full Settlement: only the interest portion counts as collection.
      const interest =
        e.category === "Full Settlement"
          ? (e.legalInterestPortion ?? 0) + (e.companyInterestPortion ?? 0)
          : e.amount;
      if (interest <= 0) continue;
      if (e.dateIso === today) dToday += interest;
      if (e.dateIso >= weekAgo) dWeek += interest;
      if (e.dateIso >= monthAgo) dMonth += interest;
    }
    return { today: dToday, week: dWeek, month: dMonth };
  }, [daybook]);

  // ---- Card 4: Upcoming Maturities (next 7 days) -------------------------
  const upcoming = useMemo(() => {
    const now = new Date();
    const today = startOfDayIso(now);
    const horizon = startOfDayIso(
      new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    );
    return loans
      .filter(
        (l) =>
          l.status === "ACTIVE" &&
          l.maturityIso &&
          l.maturityIso >= today &&
          l.maturityIso <= horizon,
      )
      .sort((a, b) =>
        (a.maturityIso ?? "") < (b.maturityIso ?? "")
          ? -1
          : (a.maturityIso ?? "") > (b.maturityIso ?? "")
            ? 1
            : 0,
      )
      .slice(0, 5);
  }, [loans]);

  // ---- Card 5: Recent Activity (last 5) ---------------------------------
  const recentActivity = useMemo(() => activity.slice(0, 5), [activity]);

  // ---- Card 6: 6-month Revenue chart ------------------------------------
  // Walk back 6 calendar months and sum interest income each.
  const monthlyRevenue = useMemo(() => {
    const now = new Date();
    const months: Array<{
      key: string;
      label: string;
      pawn: number;
      vehicle: number;
      total: number;
    }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const key = `${y}-${m}`;
      months.push({
        key,
        label: d.toLocaleDateString("en-IN", { month: "short" }),
        pawn: 0,
        vehicle: 0,
        total: 0,
      });
    }
    const idxByKey = new Map(months.map((m, i) => [m.key, i]));
    for (const e of daybook) {
      if (e.side !== "CREDIT") continue;
      if (!isInterestCategory(e.category)) continue;
      const key = e.dateIso.slice(0, 7);
      const idx = idxByKey.get(key);
      if (idx === undefined) continue;
      const interest =
        e.category === "Full Settlement"
          ? (e.legalInterestPortion ?? 0) + (e.companyInterestPortion ?? 0)
          : e.amount;
      if (interest <= 0) continue;
      if (e.category === "EMI Received") months[idx].vehicle += interest;
      else months[idx].pawn += interest;
      months[idx].total += interest;
    }
    return months;
  }, [daybook]);

  const totalRevenue6mo = monthlyRevenue.reduce((s, m) => s + m.total, 0);

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ background: "var(--brand-light)" }}
          >
            <LayoutDashboard
              className="h-6 w-6"
              style={{ color: "var(--brand-primary)" }}
            />
          </div>
          <div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: "var(--brand-primary)" }}
            >
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Live operational snapshot — loans, customers, collections, and
              activity across the branch.
            </p>
          </div>
        </div>

        <div
          className="flex items-center gap-2 rounded-xl border bg-white p-1 text-sm shadow-sm"
          style={{ borderColor: "rgba(74,111,165,0.18)" }}
          role="status"
          aria-label="Active vertical"
        >
          <VerticalPill active={isPawn} icon={Landmark} label="Pawn Broking" />
          <VerticalPill active={!isPawn} icon={Car} label="Vehicle Finance" />
        </div>
      </div>

      {/* 6 KPI cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          tone="brand"
          icon={Banknote}
          label="Total Active Loans"
          value={String(activeLoans.count)}
          sub={`${inr(activeLoans.principal)} outstanding`}
          testId="kpi-active-loans"
        />
        <KpiCard
          tone="violet"
          icon={UsersRound}
          label="Verified Customers"
          value={String(verifiedCustomers.verified)}
          sub={`${verifiedCustomers.all} total on file`}
          testId="kpi-verified-customers"
        />
        <KpiCard
          tone="emerald"
          icon={Coins}
          label="Interest Collected"
          value={inr(interestSlices.today)}
          sub={`Today · 7-day ${inr(interestSlices.week)} · 30-day ${inr(interestSlices.month)}`}
          testId="kpi-interest-collected"
        />

        {/* Upcoming maturities — wider card with mini list */}
        <Card
          className="border bg-white sm:col-span-2 lg:col-span-2"
          style={{ borderColor: "rgba(74,111,165,0.12)" }}
        >
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ background: TONE_MAP.amber.bg }}
                >
                  <CalendarClock
                    className="h-5 w-5"
                    style={{ color: TONE_MAP.amber.fg }}
                  />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Upcoming Maturities
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Active loans maturing in the next 7 days
                  </CardDescription>
                </div>
              </div>
              <span
                className="rounded-md px-2 py-0.5 text-xs font-bold"
                style={{
                  background: "var(--brand-light)",
                  color: "var(--brand-primary)",
                }}
              >
                {upcoming.length}
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {upcoming.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-slate-500">
                No loans maturing in the next 7 days.
              </p>
            ) : (
              <ul
                className="divide-y rounded-md border"
                style={{ borderColor: "rgba(74,111,165,0.10)" }}
              >
                {upcoming.map((l) => {
                  const due = new Date((l.maturityIso ?? "") + "T00:00:00");
                  return (
                    <li
                      key={l.id}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <Link
                          to={`/loans/${l.id}`}
                          className="font-mono text-xs font-semibold hover:underline"
                          style={{ color: "var(--brand-primary)" }}
                        >
                          {l.id}
                        </Link>
                        <span className="ml-2 text-slate-700">
                          {l.customer}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-slate-500">
                          {due.toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </span>
                        <span className="font-semibold text-slate-800">
                          {inr(l.principal)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card
          className="border bg-white"
          style={{ borderColor: "rgba(74,111,165,0.12)" }}
        >
          <CardHeader className="pb-2">
            <div className="flex items-start gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: TONE_MAP.sky.bg }}
              >
                <Activity
                  className="h-5 w-5"
                  style={{ color: TONE_MAP.sky.fg }}
                />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  Recent Activity
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Last {recentActivity.length || 5} actions
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {recentActivity.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-slate-500">
                No activity recorded yet — sign-ins and loan postings will
                appear here.
              </p>
            ) : (
              <ul className="space-y-2">
                {recentActivity.map((a) => (
                  <ActivityItem key={a.id} entry={a} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue bar chart */}
      <Card
        className="border bg-white"
        style={{ borderColor: "rgba(74,111,165,0.12)" }}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: "var(--brand-light)" }}
              >
                <TrendingUp
                  className="h-5 w-5"
                  style={{ color: "var(--brand-primary)" }}
                />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  Revenue (Interest) — Last 6 Months
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Pawn interest + Vehicle EMI interest, posted to the Daybook
                </CardDescription>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                6-Month Total
              </p>
              <p
                className="text-xl font-bold tabular-nums"
                style={{ color: "var(--brand-primary)" }}
              >
                {inr(totalRevenue6mo)}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-64 w-full" data-testid="dashboard-revenue-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyRevenue}
                margin={{ top: 12, right: 16, bottom: 4, left: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(74,111,165,0.10)"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={{ stroke: "rgba(74,111,165,0.20)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={(v) => inrCompact(Number(v))}
                  axisLine={{ stroke: "rgba(74,111,165,0.20)" }}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  cursor={{ fill: "rgba(74,111,165,0.06)" }}
                  formatter={(v: number) => inr(v)}
                  contentStyle={{
                    background: "white",
                    border: "1px solid rgba(74,111,165,0.20)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="pawn"
                  stackId="rev"
                  name="Pawn"
                  fill="var(--brand-primary)"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="vehicle"
                  stackId="rev"
                  name="Vehicle"
                  fill="#86b7e5"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center justify-center gap-4 text-xs text-slate-600">
            <LegendDot color="var(--brand-primary)" label="Pawn Interest" />
            <LegendDot color="#86b7e5" label="Vehicle Interest" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------- helpers -------------------- */

function KpiCard({
  tone,
  icon: Icon,
  label,
  value,
  sub,
  testId,
}: {
  tone: Tone;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  sub: string;
  testId?: string;
}) {
  const t = TONE_MAP[tone];
  return (
    <Card
      className="border bg-white"
      style={{ borderColor: "rgba(74,111,165,0.12)" }}
      data-testid={testId}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {label}
            </p>
            <p
              className="mt-1.5 truncate text-2xl font-bold leading-tight tabular-nums"
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

function ActivityItem({ entry }: { entry: ActivityEntry }) {
  const tone = TONE_MAP[ACTIVITY_TONE[entry.kind]];
  const Icon = ACTIVITY_ICON[entry.kind];
  const at = new Date(entry.atIso);
  const ago = relativeTime(at);
  return (
    <li className="flex items-start gap-3">
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
        style={{ background: tone.bg }}
      >
        <Icon className="h-3.5 w-3.5" style={{ color: tone.fg }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium leading-tight text-slate-800">
          {entry.summary}
        </p>
        <p className="mt-0.5 text-[10px] text-slate-500">
          {entry.actor} · {ago}
        </p>
      </div>
    </li>
  );
}

function relativeTime(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-sm"
        style={{ background: color }}
      />
      {label}
    </span>
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
