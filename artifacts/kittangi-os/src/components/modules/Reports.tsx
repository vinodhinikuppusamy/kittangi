import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Coins,
  Download,
  FileSpreadsheet,
  Landmark,
  PieChart,
  TrendingUp,
  Users,
} from "lucide-react";

import { downloadCsv, type CsvColumn } from "@/lib/csv";
import { exportXlsx, num, fmtDate as fmtDateXlsx } from "@/lib/xlsx";
import { useSettings, splitInterest } from "@/lib/stores/settingsStore";
import { useIsAdmin } from "@/lib/stores/userRoleStore";
import { useDaybook } from "@/lib/stores/daybookStore";
import { useLoans } from "@/lib/stores/loansStore";
import { useCustomers } from "@/lib/stores/customersStore";
import { usePledgedItems } from "@/lib/stores/pledgedItemsStore";
import { accruedInterestForLoan } from "@/lib/interest";

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

type PaymentMode = "CASH" | "BANK";

type LoanRow = {
  date: string;
  loanId: string;
  customer: string;
  itemDesc: string;
  grossWeightG: number;
  disbursed: number;
};

type CollectionRow = {
  date: string;
  receiptId: string;
  loanId: string;
  customer: string;
  mode: PaymentMode;
  interest: number;
  /**
   * Pre-computed split portions taken from the persisted Daybook entry
   * (set by ReceiptsLedger at receipt time). Optional so synthetic / legacy
   * rows without provenance can fall back to settings-based computation.
   */
  legalPortion?: number;
  companyPortion?: number;
  /** Per-loan annual rate used at receipt time, for accurate fallback split. */
  loanAnnualRatePct?: number;
  /** Per-loan legal % override, for accurate fallback split. */
  legalRatePctPerAnnumOverride?: number;
};

type DefaultRow = {
  loanId: string;
  customer: string;
  disbursedDate: string;
  dueDate: string;
  daysOverdue: number;
  outstanding: number;
};

const MODE_META: Record<PaymentMode, { label: string; bg: string; fg: string; border: string }> = {
  CASH: {
    label: "Cash",
    bg: "rgba(16,185,129,0.12)",
    fg: "#047857",
    border: "rgba(16,185,129,0.35)",
  },
  BANK: {
    label: "Bank",
    bg: "rgba(74,111,165,0.14)",
    fg: "#1d4ed8",
    border: "rgba(74,111,165,0.35)",
  },
};

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function thirtyDaysAgoIso() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type ReportTab = "register" | "collections" | "defaults" | "weekly";

const ICON_TONE = {
  blue: { bg: "rgba(59,130,246,0.12)", fg: "#1d4ed8", ring: "rgba(59,130,246,0.30)" },
  green: { bg: "rgba(16,185,129,0.12)", fg: "#047857", ring: "rgba(16,185,129,0.30)" },
  amber: { bg: "rgba(245,158,11,0.12)", fg: "#b45309", ring: "rgba(245,158,11,0.30)" },
  red: { bg: "rgba(239,68,68,0.12)", fg: "#030213", ring: "rgba(239,68,68,0.30)" },
  purple: { bg: "rgba(168,85,247,0.12)", fg: "#7e22ce", ring: "rgba(168,85,247,0.30)" },
} as const;

/* Returns Sunday 00:00 of the current week and Saturday 23:59 (ISO yyyy-mm-dd). */
function currentWeekRange(): { startIso: string; endIso: string } {
  const now = new Date();
  const dow = now.getDay(); // 0 = Sun
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(now.getDate() - dow);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  return { startIso: fmt(start), endIso: fmt(end) };
}

