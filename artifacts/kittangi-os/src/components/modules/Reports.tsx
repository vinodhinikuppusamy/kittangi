import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Coins,
  Download,
  Landmark,
  PieChart,
} from "lucide-react";

import { downloadCsv, type CsvColumn } from "@/lib/csv";
import { useSettings, splitInterest } from "@/lib/stores/settingsStore";
import { useIsAdmin } from "@/lib/stores/userRoleStore";
import { useDaybook } from "@/lib/stores/daybookStore";
import { useLoans } from "@/lib/stores/loansStore";

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

const LOAN_REGISTER: LoanRow[] = [
  { date: "2026-04-12", loanId: "PWN-204402", customer: "Aanya Sharma", itemDesc: "Gold Coin (50g · 24K)", grossWeightG: 50, disbursed: 305000 },
  { date: "2026-04-13", loanId: "PWN-204415", customer: "Rohan Verma", itemDesc: "Silver Anklets (Pair)", grossWeightG: 280, disbursed: 24500 },
  { date: "2026-04-14", loanId: "PWN-204421", customer: "Karthik R", itemDesc: "22K Gold Ring (Mens)", grossWeightG: 11, disbursed: 51000 },
  { date: "2026-04-15", loanId: "PWN-204428", customer: "Sneha B", itemDesc: "Diamond Stud Earrings", grossWeightG: 4, disbursed: 96000 },
  { date: "2026-04-16", loanId: "PWN-204430", customer: "Lakshmi V", itemDesc: "Gold Necklace (Antique)", grossWeightG: 62, disbursed: 295000 },
  { date: "2026-04-18", loanId: "PWN-204512", customer: "Anand", itemDesc: "22K Gold Chain", grossWeightG: 45, disbursed: 210000 },
  { date: "2026-04-19", loanId: "PWN-204519", customer: "Meera Iyer", itemDesc: "Gold Bangles (Set of 4)", grossWeightG: 88, disbursed: 425000 },
  { date: "2026-04-21", loanId: "PWN-204527", customer: "Kunal Mehta", itemDesc: "Diamond Solitaire Ring", grossWeightG: 6, disbursed: 185000 },
  { date: "2026-04-22", loanId: "PWN-204533", customer: "Suresh Patel", itemDesc: "Silver Pooja Set", grossWeightG: 720, disbursed: 62000 },
  { date: "2026-04-23", loanId: "PWN-204540", customer: "Priya Menon", itemDesc: "22K Gold Earrings (Pair)", grossWeightG: 14, disbursed: 64000 },
  { date: "2026-04-24", loanId: "PWN-204555", customer: "Ravi Krishnan", itemDesc: "Gold Mangalsutra", grossWeightG: 22, disbursed: 98000 },
  { date: "2026-04-25", loanId: "PWN-204561", customer: "Divya Nair", itemDesc: "18K Diamond Pendant", grossWeightG: 8, disbursed: 142000 },
];

const COLLECTIONS: CollectionRow[] = [
  { date: "2026-04-27", receiptId: "RCP-88421", loanId: "PWN-204402", customer: "Ravi Krishnan", mode: "CASH", interest: 2640 },
  { date: "2026-04-27", receiptId: "RCP-88422", loanId: "PWN-204415", customer: "Meera Iyer", mode: "BANK", interest: 15000 },
  { date: "2026-04-27", receiptId: "RCP-88423", loanId: "PWN-204555", customer: "Suresh Patel", mode: "BANK", interest: 86420 },
  { date: "2026-04-27", receiptId: "RCP-88424", loanId: "PWN-204512", customer: "Aanya Sharma", mode: "CASH", interest: 1408 },
  { date: "2026-04-27", receiptId: "RCP-88425", loanId: "PWN-204561", customer: "Divya Nair", mode: "BANK", interest: 8000 },
  { date: "2026-04-27", receiptId: "RCP-88426", loanId: "PWN-204519", customer: "Rohan Verma", mode: "BANK", interest: 12150 },
  { date: "2026-04-27", receiptId: "RCP-88427", loanId: "PWN-204527", customer: "Kunal Mehta", mode: "CASH", interest: 715 },
  { date: "2026-04-26", receiptId: "RCP-88412", loanId: "PWN-204430", customer: "Lakshmi V", mode: "CASH", interest: 4425 },
  { date: "2026-04-26", receiptId: "RCP-88413", loanId: "PWN-204421", customer: "Karthik R", mode: "BANK", interest: 765 },
  { date: "2026-04-25", receiptId: "RCP-88401", loanId: "PWN-204540", customer: "Priya Menon", mode: "CASH", interest: 960 },
];

const DEFAULTS: DefaultRow[] = [
  { loanId: "PWN-204402", customer: "Aanya Sharma", disbursedDate: "2025-10-12", dueDate: "2026-04-12", daysOverdue: 15, outstanding: 322000 },
  { loanId: "PWN-204428", customer: "Sneha B", disbursedDate: "2025-10-15", dueDate: "2026-04-15", daysOverdue: 12, outstanding: 101400 },
  { loanId: "PWN-204312", customer: "Vikram Hegde", disbursedDate: "2025-09-22", dueDate: "2026-03-22", daysOverdue: 36, outstanding: 178650 },
  { loanId: "PWN-204288", customer: "Manoj Pillai", disbursedDate: "2025-09-08", dueDate: "2026-03-08", daysOverdue: 50, outstanding: 88420 },
  { loanId: "PWN-204255", customer: "Anita K", disbursedDate: "2025-08-30", dueDate: "2026-02-28", daysOverdue: 58, outstanding: 245300 },
  { loanId: "PWN-204210", customer: "Rakesh G", disbursedDate: "2025-08-14", dueDate: "2026-02-14", daysOverdue: 72, outstanding: 142800 },
  { loanId: "PWN-204188", customer: "Geeta R", disbursedDate: "2025-08-02", dueDate: "2026-02-02", daysOverdue: 84, outstanding: 67200 },
];

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

