import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  FileSignature,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";

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
import { addLoan, type LegalDoc } from "@/lib/stores/loansStore";
import { useSettings } from "@/lib/stores/settingsStore";
import { computeProcessingFee } from "@/lib/interest";

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
 * General-purpose loan origination dialog ("New Loan").
 *
 * Originally this was a Document-only / unsecured promissory note flow, but
 * as of April 2026 it doubles as a catch-all for any non-Pawn / non-Vehicle
 * lending where the operator wants to attach scanned legal collateral docs.
 * It posts the disbursement (net of the slab-based processing fee) to the
 * Daybook, persists the gross principal on the Loan record, and stores any
 * uploaded PDFs/images as base64 dataUrls under `loan.legalDocs` so they
 * surface in Loan Lifecycle the same way Vehicle's docs do.
 */
export default function DocumentLoanDialog({
  open,
  onOpenChange,
  onCreated,
}: Props) {
  const accounts = useAccounts();
  const allCustomers = useCustomers();
  const settings = useSettings();
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
  const [legalRateStr, setLegalRateStr] = useState<string>(
    String(settings.globalLegalInterestRatePct),
  );
  const [tenureStr, setTenureStr] = useState<string>("12");
  const [accountId, setAccountId] = useState<string>("");
  // Uploaded legal/collateral attachments — each one stored as a base64
  // dataUrl + filename so the Loan Lifecycle viewer can render PDFs and
  // images without a separate object-storage round-trip.
  const [docs, setDocs] = useState<LegalDoc[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Default to CASH on open so the user can submit in two clicks.
  useEffect(() => {
    if (!open) return;
    setCustomerId("");
    setAmountStr("");
    setRateStr("18");
    setLegalRateStr(String(settings.globalLegalInterestRatePct));
    setTenureStr("12");
    setDocs([]);
    const cash = accounts.find((a) => a.id === "CASH");
    setAccountId(cash?.id ?? accounts[0]?.id ?? "");
  }, [open, accounts, settings.globalLegalInterestRatePct]);

  const amount = parseFloat(amountStr || "0");
  const rate = parseFloat(rateStr || "0");
  const legalRate = parseFloat(legalRateStr || "0");
  const tenure = parseFloat(tenureStr || "0");
  const customer = verifiedCustomers.find((c) => c.id === customerId);

  // Slab-based processing fee — auto-derived from Settings → Rates & Fees.
  // Kept as a derived value (not an input) so cashiers can't fudge it on a
  // per-loan basis; raise the slab in Settings if a permanent change is
  // needed.
  const processingFee = computeProcessingFee({
    loanAmount: Number.isFinite(amount) ? amount : 0,
    feePerThousand: settings.processingFeePer1000,
  });
  const netDisbursement = Math.max(0, amount - processingFee);

  const companyRate = Math.max(0, rate - Math.min(rate, legalRate));

  // Hard limits to keep the loan record payload bounded for API safety.
  // ~5 MB-per-origin quota — base64 inflates payload by ~33%, so we cap
  // both per-file and aggregate sizes (and a sensible max file count).
  const MAX_FILE_BYTES = 4 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 12 * 1024 * 1024;
  const MAX_FILES = 8;

  const currentTotalBytes = useMemo(
    () =>
      docs.reduce((s, d) => {
        // dataUrl is "data:<mime>;base64,<payload>" — payload length × 0.75
        // roughly equals decoded bytes; near enough for a budget guard.
        const idx = d.dataUrl.indexOf(",");
        const payload = idx >= 0 ? d.dataUrl.slice(idx + 1) : d.dataUrl;
        return s + Math.ceil(payload.length * 0.75);
      }, 0),
    [docs],
  );

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    // Reset the input so re-selecting the same file fires a change event.
    if (fileInputRef.current) fileInputRef.current.value = "";

    let runningBytes = currentTotalBytes;
    const accepted: LegalDoc[] = [];
    for (const file of files) {
      if (docs.length + accepted.length >= MAX_FILES) {
        toast.error(`At most ${MAX_FILES} attachments per loan.`);
        break;
      }
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`${file.name} is over 4 MB — please attach a smaller file.`);
        continue;
      }
      if (runningBytes + file.size > MAX_TOTAL_BYTES) {
        toast.error(
          `${file.name} would push attachments past 12 MB total — drop something first.`,
        );
        continue;
      }
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onerror = () => reject(fr.error ?? new Error("read failed"));
          fr.onload = () => resolve(String(fr.result ?? ""));
          fr.readAsDataURL(file);
        });
        accepted.push({
          type: "AGREEMENT",
          name: file.name,
          dataUrl,
          uploadedAtIso: new Date().toISOString(),
        });
        runningBytes += file.size;
      } catch {
        toast.error(`Couldn't read ${file.name}.`);
      }
    }
    if (accepted.length > 0) {
      setDocs((prev) => [...prev, ...accepted]);
      toast.success(
        accepted.length === 1
          ? `${accepted[0].name} attached.`
          : `${accepted.length} files attached.`,
      );
    }
  };

  const removeDoc = (idx: number): void => {
    setDocs((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
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
    if (!Number.isFinite(legalRate) || legalRate < 0 || legalRate > rate) {
      toast.error(
        "Legal Interest must be between 0 and the loan's total rate.",
      );
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
        particulars: `Loan disbursed to ${customer.name}${
          processingFee > 0
            ? ` (net of ${inr(processingFee)} processing fee)`
            : ""
        }`,
        refId: loanId,
        account: accountId,
        amount: netDisbursement,
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
      legalInterestPct: legalRate || undefined,
      legalDocs: docs.length > 0 ? docs : undefined,
      notes:
        docs.length > 0
          ? `General loan with ${docs.length} attached document${
              docs.length === 1 ? "" : "s"
            }.`
          : "General loan — signed promissory note on file.",
    });

    toast.success("Loan disbursed", {
      icon: <CheckCircle2 size={16} />,
      description: `${loanId} • ${inr(netDisbursement)} disbursed from ${
        accounts.find((a) => a.id === accountId)?.name ?? accountId
      }`,
    });
    onOpenChange(false);
    onCreated?.(loanId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle
            className="flex items-center gap-2 text-base font-semibold"
            style={{ color: "var(--brand-primary)" }}
          >
            <FileSignature size={16} />
            New Loan
          </DialogTitle>
          <DialogDescription className="text-xs">
            General-purpose loan origination. Attach any legal or collateral
            documents (PDFs / images) — they're saved with the loan and
            available from Loan Lifecycle.
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

          {/* Legal vs Company split — same convention as Pawn. The "Legal"
              portion is what the splitInterest helper will allocate to the
              legal book at receipt time; the remainder is "Company". */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Legal Interest (% p.a.)
              </Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                max="60"
                value={legalRateStr}
                onChange={(e) => setLegalRateStr(e.target.value)}
                className="h-10"
                data-testid="input-doc-legal-rate"
              />
              <p className="text-[11px] text-slate-500">
                Default {settings.globalLegalInterestRatePct}% from Settings.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Company Interest (% p.a.)
              </Label>
              <Input
                type="number"
                value={companyRate.toFixed(2)}
                readOnly
                disabled
                className="h-10 bg-slate-50 font-semibold"
                data-testid="input-doc-company-rate"
              />
              <p className="text-[11px] text-slate-500">
                Auto = Total − Legal.
              </p>
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

          {/* Legal / Collateral document upload. Multi-select; each file is
              read as a base64 dataUrl and attached to the loan record. */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Legal / Collateral Documents
            </Label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
                data-testid="input-doc-upload"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-semibold"
                style={{
                  borderColor: "var(--brand-primary)",
                  color: "var(--brand-primary)",
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} />
                Attach files
              </Button>
              <span className="text-[11px] text-slate-500">
                PDFs or images, up to 4 MB each.
              </span>
            </div>
            {docs.length > 0 && (
              <ul className="mt-2 space-y-1 rounded-md border border-slate-200 bg-slate-50 p-2">
                {docs.map((d, i) => (
                  <li
                    key={`${d.name}-${i}`}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <Paperclip size={12} className="shrink-0 text-slate-400" />
                      <span className="truncate font-medium text-slate-700">
                        {d.name}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-slate-400 hover:text-rose-600"
                      onClick={() => removeDoc(i)}
                      aria-label={`Remove ${d.name}`}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
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
              <div className="flex justify-between">
                <span>Principal</span>
                <span className="font-semibold">{inr(amount)}</span>
              </div>
              <div className="flex justify-between">
                <span>− Processing Fee (auto)</span>
                <span className="font-semibold">{inr(processingFee)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-slate-300/60 pt-1">
                <span className="font-semibold">Net Disbursement</span>
                <span className="font-bold">{inr(netDisbursement)}</span>
              </div>
              <div className="mt-1 text-[11px] opacity-75">
                {tenure} months @ {rate}% p.a.
              </div>
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
            onClick={handleSubmit}
            data-testid="button-create-loan"
          >
            <FileSignature size={14} className="mr-1.5" />
            Create &amp; Disburse
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
