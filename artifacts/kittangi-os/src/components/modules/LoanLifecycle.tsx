import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Banknote,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  FileSignature,
  IndianRupee,
  Lock,
  Printer,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  Vault,
  Wallet,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addLoan,
  closeLoanWithSettlement,
  deleteLoan,
  markLoanForAuction,
  updateLoan,
  useLoans,
  type Loan,
} from "@/lib/stores/loansStore";
import {
  addDaybookEntry,
  removeDaybookEntry,
  DayLockedError,
  useDaybook,
  type DaybookEntry,
} from "@/lib/stores/daybookStore";
import {
  addPledgedItem,
  deletePledgedItem,
  updatePledgedItem,
  usePledgedItems,
} from "@/lib/stores/pledgedItemsStore";
import { useSettings, splitInterest } from "@/lib/stores/settingsStore";
import { useAccounts } from "@/lib/stores/accountsStore";
import { useCustomers } from "@/lib/stores/customersStore";
import { isDateLocked } from "@/lib/stores/dayLocksStore";
import { useBranchProfile } from "@/lib/stores/branchProfileStore";
import { useIsAdmin } from "@/lib/stores/userRoleStore";
import DocumentViewer from "@/components/shared/DocumentViewer";

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

function todayIso(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export default function LoanLifecycle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const loans = useLoans();
  const allEntries = useDaybook();
  const accounts = useAccounts();
  const pledgedItems = usePledgedItems();
  const customers = useCustomers();
  const branch = useBranchProfile();
  const isAdmin = useIsAdmin();
  const settings = useSettings();

  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [auctionDialogOpen, setAuctionDialogOpen] = useState(false);
  const [settlementAmountStr, setSettlementAmountStr] = useState("");
  const [settlementAccountId, setSettlementAccountId] = useState("");

  // Part Release / Renew dialog state. Carrying the pledge means a brand-new
  // loan inherits the same locker; releasing it leaves the vault empty after
  // close. New principal defaults to the current outstanding so the cashier
  // can dial it down to give partial cash back to the customer.
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewCarryItem, setRenewCarryItem] = useState(true);
  const [renewPrincipalStr, setRenewPrincipalStr] = useState("");
  const [renewAccountId, setRenewAccountId] = useState("");

  const loan = useMemo<Loan | undefined>(
    () => loans.find((l) => l.id === id),
    [loans, id],
  );

  const sourceAccount = useMemo(
    () => accounts.find((a) => a.id === loan?.disbursedFromAccountId),
    [accounts, loan],
  );

  const pledgedItem = useMemo(
    () => pledgedItems.find((p) => p.id === loan?.pledgedItemId),
    [pledgedItems, loan],
  );

  // Resolve the borrower from the global customer store so the printable
  // document can render their KYC photo + ID details. We try by id first
  // (loan.customerCode === Customer.id) and then fall back to a name match
  // for legacy seed records that pre-date strict id linkage.
  const customer = useMemo(() => {
    if (!loan) return undefined;
    return (
      customers.find((c) => c.id === loan.customerCode) ??
      customers.find(
        (c) => c.fullName.toLowerCase() === loan.customer.toLowerCase(),
      )
    );
  }, [customers, loan]);

  // Daybook entries linked to this loan: receipts (CREDIT) + the disbursement
  // (DEBIT). The refId convention is "RCP-XXXXX • LOAN-ID" or just "LOAN-ID".
  const linkedEntries = useMemo<DaybookEntry[]>(() => {
    if (!loan) return [];
    return allEntries
      .filter((e) => (e.refId ?? "").includes(loan.id))
      .sort((a, b) =>
        a.dateIso === b.dateIso ? a.time.localeCompare(b.time) : a.dateIso.localeCompare(b.dateIso),
      );
  }, [allEntries, loan]);

  const receipts = useMemo(
    () => linkedEntries.filter((e) => e.side === "CREDIT"),
    [linkedEntries],
  );

  const totalCollected = useMemo(
    () => receipts.reduce((s, e) => s + e.amount, 0),
    [receipts],
  );

  // Live outstanding balance for the loan: principal + accrued interest, less
  // anything already collected against it (sum of CREDIT entries linked by
  // refId). Drives the Final Settlement dialog's split + the gating that
  // prevents flipping status unless the balance is exactly ₹0.
  const grossDue = (loan?.principal ?? 0) + (loan?.accruedInterest ?? 0);
  const outstandingBalance = Math.max(0, grossDue - totalCollected);

  // When the dialog opens, prefill the amount with the full outstanding and
  // pick a sensible cashier-side account (CASH is the typical default).
  useEffect(() => {
    if (!closeDialogOpen) return;
    setSettlementAmountStr(String(outstandingBalance));
    const fallback = accounts.find((a) => a.type === "CASH") ?? accounts[0];
    if (fallback) setSettlementAccountId(fallback.id);
  }, [closeDialogOpen, outstandingBalance, accounts]);

  const settlementAmount = Math.max(
    0,
    Math.round(Number(settlementAmountStr) || 0),
  );
  // Strict closure invariant — overpayment is NOT allowed. The settlement
  // must land on either a positive remaining balance (partial) or exactly
  // ₹0 (full closure). `projectedBalance` is the unclamped delta so we can
  // detect over-collection in the handler and reject it.
  const projectedBalance = outstandingBalance - settlementAmount;
  const isOverpaid = projectedBalance < 0;
  const willFullyClose =
    settlementAmount > 0 && projectedBalance === 0;
  const settlementAccount = accounts.find((a) => a.id === settlementAccountId);

  const accountName = (accountId?: string) => {
    if (!accountId) return "—";
    return accounts.find((a) => a.id === accountId)?.name ?? accountId;
  };

  if (!loan) {
    return (
      <div className="mx-auto max-w-3xl py-10">
        <Card
          className="border bg-white shadow-sm"
          style={{ borderColor: "rgba(74,111,165,0.12)" }}
        >
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <CircleAlert size={32} className="text-slate-400" />
            <div className="text-base font-semibold text-slate-700">
              Loan not found
            </div>
            <p className="max-w-md text-sm text-slate-500">
              We couldn't find a loan record for{" "}
              <span className="font-mono">{id}</span>. It may have been deleted
              or never originated.
            </p>
            <Button
              variant="outline"
              onClick={() => navigate("/loans")}
              className="mt-2"
            >
              <ArrowLeft size={14} className="mr-2" />
              Back to Loan Management
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Final Settlement — strict closure logic.
  //
  // Posts a single CREDIT entry to the chosen account categorised as
  // "Full Settlement" (or "Principal Recovery" if it's an interest-free
  // partial). The loan status only flips to CLOSED — and the pledged item is
  // only released — when the projected balance after this entry is exactly
  // ₹0. Partial payments are recorded but the loan stays ACTIVE.
  // -------------------------------------------------------------------------
  const handleFinalSettlement = () => {
    if (!loan) return;
    if (!isAdmin) {
      toast.error("Admin access required to settle a loan.");
      return;
    }
    if (settlementAmount <= 0) {
      toast.error("Enter a settlement amount greater than ₹0.");
      return;
    }
    if (!settlementAccount) {
      toast.error("Select an account to receive the settlement.");
      return;
    }
    if (isOverpaid) {
      toast.error(
        `Overpayment blocked — the customer owes only ${inr(outstandingBalance)}. Reduce the settlement amount.`,
      );
      return;
    }

    const today = todayIso();
    const time = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    const receiptId = `RCP-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const refId = `${receiptId} • ${loan.id}`;

    try {
      addDaybookEntry({
        dateIso: today,
        time,
        side: "CREDIT",
        category: willFullyClose ? "Full Settlement" : "Principal Recovery",
        particulars: willFullyClose
          ? `Final settlement — ${loan.customer}`
          : `Part settlement — ${loan.customer}`,
        refId,
        account: settlementAccount.id,
        amount: settlementAmount,
        customerName: loan.customer,
        paymentMode: settlementAccount.type === "CASH" ? "CASH" : "BANK",
        outstandingAfter: projectedBalance,
      });
    } catch (err) {
      if (err instanceof DayLockedError) {
        toast.error(
          "Today's Daybook is locked — unlock it before posting the settlement.",
        );
        return;
      }
      throw err;
    }

    if (willFullyClose) {
      // Atomic close + release: the helper flips loan.status AND clears the
      // pledged item's vaultLoc/status in the same render cycle so the
      // Vault Management view never observes a stale OCCUPIED locker for a
      // closed loan.
      closeLoanWithSettlement(loan.id);
      toast.success("Loan fully settled", {
        description: `${loan.id} closed${
          pledgedItem ? " and pledged item released from the vault." : "."
        }`,
        icon: <CheckCircle2 size={16} />,
      });
    } else {
      toast.success("Part payment recorded", {
        description: `${inr(settlementAmount)} received. Balance ${inr(
          projectedBalance,
        )} still pending — loan remains Active.`,
      });
    }
    setCloseDialogOpen(false);
  };

  const handleMarkForAuction = () => {
    if (!loan) return;
    if (!isAdmin) {
      toast.error("Admin access required to mark a loan for auction.");
      setAuctionDialogOpen(false);
      return;
    }
    if (isDateLocked(todayIso())) {
      toast.error(
        "Today's Daybook is locked — unlock it before changing loan status.",
      );
      return;
    }
    markLoanForAuction(loan.id);
    toast.success("Marked for auction", {
      description: `${loan.id} flagged. The pledged item will appear in the Auction list.`,
      icon: <ShieldAlert size={16} />,
    });
    setAuctionDialogOpen(false);
  };

  // Open the renewal dialog with sensible defaults: carry the pledge by
  // default and seed the new principal at the current outstanding so the
  // cashier only has to type a delta when partially releasing value.
  const openRenewDialog = () => {
    if (!loan) return;
    setRenewCarryItem(true);
    setRenewPrincipalStr(String(outstandingBalance || loan.principal));
    setRenewAccountId(loan.disbursedFromAccountId ?? accounts[0]?.id ?? "");
    setRenewOpen(true);
  };

  const handlePartReleaseRenew = () => {
    if (!loan) return;
    if (!isAdmin) {
      toast.error("Admin access required to renew a loan.");
      return;
    }
    if (loan.product !== "PAWN") {
      toast.error("Part Release / Renew is only available for pawn loans.");
      return;
    }
    if (isDateLocked(todayIso())) {
      toast.error(
        "Today's Daybook is locked — unlock it before renewing the loan.",
      );
      return;
    }

    const newPrincipal = parseInt(renewPrincipalStr || "0", 10);
    if (!Number.isFinite(newPrincipal) || newPrincipal <= 0) {
      toast.error("Enter a valid principal for the new loan.");
      return;
    }
    const disbursalAccount = accounts.find((a) => a.id === renewAccountId);
    if (!disbursalAccount) {
      toast.error("Pick an account to disburse the new loan from.");
      return;
    }

    const today = todayIso();
    const time = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // 1) Snapshot the current vault location BEFORE close — closeLoanWithSettlement
    //    will null it out as part of the atomic release.
    const carriedVaultLoc = pledgedItem?.vaultLoc;

    // 2) Settle the existing loan on today's daybook so the receipts ledger
    //    shows a clean close-out for the original principal+accrued interest.
    //
    // The whole renew sequence is wrapped in a try/catch with compensating
    // actions. We track each side-effect in `compensations` (LIFO) so a
    // mid-flight failure can roll back to a clean state — no orphaned
    // loans, pledged items, or daybook entries. This is the closest we
    // can get to a transaction across multiple persisted stores.
    const closingReceiptId = `RCP-${Math.floor(
      100000 + Math.random() * 899999,
    )}`;
    const compensations: Array<() => void> = [];
    let newLoanId: string | undefined;

    try {
      // Step A — Post the closing CREDIT for the existing loan's outstanding.
      // Split the accrued-interest portion of the lump close into legal vs
      // company so the entry shows up in Reports → Interest Collections
      // alongside ReceiptsLedger-posted receipts.
      const closingInterestPortion = Math.max(
        0,
        outstandingBalance - loan.principal,
      );
      const closingSplit = splitInterest({
        totalInterest: closingInterestPortion,
        loanAnnualRatePct: loan.ratePctPerAnnum,
        legalRatePctPerAnnum:
          loan.legalInterestPct ?? settings.globalLegalInterestRatePct,
      });
      let closingEntry: DaybookEntry;
      try {
        closingEntry = addDaybookEntry({
          dateIso: today,
          time,
          side: "CREDIT",
          category: "Full Settlement",
          particulars: `Renewal close — ${loan.customer}`,
          refId: `${closingReceiptId} • ${loan.id}`,
          account: disbursalAccount.id,
          amount: outstandingBalance,
          customerName: loan.customer,
          paymentMode: disbursalAccount.type === "CASH" ? "CASH" : "BANK",
          outstandingAfter: 0,
          legalInterestPortion: closingSplit.legal,
          companyInterestPortion: closingSplit.company,
        });
      } catch (err) {
        if (err instanceof DayLockedError) {
          toast.error(
            "Today's Daybook is locked — unlock it before posting the renewal.",
          );
          return;
        }
        throw err;
      }
      compensations.push(() => removeDaybookEntry(closingEntry.id));

      // Step B — Atomically close the existing loan + release its pledged item.
      // closeLoanWithSettlement only flips status (does NOT delete) — so the
      // true inverse is `updateLoan(prior.id, { status: prior.status })` and
      // `updatePledgedItem(prior.id, { status, vaultLoc })`. Re-adding via
      // addLoan/addPledgedItem would create duplicate IDs, so the rollback
      // path stays on the same record by id.
      const priorLoanStatus = loan.status;
      const priorPledgedSnapshot = pledgedItem
        ? {
            id: pledgedItem.id,
            status: pledgedItem.status,
            vaultLoc: pledgedItem.vaultLoc,
          }
        : null;
      closeLoanWithSettlement(loan.id);
      compensations.push(() => {
        updateLoan(loan.id, { status: priorLoanStatus });
        if (priorPledgedSnapshot) {
          updatePledgedItem(priorPledgedSnapshot.id, {
            status: priorPledgedSnapshot.status,
            vaultLoc: priorPledgedSnapshot.vaultLoc,
          });
        }
      });

      // Step C — If carrying the pledge, clone it back into the same locker
      // and originate a new PAWN loan that references it.
      if (renewCarryItem && pledgedItem) {
        const newPledged = addPledgedItem({
          title: pledgedItem.title,
          category: pledgedItem.category,
          grossWeightG: pledgedItem.grossWeightG,
          netWeightG: pledgedItem.netWeightG,
          pledgedValue: pledgedItem.pledgedValue,
          loanId: "", // patched below once we know the new loan id
          customer: pledgedItem.customer,
          status: "VAULTED",
          vaultLoc: carriedVaultLoc,
          photos: pledgedItem.photos,
          originatedAt: today,
        });
        compensations.push(() => deletePledgedItem(newPledged.id));

        newLoanId = `PWN-${Math.floor(100000 + Math.random() * 899999)}`;
        addLoan({
          id: newLoanId,
          product: "PAWN",
          customer: loan.customer,
          customerCode: loan.customerCode,
          principal: newPrincipal,
          ratePctPerAnnum: loan.ratePctPerAnnum,
          startedAtIso: today,
          durationLabel: loan.durationLabel,
          maturityIso: loan.maturityIso,
          status: "ACTIVE",
          disbursedFromAccountId: disbursalAccount.id,
          pledgedItemId: newPledged.id,
          accruedInterest: 0,
          legalInterestPct:
            loan.legalInterestPct ?? settings.globalLegalInterestRatePct,
          renewedFromLoanId: loan.id,
          notes: `Renewed from ${loan.id} via Part Release.`,
        });
        const createdNewLoanId = newLoanId;
        compensations.push(() => deleteLoan(createdNewLoanId));

        updatePledgedItem(newPledged.id, { loanId: newLoanId });

        // Step D — Processing fee on the new loan, posted as a CREDIT.
        // A day-lock failure here is non-fatal — the loan exists, we just
        // surface a warning and skip the fee rather than rolling back the
        // whole renewal.
        const fee = settings.processingFeeFlat;
        if (fee > 0) {
          try {
            const feeEntry = addDaybookEntry({
              dateIso: today,
              time,
              side: "CREDIT",
              category: "Other Income",
              particulars: `Processing fee — ${loan.customer} (${newLoanId})`,
              refId: `FEE • ${newLoanId}`,
              account: disbursalAccount.id,
              amount: fee,
              customerName: loan.customer,
              paymentMode: disbursalAccount.type === "CASH" ? "CASH" : "BANK",
            });
            compensations.push(() => removeDaybookEntry(feeEntry.id));
          } catch (err) {
            if (err instanceof DayLockedError) {
              toast.warning(
                "Renewal posted but processing fee blocked by daybook lock.",
              );
            } else {
              throw err;
            }
          }
        }
      }

      // All steps succeeded — discard the compensation list.
      compensations.length = 0;
    } catch (err) {
      // Run compensations LIFO so later side-effects unwind first.
      for (let i = compensations.length - 1; i >= 0; i--) {
        try {
          compensations[i]();
        } catch {
          // Swallow rollback failures — the user already got an error toast,
          // surfacing a second one would only confuse them.
        }
      }
      const msg = err instanceof Error ? err.message : "Renewal failed.";
      toast.error("Renewal rolled back", { description: msg });
      return;
    }

    setRenewOpen(false);
    if (renewCarryItem && newLoanId) {
      toast.success("Loan renewed", {
        description: `${loan.id} closed → ${newLoanId} opened with the same pledged item.`,
        icon: <RefreshCw size={16} />,
      });
      navigate(`/loans/${newLoanId}`);
    } else {
      toast.success("Loan released", {
        description: `${loan.id} closed and pledged item released from vault.`,
        icon: <CheckCircle2 size={16} />,
      });
      navigate("/loans");
    }
  };

  const isPawn = loan.product === "PAWN";

  return (
    <div className="mx-auto max-w-7xl pb-10">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => navigate("/loans")}
          >
            <ArrowLeft size={14} className="mr-1.5" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1
                className="font-mono text-2xl font-bold tracking-tight"
                style={{ color: "var(--brand-primary)" }}
              >
                {loan.id}
              </h1>
              <StatusPill status={loan.status} />
            </div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {loan.customer} · {loan.customerCode} ·{" "}
              {isPawn ? "Pawn Loan" : "Vehicle Loan"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => {
              // The print stylesheet only recognises "statement" and "thermal"
              // (see src/index.css). DocumentViewer is tagged
              // `print-area--statement`, so we drive the body flag to match.
              document.body.setAttribute("data-print-target", "statement");
              window.print();
              setTimeout(
                () => document.body.removeAttribute("data-print-target"),
                500,
              );
            }}
          >
            <Printer size={14} className="mr-1.5" />
            Print {isPawn ? "Pawn Ticket" : "Vehicle Agreement"}
          </Button>
          {loan.status === "ACTIVE" && isAdmin && (
            <>
              <Button
                size="sm"
                className="h-9"
                style={{
                  backgroundColor: "var(--brand-primary)",
                  color: "white",
                }}
                onClick={() => setCloseDialogOpen(true)}
              >
                <CheckCircle2 size={14} className="mr-1.5" />
                Close Loan
              </Button>
              {isPawn && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9"
                  data-testid="button-part-release"
                  style={{
                    color: "var(--brand-primary)",
                    borderColor: "rgba(74,111,165,0.40)",
                  }}
                  onClick={openRenewDialog}
                >
                  <RefreshCw size={14} className="mr-1.5" />
                  Part Release / Renew
                </Button>
              )}
              {isPawn && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9"
                  style={{
                    color: "rgb(185,28,28)",
                    borderColor: "rgba(220,38,38,0.40)",
                  }}
                  onClick={() => setAuctionDialogOpen(true)}
                >
                  <ShieldAlert size={14} className="mr-1.5" />
                  Mark for Auction
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        {/* LEFT — Printable Ticket / Agreement */}
        <DocumentViewer
          loan={loan}
          customer={customer}
          pledgedItem={pledgedItem}
          branch={branch}
          sourceAccountName={sourceAccount?.name}
        />

        {/* RIGHT — Status + summary */}
        <div className="space-y-5">
          <Card
            className="border bg-white shadow-sm"
            style={{ borderColor: "rgba(74,111,165,0.12)" }}
          >
            <CardHeader className="pb-3">
              <CardTitle
                className="text-base font-semibold"
                style={{ color: "var(--brand-primary)" }}
              >
                Loan Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <SummaryRow
                icon={Banknote}
                label="Principal Disbursed"
                value={inr(loan.principal)}
              />
              <SummaryRow
                icon={Wallet}
                label="Source Account"
                value={sourceAccount?.name ?? "—"}
                sub={sourceAccount?.subtitle}
              />
              <SummaryRow
                icon={CalendarClock}
                label="Maturity"
                value={prettyDate(loan.maturityIso)}
                sub={loan.durationLabel}
              />
              <SummaryRow
                icon={ReceiptText}
                label="Total Collected"
                value={inr(totalCollected)}
                sub={`${receipts.length} receipt${receipts.length === 1 ? "" : "s"}`}
              />
              {pledgedItem && (
                <SummaryRow
                  icon={Vault}
                  label="Vault Location"
                  value={pledgedItem.vaultLoc ?? "—"}
                  sub={pledgedItem.title}
                />
              )}
            </CardContent>
          </Card>

          {!isAdmin && loan.status === "ACTIVE" && (
            <div
              className="flex items-start gap-2 rounded-lg border p-3 text-[11px]"
              style={{
                borderColor: "rgba(245,158,11,0.40)",
                backgroundColor: "rgba(254,243,199,0.50)",
                color: "rgb(146,64,14)",
              }}
            >
              <Lock size={12} className="mt-0.5 shrink-0" />
              <span>
                Closing a loan or marking for auction requires an Admin role.
                Switch to Admin Mode in Settings.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Linked Receipts */}
      <Card
        className="mt-5 border bg-white shadow-sm"
        style={{ borderColor: "rgba(74,111,165,0.12)" }}
      >
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle
                className="text-base font-semibold"
                style={{ color: "var(--brand-primary)" }}
              >
                Linked Ledger Activity
              </CardTitle>
              <CardDescription className="text-xs">
                Every Daybook entry posted against this loan, in chronological
                order.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => navigate("/receipts-ledger")}
            >
              Open Receipts Ledger
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div
            className="overflow-hidden rounded-lg border"
            style={{ borderColor: "rgba(74,111,165,0.12)" }}
          >
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: "rgba(191,221,245,0.25)" }}>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                    Date
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                    Side
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
                    Category
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
                {linkedEntries.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-20 text-center text-sm text-slate-500"
                    >
                      No ledger activity yet for this loan.
                    </TableCell>
                  </TableRow>
                ) : (
                  linkedEntries.map((e) => (
                    <TableRow key={e.id} className="hover:bg-slate-50/60">
                      <TableCell className="text-xs text-slate-600">
                        {prettyDate(e.dateIso)}
                        <div className="text-[10px] text-slate-400">
                          {e.time}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            e.side === "CREDIT"
                              ? "border-green-300 text-green-700"
                              : "border-red-300 text-red-700"
                          }
                        >
                          {e.side}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {e.category}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {e.particulars}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {accountName(e.account)}
                      </TableCell>
                      <TableCell
                        className="text-right text-sm font-semibold"
                        style={{
                          color:
                            e.side === "CREDIT"
                              ? "rgb(21,128,61)"
                              : "rgb(185,28,28)",
                        }}
                      >
                        {e.side === "CREDIT" ? "+" : "−"}
                        {inr(e.amount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Final Settlement dialog — strict closure */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent
          className="max-w-lg"
          style={{ backgroundColor: "var(--bg-main)" }}
        >
          <DialogHeader>
            <DialogTitle
              className="flex items-center gap-2 text-base font-semibold"
              style={{ color: "var(--brand-primary)" }}
            >
              <FileSignature size={16} />
              Final Settlement — {loan.id}
            </DialogTitle>
            <DialogDescription className="text-xs">
              The loan is only marked Closed when the entire balance is
              cleared. Partial amounts post a receipt but keep the loan Active.
            </DialogDescription>
          </DialogHeader>

          {/* Outstanding breakdown */}
          <div
            className="rounded-lg border bg-white p-3 text-xs"
            style={{ borderColor: "rgba(74,111,165,0.18)" }}
          >
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Outstanding Balance
            </div>
            <div className="grid grid-cols-2 gap-y-1.5">
              <div className="text-slate-600">Principal</div>
              <div className="text-right font-mono">{inr(loan.principal)}</div>
              <div className="text-slate-600">Accrued Interest</div>
              <div className="text-right font-mono">
                {inr(loan.accruedInterest ?? 0)}
              </div>
              <div className="text-slate-600">Already Collected</div>
              <div className="text-right font-mono text-emerald-700">
                − {inr(totalCollected)}
              </div>
              <div
                className="border-t pt-1.5 font-semibold text-slate-700"
                style={{ borderColor: "rgba(74,111,165,0.18)" }}
              >
                Balance Due
              </div>
              <div
                className="border-t pt-1.5 text-right font-mono font-bold"
                style={{
                  borderColor: "rgba(74,111,165,0.18)",
                  color:
                    outstandingBalance === 0
                      ? "rgb(21,128,61)"
                      : "var(--brand-primary)",
                }}
              >
                {inr(outstandingBalance)}
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="settlement-amount" className="text-xs font-semibold">
                Amount Received
              </Label>
              <div className="relative mt-1">
                <IndianRupee
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <Input
                  id="settlement-amount"
                  type="number"
                  inputMode="decimal"
                  className="pl-8 font-mono"
                  value={settlementAmountStr}
                  onChange={(e) => setSettlementAmountStr(e.target.value)}
                  min={0}
                  step={1}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="settlement-account" className="text-xs font-semibold">
                Receive Into
              </Label>
              <Select
                value={settlementAccountId}
                onValueChange={setSettlementAccountId}
              >
                <SelectTrigger id="settlement-account" className="mt-1">
                  <SelectValue placeholder="Pick account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                      {a.subtitle ? ` · ${a.subtitle}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Live status banner */}
            <div
              className="rounded-lg border p-3 text-xs"
              style={{
                borderColor: isOverpaid
                  ? "rgba(220,38,38,0.40)"
                  : willFullyClose
                  ? "rgba(34,197,94,0.40)"
                  : "rgba(245,158,11,0.40)",
                backgroundColor: isOverpaid
                  ? "rgba(254,226,226,0.60)"
                  : willFullyClose
                  ? "rgba(220,252,231,0.55)"
                  : "rgba(254,243,199,0.55)",
                color: isOverpaid
                  ? "rgb(185,28,28)"
                  : willFullyClose
                  ? "rgb(21,128,61)"
                  : "rgb(146,64,14)",
              }}
            >
              {settlementAmount === 0 ? (
                <span>Enter an amount to record the settlement.</span>
              ) : isOverpaid ? (
                <span>
                  Overpayment blocked — the customer owes only{" "}
                  <strong>{inr(outstandingBalance)}</strong>. Reduce the amount
                  to proceed.
                </span>
              ) : willFullyClose ? (
                <span>
                  <CheckCircle2 size={12} className="-mt-0.5 mr-1 inline" />
                  Balance clears to ₹0 — loan will be marked{" "}
                  <strong>Closed</strong>
                  {pledgedItem
                    ? " and the pledged item released from the vault."
                    : "."}
                </span>
              ) : (
                <span>
                  Records a part payment of {inr(settlementAmount)}. Balance
                  {" "}
                  <strong>{inr(projectedBalance)}</strong> remains pending —
                  the loan stays <strong>Active</strong>.
                </span>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleFinalSettlement}
              disabled={
                settlementAmount <= 0 || !settlementAccount || isOverpaid
              }
              style={{
                backgroundColor: willFullyClose
                  ? "rgb(22,163,74)"
                  : "var(--brand-primary)",
                color: "white",
              }}
            >
              <FileSignature size={14} className="mr-1.5" />
              {willFullyClose ? "Settle & Close Loan" : "Record Part Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Part Release / Renew dialog */}
      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Part Release / Renew</DialogTitle>
            <DialogDescription>
              Closes <span className="font-mono">{loan.id}</span> for{" "}
              {inr(outstandingBalance)} and originates a fresh pawn loan
              against the same pledged item.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {pledgedItem ? (
              <div
                className="rounded-md border p-3 text-sm"
                style={{
                  borderColor: "rgba(74,111,165,0.20)",
                  background: "rgba(191,221,245,0.18)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {pledgedItem.title}
                    </div>
                    <div className="text-xs text-slate-600">
                      {pledgedItem.category} · Net {pledgedItem.netWeightG}g ·
                      Pledged {inr(pledgedItem.pledgedValue)}
                    </div>
                    <div className="mt-1 text-[11px] font-mono text-slate-500">
                      Vault {pledgedItem.vaultLoc ?? "—"} · {pledgedItem.id}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                    <Checkbox
                      checked={renewCarryItem}
                      onCheckedChange={(v) => setRenewCarryItem(v === true)}
                      data-testid="checkbox-carry-item"
                    />
                    Carry to new loan
                  </label>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                No pledged item linked to this loan. Renewal will only close
                the existing loan.
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="renew-principal">New principal (₹)</Label>
                <Input
                  id="renew-principal"
                  type="number"
                  inputMode="numeric"
                  value={renewPrincipalStr}
                  onChange={(e) => setRenewPrincipalStr(e.target.value)}
                  placeholder="e.g. 150000"
                  data-testid="input-renew-principal"
                  disabled={!renewCarryItem}
                />
                <p className="text-[11px] text-slate-500">
                  Defaults to current outstanding ({inr(outstandingBalance)}).
                  Lower it to give cash back to the customer.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="renew-account">Disbursal Account</Label>
                <Select
                  value={renewAccountId}
                  onValueChange={setRenewAccountId}
                >
                  <SelectTrigger
                    id="renew-account"
                    data-testid="select-renew-account"
                  >
                    <SelectValue placeholder="Pick account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-500">
                  Used for both the closing settlement and the new
                  disbursement.
                </p>
              </div>
            </div>

            {renewCarryItem && (
              <div className="rounded-md bg-slate-50 p-3 text-[11px] text-slate-600">
                <div className="font-semibold text-slate-700">
                  Posting summary
                </div>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  <li>
                    Close {loan.id} (Full Settlement{" "}
                    {inr(outstandingBalance)})
                  </li>
                  <li>Open new pawn loan ({inr(parseInt(renewPrincipalStr || "0", 10))})</li>
                  <li>
                    Processing fee {inr(settings.processingFeeFlat)} (CREDIT)
                  </li>
                  <li>Pledged item stays in vault {pledgedItem?.vaultLoc ?? "—"}</li>
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handlePartReleaseRenew}
              data-testid="button-confirm-renew"
              style={{ backgroundColor: "var(--brand-primary)", color: "white" }}
            >
              <RefreshCw size={14} className="mr-1.5" />
              {renewCarryItem ? "Renew Loan" : "Close & Release"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark for Auction dialog */}
      <AlertDialog
        open={auctionDialogOpen}
        onOpenChange={setAuctionDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this loan for auction?</AlertDialogTitle>
            <AlertDialogDescription>
              This flags {loan.id} as defaulted. The pledged item (
              {pledgedItem?.title ?? "—"}) will be moved to the Auction queue
              and locked from release.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMarkForAuction}
              style={{ backgroundColor: "rgb(185,28,28)" }}
            >
              <ShieldAlert size={14} className="mr-1.5" />
              Mark for Auction
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusPill({ status }: { status: Loan["status"] }) {
  const map: Record<Loan["status"], { label: string; bg: string; color: string }> = {
    ACTIVE: {
      label: "Active",
      bg: "rgba(34,197,94,0.14)",
      color: "rgb(21,128,61)",
    },
    CLOSED: {
      label: "Closed",
      bg: "rgba(74,111,165,0.12)",
      color: "var(--brand-primary)",
    },
    AUCTION: {
      label: "Auction",
      bg: "rgba(220,38,38,0.14)",
      color: "rgb(185,28,28)",
    },
  };
  const cfg = map[status];
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Banknote;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: "var(--brand-light)" }}
      >
        <Icon size={16} style={{ color: "var(--brand-primary)" }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </div>
        <div className="text-sm font-semibold text-slate-800">{value}</div>
        {sub && <div className="truncate text-[11px] text-slate-500">{sub}</div>}
      </div>
    </div>
  );
}
