import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, FileSignature } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { useAccounts } from "@/lib/stores/accountsStore";
import { useCustomers } from "@/lib/stores/customersStore";
import {
  addDaybookEntry,
  DayLockedError,
} from "@/lib/stores/daybookStore";
import { isDateLocked } from "@/lib/stores/dayLocksStore";
import { addLoan } from "@/lib/stores/loansStore";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

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

function addMonthsIso(iso: string, months: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: (loanId: string) => void;
};

/**
 * Document Loan = unsecured personal loan against signed promissory note.
 * Unlike Pawn / Vehicle there is no collateral artefact, so we only persist
 * the Loan record + the matching DEBIT in the Daybook.
 */
export default function DocumentLoanDialog({
  open,
  onOpenChange,
  onCreated,
}: Props) {
  const accounts = useAccounts();
  const allCustomers = useCustomers();
  const verifiedCustomers = useMemo(
    () =>
      allCustomers
        .filter((c) => c.kycStatus === "Verified")
        .map((c) => ({ id: c.id, name: c.fullName, phone: c.phone })),
    [allCustomers],
  );

  const [customerId, setCustomerId] = useState<string>("");
  const [amountStr, setAmountStr] = useState<string>("");
  const [rateStr, setRateStr] = useState<string>("18");
  const [tenureStr, setTenureStr] = useState<string>("12");
  const [accountId, setAccountId] = useState<string>("");

  // Default to CASH on open so the user can submit in two clicks.
  useEffect(() => {
    if (!open) return;
    setCustomerId("");
    setAmountStr("");
    setRateStr("18");
    setTenureStr("12");
    const cash = accounts.find((a) => a.id === "CASH");
    setAccountId(cash?.id ?? accounts[0]?.id ?? "");
  }, [open, accounts]);

  const amount = parseFloat(amountStr || "0");
  const rate = parseFloat(rateStr || "0");
  const tenure = parseFloat(tenureStr || "0");
  const customer = verifiedCustomers.find((c) => c.id === customerId);

  const handleDocument = () => {
    if (!customerId || !customer) {
      toast.error("Select a KYC-verified customer.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid loan amount.");
      return;
    }
    if (!Number.isFinite(rate) || rate <= 0 || rate > 60) {
      toast.error("Interest rate must be between 0 and 60% p.a.");
      return;
    }
    if (!Number.isFinite(tenure) || tenure <= 0 || tenure > 60) {
      toast.error("Tenure must be between 1 and 60 months.");
      return;
    }
    if (!accountId) {
      toast.error("Choose the disbursing account.");
      return;
    }

    const today = todayIso();
    if (isDateLocked(today)) {
      toast.error(
        "Today's Daybook is locked — unlock the day before originating new loans.",
      );
      return;
    }

    const loanId = `DOC-${Math.floor(100000 + Math.random() * 899999)}`;
    const maturityIso = addMonthsIso(today, tenure);

    // Atomicity: post the disbursement to the Daybook FIRST. If it throws
    // (e.g. someone locked the day between our precheck and now) we abort
    // BEFORE creating the loan record, so the loan ledger and the cash
    // ledger never disagree. Only after the post succeeds do we commit the
    // loan to the loans store.
    try {
      addDaybookEntry({
        dateIso: today,
        time: timeNow(),
        side: "DEBIT",
        category: "Loan Disbursement",
        particulars: `Document loan disbursed to ${customer.name}`,
        refId: loanId,
        account: accountId,
        amount,
        customerName: customer.name,
        customerId: customer.id,
      });
    } catch (err) {
      if (err instanceof DayLockedError) {
        toast.error(
          "Today's Daybook was locked just now — disbursement was not posted.",
        );
        return;
      }
      throw err;
    }

    addLoan({
      id: loanId,
      product: "DOCUMENT",
      customer: customer.name,
      customerCode: customer.id,
      principal: amount,
      ratePctPerAnnum: rate,
      startedAtIso: today,
      durationLabel: `${tenure} months`,
      maturityIso,
      status: "ACTIVE",
      disbursedFromAccountId: accountId,
      notes: "Unsecured document loan — signed promissory note on file.",
    });

    toast.success("Document loan disbursed", {
      icon: <CheckCircle2 size={16} />,
      description: `${loanId} • ${inr(amount)} disbursed from ${
        accounts.find((a) => a.id === accountId)?.name ?? accountId
      }`,
    });
    onOpenChange(false);
    onCreated?.(loanId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle
            className="flex items-center gap-2 text-base font-semibold"
            style={{ color: "var(--brand-primary)" }}
          >
            <FileSignature size={16} />
            Originate Document Loan
          </DialogTitle>
          <DialogDescription className="text-xs">
            Unsecured personal loan against a signed promissory note. No
            collateral is captured — only the Loan record and a DEBIT in the
            Daybook are posted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Customer
            </Label>
            <Select
              value={customerId}
              onValueChange={setCustomerId}
              disabled={verifiedCustomers.length === 0}
            >
              <SelectTrigger className="h-10 w-full bg-white">
                <SelectValue
                  placeholder={
                    verifiedCustomers.length === 0
                      ? "No verified customers found"
                      : "Select KYC-verified customer..."
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {verifiedCustomers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{c.name}</span>
                      <span className="text-xs text-slate-500">
                        {c.id} • {c.phone}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Amount (₹)
              </Label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="e.g., 75,000"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Rate (% p.a.)
              </Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                max="60"
                value={rateStr}
                onChange={(e) => setRateStr(e.target.value)}
                className="h-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tenure (months)
              </Label>
              <Input
                type="number"
                min="1"
                max="60"
                value={tenureStr}
                onChange={(e) => setTenureStr(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Disburse From
              </Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger
                  className="h-10 w-full bg-white"
                  aria-label="Disbursing Account"
                >
                  <SelectValue placeholder="Select account..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{a.name}</span>
                        {a.subtitle ? (
                          <span className="text-xs text-slate-500">
                            {a.subtitle}
                          </span>
                        ) : null}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {amount > 0 && (
            <div
              className="rounded-lg border px-3 py-2 text-xs"
              style={{
                borderColor: "rgba(74,111,165,0.18)",
                backgroundColor: "var(--bg-main)",
                color: "var(--brand-primary)",
              }}
            >
              Will disburse{" "}
              <span className="font-semibold">{inr(amount)}</span> at{" "}
              <span className="font-semibold">{rate}% p.a.</span> for{" "}
              <span className="font-semibold">{tenure} months</span>.
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="font-semibold text-white"
            style={{ backgroundColor: "var(--brand-primary)" }}
            onClick={handleDocument}
          >
            <FileSignature size={14} className="mr-1.5" />
            Document &amp; Disburse
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
