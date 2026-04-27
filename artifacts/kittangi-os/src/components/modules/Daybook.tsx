import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Calendar,
  Printer,
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useDaybook,
  type DaybookAccount,
  type DaybookEntry,
} from "@/lib/stores/daybookStore";

const OPENING_BALANCE = 218430;

const ACCOUNT_SHORT: Record<DaybookAccount, string> = {
  CASH: "Cash",
  HDFC: "HDFC",
  SBI: "SBI",
};

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function prettyDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function accountChip(account: DaybookAccount) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border bg-white px-2 py-0.5 text-[11px] font-medium"
      style={{
        borderColor: "rgba(74,111,165,0.18)",
        color: "var(--brand-primary)",
      }}
    >
      <Wallet size={11} />
      {ACCOUNT_SHORT[account]}
    </span>
  );
}

type SummaryCardProps = {
  label: string;
  hint: string;
  value: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  iconBg: string;
  iconColor: string;
  emphasis?: boolean;
};

function SummaryCard({
  label,
  hint,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  emphasis = false,
}: SummaryCardProps) {
  return (
    <Card
      className="border bg-white shadow-sm"
      style={
        emphasis
          ? {
              borderColor: "rgba(74,111,165,0.25)",
              background:
                "linear-gradient(135deg, #FFFFFF 0%, rgba(191,221,245,0.30) 100%)",
            }
          : { borderColor: "rgba(74,111,165,0.12)" }
      }
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {label}
            </div>
            <div
              className={`mt-2 tracking-tight ${
                emphasis ? "text-3xl font-extrabold" : "text-2xl font-bold"
              }`}
              style={{ color: "var(--brand-primary)" }}
            >
              {value}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">{hint}</div>
          </div>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: iconBg }}
          >
            <Icon size={18} style={{ color: iconColor }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Daybook() {
  const allEntries = useDaybook();

  // Default to the most recent date that actually has entries so the page
  // never opens to an empty Chitta even after several demo days have passed.
  const latestDate = useMemo(() => {
    if (allEntries.length === 0) return todayIso();
    return allEntries.reduce(
      (max, e) => (e.dateIso > max ? e.dateIso : max),
      allEntries[0].dateIso,
    );
  }, [allEntries]);

  const [date, setDate] = useState<string>(() => latestDate);

  const dayEntries = useMemo<DaybookEntry[]>(
    () => allEntries.filter((e) => e.dateIso === date),
    [allEntries, date],
  );
  const inflows = useMemo(
    () => dayEntries.filter((e) => e.side === "CREDIT"),
    [dayEntries],
  );
  const outflows = useMemo(
    () => dayEntries.filter((e) => e.side === "DEBIT"),
    [dayEntries],
  );

  const totalInflows = useMemo(
    () => inflows.reduce((s, x) => s + x.amount, 0),
    [inflows],
  );
  const totalOutflows = useMemo(
    () => outflows.reduce((s, x) => s + x.amount, 0),
    [outflows],
  );
  const closing = OPENING_BALANCE + totalInflows - totalOutflows;
  const isBalanced = totalInflows + OPENING_BALANCE >= totalOutflows;

  return (
    <div className="mx-auto max-w-7xl pb-10">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: "var(--brand-light)" }}
          >
            <BookOpen size={22} style={{ color: "var(--brand-primary)" }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--brand-primary)" }}
            >
              Daily Chitta / Daybook
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Consolidated cash &amp; bank movements for{" "}
              <span className="font-medium text-slate-700">
                {prettyDate(date)}
              </span>
              .
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex items-center gap-2 rounded-lg border bg-white px-2.5 py-1.5"
            style={{ borderColor: "rgba(74,111,165,0.18)" }}
          >
            <Calendar size={14} style={{ color: "var(--brand-primary)" }} />
            <Input
              type="date"
              value={date}
              max={todayIso()}
              onChange={(e) => setDate(e.target.value)}
              className="h-7 w-[160px] border-0 p-0 text-sm focus-visible:ring-0"
              style={{ color: "var(--brand-primary)" }}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-9 px-3 text-xs"
            style={{
              borderColor: "rgba(74,111,165,0.25)",
              color: "var(--brand-primary)",
            }}
            onClick={() => window.print()}
          >
            <Printer size={14} className="mr-1.5" />
            Print Chitta
          </Button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          label="Opening Balance"
          hint="Cash carried from yesterday"
          value={inr(OPENING_BALANCE)}
          icon={Wallet}
          iconBg="var(--brand-light)"
          iconColor="var(--brand-primary)"
        />
        <SummaryCard
          label="Total Inflows (Credit)"
          hint={`${inflows.length} receipt entries`}
          value={inr(totalInflows)}
          icon={TrendingUp}
          iconBg="rgba(34,197,94,0.12)"
          iconColor="rgb(21,128,61)"
        />
        <SummaryCard
          label="Total Outflows (Debit)"
          hint={`${outflows.length} payment entries`}
          value={inr(totalOutflows)}
          icon={TrendingDown}
          iconBg="rgba(220,38,38,0.10)"
          iconColor="rgb(185,28,28)"
        />
        <SummaryCard
          label="Closing Balance"
          hint="Opening + Inflows − Outflows"
          value={inr(closing)}
          icon={Scale}
          iconBg="var(--brand-light)"
          iconColor="var(--brand-primary)"
          emphasis
        />
      </div>

      {/* Reconciliation strip */}
      <div
        className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3"
        style={{ borderColor: "rgba(74,111,165,0.15)" }}
      >
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Scale size={14} style={{ color: "var(--brand-primary)" }} />
            <span className="font-semibold text-slate-700">Reconciliation</span>
          </div>
          <span className="text-slate-400">|</span>
          <span className="text-slate-600">
            Opening{" "}
            <span className="font-semibold" style={{ color: "var(--brand-primary)" }}>
              {inr(OPENING_BALANCE)}
            </span>
          </span>
          <span className="text-slate-400">+</span>
          <span className="text-emerald-700">
            Credits{" "}
            <span className="font-semibold">{inr(totalInflows)}</span>
          </span>
          <span className="text-slate-400">−</span>
          <span className="text-red-700">
            Debits <span className="font-semibold">{inr(totalOutflows)}</span>
          </span>
          <span className="text-slate-400">=</span>
          <span style={{ color: "var(--brand-primary)" }}>
            Closing{" "}
            <span className="font-bold">{inr(closing)}</span>
          </span>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
          style={{
            backgroundColor: isBalanced
              ? "rgba(34,197,94,0.14)"
              : "rgba(220,38,38,0.10)",
            color: isBalanced ? "rgb(21,128,61)" : "rgb(185,28,28)",
          }}
        >
          {isBalanced ? "Books balanced" : "Negative liquidity — review!"}
        </span>
      </div>

      {/* T-Account Ledger */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* CREDIT / Inflows */}
        <Card
          className="border bg-white shadow-sm"
          style={{ borderColor: "rgba(74,111,165,0.12)" }}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "rgba(34,197,94,0.12)" }}
                >
                  <ArrowDownLeft
                    size={16}
                    style={{ color: "rgb(21,128,61)" }}
                  />
                </div>
                <div>
                  <CardTitle
                    className="text-base font-semibold"
                    style={{ color: "var(--brand-primary)" }}
                  >
                    Receipts &amp; Income
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Credit entries — money flowing in.
                  </CardDescription>
                </div>
              </div>
              <span
                className="rounded-md px-2.5 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: "rgba(34,197,94,0.14)",
                  color: "rgb(21,128,61)",
                }}
              >
                {inr(totalInflows)}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div
              className="overflow-hidden rounded-lg border"
              style={{ borderColor: "rgba(74,111,165,0.12)" }}
            >
              <Table>
                <TableHeader>
                  <TableRow
                    style={{ backgroundColor: "rgba(34,197,94,0.06)" }}
                  >
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                      Time
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                      Particulars
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                      Account
                    </TableHead>
                    <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                      Amount
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inflows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-8 text-center text-xs text-slate-500"
                      >
                        No credits recorded for this date.
                      </TableCell>
                    </TableRow>
                  ) : (
                    inflows.map((row) => (
                      <TableRow key={row.id} className="hover:bg-emerald-50/40">
                        <TableCell className="text-xs text-slate-600">
                          {row.time}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium text-slate-800">
                            {row.particulars}
                          </div>
                          {row.refId && (
                            <div className="text-[11px] text-slate-500">
                              {row.refId}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{accountChip(row.account)}</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-emerald-700">
                          + {inr(row.amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  <TableRow
                    style={{
                      backgroundColor: "rgba(34,197,94,0.06)",
                      borderTop: "2px solid rgba(34,197,94,0.25)",
                    }}
                  >
                    <TableCell colSpan={3} className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Total Credits
                    </TableCell>
                    <TableCell className="text-right text-sm font-bold text-emerald-700">
                      {inr(totalInflows)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* DEBIT / Outflows */}
        <Card
          className="border bg-white shadow-sm"
          style={{ borderColor: "rgba(74,111,165,0.12)" }}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "rgba(220,38,38,0.10)" }}
                >
                  <ArrowUpRight
                    size={16}
                    style={{ color: "rgb(185,28,28)" }}
                  />
                </div>
                <div>
                  <CardTitle
                    className="text-base font-semibold"
                    style={{ color: "var(--brand-primary)" }}
                  >
                    Payments &amp; Expenses
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Debit entries — money flowing out.
                  </CardDescription>
                </div>
              </div>
              <span
                className="rounded-md px-2.5 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: "rgba(220,38,38,0.10)",
                  color: "rgb(185,28,28)",
                }}
              >
                {inr(totalOutflows)}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div
              className="overflow-hidden rounded-lg border"
              style={{ borderColor: "rgba(74,111,165,0.12)" }}
            >
              <Table>
                <TableHeader>
                  <TableRow
                    style={{ backgroundColor: "rgba(220,38,38,0.05)" }}
                  >
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                      Time
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                      Particulars
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                      Account
                    </TableHead>
                    <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                      Amount
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outflows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-8 text-center text-xs text-slate-500"
                      >
                        No debits recorded for this date.
                      </TableCell>
                    </TableRow>
                  ) : (
                    outflows.map((row) => (
                      <TableRow key={row.id} className="hover:bg-red-50/40">
                        <TableCell className="text-xs text-slate-600">
                          {row.time}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium text-slate-800">
                            {row.particulars}
                          </div>
                          {row.refId && (
                            <div className="text-[11px] text-slate-500">
                              {row.refId}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{accountChip(row.account)}</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-red-700">
                          − {inr(row.amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  <TableRow
                    style={{
                      backgroundColor: "rgba(220,38,38,0.05)",
                      borderTop: "2px solid rgba(220,38,38,0.25)",
                    }}
                  >
                    <TableCell colSpan={3} className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Total Debits
                    </TableCell>
                    <TableCell className="text-right text-sm font-bold text-red-700">
                      {inr(totalOutflows)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="mt-4 text-center text-[11px] text-slate-500">
        Live Chitta · powered by the shared Daybook ledger (Receipts, Loan
        Disbursements, Investor Payouts and more).
      </p>
    </div>
  );
}
