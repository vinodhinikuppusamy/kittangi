import { Bike, Car, FileSignature, Gem, Truck, Vault } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { Loan } from "@/lib/stores/loansStore";
import type { Customer } from "@/lib/stores/customersStore";
import type { PledgedItem } from "@/lib/stores/pledgedItemsStore";
import type { BranchProfile } from "@/lib/stores/branchProfileStore";

type Props = {
  loan: Loan;
  customer?: Customer;
  pledgedItem?: PledgedItem;
  branch: BranchProfile;
  sourceAccountName?: string;
};

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

function tenureLabel(loan: Loan): string {
  if (loan.durationLabel) return loan.durationLabel;
  if (!loan.maturityIso) return "—";
  const start = new Date(loan.startedAtIso + "T00:00:00").getTime();
  const end = new Date(loan.maturityIso + "T00:00:00").getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    return "—";
  const days = Math.round((end - start) / (1000 * 60 * 60 * 24));
  if (days < 31) return `${days} days`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? "" : "s"}`;
}

function CustomerKycBlock({ customer }: { customer?: Customer }) {
  if (!customer) {
    return (
      <div className="text-xs text-slate-500">
        Customer KYC details not available on file.
      </div>
    );
  }
  const initials = customer.fullName
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const addr = customer.address;
  const addrLine = addr
    ? [addr.street, addr.city, addr.state, addr.pincode]
        .filter(Boolean)
        .join(", ")
    : "";
  return (
    <div className="flex items-start gap-4">
      {customer.photoDataUrl ? (
        <img
          src={customer.photoDataUrl}
          alt={customer.fullName}
          className="h-20 w-20 rounded-lg border object-cover"
          style={{ borderColor: "rgba(74,111,165,0.30)" }}
        />
      ) : (
        <div
          className="flex h-20 w-20 items-center justify-center rounded-lg text-xl font-bold text-white"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          {initials || "—"}
        </div>
      )}
      <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <span className="text-slate-500">Name</span>
        <span className="text-right font-semibold text-slate-800">
          {customer.fullName}
        </span>
        <span className="text-slate-500">Customer Code</span>
        <span className="text-right font-mono text-slate-800">
          {customer.id}
        </span>
        <span className="text-slate-500">Phone</span>
        <span className="text-right text-slate-800">{customer.phone}</span>
        {customer.dob && (
          <>
            <span className="text-slate-500">Date of Birth</span>
            <span className="text-right text-slate-800">
              {prettyDate(customer.dob)}
            </span>
          </>
        )}
        {customer.aadhar && (
          <>
            <span className="text-slate-500">Aadhaar</span>
            <span className="text-right font-mono text-slate-800">
              {customer.aadhar}
            </span>
          </>
        )}
        {customer.pan && (
          <>
            <span className="text-slate-500">PAN</span>
            <span className="text-right font-mono text-slate-800">
              {customer.pan}
            </span>
          </>
        )}
        {addrLine && (
          <>
            <span className="text-slate-500">Address</span>
            <span className="text-right text-slate-800">{addrLine}</span>
          </>
        )}
      </div>
    </div>
  );
}

function ItemBlock({ pledgedItem }: { pledgedItem?: PledgedItem }) {
  if (!pledgedItem) {
    return (
      <div className="text-xs text-slate-500">
        No pledged item linked to this loan.
      </div>
    );
  }
  const photo = pledgedItem.photos?.[0];
  return (
    <div className="flex items-start gap-4">
      {photo ? (
        <img
          src={photo}
          alt={pledgedItem.title}
          className="h-24 w-24 rounded-lg border object-cover"
          style={{ borderColor: "rgba(74,111,165,0.30)" }}
        />
      ) : (
        <div
          className="flex h-24 w-24 items-center justify-center rounded-lg border bg-white"
          style={{ borderColor: "rgba(74,111,165,0.30)" }}
        >
          <Gem className="h-7 w-7" style={{ color: "var(--brand-primary)" }} />
        </div>
      )}
      <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <span className="text-slate-500">Item</span>
        <span className="text-right font-medium text-slate-800">
          {pledgedItem.title}
        </span>
        <span className="text-slate-500">Category</span>
        <span className="text-right font-medium text-slate-800">
          {pledgedItem.category}
        </span>
        <span className="text-slate-500">Gross / Net Weight</span>
        <span className="text-right font-medium text-slate-800">
          {pledgedItem.grossWeightG.toFixed(2)}g /{" "}
          {pledgedItem.netWeightG.toFixed(2)}g
        </span>
        <span className="text-slate-500">Pledged Value</span>
        <span className="text-right font-medium text-slate-800">
          {inr(pledgedItem.pledgedValue)}
        </span>
        <span className="text-slate-500 flex items-center gap-1">
          <Vault size={11} /> Vault Location
        </span>
        <span className="text-right font-mono text-xs text-slate-800">
          {pledgedItem.vaultLoc ?? "—"}
        </span>
      </div>
    </div>
  );
}

function VehicleBlock({ loan }: { loan: Loan }) {
  const v = loan.vehicleDetails;
  if (!v) {
    return (
      <div className="text-xs text-slate-500">
        Vehicle details not on file.
      </div>
    );
  }
  const Icon =
    v.vehicleType === "TWO_WHEELER"
      ? Bike
      : v.vehicleType === "COMMERCIAL"
        ? Truck
        : Car;
  return (
    <div className="flex items-start gap-4">
      <div
        className="flex h-24 w-24 items-center justify-center rounded-lg border bg-white"
        style={{ borderColor: "rgba(74,111,165,0.30)" }}
      >
        <Icon className="h-8 w-8" style={{ color: "var(--brand-primary)" }} />
      </div>
      <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <span className="text-slate-500">Make &amp; Model</span>
        <span className="text-right font-medium text-slate-800">
          {v.makeModel}
        </span>
        <span className="text-slate-500">Registration No.</span>
        <span className="text-right font-mono text-slate-800">
          {v.regNo ?? "—"}
        </span>
        <span className="text-slate-500">Year</span>
        <span className="text-right font-medium text-slate-800">
          {v.year ?? "—"}
        </span>
        <span className="text-slate-500">Type</span>
        <span className="text-right font-medium text-slate-800">
          {v.vehicleType ?? "—"}
        </span>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className={
          emphasis
            ? "text-base font-bold"
            : "text-sm font-medium text-slate-800"
        }
        style={emphasis ? { color: "var(--brand-primary)" } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

export default function DocumentViewer({
  loan,
  customer,
  pledgedItem,
  branch,
  sourceAccountName,
}: Props) {
  const isPawn = loan.product === "PAWN";

  return (
    <Card
      className="print-area print-area--statement border bg-white shadow-sm"
      data-print-area="loan-ticket"
      style={{ borderColor: "rgba(74,111,165,0.12)" }}
    >
      <CardContent className="p-8">
        {/* Branch header */}
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <div
              className="text-lg font-bold tracking-tight"
              style={{ color: "var(--brand-primary)" }}
            >
              {branch.branchName}
            </div>
            <div className="text-xs text-slate-500">{branch.address}</div>
            <div className="text-xs text-slate-500">
              GSTIN: {branch.gstin} · {branch.contact}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {isPawn ? "Pawn Ticket" : "Vehicle Loan Agreement"}
            </div>
            <div
              className="font-mono text-xl font-bold"
              style={{ color: "var(--brand-primary)" }}
            >
              {loan.id}
            </div>
            <div className="text-[11px] text-slate-500">
              Issued {prettyDate(loan.startedAtIso)}
            </div>
          </div>
        </div>

        {/* Customer KYC */}
        <section className="mt-6">
          <div
            className="mb-2 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--brand-primary)" }}
          >
            Borrower / KYC
          </div>
          <div
            className="rounded-lg border p-4"
            style={{
              borderColor: "rgba(74,111,165,0.18)",
              backgroundColor: "var(--bg-main)",
            }}
          >
            <CustomerKycBlock customer={customer} />
          </div>
        </section>

        {/* Financial terms */}
        <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <DetailRow
            label="Principal"
            value={inr(loan.principal)}
            emphasis
          />
          <DetailRow
            label="Interest Rate"
            value={`${loan.ratePctPerAnnum}% p.a.`}
          />
          <DetailRow
            label="Start Date"
            value={prettyDate(loan.startedAtIso)}
          />
          <DetailRow
            label="Maturity Date"
            value={prettyDate(loan.maturityIso)}
          />
          <DetailRow label="Tenure" value={tenureLabel(loan)} />
          <DetailRow
            label="Disbursed From"
            value={sourceAccountName ?? "—"}
          />
          <DetailRow
            label="Status"
            value={loan.status}
          />
          <DetailRow
            label="Customer Code"
            value={loan.customerCode}
          />
        </section>

        {/* Item / vehicle */}
        <section className="mt-6">
          <div
            className="mb-2 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--brand-primary)" }}
          >
            {isPawn ? "Pledged Item" : "Vehicle Details"}
          </div>
          <div
            className="rounded-lg border p-4"
            style={{
              borderColor: "rgba(74,111,165,0.18)",
              backgroundColor: "var(--bg-main)",
            }}
          >
            {isPawn ? (
              <ItemBlock pledgedItem={pledgedItem} />
            ) : (
              <VehicleBlock loan={loan} />
            )}
          </div>
        </section>

        {/* Terms + signatures */}
        <section className="mt-6">
          <div
            className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--brand-primary)" }}
          >
            <FileSignature size={12} />
            Terms &amp; Conditions
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-[11px] leading-relaxed text-slate-600">
            <li>
              Interest accrues monthly at the rate stated above and is payable
              on or before the maturity date.
            </li>
            <li>
              {isPawn
                ? "Failure to settle dues by the maturity date may result in the pledged item being moved to auction after a 30-day grace period."
                : "Failure to pay an EMI by its due date attracts a late-payment charge and, after sustained default, repossession of the hypothecated vehicle."}
            </li>
            <li>
              {isPawn
                ? "Items will be released only on full settlement (principal + accrued interest) and surrender of this ticket."
                : "The vehicle remains hypothecated to the branch until the entire outstanding (principal + interest + charges) is cleared and the No-Objection Certificate is issued."}
            </li>
            <li>
              All disputes are subject to the jurisdiction of the courts at the
              branch location stated in the header.
            </li>
            <li>
              The borrower confirms that the KYC details and asset
              particulars above are true to the best of their knowledge.
            </li>
          </ol>

          <div className="mt-10 grid grid-cols-2 gap-8 text-[11px]">
            <div>
              <div
                className="border-t border-dashed pt-2 text-center text-slate-500"
                style={{ borderColor: "rgba(74,111,165,0.40)" }}
              >
                Customer Signature
              </div>
            </div>
            <div>
              <div
                className="border-t border-dashed pt-2 text-center text-slate-500"
                style={{ borderColor: "rgba(74,111,165,0.40)" }}
              >
                For {branch.branchName}
              </div>
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
