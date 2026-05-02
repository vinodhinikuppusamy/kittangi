import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Download,
  Gavel,
  PieChart,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { downloadCsv, type CsvColumn } from "@/lib/csv";
import { useLoans, type Loan } from "@/lib/stores/loansStore";
import { useDaybook } from "@/lib/stores/daybookStore";

type VehicleReportTab = "disbursal" | "collection" | "npa";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type DisbursalRow = {
  date: string;
  loanId: string;
  customer: string;
  vehicle: string;
  vehicleType: "2W" | "4W" | "Comm";
  loanAmount: number;
  ltv: number;
};

type CollectionRow = {
  loanId: string;
  customer: string;
  vehicle: string;
  expectedEMI: number;
  collectedEMI: number;
  status: "PAID" | "PARTIAL" | "PENDING";
};

type DefaultRow = {
  loanId: string;
  customer: string;
  vehicle: string;
  rcNumber: string;
  missedEMIs: number;
  outstanding: number;
  flagged: "REPOSSESSION" | "LEGAL_NOTICE" | "WATCH";
};


const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

export default function VehicleReports() {
  const allLoans = useLoans();
  const daybook = useDaybook();

  const [from, setFrom] = useState("2026-04-01");
  const [to, setTo] = useState("2026-04-27");
  const [activeTab, setActiveTab] = useState<VehicleReportTab>("disbursal");

  const inRange = (iso: string) => iso >= from && iso <= to;

  const vehicleLoans = useMemo(
    () => allLoans.filter((l) => l.product === "VEHICLE"),
    [allLoans],
  );

  const filteredDisbursals = useMemo(() => {
    return vehicleLoans
      .filter((l) => inRange(l.startedAtIso))
      .map((l) => ({
        date: l.startedAtIso,
        loanId: l.id,
        customer: l.customer,
        vehicle: l.vehicleDetails?.makeModel ?? "Vehicle",
        vehicleType: (l.vehicleDetails?.vehicleType === "TWO_WHEELER" ? "2W" : l.vehicleDetails?.vehicleType === "FOUR_WHEELER" ? "4W" : "Comm") as "2W" | "4W" | "Comm",
        loanAmount: l.principal,
        ltv: 75, // LTV not stored in record, using default for display
      }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [vehicleLoans, from, to]);

  const collections = useMemo(() => {
    // Group daybook receipts by loanId
    return vehicleLoans.map((l) => {
      const receipts = daybook.filter(
        (e) => e.side === "CREDIT" && e.category === "EMI Received" && (e.refId ?? "").includes(l.id)
      );
      const collected = receipts.reduce((s, e) => s + e.amount, 0);
      const months = parseInt(l.durationLabel?.split(" ")[0] ?? "36");
      const expected = Math.round(l.principal / months); // Simplified monthly expected
      return {
        loanId: l.id,
        customer: l.customer,
        vehicle: l.vehicleDetails?.makeModel ?? "Vehicle",
        expectedEMI: expected,
        collectedEMI: collected,
        status: (collected >= expected ? "PAID" : collected > 0 ? "PARTIAL" : "PENDING") as "PAID" | "PARTIAL" | "PENDING",
      };
    });
  }, [vehicleLoans, daybook]);

  const defaults = useMemo(() => {
    return vehicleLoans
      .filter((l) => (l as any).repossessionDetails || l.status === "AUCTION")
      .map((l) => ({
        loanId: l.id,
        customer: l.customer,
        vehicle: l.vehicleDetails?.makeModel ?? "Vehicle",
        rcNumber: l.vehicleDetails?.regNo ?? "—",
        missedEMIs: 3, // Heuristic
        outstanding: l.principal,
        flagged: (l.status === "AUCTION" ? "REPOSSESSION" : "WATCH") as "REPOSSESSION" | "LEGAL_NOTICE" | "WATCH",
      }));
  }, [vehicleLoans]);

  const repossessedLoanIds = useMemo(
    () => new Set(vehicleLoans.filter(l => l.status === "AUCTION").map(l => l.id)),
    [vehicleLoans]
  );

  const totals = useMemo(() => {
    const totalDisbursed = filteredDisbursals.reduce(
      (s, r) => s + r.loanAmount,
      0,
    );
    const expected = collections.reduce((s, r) => s + r.expectedEMI, 0);
    const collected = collections.reduce((s, r) => s + r.collectedEMI, 0);
    const collectionRate = expected > 0 ? (collected / expected) * 100 : 0;
    const totalOutstanding = defaults.reduce((s, r) => s + r.outstanding, 0);
    return {
      totalDisbursed,
      expected,
      collected,
      collectionRate,
      totalOutstanding,
    };
  }, [filteredDisbursals, collections, defaults]);

  const onExport = (which: VehicleReportTab) => {
    const range = `${from}_to_${to}`;
    if (which === "disbursal") {
      const cols: CsvColumn<DisbursalRow>[] = [
        { header: "Date", key: "date" },
        { header: "Loan ID", key: "loanId" },
        { header: "Customer", key: "customer" },
        { header: "Vehicle (Make/Model)", key: "vehicle" },
        { header: "Vehicle Type", key: "vehicleType" },
        { header: "Loan Amount (INR)", key: "loanAmount" },
        { header: "LTV (%)", key: "ltv" },
      ];
      const rows: DisbursalRow[] = [
        ...filteredDisbursals,
        {
          date: "",
          loanId: "",
          customer: "",
          vehicle: `TOTAL (${filteredDisbursals.length} loans)`,
          vehicleType: "4W",
          loanAmount: filteredDisbursals.reduce((s, r) => s + r.loanAmount, 0),
          ltv: 0,
        },
      ];
      downloadCsv(`kittangi-vehicle-disbursals-${range}.csv`, cols, rows);
    } else if (which === "collection") {
      const cols: CsvColumn<CollectionRow>[] = [
        { header: "Loan ID", key: "loanId" },
        { header: "Customer", key: "customer" },
        { header: "Vehicle", key: "vehicle" },
        { header: "Expected EMI (INR)", key: "expectedEMI" },
        { header: "Collected EMI (INR)", key: "collectedEMI" },
        { header: "Status", key: "status" },
      ];
      const rows: CollectionRow[] = [
        ...collections,
        {
          loanId: "",
          customer: `TOTAL (${collections.length} accounts)`,
          vehicle: "",
          expectedEMI: collections.reduce((s, r) => s + r.expectedEMI, 0),
          collectedEMI: collections.reduce((s, r) => s + r.collectedEMI, 0),
          status: "PAID",
        },
      ];
      downloadCsv(`kittangi-vehicle-collections-${range}.csv`, cols, rows);
    } else {
      const cols: CsvColumn<DefaultRow>[] = [
        { header: "Loan ID", key: "loanId" },
        { header: "Customer", key: "customer" },
        { header: "Vehicle", key: "vehicle" },
        { header: "RC Number", key: "rcNumber" },
        { header: "Missed EMIs", key: "missedEMIs" },
        { header: "Outstanding (INR)", key: "outstanding" },
        { header: "Flagged", key: "flagged" },
      ];
      const rows: DefaultRow[] = [
        ...defaults,
        {
          loanId: "",
          customer: `TOTAL (${defaults.length} accounts)`,
          vehicle: "",
          rcNumber: "",
          missedEMIs: 0,
          outstanding: defaults.reduce((s, r) => s + r.outstanding, 0),
          flagged: "WATCH",
        },
      ];
      downloadCsv(`kittangi-vehicle-npa-${range}.csv`, cols, rows);
    }
    toast.success("Downloaded", {
      icon: <CheckCircle2 className="h-4 w-4" />,
      description: `${
        which === "disbursal"
          ? "Disbursal Log"
          : which === "collection"
            ? "Collection Report"
            : "NPA / Default List"
      } CSV saved to your downloads.`,
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
            <PieChart className="h-6 w-6" style={{ color: "#047857" }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold tracking-tight text-slate-900"
            >
              Vehicle Portfolio Reports
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Disbursals, EMI collection performance, and NPA / repossession watchlist.
            </p>
          </div>
        </div>

        {/* Date range */}
        <div
          className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2"
          style={{ borderColor: "rgba(74,111,165,0.18)" }}
        >
          <CalendarRange className="h-4 w-4" style={{ color: "var(--text-main)" }} />
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-8 w-35 border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
            aria-label="From date"
          />
          <span className="text-slate-400">→</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-8 w-35 border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
            aria-label="To date"
          />
        </div>
      </div>

      {/* Top stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Wallet}
          label="Total Disbursed"
          value={inr(totals.totalDisbursed)}
          sub={`${filteredDisbursals.length} loans this period`}
        />
        <StatCard
          icon={TrendingUp}
          label="Collection Rate"
          value={`${totals.collectionRate.toFixed(1)}%`}
          sub={`${inr(totals.collected)} of ${inr(totals.expected)}`}
          tone="emerald"
        />
        <StatCard
          icon={AlertTriangle}
          label="Loans in Default"
          value={defaults.length.toString()}
          sub={`${repossessedLoanIds.size} flagged for repossession`}
          tone="amber"
        />
        <StatCard
          icon={Gavel}
          label="Total Outstanding (Default)"
          value={inr(totals.totalOutstanding)}
          sub="Across NPA accounts"
          tone="rose"
        />
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as VehicleReportTab)}
        className="w-full"
      >
        <TabsList
          className="grid w-full grid-cols-1 sm:w-auto sm:grid-cols-3"
          style={{ background: "#fff" }}
        >
          <TabsTrigger value="disbursal">
            Disbursal Log
          </TabsTrigger>
          <TabsTrigger value="collection">
            Collection Report
          </TabsTrigger>
          <TabsTrigger value="npa">
            NPA / Default List
          </TabsTrigger>
        </TabsList>

        {/* Disbursal Log */}
        <TabsContent value="disbursal" className="mt-4">
          <ReportCard
            title="Disbursal Log"
            description="Vehicle loans originated during the selected period."
            onExport={() => onExport("disbursal")}
          >
            <Table>
              <TableHeader>
                <TableRow style={{ background: "var(--bg-main)" }}>
                  <TableHead className="text-[11px] uppercase tracking-wide text-slate-500">Date</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-slate-500">Loan ID</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-slate-500">Customer</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-slate-500">Vehicle (Make/Model)</TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-wide text-slate-500">Loan Amount</TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-wide text-slate-500">LTV</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDisbursals.map((r) => (
                  <TableRow key={r.loanId} className="text-sm">
                    <TableCell className="text-slate-600">{r.date}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs font-semibold" style={{ color: "var(--text-main)" }}>
                        {r.loanId}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-slate-800">{r.customer}</TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-800">{r.vehicle}</div>
                      <div className="text-[11px] text-slate-500">{r.vehicleType}</div>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums" style={{ color: "var(--text-main)" }}>
                      {inr(r.loanAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <LtvBadge ltv={r.ltv} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ReportCard>
        </TabsContent>

        {/* Collection Report */}
        <TabsContent value="collection" className="mt-4">
          <ReportCard
            title="Collection Report"
            description="Total EMIs collected vs. expected for the current month."
            onExport={() => onExport("collection")}
            headerExtra={
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <Badge variant="outline" className="font-medium" style={{ borderColor: "rgba(16,185,129,0.40)", color: "#047857" }}>
                  Collected {inr(totals.collected)}
                </Badge>
                <Badge variant="outline" className="font-medium" style={{ borderColor: "rgba(74,111,165,0.40)", color: "var(--text-main)" }}>
                  Expected {inr(totals.expected)}
                </Badge>
                <Badge variant="outline" className="font-medium" style={{ borderColor: "rgba(244,63,94,0.40)", color: "#be123c" }}>
                  Gap {inr(Math.max(totals.expected - totals.collected, 0))}
                </Badge>
              </div>
            }
          >
            <Table>
              <TableHeader>
                <TableRow style={{ background: "var(--bg-main)" }}>
                  <TableHead className="text-[11px] uppercase tracking-wide text-slate-500">Loan ID</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-slate-500">Customer</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-slate-500">Vehicle</TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-wide text-slate-500">Expected EMI</TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-wide text-slate-500">Collected</TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-wide text-slate-500">% Achieved</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-slate-500">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.map((r) => {
                  const pct = r.expectedEMI > 0 ? (r.collectedEMI / r.expectedEMI) * 100 : 0;
                  return (
                    <TableRow key={r.loanId} className="text-sm">
                      <TableCell>
                        <span className="font-mono text-xs font-semibold" style={{ color: "var(--text-main)" }}>
                          {r.loanId}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium text-slate-800">{r.customer}</TableCell>
                      <TableCell className="text-slate-700">{r.vehicle}</TableCell>
                      <TableCell className="text-right tabular-nums">{inr(r.expectedEMI)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums" style={{ color: "var(--text-main)" }}>
                        {inr(r.collectedEMI)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span
                          className={
                            pct >= 100 ? "font-semibold text-emerald-700" :
                            pct >= 50 ? "font-semibold text-slate-900" :
                            "font-semibold text-slate-900"
                          }
                        >
                          {pct.toFixed(0)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <CollectionStatusBadge status={r.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ReportCard>
        </TabsContent>

        {/* NPA / Default List */}
        <TabsContent value="npa" className="mt-4">
          <ReportCard
            title="NPA / Default List"
            description="Loans with more than 2 missed EMIs — repossession candidates highlighted in rose."
            onExport={() => onExport("npa")}
          >
            <Table>
              <TableHeader>
                <TableRow style={{ background: "var(--bg-main)" }}>
                  <TableHead className="text-[11px] uppercase tracking-wide text-slate-500">Loan ID</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-slate-500">Customer</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-slate-500">Vehicle</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-slate-500">RC Number</TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-wide text-slate-500">Missed EMIs</TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-wide text-slate-500">Outstanding</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-slate-500">Action Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defaults.map((r) => {
                  const inYard = repossessedLoanIds.has(r.loanId);
                  return (
                    <TableRow
                      key={r.loanId}
                      className="text-sm"
                      style={inYard ? { background: "rgba(244,63,94,0.05)" } : undefined}
                    >
                      <TableCell>
                        <span className="font-mono text-xs font-semibold" style={{ color: "var(--text-main)" }}>
                          {r.loanId}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium text-slate-800">{r.customer}</TableCell>
                      <TableCell className="text-slate-700">{r.vehicle}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-slate-700">
                        {r.rcNumber}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-slate-900 tabular-nums">{r.missedEMIs}</span>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-slate-800">
                        {inr(r.outstanding)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <FlagBadge flag={r.flagged} />
                          {inYard && (
                            <Badge
                              variant="outline"
                              className="gap-1 font-semibold"
                              style={{
                                borderColor: "rgba(244,63,94,0.45)",
                                color: "#be123c",
                                background: "rgba(244,63,94,0.10)",
                              }}
                            >
                              <Gavel className="h-3 w-3" />
                              In Yard
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ReportCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------- helpers -------------------- */

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "brand",
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  sub: string;
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
              style={{ color: "var(--text-main)" }}
              title={value}
            >
              {value}
            </p>
            <p className="mt-1 text-xs text-slate-500">{sub}</p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: t.bg }}>
            <Icon className="h-5 w-5" style={{ color: t.fg }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportCard({
  title,
  description,
  onExport,
  headerExtra,
  children,
}: {
  title: string;
  description: string;
  onExport: () => void;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="border bg-white" style={{ borderColor: "rgba(74,111,165,0.12)" }}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">{title}</CardTitle>
            <CardDescription className="text-sm text-slate-500">{description}</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {headerExtra}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onExport}
              className="gap-1.5"
              style={{ borderColor: "rgba(74,111,165,0.30)", color: "var(--text-main)" }}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">{children}</div>
      </CardContent>
    </Card>
  );
}

function LtvBadge({ ltv }: { ltv: number }) {
  const tone =
    ltv <= 70 ? { bg: "rgba(16,185,129,0.12)", fg: "#047857" } :
    ltv <= 85 ? { bg: "rgba(234,179,8,0.16)", fg: "#a16207" } :
    { bg: "rgba(244,63,94,0.12)", fg: "#be123c" };
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {ltv}%
    </span>
  );
}

function CollectionStatusBadge({ status }: { status: CollectionRow["status"] }) {
  const meta: Record<CollectionRow["status"], { label: string; bg: string; fg: string }> = {
    PAID:    { label: "Paid",    bg: "rgba(16,185,129,0.12)", fg: "#047857" },
    PARTIAL: { label: "Partial", bg: "rgba(234,179,8,0.16)", fg: "#a16207" },
    PENDING: { label: "Pending", bg: "rgba(244,63,94,0.12)", fg: "#be123c" },
  };
  const m = meta[status];
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
      style={{ background: m.bg, color: m.fg }}
    >
      {m.label}
    </span>
  );
}

function FlagBadge({ flag }: { flag: DefaultRow["flagged"] }) {
  const meta: Record<DefaultRow["flagged"], { label: string; bg: string; fg: string }> = {
    REPOSSESSION: { label: "Repossession",  bg: "rgba(244,63,94,0.12)", fg: "#be123c" },
    LEGAL_NOTICE: { label: "Legal Notice",  bg: "rgba(234,179,8,0.16)", fg: "#a16207" },
    WATCH:        { label: "Watch",         bg: "rgba(100,116,139,0.12)", fg: "#475569" },
  };
  const m = meta[flag];
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ background: m.bg, color: m.fg }}
    >
      {m.label}
    </span>
  );
}
 