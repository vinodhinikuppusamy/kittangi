import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Copy,
  Lock,
  LockOpen,
  Plus,
  PlusCircle,
  Printer,
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  addDaybookEntry,
  addInternalTransfer,
  DayLockedError,
  useDaybook,
  type DaybookAccount,
  type DaybookCategory,
  type DaybookEntry,
} from "@/lib/stores/daybookStore";
import {
  lockDay,
  unlockDay,
  useDayLocks,
  type DayLock,
} from "@/lib/stores/dayLocksStore";
import { useAccounts, type Account } from "@/lib/stores/accountsStore";
import {
  getCurrentActor,
  logActivity,
} from "@/lib/stores/activityLogStore";
import { useBranchProfile } from "@/lib/stores/branchProfileStore";
import { useIsAdmin } from "@/lib/stores/userRoleStore";

const EXPENSE_CATEGORIES: DaybookCategory[] = [
  "Salary",
  "Branch Expense",
  "Utilities",
  "Other Expense",
];

function timeNow(): string {
  return new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

const OPENING_BALANCE = 218430;

/**
 * Resolve an account id to a short display label (e.g. "Cash", "HDFC").
 * Falls back to the raw id so unknown accounts do not produce blank cells.
 */
function shortAccountLabel(
  accountId: DaybookAccount,
  accounts: Account[],
): string {
  const acc = accounts.find((a) => a.id === accountId);
  if (!acc) return accountId;
  // Strip common bank suffixes for the chip.
  return acc.name.replace(/\s+(Bank|in Hand)$/i, "");
}

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

/**
 * Print Chitta — open a brand-new browser window with a fully self-contained
 * B/W A4 layout and auto-trigger the print dialog. Sections, in order:
 *
 *   1. Header — Branch name + date + "Daily Cash & Bank Summary".
 *   2. Inflows table — every CREDIT entry on the picked date.
 *   3. Outflows table — every DEBIT entry on the picked date.
 *   4. Closing Balance per Account — Opening + Credits − Debits, per account.
 *      Cash uses the seeded `OPENING_BALANCE`; bank/other accounts open at 0
 *      since the demo doesn't track per-bank carry-forward yet (a known
 *      limitation that matches what's shown in the on-screen Daybook).
 *   5. Signature block.
 *
 * The new window has zero React/Vite dependencies so the print preview is
 * deterministic regardless of what's mounted in the host page.
 */
function openChittaPrintWindow(args: {
  date: string;
  branchName: string;
  openingBalance: number;
  inflows: DaybookEntry[];
  outflows: DaybookEntry[];
  accounts: Account[];
}): void {
  const { date, branchName, openingBalance, inflows, outflows, accounts } =
    args;

  const safeText = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const fmtINR = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 0,
    }).format(Math.round(Number.isFinite(n) ? n : 0));

  const prettyDate = (() => {
    const d = new Date(date + "T00:00:00");
    if (Number.isNaN(d.getTime())) return date;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  })();

  const accountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name ?? id;

  const totalIn = inflows.reduce((s, e) => s + e.amount, 0);
  const totalOut = outflows.reduce((s, e) => s + e.amount, 0);
  const netChange = totalIn - totalOut;

  // Per-account closing — opening is only seeded for the CASH account.
  // Bank/other accounts do not yet have per-day carry-forward in this build,
  // so we mark them as "N/A" rather than printing a misleading ₹0 opening
  // and an "as-if-zero-opening" closing balance. The day's net movement
  // (credits − debits) is still reported in those columns.
  const cashAccount = accounts.find((a) => a.type === "CASH");
  const accountRows = accounts.map((acc) => {
    const isCash = acc.id === cashAccount?.id;
    const credits = inflows
      .filter((e) => e.account === acc.id)
      .reduce((s, e) => s + e.amount, 0);
    const debits = outflows
      .filter((e) => e.account === acc.id)
      .reduce((s, e) => s + e.amount, 0);
    return {
      name: acc.name,
      type: acc.type,
      isCash,
      opening: isCash ? openingBalance : null,
      credits,
      debits,
      closing: isCash ? openingBalance + credits - debits : null,
      net: credits - debits,
    };
  });

  const renderRows = (rows: DaybookEntry[]): string => {
    if (rows.length === 0) {
      return `<tr><td colspan="5" class="empty">No entries for this day.</td></tr>`;
    }
    return rows
      .map(
        (e, i) => `
        <tr>
          <td class="num">${i + 1}</td>
          <td>${safeText(e.time)}</td>
          <td>${safeText(e.particulars)}${e.refId ? `<div class="ref">${safeText(e.refId)}</div>` : ""
          }</td>
          <td>${safeText(accountName(e.account))}</td>
          <td class="amt">₹ ${fmtINR(e.amount)}</td>
        </tr>`,
      )
      .join("");
  };

  const accountRowsHtml = accountRows
    .map((r) => {
      const openingCell =
        r.opening === null ? `<span class="na">N/A</span>` : `₹ ${fmtINR(r.opening)}`;
      const closingCell =
        r.closing === null
          ? `<span class="na">N/A · net ${r.net >= 0 ? "+" : "−"} ₹ ${fmtINR(Math.abs(r.net))}</span>`
          : `₹ ${fmtINR(r.closing)}`;
      return `
      <tr>
        <td>${safeText(r.name)} <span class="acc-type">(${safeText(r.type)})</span></td>
        <td class="amt">${openingCell}</td>
        <td class="amt credit">+ ₹ ${fmtINR(r.credits)}</td>
        <td class="amt debit">− ₹ ${fmtINR(r.debits)}</td>
        <td class="amt closing">${closingCell}</td>
      </tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Daily Chitta · ${safeText(prettyDate)} · ${safeText(branchName)}</title>
    <style>
      @page { size: A4 portrait; margin: 12mm; }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        background: #fff;
        color: #000;
        font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        font-size: 11pt;
        line-height: 1.35;
      }
      .sheet { padding: 4mm 0; }
      .banner {
        border-bottom: 2px solid #000;
        padding-bottom: 6mm;
        margin-bottom: 6mm;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
      }
      .banner h1 {
        margin: 0;
        font-size: 16pt;
        font-weight: 800;
        letter-spacing: 0.3px;
      }
      .banner .sub {
        margin-top: 2mm;
        font-size: 11pt;
        font-weight: 600;
      }
      .banner .meta {
        text-align: right;
        font-size: 10pt;
      }
      .banner .meta .label {
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-size: 8pt;
        color: #333;
      }
      h2.section {
        font-size: 12pt;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        margin: 8mm 0 3mm;
        padding-bottom: 1.5mm;
        border-bottom: 1px solid #000;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 2mm;
      }
      th, td {
        border: 1px solid #000;
        padding: 1.5mm 2mm;
        font-size: 10pt;
        vertical-align: top;
        color: #000;
      }
      th {
        background: #eaeaea;
        text-align: left;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        font-size: 9pt;
      }
      td.num { width: 7mm; text-align: center; font-variant-numeric: tabular-nums; }
      td.amt, th.amt { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
      td.empty { text-align: center; font-style: italic; color: #555; padding: 6mm 2mm; }
      .ref { font-size: 8pt; color: #444; margin-top: 0.6mm; }
      tfoot td { background: #f5f5f5; font-weight: 700; }
      .totals-bar {
        margin-top: 4mm;
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 4mm;
      }
      .totals-bar .cell {
        border: 1px solid #000;
        padding: 3mm;
      }
      .totals-bar .cell .label {
        font-size: 8pt;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 700;
      }
      .totals-bar .cell .value {
        margin-top: 1.5mm;
        font-size: 13pt;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
      }
      .closing-tbl td.closing { font-weight: 700; }
      .na { font-style: italic; color: #555; font-weight: 600; font-size: 9pt; }
      .acc-type {
        font-size: 8pt;
        font-weight: 600;
        color: #444;
        text-transform: uppercase;
        margin-left: 1mm;
      }
      .signature {
        margin-top: 14mm;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16mm;
        page-break-inside: avoid;
      }
      .sig-line {
        border-top: 1px solid #000;
        padding-top: 1.5mm;
        text-align: center;
        font-size: 9pt;
        color: #000;
      }
      @media screen {
        body { background: #f1f5f9; padding: 8mm; }
        .sheet { background: #fff; padding: 14mm; max-width: 210mm; margin: 0 auto; box-shadow: 0 6px 18px rgba(0,0,0,0.15); }
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="banner">
        <div>
          <h1>${safeText(branchName)}</h1>
          <div class="sub">Daily Cash &amp; Bank Summary</div>
        </div>
        <div class="meta">
          <div class="label">Chitta Date</div>
          <div>${safeText(prettyDate)}</div>
        </div>
      </div>

      <h2 class="section">Inflows (Credit)</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Time</th>
            <th>Particulars</th>
            <th>Account</th>
            <th class="amt">Amount</th>
          </tr>
        </thead>
        <tbody>${renderRows(inflows)}</tbody>
        <tfoot>
          <tr>
            <td colspan="4">Total Inflows</td>
            <td class="amt">₹ ${fmtINR(totalIn)}</td>
          </tr>
        </tfoot>
      </table>

      <h2 class="section">Outflows (Debit)</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Time</th>
            <th>Particulars</th>
            <th>Account</th>
            <th class="amt">Amount</th>
          </tr>
        </thead>
        <tbody>${renderRows(outflows)}</tbody>
        <tfoot>
          <tr>
            <td colspan="4">Total Outflows</td>
            <td class="amt">₹ ${fmtINR(totalOut)}</td>
          </tr>
        </tfoot>
      </table>

      <div class="totals-bar">
        <div class="cell">
          <div class="label">Total Inflows</div>
          <div class="value">₹ ${fmtINR(totalIn)}</div>
        </div>
        <div class="cell">
          <div class="label">Total Outflows</div>
          <div class="value">₹ ${fmtINR(totalOut)}</div>
        </div>
        <div class="cell">
          <div class="label">Net Change</div>
          <div class="value">${netChange >= 0 ? "+" : "−"} ₹ ${fmtINR(Math.abs(netChange))}</div>
        </div>
      </div>

      <h2 class="section">Closing Balance — Per Account</h2>
      <table class="closing-tbl">
        <thead>
          <tr>
            <th>Account</th>
            <th class="amt">Opening</th>
            <th class="amt">Credits</th>
            <th class="amt">Debits</th>
            <th class="amt">Closing</th>
          </tr>
        </thead>
        <tbody>${accountRowsHtml || `<tr><td colspan="5" class="empty">No accounts configured.</td></tr>`}</tbody>
      </table>

      <div class="signature">
        <div class="sig-line">Cashier Signature</div>
        <div class="sig-line">Branch Manager Signature</div>
      </div>
    </div>
    <script>
      window.addEventListener('load', function () {
        setTimeout(function () { window.focus(); window.print(); }, 80);
      });
    </script>
  </body>
</html>`;

  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) {
    // Fall back silently — dev console will surface the popup-block warning.
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

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

function accountChip(account: DaybookAccount, accounts: Account[]) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border bg-white px-2 py-0.5 text-[11px] font-medium"
      style={{
        borderColor: "rgba(74,111,165,0.18)",
        color: "#000000",
      }}
    >
      <Wallet size={11} />
      {shortAccountLabel(account, accounts)}
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
              className={`mt-2 tracking-tight text-slate-900 ${emphasis ? "text-3xl font-extrabold" : "text-2xl font-bold"
                }`}
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
  const dayLocks = useDayLocks();
  const accounts = useAccounts();
  const branch = useBranchProfile();

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
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [unlockConfirmOpen, setUnlockConfirmOpen] = useState(false);
  const [pendingLock, setPendingLock] = useState<DayLock | null>(null);
  const isAdmin = useIsAdmin();

  // ===== Manual Expense Entry =====
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState<DaybookCategory>(
    "Branch Expense",
  );
  const [expenseAccount, setExpenseAccount] = useState<string>("");
  const [expenseAmount, setExpenseAmount] = useState<string>("");
  const [expenseParticulars, setExpenseParticulars] = useState<string>("");
  const [expenseNotes, setExpenseNotes] = useState<string>("");
  const expenseAmountNum = Number(
    (expenseAmount || "").toString().replace(/[^0-9.]/g, ""),
  );

  // ===== Internal Transfer (contra) =====
  const [transferOpen, setTransferOpen] = useState(false);
  const [xfrFrom, setXfrFrom] = useState<string>("");
  const [xfrTo, setXfrTo] = useState<string>("");
  const [xfrAmount, setXfrAmount] = useState<string>("");
  const [xfrParticulars, setXfrParticulars] = useState<string>("");
  const [xfrNotes, setXfrNotes] = useState<string>("");
  const xfrAmountNum = Number(
    (xfrAmount || "").toString().replace(/[^0-9.]/g, ""),
  );
  const resetTransferForm = () => {
    setXfrFrom("");
    setXfrTo("");
    setXfrAmount("");
    setXfrParticulars("");
    setXfrNotes("");
  };
  const handlePostTransfer = () => {
    if (!xfrFrom || !xfrTo) {
      toast.error("Pick both a source and a destination account.");
      return;
    }
    if (xfrFrom === xfrTo) {
      toast.error("Source and destination must be different accounts.");
      return;
    }
    if (!Number.isFinite(xfrAmountNum) || xfrAmountNum <= 0) {
      toast.error("Transfer amount must be greater than zero.");
      return;
    }
    if (!xfrParticulars.trim()) {
      toast.error("Please describe the transfer.");
      return;
    }
    try {
      addInternalTransfer({
        dateIso: date,
        fromAccount: xfrFrom,
        toAccount: xfrTo,
        amount: xfrAmountNum,
        particulars: xfrParticulars.trim(),
        notes: xfrNotes.trim() || undefined,
      });
      const fromName =
        accounts.find((a) => a.id === xfrFrom)?.name ?? xfrFrom;
      const toName = accounts.find((a) => a.id === xfrTo)?.name ?? xfrTo;
      try {
        logActivity({
          actor: getCurrentActor(),
          kind: "DAYBOOK",
          summary: `Internal Transfer ${inr(xfrAmountNum)} · ${fromName} → ${toName}`,
        });
      } catch {
        /* best effort */
      }
      toast.success("Internal transfer posted", {
        icon: <ArrowLeftRight size={16} />,
        description: `${inr(xfrAmountNum)} · ${fromName} → ${toName}`,
      });
      resetTransferForm();
      setTransferOpen(false);
    } catch (err) {
      if (err instanceof DayLockedError) {
        toast.error(
          `${prettyDate(date)} is locked — unlock the day before posting transfers.`,
        );
        return;
      }
      const msg = err instanceof Error ? err.message : "Transfer failed.";
      toast.error(msg);
    }
  };

  // ===== Add Other Income =====
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [incomeAccount, setIncomeAccount] = useState<string>("");
  const [incomeAmount, setIncomeAmount] = useState<string>("");
  const [incomeParticulars, setIncomeParticulars] = useState<string>("");
  const [incomeNotes, setIncomeNotes] = useState<string>("");
  const incomeAmountNum = Number(
    (incomeAmount || "").toString().replace(/[^0-9.]/g, ""),
  );
  const resetIncomeForm = () => {
    setIncomeAccount("");
    setIncomeAmount("");
    setIncomeParticulars("");
    setIncomeNotes("");
  };
  const handlePostIncome = () => {
    if (!incomeAccount) {
      toast.error("Please choose the destination account.");
      return;
    }
    if (!Number.isFinite(incomeAmountNum) || incomeAmountNum <= 0) {
      toast.error("Amount must be greater than zero.");
      return;
    }
    if (!incomeParticulars.trim()) {
      toast.error("Please describe the income (e.g. scrap sale, doc fee).");
      return;
    }
    try {
      const refSeq = Math.floor(10000 + Math.random() * 89999);
      addDaybookEntry({
        dateIso: date,
        time: timeNow(),
        side: "CREDIT",
        category: "Other Income",
        particulars: incomeParticulars.trim(),
        refId: `OIN-${refSeq}`,
        account: incomeAccount,
        amount: incomeAmountNum,
        notes: incomeNotes.trim() || undefined,
      });
      try {
        logActivity({
          actor: getCurrentActor(),
          kind: "DAYBOOK",
          summary: `Other Income ${inr(incomeAmountNum)} — ${incomeParticulars.trim()}`,
        });
      } catch {
        /* best effort */
      }
      toast.success("Other income recorded", {
        icon: <CheckCircle2 size={16} />,
        description: `${inr(incomeAmountNum)} into ${accounts.find((a) => a.id === incomeAccount)?.name ?? incomeAccount
          }`,
      });
      resetIncomeForm();
      setIncomeOpen(false);
    } catch (err) {
      if (err instanceof DayLockedError) {
        toast.error(
          `${prettyDate(date)} is locked — unlock the day before posting income.`,
        );
        return;
      }
      // Surface unexpected errors as a toast instead of crashing the dialog
      // tree. The expense / transfer handlers follow the same convention.
      const message =
        err instanceof Error ? err.message : "Could not record income.";
      toast.error(message);
    }
  };

  const resetExpenseForm = () => {
    setExpenseCategory("Branch Expense");
    setExpenseAccount("");
    setExpenseAmount("");
    setExpenseParticulars("");
    setExpenseNotes("");
  };

  const handlePostExpense = () => {
    if (!expenseAccount) {
      toast.error("Please choose the source account.");
      return;
    }
    if (!Number.isFinite(expenseAmountNum) || expenseAmountNum <= 0) {
      toast.error("Amount must be greater than zero.");
      return;
    }
    if (!expenseParticulars.trim()) {
      toast.error("Please describe what this expense is for.");
      return;
    }
    try {
      const refSeq = Math.floor(10000 + Math.random() * 89999);
      addDaybookEntry({
        dateIso: date,
        time: timeNow(),
        side: "DEBIT",
        category: expenseCategory,
        particulars: expenseParticulars.trim(),
        refId: `EXP-${refSeq}`,
        account: expenseAccount,
        amount: expenseAmountNum,
        notes: expenseNotes.trim() || undefined,
      });
      try {
        logActivity({
          actor: getCurrentActor(),
          kind: "DAYBOOK",
          summary: `Expense ₹${expenseAmountNum.toLocaleString("en-IN")} — ${expenseCategory} (${accounts.find((a) => a.id === expenseAccount)?.name ?? expenseAccount
            })`,
        });
      } catch {
        /* best effort */
      }
      toast.success("Expense recorded", {
        icon: <CheckCircle2 size={16} />,
        description: `${expenseCategory} · ${inr(expenseAmountNum)} from ${accounts.find((a) => a.id === expenseAccount)?.name ?? expenseAccount
          }`,
      });
      resetExpenseForm();
      setExpenseDialogOpen(false);
    } catch (err) {
      if (err instanceof DayLockedError) {
        toast.error(
          `${prettyDate(date)} is locked — unlock the day before posting expenses.`,
        );
        return;
      }
      throw err;
    }
  };

  // STRICT date filter — the table only ever shows transactions whose
  // dateIso exactly matches the picker. Switching to yesterday in the
  // date picker drops today's entries entirely from view.
  const dayEntries = useMemo<DaybookEntry[]>(
    () => allEntries.filter((e) => e.dateIso === date),
    [allEntries, date],
  );

  const existingLock = useMemo(
    () => dayLocks.find((l) => l.dateIso === date),
    [dayLocks, date],
  );
  const isLocked = !!existingLock;
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
            style={{
              backgroundColor: "rgba(59,130,246,0.14)",
              boxShadow: "inset 0 0 0 1px rgba(59,130,246,0.30)",
            }}
          >
            <BookOpen size={22} style={{ color: "#1d4ed8" }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold text-slate-900"
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
            <Calendar size={14} style={{ color: "var(--text-main)" }} />
            <Input
              type="date"
              value={date}
              max={todayIso()}
              onChange={(e) => setDate(e.target.value)}
              className="h-7 w-40 border-0 p-0 text-sm focus-visible:ring-0"
              style={{ color: "var(--text-main)" }}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-9 px-3 text-xs"
            style={{
              borderColor: "rgba(74,111,165,0.25)",
              color: "#000000",
            }}
            onClick={() => {
              // Open a brand-new window with a self-contained, B/W A4-friendly
              // chitta. This bypasses the in-page print stylesheet (which can
              // be polluted by other components on the screen) and gives the
              // operator a deterministic preview-then-print flow.
              openChittaPrintWindow({
                date,
                branchName: branch.branchName,
                openingBalance: OPENING_BALANCE,
                inflows,
                outflows,
                accounts,
              });
            }}
          >
            <Printer size={14} className="mr-1.5" />
            Print Chitta
          </Button>
          {!isLocked && isAdmin && (
            <>
              <Button
                type="button"
                variant="outline"
                className="h-9 px-3 text-xs"
                style={{
                  borderColor: "rgba(74,111,165,0.25)",
                  color: "#000000",
                }}
                onClick={() => {
                  resetTransferForm();
                  setTransferOpen(true);
                }}
                data-testid="button-internal-transfer"
              >
                <ArrowLeftRight size={14} className="mr-1.5" />
                Internal Transfer
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 px-3 text-xs"
                style={{
                  borderColor: "rgba(74,111,165,0.25)",
                  color: "#000000",
                }}
                onClick={() => {
                  resetIncomeForm();
                  setIncomeOpen(true);
                }}
                data-testid="button-add-other-income"
              >
                <PlusCircle size={14} className="mr-1.5" />
                Add Other Income
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 px-3 text-xs"
                style={{
                  borderColor: "rgba(74,111,165,0.25)",
                  color: "#000000",
                }}
                onClick={() => {
                  resetExpenseForm();
                  setExpenseDialogOpen(true);
                }}
              >
                <Plus size={14} className="mr-1.5" />
                Add Expense
              </Button>
            </>
          )}
          {isLocked ? (
            <Button
              type="button"
              variant="outline"
              className="h-9 px-3 text-xs"
              style={{
                borderColor: "rgba(220,38,38,0.30)",
                color: "rgb(185,28,28)",
              }}
              onClick={() => setUnlockConfirmOpen(true)}
            >
              <LockOpen size={14} className="mr-1.5" />
              Unlock Day
            </Button>
          ) : (
            <Button
              type="button"
              className="h-9 px-3 text-xs font-semibold text-white"
              style={{ backgroundColor: "var(--brand-primary)" }}
              onClick={() => {
                if (dayEntries.length === 0) {
                  toast.error("Nothing to lock", {
                    description:
                      "There are no entries recorded for this date.",
                  });
                  return;
                }
                const lock: DayLock = {
                  dateIso: date,
                  lockedAtIso: new Date().toISOString(),
                  totalCashIn: totalInflows,
                  totalCashOut: totalOutflows,
                  netChange: totalInflows - totalOutflows,
                  entryCount: dayEntries.length,
                };
                setPendingLock(lock);
                setLockDialogOpen(true);
              }}
            >
              <Lock size={14} className="mr-1.5" />
              Lock Day &amp; Generate Report
            </Button>
          )}
        </div>
      </div>

      {/* Locked banner — surfaces the frozen totals so anyone re-opening
       * this date instantly sees the closure summary without re-running it. */}
      {isLocked && existingLock && (
        <div
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 px-4 py-3"
          style={{
            borderColor: "rgba(74,111,165,0.30)",
            backgroundColor: "rgba(191,221,245,0.30)",
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              <Lock size={16} className="text-white" />
            </div>
            <div>
              <div
                className="text-sm font-semibold"
                style={{ color: "var(--text-main)" }}
              >
                Day Closed · {prettyDate(date)}
              </div>
              <div className="text-[11px] text-slate-600">
                Locked on{" "}
                {new Date(existingLock.lockedAtIso).toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                · {existingLock.entryCount} entries frozen.
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="text-slate-600">
              Cash In{" "}
              <span className="font-semibold text-emerald-700">
                {inr(existingLock.totalCashIn)}
              </span>
            </span>
            <span className="text-slate-600">
              Cash Out{" "}
              <span className="font-semibold text-slate-900">
                {inr(existingLock.totalCashOut)}
              </span>
            </span>
            <span
              className="rounded-md px-2 py-0.5 font-semibold"
              style={{
                backgroundColor:
                  existingLock.netChange >= 0
                    ? "rgba(34,197,94,0.14)"
                    : "rgba(220,38,38,0.10)",
                color:
                  existingLock.netChange >= 0
                    ? "rgb(21,128,61)"
                    : "rgb(185,28,28)",
              }}
            >
              Net {existingLock.netChange >= 0 ? "+" : "−"}
              {inr(Math.abs(existingLock.netChange))}
            </span>
          </div>
        </div>
      )}

      {/* Printable Chitta region — everything inside this wrapper is what
          the @media print CSS in index.css promotes to a clean A4 sheet
          when the user clicks "Print Chitta". The screen-only `display:
          contents` on the wrapper means it has no visual side-effect on
          the live page. */}
      <div className="print-area print-area--chitta contents print:block">
        {/* Print-only banner — hidden on screen, shown on paper. */}
        <div className="chitta-print-banner hidden print:block">
          <div className="text-lg font-bold text-slate-900">
            Kittangi OS — Daybook (Chitta)
          </div>
          <div className="text-xs text-slate-700">
            For the day:{" "}
            <span className="font-semibold">{prettyDate(date)}</span>
          </div>
          <div className="mt-1 text-xs text-slate-700">
            Opening Balance:{" "}
            <span className="font-semibold">{inr(OPENING_BALANCE)}</span>
            {"  ·  "}Closing Balance:{" "}
            <span className="font-semibold">{inr(closing)}</span>
            {"  ·  "}Net{" "}
            <span className="font-semibold">
              {(closing - OPENING_BALANCE) >= 0 ? "+" : "−"}
              {inr(Math.abs(closing - OPENING_BALANCE))}
            </span>
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
            iconColor="var(--text-main)"
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
            iconColor="var(--text-main)"
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
              <Scale size={14} style={{ color: "var(--text-main)" }} />
              <span className="font-semibold text-slate-700">Reconciliation</span>
            </div>
            <span className="text-slate-400">|</span>
            <span className="text-slate-600">
              Opening{" "}
              <span className="font-semibold text-slate-800">
                {inr(OPENING_BALANCE)}
              </span>
            </span>
            <span className="text-slate-400">+</span>
            <span className="text-emerald-700">
              Credits{" "}
              <span className="font-semibold">{inr(totalInflows)}</span>
            </span>
            <span className="text-slate-400">−</span>
            <span className="text-slate-900">
              Debits <span className="font-semibold">{inr(totalOutflows)}</span>
            </span>
            <span className="text-slate-400">=</span>
            <span className="text-slate-800">
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
                      style={{ color: "var(--text-main)" }}
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
                          <TableCell>{accountChip(row.account, accounts)}</TableCell>
                          <TableCell className="text-right text-sm font-semibold text-emerald-700">
                            + {inr(row.amount)}
                            {isAdmin &&
                              (row.legalInterestPortion ?? 0) +
                              (row.companyInterestPortion ?? 0) >
                              0 && (
                                <div
                                  className="mt-0.5 text-[10px] font-medium text-slate-500"
                                  data-testid={`split-credit-${row.id}`}
                                >
                                  Legal {inr(row.legalInterestPortion ?? 0)} ·
                                  Co. {inr(row.companyInterestPortion ?? 0)}
                                </div>
                              )}
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
                      style={{ color: "var(--text-main)" }}
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
                          <TableCell>{accountChip(row.account, accounts)}</TableCell>
                          <TableCell className="text-right text-sm font-semibold text-slate-900">
                            − {inr(row.amount)}
                            {isAdmin &&
                              (row.legalInterestPortion ?? 0) +
                              (row.companyInterestPortion ?? 0) >
                              0 && (
                                <div
                                  className="mt-0.5 text-[10px] font-medium text-slate-500"
                                  data-testid={`split-debit-${row.id}`}
                                >
                                  Legal {inr(row.legalInterestPortion ?? 0)} ·
                                  Co. {inr(row.companyInterestPortion ?? 0)}
                                </div>
                              )}
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
                      <TableCell className="text-right text-sm font-bold text-slate-900">
                        {inr(totalOutflows)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Print-only signature block — appears at the bottom of the
            paper Chitta only. */}
        <div className="chitta-print-signature hidden print:grid">
          <div className="sig-line">
            Branch Manager — Signature &amp; Date
          </div>
          <div className="sig-line">
            Authorised Reviewer — Signature &amp; Date
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] text-slate-500 no-print">
        Live Chitta · powered by the shared Daybook ledger (Receipts, Loan
        Disbursements, Investor Payouts and more).
      </p>

      {/* Lock Day report dialog */}
      <Dialog
        open={lockDialogOpen}
        onOpenChange={(o) => {
          setLockDialogOpen(o);
          if (!o) setPendingLock(null);
        }}
      >
        <DialogContent
          className="max-w-md"
          style={{ backgroundColor: "var(--bg-main)" }}
        >
          <DialogHeader>
            <DialogTitle
              className="flex items-center gap-2 text-base font-semibold"
              style={{ color: "var(--text-main)" }}
            >
              <Lock size={16} />
              Confirm Day Closure
            </DialogTitle>
            <DialogDescription className="text-xs">
              Once locked, the totals below are frozen and persisted as the
              audit-trail snapshot for {prettyDate(date)}. You can unlock
              later if a correction is required.
            </DialogDescription>
          </DialogHeader>

          {pendingLock && (
            <div
              className="rounded-lg border bg-white p-4 font-mono text-xs leading-relaxed"
              style={{ borderColor: "rgba(74,111,165,0.18)" }}
            >
              <div className="mb-2 font-sans text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Closure Report
              </div>
              <div>
                <span className="text-slate-500">Day Closed:</span>{" "}
                <span style={{ color: "var(--text-main)" }}>
                  {prettyDate(pendingLock.dateIso)}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Total Cash In:</span>{" "}
                <span className="font-semibold text-emerald-700">
                  {inr(pendingLock.totalCashIn)}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Total Cash Out:</span>{" "}
                <span className="font-semibold text-slate-900">
                  {inr(pendingLock.totalCashOut)}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Net Change:</span>{" "}
                <span
                  className="font-bold"
                  style={{
                    color:
                      pendingLock.netChange >= 0
                        ? "rgb(21,128,61)"
                        : "rgb(185,28,28)",
                  }}
                >
                  {pendingLock.netChange >= 0 ? "+" : "−"}
                  {inr(Math.abs(pendingLock.netChange))}
                </span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                {pendingLock.entryCount} entries included.
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                if (!pendingLock) return;
                const text = `Day Closed: ${prettyDate(
                  pendingLock.dateIso,
                )}. Total Cash In: ${inr(
                  pendingLock.totalCashIn,
                )}, Total Cash Out: ${inr(
                  pendingLock.totalCashOut,
                )}, Net Change: ${pendingLock.netChange >= 0 ? "+" : "−"
                  }${inr(Math.abs(pendingLock.netChange))}.`;
                navigator.clipboard
                  ?.writeText(text)
                  .then(() => toast.success("Report copied to clipboard"))
                  .catch(() => toast.error("Copy failed"));
              }}
            >
              <Copy size={13} className="mr-1.5" />
              Copy Report
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setLockDialogOpen(false);
                  setPendingLock(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="text-xs font-semibold text-white"
                style={{ backgroundColor: "var(--brand-primary)" }}
                onClick={() => {
                  if (!pendingLock) return;
                  lockDay(pendingLock);
                  toast.success("Day locked", {
                    description: `Net change ${pendingLock.netChange >= 0 ? "+" : "−"
                      }${inr(Math.abs(pendingLock.netChange))} frozen.`,
                    icon: <CheckCircle2 size={16} />,
                  });
                  setLockDialogOpen(false);
                  setPendingLock(null);
                }}
              >
                <Lock size={13} className="mr-1.5" />
                Confirm &amp; Lock
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Internal Transfer — contra entry between two accounts */}
      <Dialog
        open={transferOpen}
        onOpenChange={(o) => {
          if (!o) resetTransferForm();
          setTransferOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-130">
          <DialogHeader>
            <DialogTitle>Internal Transfer (Contra)</DialogTitle>
            <DialogDescription>
              Moves funds between two of your accounts. Posts a Debit on the
              source and a Credit on the destination — never counted as Income
              or Expense in the P&amp;L.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  From Account
                </Label>
                <Select value={xfrFrom} onValueChange={setXfrFrom}>
                  <SelectTrigger
                    className="h-10 w-full bg-white"
                    aria-label="From Account"
                    data-testid="select-xfr-from"
                  >
                    <SelectValue placeholder="Select source..." />
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
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  To Account
                </Label>
                <Select value={xfrTo} onValueChange={setXfrTo}>
                  <SelectTrigger
                    className="h-10 w-full bg-white"
                    aria-label="To Account"
                    data-testid="select-xfr-to"
                  >
                    <SelectValue placeholder="Select destination..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter((a) => a.id !== xfrFrom)
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {a.name}
                            </span>
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

            <div className="space-y-1.5">
              <Label
                htmlFor="xfrAmount"
                className="text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Amount (₹)
              </Label>
              <Input
                id="xfrAmount"
                type="number"
                inputMode="numeric"
                placeholder="e.g., 50,000"
                value={xfrAmount}
                onChange={(e) => setXfrAmount(e.target.value)}
                className="h-10"
                data-testid="input-xfr-amount"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="xfrParticulars"
                className="text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Particulars
              </Label>
              <Input
                id="xfrParticulars"
                placeholder="e.g., Cash deposit to HDFC current A/c"
                value={xfrParticulars}
                onChange={(e) => setXfrParticulars(e.target.value)}
                className="h-10"
                data-testid="input-xfr-particulars"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="xfrNotes"
                className="text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Notes (optional)
              </Label>
              <Textarea
                id="xfrNotes"
                placeholder="Cheque no., reference, etc."
                value={xfrNotes}
                onChange={(e) => setXfrNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetTransferForm();
                setTransferOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="font-semibold text-white"
              style={{ backgroundColor: "var(--brand-primary)" }}
              onClick={handlePostTransfer}
              data-testid="button-post-transfer"
            >
              Post Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Other Income — manual inflow (scrap, doc fee, etc.) */}
      <Dialog
        open={incomeOpen}
        onOpenChange={(o) => {
          if (!o) resetIncomeForm();
          setIncomeOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-130">
          <DialogHeader>
            <DialogTitle>Add Other Income</DialogTitle>
            <DialogDescription>
              Records a CREDIT against the chosen account under the “Other
              Income” head. Use this for scrap sales, document fees, or any
              non-loan revenue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Destination Account
              </Label>
              <Select value={incomeAccount} onValueChange={setIncomeAccount}>
                <SelectTrigger
                  className="h-10 w-full bg-white"
                  aria-label="Destination Account"
                  data-testid="select-income-account"
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

            <div className="space-y-1.5">
              <Label
                htmlFor="incomeAmount"
                className="text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Amount (₹)
              </Label>
              <Input
                id="incomeAmount"
                type="number"
                inputMode="numeric"
                placeholder="e.g., 4,500"
                value={incomeAmount}
                onChange={(e) => setIncomeAmount(e.target.value)}
                className="h-10"
                data-testid="input-income-amount"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="incomeParticulars"
                className="text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Particulars
              </Label>
              <Input
                id="incomeParticulars"
                placeholder="e.g., Scrap silver sale, Doc fee — PWN-204410"
                value={incomeParticulars}
                onChange={(e) => setIncomeParticulars(e.target.value)}
                className="h-10"
                data-testid="input-income-particulars"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="incomeNotes"
                className="text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Notes (optional)
              </Label>
              <Textarea
                id="incomeNotes"
                placeholder="Buyer name, invoice number, etc."
                value={incomeNotes}
                onChange={(e) => setIncomeNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetIncomeForm();
                setIncomeOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="font-semibold text-white"
              style={{ backgroundColor: "var(--brand-primary)" }}
              onClick={handlePostIncome}
              data-testid="button-post-income"
            >
              Post Income
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Expense — manual outflow into the Daybook */}
      <Dialog
        open={expenseDialogOpen}
        onOpenChange={(o) => {
          if (!o) resetExpenseForm();
          setExpenseDialogOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-130">
          <DialogHeader>
            <DialogTitle>Add Expense Entry</DialogTitle>
            <DialogDescription>
              Records a DEBIT against the chosen account. The day must be
              unlocked.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Category
                </Label>
                <Select
                  value={expenseCategory}
                  onValueChange={(v) =>
                    setExpenseCategory(v as DaybookCategory)
                  }
                >
                  <SelectTrigger className="h-10 w-full bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Source Account
                </Label>
                <Select
                  value={expenseAccount}
                  onValueChange={setExpenseAccount}
                >
                  <SelectTrigger
                    className="h-10 w-full bg-white"
                    aria-label="Source Account"
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

            <div className="space-y-1.5">
              <Label
                htmlFor="expenseAmount"
                className="text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Amount (₹)
              </Label>
              <Input
                id="expenseAmount"
                type="number"
                inputMode="numeric"
                placeholder="e.g., 12,500"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="expenseParticulars"
                className="text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Particulars
              </Label>
              <Input
                id="expenseParticulars"
                placeholder="e.g., April electricity bill"
                value={expenseParticulars}
                onChange={(e) => setExpenseParticulars(e.target.value)}
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="expenseNotes"
                className="text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Notes (optional)
              </Label>
              <Textarea
                id="expenseNotes"
                placeholder="Vendor, invoice number, etc."
                value={expenseNotes}
                onChange={(e) => setExpenseNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetExpenseForm();
                setExpenseDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="font-semibold text-white"
              style={{ backgroundColor: "var(--brand-primary)" }}
              onClick={handlePostExpense}
            >
              Post Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlock confirmation */}
      <AlertDialog
        open={unlockConfirmOpen}
        onOpenChange={setUnlockConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlock this day's Chitta?</AlertDialogTitle>
            <AlertDialogDescription>
              The frozen closure snapshot for {prettyDate(date)} will be
              removed. Future entries can then be added to this date again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                unlockDay(date);
                toast.success("Day unlocked");
              }}
            >
              Unlock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