export default function Reports() {
  const [from, setFrom] = useState(thirtyDaysAgoIso());
  const [to, setTo] = useState(todayIso());
  const [activeTab, setActiveTab] = useState<ReportTab>("register");
  const customers = useCustomers();

  const inRange = (iso: string) => iso >= from && iso <= to;

  // ----- Real ledger data: derive every Reports tab from the live stores
  // (Daybook, Loans, Pledged Items) so a System Wipe / fresh deployment
  // shows truly empty tabs instead of stale demo numbers.
  const daybook = useDaybook();
  const loans = useLoans();
  const pledgedItems = usePledgedItems();
  const loanRateLookup = useMemo(() => {
    const map = new Map<string, { ratePctPerAnnum: number; legalPct?: number }>();
    for (const l of loans) {
      map.set(l.id, {
        ratePctPerAnnum: l.ratePctPerAnnum,
        legalPct: l.legalInterestPct,
      });
    }
    return map;
  }, [loans]);

  const realCollections = useMemo<CollectionRow[]>(() => {
    const isInterestCategory = (c: string) =>
      c === "Interest Income" ||
      c === "EMI Received" ||
      c === "Full Settlement";

    const rows: CollectionRow[] = [];
    for (const e of daybook) {
      if (e.side !== "CREDIT") continue;
      if (!isInterestCategory(e.category)) continue;

      // Derive loanId from refId (`RCP-xxxx • LOAN-xxxx`) when possible.
      const tail = (e.refId ?? "").split("•").pop()?.trim() ?? "";
      const head = (e.refId ?? "").split("•")[0]?.trim() ?? e.id;
      const loanId = tail || "—";
      const receiptId = head || e.id;

      // Interest amount: settlement lines carry principal+interest in
      // `amount`; the interest slice is the sum of the split portions
      // (set when posted by ReceiptsLedger). Non-settlement interest lines
      // already represent pure interest, so `amount` is fine.
      let interest: number;
      if (e.category === "Full Settlement") {
        const split =
          (e.legalInterestPortion ?? 0) + (e.companyInterestPortion ?? 0);
        interest = split > 0 ? split : 0;
        if (interest === 0) continue; // no interest portion — skip from collections
      } else {
        interest = e.amount;
      }

      const loanMeta = loanRateLookup.get(loanId);
      rows.push({
        date: e.dateIso,
        receiptId,
        loanId,
        customer: e.customerName ?? "—",
        mode: e.paymentMode === "BANK" || e.paymentMode === "UPI" ? "BANK" : "CASH",
        interest,
        legalPortion: e.legalInterestPortion,
        companyPortion: e.companyInterestPortion,
        loanAnnualRatePct: loanMeta?.ratePctPerAnnum,
        legalRatePctPerAnnumOverride: loanMeta?.legalPct,
      });
    }
    // Newest first (matches existing UX where today's receipts top the list).
    rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return rows;
  }, [daybook, loanRateLookup]);

  // ----- Loan Register (derived from useLoans + usePledgedItems) -----
  const pledgedByLoanId = useMemo(() => {
    const map = new Map<string, (typeof pledgedItems)[number]>();
    for (const p of pledgedItems) map.set(p.loanId, p);
    return map;
  }, [pledgedItems]);

  const realRegister = useMemo<LoanRow[]>(() => {
    const rows: LoanRow[] = loans.map((l) => {
      const pledge = pledgedByLoanId.get(l.id);
      let itemDesc: string;
      let grossWeightG: number;
      if (l.product === "PAWN") {
        itemDesc = pledge?.title ?? "—";
        grossWeightG = pledge?.grossWeightG ?? 0;
      } else {
        // Vehicle / chit / other — use makeModel + reg no when available.
        const v = l.vehicleDetails;
        itemDesc = v
          ? [v.makeModel, v.regNo].filter(Boolean).join(" · ")
          : l.product;
        grossWeightG = 0;
      }
      return {
        date: l.startedAtIso,
        loanId: l.id,
        customer: l.customer,
        itemDesc,
        grossWeightG,
        disbursed: l.principal,
      };
    });
    rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return rows;
  }, [loans, pledgedByLoanId]);

  const filteredRegister = useMemo(
    () => realRegister.filter((r) => inRange(r.date)),
    [from, to, realRegister],
  );
  const filteredCollections = useMemo(
    () => realCollections.filter((r) => inRange(r.date)),
    [from, to, realCollections],
  );

  // ----- Maturity & Defaults (derived from useLoans) -----
  // Any ACTIVE loan whose maturity date is in the past, ordered by most
  // overdue first. Outstanding = principal + live accrued interest as-of today.
  const realDefaults = useMemo<DefaultRow[]>(() => {
    const today = todayIso();
    const rows: DefaultRow[] = loans
      .filter(
        (l) =>
          l.status === "ACTIVE" &&
          typeof l.maturityIso === "string" &&
          l.maturityIso < today,
      )
      .map((l) => {
        const due = l.maturityIso!;
        const msPerDay = 1000 * 60 * 60 * 24;
        const daysOverdue = Math.max(
          0,
          Math.floor(
            (new Date(today).getTime() - new Date(due).getTime()) / msPerDay,
          ),
        );
        const accrued = accruedInterestForLoan(l);
        return {
          loanId: l.id,
          customer: l.customer,
          disbursedDate: l.startedAtIso,
          dueDate: due,
          daysOverdue,
          outstanding: l.principal + accrued,
        };
      });
    rows.sort((a, b) => b.daysOverdue - a.daysOverdue);
    return rows;
  }, [loans]);
  const filteredDefaults = realDefaults;

  const handleExport = () => {
    const range = `${from}_to_${to}`;
    if (activeTab === "register") {
      const cols: CsvColumn<LoanRow>[] = [
        { header: "Date", key: "date" },
        { header: "Loan ID", key: "loanId" },
        { header: "Customer", key: "customer" },
        { header: "Item Description", key: "itemDesc" },
        { header: "Gross Weight (g)", key: "grossWeightG" },
        { header: "Disbursed (INR)", key: "disbursed" },
      ];
      const total = filteredRegister.reduce((s, r) => s + r.disbursed, 0);
      const rows: LoanRow[] = [
        ...filteredRegister,
        {
          date: "",
          loanId: "",
          customer: "",
          itemDesc: `TOTAL (${filteredRegister.length} loans)`,
          grossWeightG: filteredRegister.reduce(
            (s, r) => s + r.grossWeightG,
            0,
          ),
          disbursed: total,
        },
      ];
      downloadCsv(`kittangi-loan-register-${range}.csv`, cols, rows);
    } else if (activeTab === "collections") {
      // High-fidelity Interest Ledger as multi-sheet XLSX. Sheet 1 = ledger,
      // Sheet 2 = per-day rollup so cashiers can verify against the bank
      // deposit slip without filtering Excel manually.
      const total = filteredCollections.reduce((s, r) => s + r.interest, 0);
      const cashTotal = filteredCollections
        .filter((r) => r.mode === "CASH")
        .reduce((s, r) => s + r.interest, 0);
      const bankTotal = total - cashTotal;

      const ledgerRows: Array<Array<string | number>> = [
        [
          "Date",
          "Receipt ID",
          "Loan ID",
          "Customer",
          "Mode",
          "Interest (INR)",
          "Legal Portion (INR)",
          "Company Portion (INR)",
        ],
        ...filteredCollections.map((r) => [
          fmtDateXlsx(r.date),
          r.receiptId,
          r.loanId,
          r.customer,
          r.mode,
          num(r.interest),
          num(r.legalPortion ?? 0),
          num(r.companyPortion ?? 0),
        ]),
        ["", "", "", "", "TOTAL", num(total), "", ""],
        ["", "", "", "", "CASH", num(cashTotal), "", ""],
        ["", "", "", "", "BANK", num(bankTotal), "", ""],
      ];

      // Per-day rollup
      const byDay = new Map<string, { count: number; interest: number }>();
      for (const r of filteredCollections) {
        const cur = byDay.get(r.date) ?? { count: 0, interest: 0 };
        cur.count += 1;
        cur.interest += r.interest;
        byDay.set(r.date, cur);
      }
      const dayRows: Array<Array<string | number>> = [
        ["Date", "Receipts", "Interest (INR)"],
        ...[...byDay.entries()]
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([date, v]) => [fmtDateXlsx(date), v.count, num(v.interest)]),
      ];

      exportXlsx(`kittangi-interest-ledger-${range}.xlsx`, [
        {
          name: "Interest Ledger",
          rows: ledgerRows,
          colWidths: [14, 14, 14, 26, 8, 14, 14, 14],
        },
        { name: "Daily Rollup", rows: dayRows, colWidths: [14, 10, 16] },
      ]);
      toast.success("Downloaded", {
        icon: <CheckCircle2 className="h-4 w-4" />,
        description: `Interest Ledger XLSX for ${fmtDate(from)} → ${fmtDate(to)}.`,
      });
      return;
    } else if (activeTab === "weekly") {
      // Weekly summary export — handled by its own button inside the tab.
      // This keeps the top-bar export button focused on the date-range tabs.
      toast.message("Use the download button on the Weekly Performance card.");
      return;
    } else {
      const cols: CsvColumn<DefaultRow>[] = [
        { header: "Loan ID", key: "loanId" },
        { header: "Customer", key: "customer" },
        { header: "Disbursed Date", key: "disbursedDate" },
        { header: "Due Date", key: "dueDate" },
        { header: "Days Overdue", key: "daysOverdue" },
        { header: "Outstanding (INR)", key: "outstanding" },
      ];
      const total = filteredDefaults.reduce((s, r) => s + r.outstanding, 0);
      const rows: DefaultRow[] = [
        ...filteredDefaults,
        {
          loanId: "",
          customer: `TOTAL (${filteredDefaults.length} accounts)`,
          disbursedDate: "",
          dueDate: "",
          daysOverdue: 0,
          outstanding: total,
        },
      ];
      downloadCsv(`kittangi-maturity-defaults-${range}.csv`, cols, rows);
    }
    toast.success("Downloaded", {
      icon: <CheckCircle2 className="h-4 w-4" />,
      description: `${activeTab === "register" ? "Loan Register" : "Maturity & Defaults"
        } CSV for ${fmtDate(from)} → ${fmtDate(to)}.`,
    });
  };

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{
              background: ICON_TONE.purple.bg,
              boxShadow: `inset 0 0 0 1px ${ICON_TONE.purple.ring}`,
            }}
          >
            <PieChart className="h-6 w-6" style={{ color: ICON_TONE.purple.fg }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold tracking-tight text-slate-900"
            >
              Reports &amp; Analytics
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Operational and financial insights across the pawn portfolio.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2"
            style={{ borderColor: "rgba(74,111,165,0.18)" }}
          >
            <CalendarRange className="h-4 w-4" style={{ color: ICON_TONE.amber.fg }} />
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Date Range
            </span>
            <Input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 w-37 border-0 px-2 text-sm shadow-none focus-visible:ring-0"
              aria-label="From date"
            />
            <span className="text-xs text-slate-400">→</span>
            <Input
              type="date"
              value={to}
              min={from}
              max={todayIso()}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 w-37 border-0 px-2 text-sm shadow-none focus-visible:ring-0"
              aria-label="To date"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleExport}
            className="h-11 gap-2 border-2 px-4 font-semibold"
            style={{
              borderColor: "var(--brand-primary)",
              color: "var(--text-main)",
              background: "white",
            }}
          >
            <Download className="h-4 w-4" />
            Export to Excel
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as ReportTab)}
        className="w-full"
      >
        <TabsList
          className="mb-6 h-auto w-full justify-start gap-1 rounded-xl border bg-white p-1.5"
          style={{ borderColor: "rgba(74,111,165,0.15)" }}
        >
          <TabsTrigger
            value="register"
            className="gap-2 rounded-lg px-4 py-2 text-sm font-medium"
          >
            <Landmark className="h-4 w-4" />
            Loan Register
          </TabsTrigger>
          <TabsTrigger
            value="collections"
            className="gap-2 rounded-lg px-4 py-2 text-sm font-medium"
          >
            <Coins className="h-4 w-4" />
            Interest Collections
          </TabsTrigger>
          <TabsTrigger
            value="defaults"
            className="gap-2 rounded-lg px-4 py-2 text-sm font-medium"
          >
            <AlertTriangle className="h-4 w-4" />
            Maturity &amp; Defaults
          </TabsTrigger>
          <TabsTrigger
            value="weekly"
            className="gap-2 rounded-lg px-4 py-2 text-sm font-medium"
            data-testid="tab-weekly"
          >
            <TrendingUp className="h-4 w-4" />
            Weekly Performance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="register" className="m-0">
          <LoanRegisterTab rows={filteredRegister} />
        </TabsContent>

        <TabsContent value="collections" className="m-0">
          <CollectionsTab rows={filteredCollections} />
        </TabsContent>

        <TabsContent value="defaults" className="m-0">
          <DefaultsTab rows={filteredDefaults} />
        </TabsContent>

        <TabsContent value="weekly" className="m-0">
          <WeeklyTab
            loans={loans}
            collections={realCollections}
            customers={customers}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------- Tab 1: Loan Register -------------------- */

