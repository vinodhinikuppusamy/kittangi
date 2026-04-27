import { useMemo, useState } from "react";
import {
  Camera,
  Diamond,
  Filter,
  Gem,
  PackageSearch,
  Search,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

type Category = "GOLD" | "SILVER" | "DIAMOND";
type Status = "VAULTED" | "RELEASED" | "AUCTION";

type PledgedItem = {
  id: string;
  title: string;
  category: Category;
  grossWeightG: number;
  netWeightG: number;
  pledgedValue: number;
  loanId: string;
  customer: string;
  status: Status;
  vaultLoc?: string;
};

const ITEMS: PledgedItem[] = [
  {
    id: "PKG-45",
    title: "22K Gold Chain",
    category: "GOLD",
    grossWeightG: 45,
    netWeightG: 42,
    pledgedValue: 210000,
    loanId: "PWN-204512",
    customer: "Anand",
    status: "VAULTED",
    vaultLoc: "Safe-A · L-101",
  },
  {
    id: "PKG-46",
    title: "Gold Bangles (Set of 4)",
    category: "GOLD",
    grossWeightG: 88,
    netWeightG: 85,
    pledgedValue: 425000,
    loanId: "PWN-204519",
    customer: "Meera Iyer",
    status: "VAULTED",
    vaultLoc: "Safe-A · L-104",
  },
  {
    id: "PKG-47",
    title: "Diamond Solitaire Ring",
    category: "DIAMOND",
    grossWeightG: 6,
    netWeightG: 5,
    pledgedValue: 185000,
    loanId: "PWN-204527",
    customer: "Kunal Mehta",
    status: "VAULTED",
    vaultLoc: "Safe-B · L-203",
  },
  {
    id: "PKG-48",
    title: "Silver Pooja Set",
    category: "SILVER",
    grossWeightG: 720,
    netWeightG: 710,
    pledgedValue: 62000,
    loanId: "PWN-204533",
    customer: "Suresh Patel",
    status: "VAULTED",
    vaultLoc: "Safe-B · L-208",
  },
  {
    id: "PKG-49",
    title: "22K Gold Earrings (Pair)",
    category: "GOLD",
    grossWeightG: 14,
    netWeightG: 13,
    pledgedValue: 64000,
    loanId: "PWN-204540",
    customer: "Priya Menon",
    status: "VAULTED",
    vaultLoc: "Safe-A · L-112",
  },
  {
    id: "PKG-50",
    title: "Gold Mangalsutra",
    category: "GOLD",
    grossWeightG: 22,
    netWeightG: 20,
    pledgedValue: 98000,
    loanId: "PWN-204555",
    customer: "Ravi Krishnan",
    status: "RELEASED",
  },
  {
    id: "PKG-51",
    title: "18K Diamond Pendant",
    category: "DIAMOND",
    grossWeightG: 8,
    netWeightG: 7,
    pledgedValue: 142000,
    loanId: "PWN-204561",
    customer: "Divya Nair",
    status: "VAULTED",
    vaultLoc: "Safe-B · L-211",
  },
  {
    id: "PKG-52",
    title: "Gold Coin (50g · 24K)",
    category: "GOLD",
    grossWeightG: 50,
    netWeightG: 50,
    pledgedValue: 305000,
    loanId: "PWN-204402",
    customer: "Aanya Sharma",
    status: "AUCTION",
  },
  {
    id: "PKG-53",
    title: "Silver Anklets (Pair)",
    category: "SILVER",
    grossWeightG: 280,
    netWeightG: 275,
    pledgedValue: 24500,
    loanId: "PWN-204415",
    customer: "Rohan Verma",
    status: "RELEASED",
  },
  {
    id: "PKG-54",
    title: "22K Gold Ring (Mens)",
    category: "GOLD",
    grossWeightG: 11,
    netWeightG: 10,
    pledgedValue: 51000,
    loanId: "PWN-204421",
    customer: "Karthik R",
    status: "VAULTED",
    vaultLoc: "Safe-A · L-118",
  },
  {
    id: "PKG-55",
    title: "Diamond Stud Earrings",
    category: "DIAMOND",
    grossWeightG: 4,
    netWeightG: 3,
    pledgedValue: 96000,
    loanId: "PWN-204428",
    customer: "Sneha B",
    status: "AUCTION",
  },
  {
    id: "PKG-56",
    title: "Gold Necklace (Antique)",
    category: "GOLD",
    grossWeightG: 62,
    netWeightG: 58,
    pledgedValue: 295000,
    loanId: "PWN-204430",
    customer: "Lakshmi V",
    status: "VAULTED",
    vaultLoc: "Safe-A · L-121",
  },
];

const CATEGORY_LABEL: Record<Category, string> = {
  GOLD: "Gold",
  SILVER: "Silver",
  DIAMOND: "Diamond",
};

const STATUS_META: Record<
  Status,
  { label: string; bg: string; fg: string; border: string }
> = {
  VAULTED: {
    label: "Vaulted",
    bg: "rgba(16,185,129,0.12)",
    fg: "#047857",
    border: "rgba(16,185,129,0.35)",
  },
  RELEASED: {
    label: "Released",
    bg: "rgba(100,116,139,0.12)",
    fg: "#475569",
    border: "rgba(100,116,139,0.30)",
  },
  AUCTION: {
    label: "Defaulted / Auction",
    bg: "rgba(244,63,94,0.12)",
    fg: "#be123c",
    border: "rgba(244,63,94,0.35)",
  },
};

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

const inputBaseStyle: React.CSSProperties = {
  borderColor: "rgba(74,111,165,0.20)",
  "--tw-ring-color": "var(--brand-light)",
} as React.CSSProperties;

export default function PledgedItems() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "ALL">("ALL");
  const [status, setStatus] = useState<Status | "ALL">("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ITEMS.filter((it) => {
      if (category !== "ALL" && it.category !== category) return false;
      if (status !== "ALL" && it.status !== status) return false;
      if (!q) return true;
      return (
        it.title.toLowerCase().includes(q) ||
        it.loanId.toLowerCase().includes(q) ||
        it.customer.toLowerCase().includes(q) ||
        it.id.toLowerCase().includes(q)
      );
    });
  }, [query, category, status]);

  const totals = useMemo(() => {
    const vaulted = filtered.filter((i) => i.status === "VAULTED");
    const value = vaulted.reduce((s, i) => s + i.pledgedValue, 0);
    return { count: filtered.length, vaultedCount: vaulted.length, value };
  }, [filtered]);

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ background: "var(--brand-light)" }}
          >
            <Gem className="h-6 w-6" style={{ color: "var(--brand-primary)" }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: "var(--brand-primary)" }}
            >
              Pledged Inventory
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Visual catalogue of every physical asset held by this branch.
            </p>
          </div>
        </div>

        <div
          className="flex items-center gap-4 rounded-xl border bg-white px-4 py-2.5 text-sm"
          style={{ borderColor: "rgba(74,111,165,0.18)" }}
        >
          <div className="flex items-center gap-2">
            <PackageSearch
              className="h-4 w-4"
              style={{ color: "var(--brand-primary)" }}
            />
            <span className="text-slate-500">Showing</span>
            <span className="font-semibold text-slate-900">{totals.count}</span>
            <span className="text-slate-500">items</span>
          </div>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Vaulted value</span>
            <span
              className="font-semibold"
              style={{ color: "var(--brand-primary)" }}
            >
              {inr(totals.value)}
            </span>
          </div>
        </div>
      </div>

      {/* Controls row */}
      <Card
        className="mb-6 border bg-white"
        style={{ borderColor: "rgba(74,111,165,0.12)" }}
      >
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="relative md:col-span-6">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by item, loan ID, or customer..."
                className="h-11 pl-9"
                style={inputBaseStyle}
              />
            </div>

            <div className="md:col-span-3">
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as Category | "ALL")}
              >
                <SelectTrigger
                  className="h-11 w-full"
                  style={inputBaseStyle}
                  aria-label="Category"
                >
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-400" />
                    <SelectValue placeholder="Category" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Categories</SelectItem>
                  <SelectItem value="GOLD">Gold</SelectItem>
                  <SelectItem value="SILVER">Silver</SelectItem>
                  <SelectItem value="DIAMOND">Diamond</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-3">
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as Status | "ALL")}
              >
                <SelectTrigger
                  className="h-11 w-full"
                  style={inputBaseStyle}
                  aria-label="Status"
                >
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-400" />
                    <SelectValue placeholder="Status" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="VAULTED">Vaulted</SelectItem>
                  <SelectItem value="RELEASED">Released</SelectItem>
                  <SelectItem value="AUCTION">Defaulted / Auction</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gallery grid */}
      {filtered.length === 0 ? (
        <Card
          className="border bg-white"
          style={{ borderColor: "rgba(74,111,165,0.12)" }}
        >
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <PackageSearch className="mb-3 h-10 w-10 text-slate-300" />
            <p className="text-base font-medium text-slate-700">
              No matching pledged items
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Try adjusting your search or filters above.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemCard({ item }: { item: PledgedItem }) {
  const statusMeta = STATUS_META[item.status];
  const Icon = item.category === "DIAMOND" ? Diamond : Camera;

  return (
    <Card
      className="overflow-hidden border bg-white py-0 transition-shadow hover:shadow-md"
      style={{ borderColor: "rgba(74,111,165,0.12)" }}
    >
      {/* Top half — photo placeholder */}
      <div className="relative h-48 w-full bg-gradient-to-br from-slate-100 to-slate-200">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/70 ring-1 ring-slate-300/60">
            <Icon className="h-7 w-7 text-slate-400" />
          </div>
        </div>

        {/* Status badge — top right */}
        <Badge
          className="absolute right-3 top-3 border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
          style={{
            background: statusMeta.bg,
            color: statusMeta.fg,
            borderColor: statusMeta.border,
          }}
        >
          {statusMeta.label}
        </Badge>

        {/* Category chip — bottom left */}
        <div
          className="absolute bottom-3 left-3 rounded-md bg-white/85 px-2 py-1 text-[11px] font-medium tracking-wide text-slate-700 ring-1 ring-slate-300/60"
        >
          {CATEGORY_LABEL[item.category]} · {item.id}
        </div>
      </div>

      {/* Bottom half — details */}
      <CardHeader className="px-4 pt-4 pb-2">
        <CardTitle className="text-base font-semibold leading-snug text-slate-900">
          {item.title}
        </CardTitle>
        <p className="text-xs text-slate-500">
          Gross: {item.grossWeightG}g <span className="px-1">|</span> Net:{" "}
          {item.netWeightG}g
        </p>
      </CardHeader>

      <CardContent className="space-y-3 px-4 pb-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Pledged Value
          </p>
          <p
            className="text-xl font-bold leading-tight"
            style={{ color: "var(--brand-primary)" }}
          >
            {inr(item.pledgedValue)}
          </p>
        </div>

        <div
          className="space-y-1 rounded-lg border px-3 py-2 text-xs"
          style={{
            background: "rgba(191,221,245,0.18)",
            borderColor: "rgba(74,111,165,0.15)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Loan</span>
            <span className="font-medium text-slate-800">{item.loanId}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Customer</span>
            <span className="font-medium text-slate-800">{item.customer}</span>
          </div>
          {item.vaultLoc && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Location</span>
              <span className="font-medium text-slate-800">{item.vaultLoc}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
