import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  FileSignature,
  Filter,
  IndianRupee,
  Landmark,
  ListChecks,
  Search,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLoans, type Loan, type LoanStatus } from "@/lib/stores/loansStore";
import { useAccounts } from "@/lib/stores/accountsStore";
import DocumentLoanDialog from "./DocumentLoanDialog";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

function prettyDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusBadge(status: LoanStatus) {
  switch (status) {
    case "ACTIVE":
      return (
        <Badge
          className="border-transparent font-medium"
          style={{
            backgroundColor: "rgba(34,197,94,0.14)",
            color: "rgb(21,128,61)",
          }}
        >
          Active
        </Badge>
      );
    case "CLOSED":
      return (
        <Badge
          className="border-transparent font-medium"
          style={{
            backgroundColor: "rgba(74,111,165,0.12)",
            color: "var(--brand-primary)",
          }}
        >
          Closed
        </Badge>
      );
    case "AUCTION":
      return (
        <Badge
          className="border-transparent font-medium"
          style={{
            backgroundColor: "rgba(220,38,38,0.14)",
            color: "rgb(185,28,28)",
          }}
        >
          Auction
        </Badge>
      );
  }
}

function productBadge(product: Loan["product"]) {
  const label =
    product === "PAWN"
      ? "Pawn"
      : product === "VEHICLE"
        ? "Vehicle"
        : "Document";
  return (
    <Badge
      variant="outline"
      className="font-medium"
      style={{
        borderColor: "rgba(74,111,165,0.25)",
        color: "var(--brand-primary)",
      }}
    >
      {label}
    </Badge>
  );
}

type ProductFilter = "ALL" | "PAWN" | "VEHICLE" | "DOCUMENT";
type StatusFilter = "ALL" | LoanStatus;