function LoanRegisterTab({ rows }: { rows: LoanRow[] }) {
  const totalDisbursed = rows.reduce((s, r) => s + r.disbursed, 0);
  const totalWeight = rows.reduce((s, r) => s + r.grossWeightG, 0);

  return (
    <Card className="border bg-white" style={{ borderColor: "rgba(74,111,165,0.12)" }}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{
                background: ICON_TONE.blue.bg,
                boxShadow: `inset 0 0 0 1px ${ICON_TONE.blue.ring}`,
              }}
            >
              <Landmark className="h-5 w-5" style={{ color: ICON_TONE.blue.fg }} />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Loan Register
              </CardTitle>
              <CardDescription className="text-sm text-slate-500">
                All loans originated within the selected window.
              </CardDescription>
            </div>
          </div>

          <SummaryChips
            chips={[
              { label: "Loans", value: String(rows.length) },
              { label: "Gross Weight", value: `${totalWeight.toLocaleString("en-IN")}g` },
              { label: "Disbursed", value: inr(totalDisbursed) },
            ]}
          />
        </div>
      </CardHeader>

      <CardContent>
        <div
          className="overflow-hidden rounded-lg border"
          style={{ borderColor: "rgba(74,111,165,0.12)" }}
        >
          <Table>
            <TableHeader>
              <TableRow style={{ background: "rgba(191,221,245,0.25)" }}>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Date
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Loan ID
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Customer Name
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Item Description
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Gross Weight
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Disbursed Amount
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.loanId} className="hover:bg-slate-50/60">
                  <TableCell className="py-3 text-sm text-slate-700">{fmtDate(r.date)}</TableCell>
                  <TableCell className="py-3">
                    <span
                      className="rounded-md px-2 py-0.5 font-mono text-xs font-semibold"
                      style={{
                        background: "rgba(191,221,245,0.35)",
                        color: "var(--text-main)",
                      }}
                    >
                      {r.loanId}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 font-medium text-slate-900">{r.customer}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">{r.itemDesc}</TableCell>
                  <TableCell className="py-3 text-right text-sm font-medium text-slate-700">
                    {r.grossWeightG}g
                  </TableCell>
                  <TableCell className="py-3 text-right font-semibold" style={{ color: "var(--text-main)" }}>
                    {inr(r.disbursed)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow style={{ background: "rgba(191,221,245,0.18)" }}>
                <TableCell className="py-3 text-xs font-semibold uppercase tracking-wide text-slate-600" colSpan={4}>
                  Totals
                </TableCell>
                <TableCell className="py-3 text-right text-sm font-bold text-slate-800">
                  {totalWeight.toLocaleString("en-IN")}g
                </TableCell>
                <TableCell className="py-3 text-right font-bold" style={{ color: "var(--text-main)" }}>
                  {inr(totalDisbursed)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------- Tab 2: Interest Collections -------------------- */

function CollectionsTab({ rows }: { rows: CollectionRow[] }) {
  const settings = useSettings();
  const isAdmin = useIsAdmin();

  // Derive a Legal/Company split for every row. Prefer the portions that
  // were stamped on the source Daybook entry at receipt time (so the report
  // reflects the per-loan override that was in effect at posting). Fall
  // back to recomputing from the loan's rate + global setting for legacy /
  // seed entries that have no provenance.
  const enrichedRows = useMemo(
    () =>
      rows.map((r) => {
        const hasProvenance =
          typeof r.legalPortion === "number" &&
          typeof r.companyPortion === "number";
        if (hasProvenance) {
          return {
            ...r,
            legal: r.legalPortion ?? 0,
            company: r.companyPortion ?? 0,
          };
        }
        const fallbackAnnualRate =
          r.loanAnnualRatePct ?? settings.pawnRatePctPerMonth * 12;
        const fallbackLegalRate =
          r.legalRatePctPerAnnumOverride ?? settings.globalLegalInterestRatePct;
        const split = splitInterest({
          totalInterest: r.interest,
          loanAnnualRatePct: fallbackAnnualRate,
          legalRatePctPerAnnum: fallbackLegalRate,
        });
        return { ...r, legal: split.legal, company: split.company };
      }),
    [rows, settings.pawnRatePctPerMonth, settings.globalLegalInterestRatePct],
  );

  const totalInterest = enrichedRows.reduce((s, r) => s + r.interest, 0);
  const totalLegal = enrichedRows.reduce((s, r) => s + r.legal, 0);
  const totalCompany = enrichedRows.reduce((s, r) => s + r.company, 0);
  const cashCount = rows.filter((r) => r.mode === "CASH").length;
  const bankCount = rows.length - cashCount;

  return (
    <Card className="border bg-white" style={{ borderColor: "rgba(74,111,165,0.12)" }}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{
                background: ICON_TONE.green.bg,
                boxShadow: `inset 0 0 0 1px ${ICON_TONE.green.ring}`,
              }}
            >
              <Coins className="h-5 w-5" style={{ color: ICON_TONE.green.fg }} />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Interest Collections
              </CardTitle>
              <CardDescription className="text-sm text-slate-500">
                Realized interest income from active and closed loans.
              </CardDescription>
            </div>
          </div>

          <SummaryChips
            chips={[
              { label: "Receipts", value: String(rows.length) },
              { label: "Cash", value: String(cashCount) },
              { label: "Bank", value: String(bankCount) },
              { label: "Interest", value: inr(totalInterest), accent: true },
            ]}
          />
        </div>
      </CardHeader>

      <CardContent>
        <div
          className="overflow-hidden rounded-lg border"
          style={{ borderColor: "rgba(74,111,165,0.12)" }}
        >
          <Table>
            <TableHeader>
              <TableRow style={{ background: "rgba(191,221,245,0.25)" }}>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Date</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Receipt ID</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Loan ID</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Customer Name</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Payment Mode</TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">Interest Collected</TableHead>
                {isAdmin && (
                  <>
                    <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      Legal
                    </TableHead>
                    <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      Company
                    </TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrichedRows.map((r) => {
                const mode = MODE_META[r.mode];
                return (
                  <TableRow key={r.receiptId} className="hover:bg-slate-50/60">
                    <TableCell className="py-3 text-sm text-slate-700">{fmtDate(r.date)}</TableCell>
                    <TableCell className="py-3">
                      <span className="font-mono text-xs font-semibold text-slate-700">{r.receiptId}</span>
                    </TableCell>
                    <TableCell className="py-3">
                      <span
                        className="rounded-md px-2 py-0.5 font-mono text-xs font-semibold"
                        style={{
                          background: "rgba(191,221,245,0.35)",
                          color: "var(--text-main)",
                        }}
                      >
                        {r.loanId}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 font-medium text-slate-900">{r.customer}</TableCell>
                    <TableCell className="py-3">
                      <Badge
                        className="border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                        style={{
                          background: mode.bg,
                          color: mode.fg,
                          borderColor: mode.border,
                        }}
                      >
                        {mode.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 text-right font-semibold text-emerald-700">
                      {inr(r.interest)}
                    </TableCell>
                    {isAdmin && (
                      <>
                        <TableCell
                          className="py-3 text-right text-sm font-medium text-slate-700"
                          data-testid={`legal-${r.receiptId}`}
                        >
                          {inr(r.legal)}
                        </TableCell>
                        <TableCell
                          className="py-3 text-right text-sm font-medium text-slate-700"
                          data-testid={`company-${r.receiptId}`}
                        >
                          {inr(r.company)}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                );
              })}
              <TableRow style={{ background: "rgba(16,185,129,0.08)" }}>
                <TableCell className="py-3 text-xs font-semibold uppercase tracking-wide text-slate-600" colSpan={5}>
                  Total Interest Collected
                </TableCell>
                <TableCell className="py-3 text-right text-base font-bold text-emerald-700">
                  {inr(totalInterest)}
                </TableCell>
                {isAdmin && (
                  <>
                    <TableCell className="py-3 text-right text-sm font-bold text-slate-800">
                      {inr(totalLegal)}
                    </TableCell>
                    <TableCell className="py-3 text-right text-sm font-bold text-slate-800">
                      {inr(totalCompany)}
                    </TableCell>
                  </>
                )}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------- Tab 3: Maturity & Defaults -------------------- */

function DefaultsTab({ rows }: { rows: DefaultRow[] }) {
  const totalRisk = rows.reduce((s, r) => s + r.outstanding, 0);
  const maxOverdue = rows.reduce((m, r) => Math.max(m, r.daysOverdue), 0);

  return (
    <Card className="border bg-white" style={{ borderColor: "rgba(74,111,165,0.12)" }}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: "rgba(244,63,94,0.12)" }}
            >
              <AlertTriangle className="h-5 w-5" style={{ color: "#be123c" }} />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Maturity &amp; Defaults
              </CardTitle>
              <CardDescription className="text-sm text-slate-500">
                Loans that have crossed their tenure end-date and require recovery action.
              </CardDescription>
            </div>
          </div>

          <SummaryChips
            chips={[
              { label: "At Risk", value: String(rows.length) },
              { label: "Max Overdue", value: `${maxOverdue} days`, danger: true },
              { label: "Outstanding", value: inr(totalRisk), danger: true },
            ]}
          />
        </div>
      </CardHeader>

      <CardContent>
        <div
          className="overflow-hidden rounded-lg border"
          style={{ borderColor: "rgba(74,111,165,0.12)" }}
        >
          <Table>
            <TableHeader>
              <TableRow style={{ background: "rgba(244,63,94,0.07)" }}>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Loan ID</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Customer</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Disbursed Date</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Due Date</TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">Days Overdue</TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">Principal + Accrued Interest</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.loanId} className="hover:bg-rose-50/40">
                  <TableCell className="py-3">
                    <span
                      className="rounded-md px-2 py-0.5 font-mono text-xs font-semibold"
                      style={{
                        background: "rgba(191,221,245,0.35)",
                        color: "var(--text-main)",
                      }}
                    >
                      {r.loanId}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 font-medium text-slate-900">{r.customer}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{fmtDate(r.disbursedDate)}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{fmtDate(r.dueDate)}</TableCell>
                  <TableCell className="py-3 text-right">
                    <span className="font-bold text-slate-900">
                      {r.daysOverdue} days
                    </span>
                  </TableCell>
                  <TableCell className="py-3 text-right font-semibold text-slate-900">
                    {inr(r.outstanding)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow style={{ background: "rgba(244,63,94,0.08)" }}>
                <TableCell className="py-3 text-xs font-semibold uppercase tracking-wide text-slate-600" colSpan={5}>
                  Total Outstanding At Risk
                </TableCell>
                <TableCell className="py-3 text-right text-base font-bold text-slate-900">
                  {inr(totalRisk)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------- Tab 4: Weekly Performance -------------------- */

function WeeklyTab({
  loans,
  collections,
  customers,
}: {
  loans: import("@/lib/stores/loansStore").Loan[];
  collections: CollectionRow[];
  customers: import("@/lib/stores/customersStore").Customer[];
}) {
  const { startIso, endIso } = useMemo(currentWeekRange, []);

  const inWeek = (iso: string) => iso >= startIso && iso <= endIso;

  const loansThisWeek = useMemo(
    () => loans.filter((l) => inWeek(l.startedAtIso)),
    [loans, startIso, endIso],
  );
  const principalDisbursed = loansThisWeek.reduce(
    (s, l) => s + (l.principal ?? 0),
    0,
  );
  const collectionsThisWeek = useMemo(
    () => collections.filter((r) => inWeek(r.date)),
    [collections, startIso, endIso],
  );
  const interestCollected = collectionsThisWeek.reduce(
    (s, r) => s + r.interest,
    0,
  );
  // Customers added this week ≈ distinct customer codes that received their
  // first loan within the window. We don't persist a `createdIso` on Customer,
  // so this is the most honest derivation from real data.
  const newCustomerCodes = useMemo(() => {
    const earliest = new Map<string, string>();
    for (const l of loans) {
      const cur = earliest.get(l.customerCode);
      if (!cur || l.startedAtIso < cur) earliest.set(l.customerCode, l.startedAtIso);
    }
    const codes = new Set<string>();
    for (const [code, iso] of earliest) if (inWeek(iso)) codes.add(code);
    return codes;
  }, [loans, startIso, endIso]);

  const customersAdded = newCustomerCodes.size;

  // Top 5 loans this week (by principal)
  const top5Loans = useMemo(
    () =>
      [...loansThisWeek]
        .sort((a, b) => b.principal - a.principal)
        .slice(0, 5),
    [loansThisWeek],
  );

  const handleDownload = () => {
    const range = `${startIso}_to_${endIso}`;
    const summarySheet: Array<Array<string | number>> = [
      ["Kittangi Weekly Performance Summary"],
      [`Period`, `${fmtDate(startIso)} → ${fmtDate(endIso)}`],
      [],
      ["Metric", "Value"],
      ["Loans Originated", num(loansThisWeek.length)],
      ["Principal Disbursed (INR)", num(principalDisbursed)],
      ["Interest Collected (INR)", num(interestCollected)],
      ["Customers Added (first loan this week)", num(customersAdded)],
      ["Total Customers (cumulative)", num(customers.length)],
    ];

    const loansSheet: Array<Array<string | number>> = [
      ["Loan ID", "Customer", "Product", "Principal (INR)", "Started"],
      ...loansThisWeek.map((l) => [
        l.id,
        l.customer,
        l.product,
        num(l.principal),
        fmtDateXlsx(l.startedAtIso),
      ]),
    ];

    const top5Sheet: Array<Array<string | number>> = [
      ["Rank", "Loan ID", "Customer", "Product", "Principal (INR)"],
      ...top5Loans.map((l, i) => [
        i + 1,
        l.id,
        l.customer,
        l.product,
        num(l.principal),
      ]),
    ];

    const interestSheet: Array<Array<string | number>> = [
      ["Date", "Receipt ID", "Loan ID", "Customer", "Mode", "Interest (INR)"],
      ...collectionsThisWeek.map((r) => [
        fmtDateXlsx(r.date),
        r.receiptId,
        r.loanId,
        r.customer,
        r.mode,
        num(r.interest),
      ]),
    ];

    exportXlsx(`kittangi-weekly-summary-${range}.xlsx`, [
      { name: "Summary", rows: summarySheet, colWidths: [40, 22] },
      { name: "Loans This Week", rows: loansSheet, colWidths: [16, 26, 10, 18, 14] },
      { name: "Top 5 Loans", rows: top5Sheet, colWidths: [6, 16, 26, 10, 18] },
      { name: "Interest This Week", rows: interestSheet, colWidths: [14, 14, 16, 26, 8, 16] },
    ]);

    toast.success("Downloaded", {
      icon: <CheckCircle2 className="h-4 w-4" />,
      description: `Weekly Summary XLSX for ${fmtDate(startIso)} → ${fmtDate(endIso)}.`,
    });
  };

  return (
    <Card className="border bg-white" style={{ borderColor: "rgba(74,111,165,0.12)" }}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{
                background: ICON_TONE.purple.bg,
                boxShadow: `inset 0 0 0 1px ${ICON_TONE.purple.ring}`,
              }}
            >
              <TrendingUp
                className="h-5 w-5"
                style={{ color: ICON_TONE.purple.fg }}
              />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Weekly Performance Summary
              </CardTitle>
              <CardDescription className="text-sm text-slate-500">
                Sunday {fmtDate(startIso)} → Saturday {fmtDate(endIso)}
              </CardDescription>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleDownload}
            className="h-10 gap-2 px-4 text-sm font-semibold text-white"
            style={{ background: "var(--brand-primary)" }}
            data-testid="button-download-weekly"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Download Weekly Summary (XLSX)
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <WeeklyMetricCard
            label="Loans Originated"
            value={String(loansThisWeek.length)}
            tone="brand"
            icon={Landmark}
          />
          <WeeklyMetricCard
            label="Principal Disbursed"
            value={inr(principalDisbursed)}
            tone="brand"
            icon={TrendingUp}
          />
          <WeeklyMetricCard
            label="Interest Collected"
            value={inr(interestCollected)}
            tone="emerald"
            icon={Coins}
          />
          <WeeklyMetricCard
            label="Customers Added"
            value={String(customersAdded)}
            tone="amber"
            icon={Users}
          />
        </div>

        <div
          className="overflow-hidden rounded-lg border"
          style={{ borderColor: "rgba(74,111,165,0.12)" }}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{
              borderColor: "rgba(74,111,165,0.12)",
              background: "rgba(191,221,245,0.18)",
            }}
          >
            <h3 className="text-sm font-semibold text-slate-800">
              Top 5 Loans This Week
            </h3>
            <span className="text-xs text-slate-500">By principal</span>
          </div>
          {top5Loans.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              No loans originated this week yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow style={{ background: "rgba(191,221,245,0.10)" }}>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    Rank
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    Loan ID
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    Customer
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    Product
                  </TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    Principal
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {top5Loans.map((l, i) => (
                  <TableRow key={l.id} className="hover:bg-slate-50/60">
                    <TableCell className="py-3 text-sm font-semibold text-slate-700">
                      #{i + 1}
                    </TableCell>
                    <TableCell className="py-3">
                      <span
                        className="rounded-md px-2 py-0.5 font-mono text-xs font-semibold"
                        style={{
                          background: "rgba(191,221,245,0.35)",
                          color: "var(--text-main)",
                        }}
                      >
                        {l.id}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 font-medium text-slate-900">
                      {l.customer}
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge
                        className="border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                        style={
                          l.product === "PAWN"
                            ? {
                              background: "rgba(245,158,11,0.12)",
                              color: "#b45309",
                              borderColor: "rgba(245,158,11,0.35)",
                            }
                            : {
                              background: "rgba(74,111,165,0.12)",
                              color: "#1d4ed8",
                              borderColor: "rgba(74,111,165,0.35)",
                            }
                        }
                      >
                        {l.product}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="py-3 text-right font-semibold"
                      style={{ color: "var(--text-main)" }}
                    >
                      {inr(l.principal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function WeeklyMetricCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone: "brand" | "emerald" | "amber";
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}) {
  const colors =
    tone === "emerald"
      ? { bg: "rgba(16,185,129,0.08)", fg: "#047857", border: "rgba(16,185,129,0.25)", iconBg: ICON_TONE.green.bg, iconFg: ICON_TONE.green.fg }
      : tone === "amber"
        ? { bg: "rgba(245,158,11,0.08)", fg: "#b45309", border: "rgba(245,158,11,0.25)", iconBg: ICON_TONE.amber.bg, iconFg: ICON_TONE.amber.fg }
        : { bg: "rgba(59,130,246,0.08)", fg: "#1d4ed8", border: "rgba(59,130,246,0.25)", iconBg: ICON_TONE.blue.bg, iconFg: ICON_TONE.blue.fg };
  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: colors.bg, borderColor: colors.border }}
    >
      <div
        className="mb-2 flex h-9 w-9 items-center justify-center rounded-full"
        style={{
          background: colors.iconBg,
          boxShadow: `inset 0 0 0 1px ${colors.border}`,
        }}
      >
        <Icon className="h-4 w-4" style={{ color: colors.iconFg }} />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </p>
      <p
        className="mt-1.5 text-2xl font-bold"
        style={{ color: colors.fg }}
      >
        {value}
      </p>
    </div>
  );
}

/* -------------------- Helpers -------------------- */

function SummaryChips({
  chips,
}: {
  chips: Array<{ label: string; value: string; accent?: boolean; danger?: boolean }>;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-white px-4 py-2 text-sm"
      style={{ borderColor: "rgba(74,111,165,0.18)" }}
    >
      {chips.map((c, i) => (
        <div key={c.label} className="flex items-center gap-2">
          {i > 0 && <span className="text-slate-200">|</span>}
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {c.label}
          </span>
          <span
            className={`font-semibold ${c.danger ? "text-slate-900" : c.accent ? "text-emerald-700" : "text-slate-900"}`}
            style={c.accent || c.danger ? undefined : { color: "var(--text-main)" }}
          >
            {c.value}
          </span>
        </div>
      ))}
    </div>
  );
}

