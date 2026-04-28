import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Banknote,
  CalendarClock,
  HandCoins,
  Percent,
  Plus,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addInvestor,
  monthlyInterest,
  recordPayout,
  useInvestors,
  type Investor,
} from "@/lib/stores/investorsStore";
import { addDaybookEntry } from "@/lib/stores/daybookStore";
import { isDateLocked } from "@/lib/stores/dayLocksStore";
import { useAccounts } from "@/lib/stores/accountsStore";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

const inputClass =
  "h-9 rounded-md border bg-white text-sm outline-none transition-colors focus:ring-2";
const inputStyle = {
  borderColor: "rgba(74,111,165,0.20)",
  "--tw-ring-color": "var(--brand-light)",
} as React.CSSProperties;

function todayIso(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function timeNow(): string {
  return new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfLastMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1);
}

function periodLabel(d: Date): string {
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

// ---------------------------------------------------------------------------
// New Deposit modal
// ---------------------------------------------------------------------------

type DepositForm = {
  name: string;
  contact: string;
  depositDate: string;
  principal: string;
  monthlyRate: string;
  payoutCycle: string;
};

function NewDepositDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DepositForm>({
    defaultValues: {
      name: "",
      contact: "",
      depositDate: todayIso(),
      principal: "",
      monthlyRate: "1.5",
      payoutCycle: "1st of every month",
    },
  });

  const onSubmit = (data: DepositForm) => {
    const principal = Number(data.principal);
    const monthlyRatePct = Number(data.monthlyRate);
    if (!Number.isFinite(principal) || principal <= 0) {
      toast.error("Principal must be a positive number.");
      return;
    }
    if (!Number.isFinite(monthlyRatePct) || monthlyRatePct <= 0) {
      toast.error("Monthly interest rate must be greater than zero.");
      return;
    }
    const created = addInvestor({
      name: data.name.trim(),
      contact: data.contact.trim(),
      depositDateIso: data.depositDate,
      principal,
      monthlyRatePct,
      payoutCycle: data.payoutCycle,
    });
    toast.success("Investor onboarded", {
      description: `${created.name} • ${inr(created.principal)} @ ${created.monthlyRatePct}%/mo`,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent
        className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-xl"
        style={{ backgroundColor: "#fff" }}
      >
        <DialogHeader
          className="border-b px-6 py-4"
          style={{ borderColor: "rgba(74,111,165,0.10)" }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: "var(--brand-light)" }}
            >
              <HandCoins size={18} style={{ color: "var(--brand-primary)" }} />
            </div>
            <div>
              <DialogTitle
                className="text-lg font-bold"
                style={{ color: "var(--brand-primary)" }}
              >
                New Investor Deposit
              </DialogTitle>
              <DialogDescription className="text-xs">
                Record a fresh capital injection from an investor. Monthly
                interest payouts are scheduled per the agreed cycle.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-4 px-6 py-5">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="dep-name" className="text-xs font-medium">
                Investor Name *
              </Label>
              <Input
                id="dep-name"
                className={inputClass}
                style={inputStyle}
                placeholder="Ramesh Subramanyam"
                {...register("name", { required: true })}
              />
              {errors.name ? (
                <p className="text-[11px]" style={{ color: "#B91C1C" }}>
                  Investor name is required.
                </p>
              ) : null}
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="dep-contact" className="text-xs font-medium">
                Contact Info *
              </Label>
              <Input
                id="dep-contact"
                className={inputClass}
                style={inputStyle}
                placeholder="+91 98450 11220 or email"
                {...register("contact", { required: true })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dep-date" className="text-xs font-medium">
                Deposit Date *
              </Label>
              <Input
                id="dep-date"
                type="date"
                max={todayIso()}
                className={inputClass}
                style={inputStyle}
                {...register("depositDate", { required: true })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dep-principal" className="text-xs font-medium">
                Principal Amount (₹) *
              </Label>
              <Input
                id="dep-principal"
                type="number"
                step="1"
                min="0"
                className={inputClass}
                style={inputStyle}
                placeholder="1000000"
                {...register("principal", { required: true })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dep-rate" className="text-xs font-medium">
                Monthly Interest Rate (%) *
              </Label>
              <Input
                id="dep-rate"
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                style={inputStyle}
                placeholder="1.5"
                {...register("monthlyRate", { required: true })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dep-cycle" className="text-xs font-medium">
                Payout Cycle *
              </Label>
              <Input
                id="dep-cycle"
                className={inputClass}
                style={inputStyle}
                placeholder="1st of every month"
                {...register("payoutCycle", { required: true })}
              />
            </div>
          </div>

          <DialogFooter
            className="border-t bg-white px-6 py-4"
            style={{ borderColor: "rgba(74,111,165,0.10)" }}
          >
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-9 px-4"
              style={{
                borderColor: "rgba(74,111,165,0.25)",
                color: "var(--text-main)",
                backgroundColor: "#fff",
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-9 px-4 text-white"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              <HandCoins size={16} className="mr-1.5" />
              Save Deposit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Deposits() {
  const allInvestors = useInvestors();
  const [showNew, setShowNew] = useState(false);

  // Only ACTIVE investors appear in the table and metric tiles. Closed
  // investors stay in the store for historical lookups (Customer 360, audit)
  // but should not show up under "Active Investors" or contribute to the
  // payable totals.
  const investors = useMemo(
    () => allInvestors.filter((i) => i.status === "ACTIVE"),
    [allInvestors],
  );

  // Aggregated metrics
  const totals = useMemo(() => {
    const active = investors;
    const totalActiveDeposits = active.reduce((s, i) => s + i.principal, 0);
    const monthlyInterestPayable = active.reduce(
      (s, i) => s + monthlyInterest(i),
      0,
    );

    const now = new Date();
    const lastMonthStart = startOfLastMonth(now);
    const thisMonthStart = startOfMonth(now);
    // Include CLOSED investors when summing historical payouts — those cash
    // outflows still happened, and excluding them would understate the
    // previous month's interest expense.
    const lastMonthPayout = allInvestors.reduce((sum, inv) => {
      return (
        sum +
        inv.payouts.reduce((s, p) => {
          const d = new Date(p.dateIso + "T00:00:00");
          if (d >= lastMonthStart && d < thisMonthStart) return s + p.amount;
          return s;
        }, 0)
      );
    }, 0);

    return {
      totalActiveDeposits,
      monthlyInterestPayable,
      lastMonthPayout,
      activeCount: active.length,
      lastMonthLabel: periodLabel(lastMonthStart),
    };
  }, [investors, allInvestors]);

  // ----- Payout source picker ------------------------------------------------
  // We no longer post payouts straight to "CASH". Instead, opening the dialog
  // captures the funding account and only commits when the cashier confirms.
  const accounts = useAccounts();
  const [payoutTarget, setPayoutTarget] = useState<Investor | null>(null);
  const [payoutAccountId, setPayoutAccountId] = useState<string>("");

  const handleOpenPayout = (investor: Investor) => {
    if (monthlyInterest(investor) <= 0) {
      toast.error("Cannot record a zero-rupee payout.");
      return;
    }
    if (isDateLocked(todayIso())) {
      toast.error("Day is locked", {
        description:
          "Today's Chitta is closed. Unlock it from the Daybook page before recording payouts.",
      });
      return;
    }
    setPayoutAccountId(accounts[0]?.id ?? "");
    setPayoutTarget(investor);
  };

  /**
   * Record an interest payout for the staged investor:
   *  1. Append the payout to the investor's history.
   *  2. Push a matching DEBIT entry into the Daybook under
   *     "Interest Expense" against the chosen source account so the
   *     firm-level P&L and per-account balances stay consistent.
   */
  const handleConfirmPayout = () => {
    const investor = payoutTarget;
    if (!investor) return;
    if (!payoutAccountId) {
      toast.error("Select a source account for the payout.");
      return;
    }
    const amount = monthlyInterest(investor);
    if (amount <= 0) {
      toast.error("Cannot record a zero-rupee payout.");
      setPayoutTarget(null);
      return;
    }
    const period = periodLabel(new Date());
    const date = todayIso();

    if (isDateLocked(date)) {
      toast.error("Day is locked", {
        description:
          "Today's Chitta is closed. Unlock it from the Daybook page before recording payouts.",
      });
      return;
    }

    // Atomic-write strategy: post the (riskier) Daybook entry FIRST. Only
    // if that succeeds do we persist the payout on the investor record.
    // This eliminates the prior divergence risk where a failed daybook
    // write would leave a payout without a matching ledger entry.
    try {
      addDaybookEntry({
        dateIso: date,
        time: timeNow(),
        side: "DEBIT",
        category: "Interest Expense",
        particulars: `${investor.name} — Interest Payout (${period})`,
        refId: `${investor.id} • Payout ${period}`,
        account: payoutAccountId,
        amount,
      });
    } catch (err) {
      toast.error("Could not record payout", {
        description:
          err instanceof Error
            ? err.message
            : "Daybook write failed; nothing was persisted.",
      });
      return;
    }

    recordPayout(investor.id, {
      dateIso: date,
      period,
      amount,
    });

    const accountName =
      accounts.find((a) => a.id === payoutAccountId)?.name ?? payoutAccountId;
    toast.success("Interest payout recorded", {
      description: `${inr(amount)} paid to ${investor.name} for ${period} from ${accountName}`,
    });
    setPayoutTarget(null);
  };

  return (
    <div className="mx-auto max-w-7xl pb-10">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: "var(--brand-light)" }}
          >
            <HandCoins size={22} style={{ color: "var(--brand-primary)" }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--brand-primary)" }}
            >
              Investor Deposits &amp; Capital
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Capital you owe investors and the monthly interest you pay out.
              Every payout creates a matching expense entry in the Daybook.
            </p>
          </div>
        </div>

        <Button
          onClick={() => setShowNew(true)}
          className="h-10 px-4 text-sm font-semibold text-white shadow-sm"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          <Plus size={16} className="mr-1.5" />
          New Deposit
        </Button>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard
          label="Total Active Deposits"
          value={inr(totals.totalActiveDeposits)}
          hint={`Principal owed across ${totals.activeCount} investors`}
          icon={Wallet}
          accent="primary"
        />
        <SummaryCard
          label="Monthly Interest Payable"
          value={inr(totals.monthlyInterestPayable)}
          hint="Cash outflow per month at agreed rates"
          icon={TrendingDown}
          accent="red"
        />
        <SummaryCard
          label={`${totals.lastMonthLabel} Total Payout`}
          value={inr(totals.lastMonthPayout)}
          hint="Recorded interest payouts last month"
          icon={TrendingUp}
          accent="green"
        />
      </div>

      {/* Active Investors table */}
      <Card
        className="border bg-white shadow-sm"
        style={{ borderColor: "rgba(74,111,165,0.12)" }}
      >
        <CardContent className="p-0">
          <div
            className="flex items-center justify-between border-b px-5 py-3.5"
            style={{ borderColor: "rgba(74,111,165,0.10)" }}
          >
            <div className="flex items-center gap-2">
              <Users size={16} style={{ color: "var(--brand-primary)" }} />
              <h2
                className="text-sm font-semibold"
                style={{ color: "var(--brand-primary)" }}
              >
                Active Investors
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              {investors.length} active
            </span>
          </div>

          <Table>
            <TableHeader>
              <TableRow
                className="hover:bg-transparent"
                style={{ backgroundColor: "rgba(233,244,251,0.55)" }}
              >
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Investor
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  Principal
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  Rate
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  Interest / Month
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                  Last Payout
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {investors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <HandCoins
                        size={20}
                        style={{ color: "var(--text-muted)" }}
                      />
                      <p
                        className="text-sm font-medium"
                        style={{ color: "var(--text-main)" }}
                      >
                        No investors yet
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Click “New Deposit” to onboard your first investor.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                investors.map((inv) => {
                  const monthly = monthlyInterest(inv);
                  // Sort defensively so the "Last Payout" cell always reflects
                  // the most recent payout, regardless of seed/insertion order.
                  const last = [...inv.payouts].sort((a, b) =>
                    b.dateIso.localeCompare(a.dateIso),
                  )[0];
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{ backgroundColor: "var(--brand-primary)" }}
                            aria-hidden
                          >
                            {inv.name
                              .split(" ")
                              .map((n) => n[0])
                              .filter(Boolean)
                              .slice(0, 2)
                              .join("")}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-800">
                              {inv.name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {inv.id} · {inv.contact}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
                              <CalendarClock size={10} />
                              <span>{inv.payoutCycle}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className="text-sm font-bold"
                          style={{ color: "var(--brand-primary)" }}
                        >
                          {inr(inv.principal)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          since{" "}
                          {new Date(
                            inv.depositDateIso + "T00:00:00",
                          ).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          <Percent size={11} />
                          {inv.monthlyRatePct}/mo
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm font-bold text-red-700">
                        {inr(monthly)}
                      </TableCell>
                      <TableCell>
                        {last ? (
                          <div className="text-xs">
                            <div className="font-medium text-slate-700">
                              {inr(last.amount)}{" "}
                              <span className="text-slate-400">
                                · {last.period}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              on{" "}
                              {new Date(
                                last.dateIso + "T00:00:00",
                              ).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                              })}
                            </div>
                          </div>
                        ) : (
                          <Badge
                            variant="outline"
                            className="rounded-full px-2 py-0.5 text-[10px]"
                            style={{
                              borderColor: "rgba(234,179,8,0.4)",
                              color: "#A16207",
                              backgroundColor: "rgba(234,179,8,0.10)",
                            }}
                          >
                            Pending first payout
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleOpenPayout(inv)}
                          className="h-8 px-3 text-xs text-white"
                          style={{ backgroundColor: "var(--brand-primary)" }}
                        >
                          <Banknote size={13} className="mr-1.5" />
                          Record Interest Payout
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="mt-4 text-center text-[11px] text-slate-500">
        Recording a payout posts a Debit entry to the Daybook under{" "}
        <strong>Interest Expense</strong>.
      </p>

      <NewDepositDialog open={showNew} onOpenChange={setShowNew} />

      {/* Payout dialog — funds an investor's monthly interest from a chosen
          account. We require an explicit account so cashiers don't blindly
          drain Cash in Hand when a bank transfer was actually made. */}
      <Dialog
        open={!!payoutTarget}
        onOpenChange={(o) => {
          if (!o) setPayoutTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle
              className="text-base font-semibold"
              style={{ color: "var(--brand-primary)" }}
            >
              Record Interest Payout
            </DialogTitle>
            <DialogDescription className="text-xs">
              Posts a Debit entry under <strong>Interest Expense</strong>{" "}
              against the selected account.
            </DialogDescription>
          </DialogHeader>

          {payoutTarget && (
            <div className="space-y-4">
              <div
                className="rounded-lg border p-3"
                style={{
                  borderColor: "rgba(74,111,165,0.18)",
                  backgroundColor: "var(--bg-main)",
                }}
              >
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Investor
                </div>
                <div className="mt-0.5 text-sm font-semibold text-slate-800">
                  {payoutTarget.name}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    {periodLabel(new Date())}
                  </span>
                  <span
                    className="text-base font-bold"
                    style={{ color: "var(--brand-primary)" }}
                  >
                    {inr(monthlyInterest(payoutTarget))}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">
                  Pay From Account
                </Label>
                <Select
                  value={payoutAccountId}
                  onValueChange={setPayoutAccountId}
                >
                  <SelectTrigger
                    className="h-10 w-full bg-white"
                    style={inputStyle}
                  >
                    <SelectValue placeholder="Select source account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{a.name}</span>
                          <span className="text-xs text-slate-500">
                            {a.subtitle ?? a.id}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPayoutTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmPayout}
              className="font-semibold text-white"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              <Banknote size={14} className="mr-1.5" />
              Record Payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

type Accent = "primary" | "red" | "green";

const ACCENT: Record<
  Accent,
  { iconBg: string; iconColor: string; text: string }
> = {
  primary: {
    iconBg: "var(--brand-light)",
    iconColor: "var(--brand-primary)",
    text: "var(--brand-primary)",
  },
  red: {
    iconBg: "rgba(220,38,38,0.10)",
    iconColor: "rgb(185,28,28)",
    text: "rgb(185,28,28)",
  },
  green: {
    iconBg: "rgba(34,197,94,0.12)",
    iconColor: "rgb(21,128,61)",
    text: "rgb(21,128,61)",
  },
};

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  accent: Accent;
}) {
  const c = ACCENT[accent];
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
              style={{ color: c.text }}
            >
              {value}
            </div>
            {hint ? (
              <div className="mt-1 text-[11px] text-slate-500">{hint}</div>
            ) : null}
          </div>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: c.iconBg }}
          >
            <Icon size={18} style={{ color: c.iconColor }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