type ReportTab = "register" | "collections" | "defaults";

export default function Reports() {
  const [from, setFrom] = useState(thirtyDaysAgoIso());
  const [to, setTo] = useState(todayIso());
  const [activeTab, setActiveTab] = useState<ReportTab>("register");

  const inRange = (iso: string) => iso >= from && iso <= to;

  // ----- Real ledger data: derive Interest Collections from the Daybook -----
  // Source of truth = persisted Daybook entries posted by ReceiptsLedger
  // (Interest Income / EMI Received / Full Settlement). For Full Settlement
  // we count only the interest slice of the lump payment, which equals
  // legalInterestPortion + companyInterestPortion when the entry was posted
  // by ReceiptsLedger. Seed/legacy rows without those portions fall through
  // to a settings-based recomputation in CollectionsTab.
  const daybook = useDaybook();
  const loans = useLoans();
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

  const filteredRegister = useMemo(
    () => LOAN_REGISTER.filter((r) => inRange(r.date)),
    [from, to],
  );
  const filteredCollections = useMemo(
    () => realCollections.filter((r) => inRange(r.date)),
    [from, to, realCollections],
  );
  // The defaults list is point-in-time, not date-ranged — show it as-is.
  const filteredDefaults = DEFAULTS;

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
      const cols: CsvColumn<CollectionRow>[] = [
        { header: "Date", key: "date" },
        { header: "Receipt ID", key: "receiptId" },
        { header: "Loan ID", key: "loanId" },
        { header: "Customer", key: "customer" },
        { header: "Mode", key: "mode" },
        { header: "Interest (INR)", key: "interest" },
      ];
      const total = filteredCollections.reduce((s, r) => s + r.interest, 0);
      const rows: CollectionRow[] = [
        ...filteredCollections,
        {
          date: "",
          receiptId: "",
          loanId: "",
          customer: `TOTAL (${filteredCollections.length} receipts)`,
          mode: "CASH",
          interest: total,
        },
      ];
      downloadCsv(`kittangi-interest-collections-${range}.csv`, cols, rows);
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
      description: `${
        activeTab === "register"
          ? "Loan Register"
          : activeTab === "collections"
            ? "Interest Collections"
            : "Maturity & Defaults"
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
            style={{ background: "var(--brand-light)" }}
          >
            <PieChart className="h-6 w-6" style={{ color: "var(--brand-primary)" }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: "var(--brand-primary)" }}
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
            <CalendarRange className="h-4 w-4" style={{ color: "var(--brand-primary)" }} />
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Date Range
            </span>
            <Input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 w-[148px] border-0 px-2 text-sm shadow-none focus-visible:ring-0"
              aria-label="From date"
            />
            <span className="text-xs text-slate-400">→</span>
            <Input
              type="date"
              value={to}
              min={from}
              max={todayIso()}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 w-[148px] border-0 px-2 text-sm shadow-none focus-visible:ring-0"
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
              color: "var(--brand-primary)",
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
            className="data-[state=active]:bg-[var(--brand-light)] data-[state=active]:text-[color:var(--brand-primary)] data-[state=active]:shadow-none gap-2 rounded-lg px-4 py-2 text-sm font-medium"
          >
            <Landmark className="h-4 w-4" />
            Loan Register
          </TabsTrigger>
          <TabsTrigger
            value="collections"
            className="data-[state=active]:bg-[var(--brand-light)] data-[state=active]:text-[color:var(--brand-primary)] data-[state=active]:shadow-none gap-2 rounded-lg px-4 py-2 text-sm font-medium"
          >
            <Coins className="h-4 w-4" />
            Interest Collections
          </TabsTrigger>
          <TabsTrigger
            value="defaults"
            className="data-[state=active]:bg-[var(--brand-light)] data-[state=active]:text-[color:var(--brand-primary)] data-[state=active]:shadow-none gap-2 rounded-lg px-4 py-2 text-sm font-medium"
          >
            <AlertTriangle className="h-4 w-4" />
            Maturity &amp; Defaults
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
              style={{ background: "var(--brand-light)" }}
            >
              <Landmark className="h-5 w-5" style={{ color: "var(--brand-primary)" }} />
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
                        color: "var(--brand-primary)",
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
                  <TableCell className="py-3 text-right font-semibold" style={{ color: "var(--brand-primary)" }}>
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
                <TableCell className="py-3 text-right font-bold" style={{ color: "var(--brand-primary)" }}>
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
              style={{ background: "var(--brand-light)" }}
            >
              <Coins className="h-5 w-5" style={{ color: "var(--brand-primary)" }} />
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
                          color: "var(--brand-primary)",
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
                        color: "var(--brand-primary)",
                      }}
                    >
                      {r.loanId}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 font-medium text-slate-900">{r.customer}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{fmtDate(r.disbursedDate)}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{fmtDate(r.dueDate)}</TableCell>
                  <TableCell className="py-3 text-right">
                    <span className="font-bold text-rose-600">
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
                <TableCell className="py-3 text-right text-base font-bold text-rose-700">
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
            className={`font-semibold ${c.danger ? "text-rose-600" : c.accent ? "text-emerald-700" : "text-slate-900"}`}
            style={c.accent || c.danger ? undefined : { color: "var(--brand-primary)" }}
          >
            {c.value}
          </span>
        </div>
      ))}
    </div>
  );
}

