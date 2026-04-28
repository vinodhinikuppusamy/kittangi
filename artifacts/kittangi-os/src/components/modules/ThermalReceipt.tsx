import { useEffect, useRef } from "react";
import { Printer, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBranchProfile } from "@/lib/stores/branchProfileStore";

/**
 * The composed receipt model the dialog renders. Whoever opens the dialog is
 * expected to compute the principal/interest split and the post-payment
 * outstanding balance — the receipt itself is purely presentational so it
 * stays in lockstep with whatever the daybook recorded.
 */
export type ThermalReceiptData = {
  receiptId: string;
  dateLabel: string;
  timeLabel: string;
  customerName: string;
  loanId: string;
  paymentTypeLabel: string;
  paymentMode: string;
  accountLabel: string;
  amountPaid: number;
  interestPortion: number;
  principalPortion: number;
  outstandingBalance: number;
  cashier?: string;
  notes?: string;
};

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

const Divider = ({ heavy = false }: { heavy?: boolean }) => (
  <div
    aria-hidden
    style={{
      borderTop: `${heavy ? "1.5px" : "1px"} dashed #000`,
      margin: "6px 0",
    }}
  />
);

const Row = ({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) => (
  <div
    className="flex items-baseline justify-between"
    style={{
      fontSize: 12,
      lineHeight: 1.45,
      fontWeight: bold ? 700 : 400,
    }}
  >
    <span style={{ paddingRight: 8 }}>{label}</span>
    <span style={{ textAlign: "right" }}>{value}</span>
  </div>
);

export default function ThermalReceiptDialog({
  open,
  onOpenChange,
  data,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  data: ThermalReceiptData | null;
}) {
  const branch = useBranchProfile();
  const previewRef = useRef<HTMLDivElement | null>(null);

  // Focus is sent into the preview when the dialog opens so screen-reader
  // users land on the receipt content, not the dialog chrome.
  useEffect(() => {
    if (open && previewRef.current) {
      previewRef.current.focus({ preventScroll: true });
    }
  }, [open]);

  const handlePrint = () => {
    // window.print() works against the live DOM — the @media print rules in
    // index.css scope visibility to whichever .print-area matches the active
    // body[data-print-target] attribute, so the user sees only the receipt
    // on paper even if a Customer 360 statement is also mounted.
    const prev = document.body.dataset.printTarget;
    document.body.dataset.printTarget = "thermal";
    try {
      window.print();
    } finally {
      if (prev) document.body.dataset.printTarget = prev;
      else delete document.body.dataset.printTarget;
    }
  };

  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md p-0 sm:max-w-md"
        style={{ backgroundColor: "var(--bg-main)" }}
      >
        {/* Header (hidden on print) */}
        <DialogHeader
          className="no-print border-b px-5 py-4"
          style={{ borderColor: "rgba(74,111,165,0.15)" }}
        >
          <DialogTitle
            className="text-base font-semibold"
            style={{ color: "var(--brand-primary)" }}
          >
            Receipt Preview · 80mm Thermal
          </DialogTitle>
          <DialogDescription className="text-xs">
            Verify the breakdown, then print to your thermal roll. The cashier
            copy is auto-saved to today’s ledger.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable preview area + the actual print target */}
        <div className="px-5 py-4">
          <div
            ref={previewRef}
            tabIndex={-1}
            className="print-area print-area--thermal mx-auto rounded-md border bg-white shadow-sm"
            style={{
              width: 302, // ~80mm at 96dpi
              padding: "14px 16px",
              fontFamily:
                "'Courier New', ui-monospace, SFMono-Regular, Menlo, monospace",
              color: "#000",
              borderColor: "rgba(74,111,165,0.20)",
            }}
            id="thermal-receipt-print"
          >
            {/* Branch header */}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>
                {branch.branchName.toUpperCase()}
              </div>
              <div style={{ fontSize: 11, marginTop: 2 }}>{branch.address}</div>
              <div style={{ fontSize: 11 }}>{branch.contact}</div>
              <div style={{ fontSize: 11 }}>GSTIN: {branch.gstin}</div>
            </div>

            <Divider heavy />

            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>
                PAYMENT RECEIPT
              </div>
              <div style={{ fontSize: 11, marginTop: 2 }}>
                {data.paymentTypeLabel}
              </div>
            </div>

            <Divider />

            {/* Receipt meta */}
            <Row label="Receipt No" value={data.receiptId} />
            <Row label="Date" value={data.dateLabel} />
            <Row label="Time" value={data.timeLabel} />
            <Row label="Branch" value={branch.branchCode} />

            <Divider />

            {/* Customer */}
            <Row label="Customer" value={data.customerName} />
            <Row label="Loan ID" value={data.loanId} />

            <Divider />

            {/* Breakdown */}
            <div
              style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}
            >
              PAYMENT BREAKDOWN
            </div>
            <Row label="Interest" value={inr(data.interestPortion)} />
            <Row label="Principal" value={inr(data.principalPortion)} />
            <Divider />
            <Row label="Total Paid" value={inr(data.amountPaid)} bold />

            <Divider />

            <Row label="Mode" value={data.paymentMode} />
            <Row label="Credited To" value={data.accountLabel} />

            <Divider heavy />

            {/* Outstanding */}
            <div
              style={{
                textAlign: "center",
                fontSize: 12,
                fontWeight: 700,
                margin: "6px 0 2px",
              }}
            >
              OUTSTANDING BALANCE
            </div>
            <div
              style={{
                textAlign: "center",
                fontSize: 16,
                fontWeight: 800,
                letterSpacing: 0.5,
              }}
            >
              {inr(data.outstandingBalance)}
            </div>
            <div
              style={{
                textAlign: "center",
                fontSize: 10,
                marginTop: 2,
              }}
            >
              {data.outstandingBalance <= 0
                ? "Loan fully settled. Pledge ready for release."
                : "Carry forward — collect next due cycle."}
            </div>

            <Divider />

            {data.notes ? (
              <>
                <div style={{ fontSize: 11 }}>
                  <span style={{ fontWeight: 700 }}>Note: </span>
                  {data.notes}
                </div>
                <Divider />
              </>
            ) : null}

            {/* Footer */}
            <div
              style={{
                textAlign: "center",
                fontSize: 10,
                lineHeight: 1.5,
                marginTop: 6,
              }}
            >
              Thank you for banking with {branch.branchName}.
              <br />
              This is a computer-generated receipt.
              <br />
              Cashier: {data.cashier ?? "—"}
            </div>
          </div>
        </div>

        {/* Footer actions (hidden on print) */}
        <div
          className="no-print flex items-center justify-end gap-2 border-t px-5 py-3"
          style={{ borderColor: "rgba(74,111,165,0.15)" }}
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            <X className="mr-1.5 h-4 w-4" />
            Close
          </Button>
          <Button
            type="button"
            onClick={handlePrint}
            className="font-semibold text-white shadow-sm"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            <Printer className="mr-1.5 h-4 w-4" />
            Print Receipt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