export default function LoanManagement() {
  const navigate = useNavigate();
  const loans = useLoans();
  const accounts = useAccounts();

  const [query, setQuery] = useState("");
  const [productFilter, setProductFilter] = useState<ProductFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [docDialogOpen, setDocDialogOpen] = useState(false);

  const filteredLoans = useMemo(() => {
    const q = query.trim().toLowerCase();
    return loans.filter((l) => {
      if (productFilter !== "ALL" && l.product !== productFilter) return false;
      if (statusFilter !== "ALL" && l.status !== statusFilter) return false;
      if (!q) return true;
      return (
        l.id.toLowerCase().includes(q) ||
        l.customer.toLowerCase().includes(q) ||
        l.customerCode.toLowerCase().includes(q)
      );
    });
  }, [loans, query, productFilter, statusFilter]);

  const totals = useMemo(() => {
    const active = loans.filter((l) => l.status === "ACTIVE");
    const auction = loans.filter((l) => l.status === "AUCTION");
    return {
      activeCount: active.length,
      activePrincipal: active.reduce((s, l) => s + l.principal, 0),
      auctionCount: auction.length,
      totalCount: loans.length,
    };
  }, [loans]);

  const accountName = (id?: string) => {
    if (!id) return "—";
    return accounts.find((a) => a.id === id)?.name ?? id;
  };

  return (
    <div className="mx-auto max-w-7xl pb-10">
      {/* Page Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: "var(--brand-light)" }}
          >
            <ListChecks size={22} style={{ color: "var(--brand-primary)" }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--brand-primary)" }}
            >
              Loan Management
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Single source of truth for every pawn ticket, vehicle
              agreement, and document loan on the books.
            </p>
          </div>
        </div>
        <Button
          type="button"
          className="h-10 px-4 text-sm font-semibold text-white shadow-sm"
          style={{ backgroundColor: "var(--brand-primary)" }}
          onClick={() => setDocDialogOpen(true)}
        >
          <FileSignature size={16} className="mr-2" />
          Document Loan
        </Button>
      </div>

      {/* Summary cards */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={ShieldCheck}
          label="Active Loans"
          value={String(totals.activeCount)}
          hint={`${inr(totals.activePrincipal)} principal outstanding`}
        />
        <SummaryCard
          icon={Landmark}
          label="In Auction"
          value={String(totals.auctionCount)}
          hint="Defaulted — pending auction"
        />
        <SummaryCard
          icon={IndianRupee}
          label="Total on Books"
          value={String(totals.totalCount)}
          hint="Across the entire ledger"
        />
      </div>

      {/* Filters + table */}
      <Card
        className="border bg-white shadow-sm"
        style={{ borderColor: "rgba(74,111,165,0.12)" }}
      >
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle
              className="text-base font-semibold"
              style={{ color: "var(--brand-primary)" }}
            >
              All Loans
            </CardTitle>
            <span className="text-xs text-slate-500">
              {filteredLoans.length} of {loans.length} shown
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <Input
                placeholder="Search by loan ID, customer name or KTG code..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-10 bg-white pl-9"
                style={{
                  borderColor: "rgba(74,111,165,0.20)",
                  "--tw-ring-color": "var(--brand-light)",
                } as React.CSSProperties}
              />
            </div>
            <Select
              value={productFilter}
              onValueChange={(v) => setProductFilter(v as ProductFilter)}
            >
              <SelectTrigger
                className="h-10 w-[160px] bg-white"
                style={{ borderColor: "rgba(74,111,165,0.20)" }}
              >
                <span className="flex items-center gap-2 text-xs">
                  <Filter size={12} />
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All products</SelectItem>
                <SelectItem value="PAWN">Pawn</SelectItem>
                <SelectItem value="VEHICLE">Vehicle</SelectItem>
                <SelectItem value="DOCUMENT">Document</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger
                className="h-10 w-[150px] bg-white"
                style={{ borderColor: "rgba(74,111,165,0.20)" }}
              >
                <span className="flex items-center gap-2 text-xs">
                  <Filter size={12} />
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
                <SelectItem value="AUCTION">Auction</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div
            className="overflow-hidden rounded-lg border"
            style={{ borderColor: "rgba(74,111,165,0.12)" }}
          >
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: "rgba(191,221,245,0.25)" }}>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                    Loan ID
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                    Customer
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                    Product
                  </TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                    Principal
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                    Rate
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                    Disbursed From
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                    Maturity
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                    Status
                  </TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLoans.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="h-24 text-center text-sm text-slate-500"
                    >
                      No loans match the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLoans.map((l) => (
                    <TableRow
                      key={l.id}
                      className="cursor-pointer hover:bg-slate-50/60"
                      onClick={() => navigate(`/loans/${l.id}`)}
                    >
                      <TableCell
                        className="font-mono text-xs"
                        style={{ color: "var(--brand-primary)" }}
                      >
                        {l.id}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-semibold text-slate-800">
                          {l.customer}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {l.customerCode}
                        </div>
                      </TableCell>
                      <TableCell>{productBadge(l.product)}</TableCell>
                      <TableCell className="text-right text-sm font-semibold text-slate-800">
                        {inr(l.principal)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {l.ratePctPerAnnum}% p.a.
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {accountName(l.disbursedFromAccountId)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {prettyDate(l.maturityIso)}
                      </TableCell>
                      <TableCell>{statusBadge(l.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-3 text-xs"
                          style={{ color: "var(--brand-primary)" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/loans/${l.id}`);
                          }}
                        >
                          View Details
                          <ArrowRight size={12} className="ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <DocumentLoanDialog
        open={docDialogOpen}
        onOpenChange={setDocDialogOpen}
        onCreated={(id) => navigate(`/loans/${id}`)}
      />
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Landmark;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card
      className="border bg-white shadow-sm"
      style={{ borderColor: "rgba(74,111,165,0.12)" }}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {label}
            </div>
            <div
              className="mt-2 text-2xl font-bold tracking-tight"
              style={{ color: "var(--brand-primary)" }}
            >
              {value}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">{hint}</div>
          </div>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: "var(--brand-light)" }}
          >
            <Icon size={18} style={{ color: "var(--brand-primary)" }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
