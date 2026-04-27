import { useMemo } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Gem,
  IdCard,
  Landmark,
  ReceiptText,
  TrendingUp,
  UserCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { type Customer } from "@/lib/stores/customersStore";
import {
  formatLedgerDate,
  useDaybook,
  type DaybookEntry,
} from "@/lib/stores/daybookStore";
import {
  usePledgedItems,
  type PledgedItem,
  type PledgedStatus,
} from "@/lib/stores/pledgedItemsStore";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

const STATUS_META: Record<
  PledgedStatus,
  { label: string; bg: string; fg: string; border: string }
> = {
  VAULTED: {
    label: "Active",
    bg: "rgba(16,185,129,0.12)",
    fg: "#047857",
    border: "rgba(16,185,129,0.35)",
  },
  RELEASED: {
    label: "Closed",
    bg: "rgba(100,116,139,0.12)",
    fg: "#475569",
    border: "rgba(100,116,139,0.30)",
  },
  AUCTION: {
    label: "Defaulted",
    bg: "rgba(244,63,94,0.12)",
    fg: "#be123c",
    border: "rgba(244,63,94,0.35)",
  },
};

function MetricTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div
      className="rounded-lg border bg-white px-3 py-2.5"
      style={{ borderColor: "rgba(74,111,165,0.15)" }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className="mt-0.5 text-base font-bold"
        style={{ color: "var(--brand-primary)" }}
      >
        {value}
      </div>
      {hint ? (
        <div className="text-[10px] text-slate-500">{hint}</div>
      ) : null}
    </div>
  );
}

