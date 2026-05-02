import { useMemo } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Gem,
  IdCard,
  Landmark,
  Printer,
  ReceiptText,
  TrendingUp,
  UserCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useBranchProfile } from "@/lib/stores/branchProfileStore";
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
        style={{ color: "#000000" }}
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
  const branch = useBranchProfile();

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

  // Running totals for the metric strip (and the printed statement footer).
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
    const netOutstanding = principalDisbursed - principalRecovered;
    return {
      principalDisbursed,
      interestPaid,
      principalRecovered,
      netOutstanding,
    };
  }, [customerEntries]);

  if (!customer) return null;

  const initials = customer.fullName
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");

  const handlePrintStatement = () => {
    // The hidden statement below is `.print-area--statement`. We mark the
    // body so the @media print rules know to lift only that subtree (a
    // ThermalReceipt dialog could otherwise also be mounted on the page).
    const prev = document.body.dataset.printTarget;
    document.body.dataset.printTarget = "statement";
    try {
      window.print();
    } finally {
      if (prev) document.body.dataset.printTarget = prev;
      else delete document.body.dataset.printTarget;
    }
  };

  const printedOnLabel = new Date().toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <>
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
                  style={{ color: "#000000" }}
                >
                  <UserCircle size={18} />
                  Customer 360 · {customer.fullName}
                </SheetTitle>
                <SheetDescription className="text-xs">
                  <span className="font-mono" style={{ color: "#000000" }}>
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
                      color: "#000000",
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

              <Button
                type="button"
                onClick={handlePrintStatement}
                className="h-9 shrink-0 px-3 font-semibold text-white shadow-sm"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                <Printer size={14} className="mr-1.5" />
                Print Statement
              </Button>
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
                  backgroundColor: "rgba(227,30,36,0.08)",
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
                                  color: "#000000",
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
                            <TableCell className="text-right text-sm font-semibold text-slate-900">
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

      {/* ----------------------------------------------------------------
       * Hidden printable statement
       * Rendered as a sibling of the sheet so it is part of the live DOM
       * (so window.print() can find it) but hidden visually until print.
       * ---------------------------------------------------------------- */}
      {open ? (
        <div
          className="print-area print-area--statement"
          aria-hidden
          style={{
            position: "fixed",
            left: -100000,
            top: 0,
            width: "190mm",
            background: "#fff",
            color: "#000",
            padding: "10mm",
            fontFamily:
              "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
            fontSize: 11,
            lineHeight: 1.5,
          }}
        >
          {/* Branch + statement header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              borderBottom: "2px solid #000",
              paddingBottom: 8,
              marginBottom: 10,
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>
                {branch.branchName}
              </div>
              <div>{branch.address}</div>
              <div>
                {branch.contact} · GSTIN {branch.gstin}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                CUSTOMER STATEMENT
              </div>
              <div>Branch Code: {branch.branchCode}</div>
              <div>Printed: {printedOnLabel}</div>
            </div>
          </div>

          {/* Customer block */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 2 }}>
                Customer
              </div>
              <div>{customer.fullName}</div>
              <div>ID: {customer.id}</div>
              <div>
                {customer.phone}
                {customer.email ? ` · ${customer.email}` : ""}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 2 }}>
                KYC &amp; IDs
              </div>
              <div>Status: {customer.kycStatus}</div>
              {customer.aadhar ? (
                <div>Aadhar: •••• {customer.aadhar.slice(-4)}</div>
              ) : null}
              {customer.pan ? <div>PAN: {customer.pan}</div> : null}
            </div>
          </div>

          {/* Lifetime totals */}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginBottom: 12,
              fontSize: 11,
            }}
          >
            <thead>
              <tr style={{ background: "#eee" }}>
                <th style={statementCellHead}>Principal Disbursed</th>
                <th style={statementCellHead}>Interest Paid</th>
                <th style={statementCellHead}>Principal Recovered</th>
                <th style={statementCellHead}>Net Outstanding</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={statementCell}>{inr(totals.principalDisbursed)}</td>
                <td style={statementCell}>{inr(totals.interestPaid)}</td>
                <td style={statementCell}>{inr(totals.principalRecovered)}</td>
                <td style={{ ...statementCell, fontWeight: 700 }}>
                  {inr(Math.max(0, totals.netOutstanding))}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Loans */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
              Loans on Record ({customerLoans.length})
            </div>
            {customerLoans.length === 0 ? (
              <div style={{ fontSize: 10, color: "#444" }}>
                No loans on file.
              </div>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 10,
                }}
              >
                <thead>
                  <tr style={{ background: "#f5f5f5" }}>
                    <th style={statementCellHead}>Loan ID</th>
                    <th style={statementCellHead}>Item</th>
                    <th style={statementCellHead}>Status</th>
                    <th style={{ ...statementCellHead, textAlign: "right" }}>
                      Pledged Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customerLoans.map((loan) => (
                    <tr key={loan.id}>
                      <td style={statementCell}>{loan.loanId}</td>
                      <td style={statementCell}>
                        {loan.title} ({loan.netWeightG}g)
                      </td>
                      <td style={statementCell}>
                        {STATUS_META[loan.status].label}
                      </td>
                      <td
                        style={{
                          ...statementCell,
                          textAlign: "right",
                        }}
                      >
                        {inr(loan.pledgedValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Transactions */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
              Transaction History ({customerEntries.length})
            </div>
            {customerEntries.length === 0 ? (
              <div style={{ fontSize: 10, color: "#444" }}>
                No transactions on file.
              </div>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 10,
                }}
              >
                <thead>
                  <tr style={{ background: "#f5f5f5" }}>
                    <th style={statementCellHead}>Date</th>
                    <th style={statementCellHead}>Particulars</th>
                    <th style={statementCellHead}>Category</th>
                    <th style={{ ...statementCellHead, textAlign: "right" }}>
                      Credit
                    </th>
                    <th style={{ ...statementCellHead, textAlign: "right" }}>
                      Debit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customerEntries.map((e) => (
                    <tr key={e.id}>
                      <td style={statementCell}>
                        {formatLedgerDate(e.dateIso)} {e.time}
                      </td>
                      <td style={statementCell}>
                        {e.particulars}
                        {e.refId ? (
                          <div style={{ fontSize: 9, color: "#555" }}>
                            {e.refId}
                          </div>
                        ) : null}
                      </td>
                      <td style={statementCell}>{e.category}</td>
                      <td
                        style={{
                          ...statementCell,
                          textAlign: "right",
                        }}
                      >
                        {e.side === "CREDIT" ? inr(e.amount) : ""}
                      </td>
                      <td
                        style={{
                          ...statementCell,
                          textAlign: "right",
                        }}
                      >
                        {e.side === "DEBIT" ? inr(e.amount) : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              marginTop: 16,
              borderTop: "1px solid #000",
              paddingTop: 6,
              fontSize: 9,
              color: "#333",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <div>
              This statement is computer-generated and does not require a
              signature. Please retain for your records.
            </div>
            <div>{branch.branchName} · {branch.branchCode}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}

const statementCell: React.CSSProperties = {
  border: "1px solid #ccc",
  padding: "4px 6px",
  verticalAlign: "top",
};

const statementCellHead: React.CSSProperties = {
  border: "1px solid #999",
  padding: "4px 6px",
  textAlign: "left",
  fontWeight: 700,
  fontSize: 10,
};