export default function CustomerLedgerSheet({
  customer,
  open,
  onOpenChange,
}: {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const allItems = usePledgedItems();
  const allEntries = useDaybook();

  // Match by full name (case insensitive). The seed data does not always carry
  // a customerId, so name remains the most reliable join key for now.
  const customerLoans = useMemo<PledgedItem[]>(() => {
    if (!customer) return [];
    const target = customer.fullName.trim().toLowerCase();
    return allItems.filter(
      (i) => i.customer.trim().toLowerCase() === target,
    );
  }, [customer, allItems]);

  const customerEntries = useMemo<DaybookEntry[]>(() => {
    if (!customer) return [];
    const target = customer.fullName.trim().toLowerCase();
    return allEntries
      .filter(
        (e) =>
          (e.customerName ?? "").trim().toLowerCase() === target ||
          (customer.id && e.customerId === customer.id),
      )
      .sort((a, b) => {
        // Newest first by date, then by time descending lexicographically.
        if (a.dateIso !== b.dateIso) return b.dateIso.localeCompare(a.dateIso);
        return b.time.localeCompare(a.time);
      });
  }, [customer, allEntries]);

  // Running totals for the metric strip.
  const totals = useMemo(() => {
    const principalDisbursed = customerEntries
      .filter((e) => e.category === "Loan Disbursement")
      .reduce((s, e) => s + e.amount, 0);
    const interestPaid = customerEntries
      .filter((e) => e.category === "Interest Income")
      .reduce((s, e) => s + e.amount, 0);
    const principalRecovered = customerEntries
      .filter(
        (e) =>
          e.category === "Principal Recovery" ||
          e.category === "Full Settlement",
      )
      .reduce((s, e) => s + e.amount, 0);
    return { principalDisbursed, interestPaid, principalRecovered };
  }, [customerEntries]);

  if (!customer) return null;

  const initials = customer.fullName
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-2xl"
        style={{ backgroundColor: "#fff" }}
      >
        <SheetHeader
          className="border-b px-6 py-5"
          style={{ borderColor: "rgba(74,111,165,0.10)" }}
        >
          <div className="flex items-start gap-4">
            {customer.photoDataUrl ? (
              <img
                src={customer.photoDataUrl}
                alt={customer.fullName}
                className="h-14 w-14 rounded-full object-cover ring-2"
                style={{
                  // @ts-expect-error CSS var
                  "--tw-ring-color": "var(--brand-light)",
                }}
              />
            ) : (
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full text-base font-bold text-white"
                style={{ backgroundColor: "var(--brand-primary)" }}
                aria-hidden
              >
                {initials || "?"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <SheetTitle
                className="flex items-center gap-2 text-lg font-bold"
                style={{ color: "var(--brand-primary)" }}
              >
                <UserCircle size={18} />
                Customer 360 · {customer.fullName}
              </SheetTitle>
              <SheetDescription className="text-xs">
                <span className="font-mono" style={{ color: "var(--brand-primary)" }}>
                  {customer.id}
                </span>
                {" · "}
                {customer.phone}
                {" · "}
                {customer.email}
              </SheetDescription>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="rounded-full px-2 py-0.5 text-[10px]"
                  style={{
                    borderColor: "rgba(74,111,165,0.30)",
                    color: "var(--brand-primary)",
                  }}
                >
                  KYC: {customer.kycStatus}
                </Badge>
                {customer.aadhar ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                    <IdCard size={10} /> Aadhar •••• {customer.aadhar.slice(-4)}
                  </span>
                ) : null}
                {customer.pan ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                    <IdCard size={10} /> PAN {customer.pan}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          {/* Lifetime metric strip */}
          <div className="mb-5 grid grid-cols-3 gap-3">
            <MetricTile
              label="Principal Disbursed"
              value={inr(totals.principalDisbursed)}
              hint="All loans (lifetime)"
            />
            <MetricTile
              label="Interest Paid"
              value={inr(totals.interestPaid)}
              hint="To Kittangi"
            />
            <MetricTile
              label="Principal Recovered"
              value={inr(totals.principalRecovered)}
              hint="Repayments + closure"
            />
          </div>

          <Tabs defaultValue="loans" className="w-full">
            <TabsList
              className="grid w-full grid-cols-2"
              style={{
                backgroundColor: "rgba(191,221,245,0.30)",
              }}
            >
              <TabsTrigger value="loans">
                <Landmark size={14} className="mr-1.5" />
                Active / Past Loans ({customerLoans.length})
              </TabsTrigger>
              <TabsTrigger value="txns">
                <BookOpen size={14} className="mr-1.5" />
                Transaction History ({customerEntries.length})
              </TabsTrigger>
            </TabsList>

            {/* ---------- LOANS TAB ---------- */}
            <TabsContent value="loans" className="mt-4">
              {customerLoans.length === 0 ? (
                <div
                  className="rounded-xl border bg-white py-12 text-center"
                  style={{ borderColor: "rgba(74,111,165,0.15)" }}
                >
                  <Gem className="mx-auto mb-2 h-7 w-7 text-slate-300" />
                  <p className="text-sm font-medium text-slate-700">
                    No loans on record
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    This customer has not pledged any item with us yet.
                  </p>
                </div>
              ) : (
                <div
                  className="overflow-hidden rounded-xl border bg-white"
                  style={{ borderColor: "rgba(74,111,165,0.12)" }}
                >
                  <Table>
                    <TableHeader>
                      <TableRow
                        className="hover:bg-transparent"
                        style={{ backgroundColor: "rgba(233,244,251,0.55)" }}
                      >
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                          Loan / Item
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                          Status
                        </TableHead>
                        <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                          Pledged Value
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerLoans.map((loan) => {
                        const meta = STATUS_META[loan.status];
                        return (
                          <TableRow key={loan.id}>
                            <TableCell>
                              <div className="text-sm font-semibold text-slate-800">
                                {loan.loanId}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {loan.title} · {loan.netWeightG}g net
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
                                style={{
                                  backgroundColor: meta.bg,
                                  color: meta.fg,
                                  borderColor: meta.border,
                                }}
                              >
                                {meta.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-sm font-semibold">
                              {inr(loan.pledgedValue)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* ---------- TRANSACTIONS TAB (passbook) ---------- */}
            <TabsContent value="txns" className="mt-4">
              {customerEntries.length === 0 ? (
                <div
                  className="rounded-xl border bg-white py-12 text-center"
                  style={{ borderColor: "rgba(74,111,165,0.15)" }}
                >
                  <ReceiptText className="mx-auto mb-2 h-7 w-7 text-slate-300" />
                  <p className="text-sm font-medium text-slate-700">
                    No transactions yet
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    This customer has no payments recorded in the daybook.
                  </p>
                </div>
              ) : (
                <div
                  className="overflow-hidden rounded-xl border bg-white"
                  style={{ borderColor: "rgba(74,111,165,0.12)" }}
                >
                  <Table>
                    <TableHeader>
                      <TableRow
                        className="hover:bg-transparent"
                        style={{ backgroundColor: "rgba(233,244,251,0.55)" }}
                      >
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                          Date
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                          Particulars
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                          Type
                        </TableHead>
                        <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                          Credit
                        </TableHead>
                        <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                          Debit
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-xs">
                            <div className="font-medium text-slate-700">
                              {formatLedgerDate(entry.dateIso)}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {entry.time}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium text-slate-800">
                              {entry.particulars}
                            </div>
                            {entry.refId ? (
                              <div className="text-[11px] text-slate-500">
                                {entry.refId}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <span
                              className="inline-flex items-center gap-1 rounded-md border bg-white px-1.5 py-0.5 text-[10px] font-medium"
                              style={{
                                borderColor: "rgba(74,111,165,0.18)",
                                color: "var(--brand-primary)",
                              }}
                            >
                              {entry.side === "CREDIT" ? (
                                <ArrowDownLeft size={10} />
                              ) : (
                                <ArrowUpRight size={10} />
                              )}
                              {entry.category}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold text-emerald-700">
                            {entry.side === "CREDIT" ? `+ ${inr(entry.amount)}` : ""}
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold text-red-700">
                            {entry.side === "DEBIT" ? `− ${inr(entry.amount)}` : ""}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
                <TrendingUp size={11} />
                Reads from the same Daybook used by the Receipts &amp; Ledger
                modules — every payment lives in one place.
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
