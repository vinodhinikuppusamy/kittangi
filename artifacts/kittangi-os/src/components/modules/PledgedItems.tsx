import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Diamond,
  Filter,
  Gem,
  ImageOff,
  PackageSearch,
  Pencil,
  Search,
  ShieldCheck,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  updatePledgedItem,
  usePledgedItems,
  type PledgedCategory,
  type PledgedItem,
  type PledgedStatus,
} from "@/lib/stores/pledgedItemsStore";

const CATEGORY_LABEL: Record<PledgedCategory, string> = {
  GOLD: "Gold",
  SILVER: "Silver",
  DIAMOND: "Diamond",
};

const STATUS_META: Record<
  PledgedStatus,
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
  const items = usePledgedItems();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PledgedCategory | "ALL">("ALL");
  const [status, setStatus] = useState<PledgedStatus | "ALL">("ALL");
  const [managingId, setManagingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
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
  }, [query, category, status, items]);

  const totals = useMemo(() => {
    const vaulted = filtered.filter((i) => i.status === "VAULTED");
    const value = vaulted.reduce((s, i) => s + i.pledgedValue, 0);
    return { count: filtered.length, vaultedCount: vaulted.length, value };
  }, [filtered]);

  const managingItem = useMemo(
    () => items.find((i) => i.id === managingId) ?? null,
    [items, managingId],
  );

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
              Click a card to manage its status, weight, or photos.
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
                onValueChange={(v) =>
                  setCategory(v as PledgedCategory | "ALL")
                }
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
                onValueChange={(v) => setStatus(v as PledgedStatus | "ALL")}
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
            <ItemCard
              key={item.id}
              item={item}
              onClick={() => setManagingId(item.id)}
            />
          ))}
        </div>
      )}

      <ManageItemDialog
        item={managingItem}
        open={!!managingItem}
        onClose={() => setManagingId(null)}
      />
    </div>
  );
}

function ItemCard({
  item,
  onClick,
}: {
  item: PledgedItem;
  onClick: () => void;
}) {
  const statusMeta = STATUS_META[item.status];
  const Icon = item.category === "DIAMOND" ? Diamond : Gem;
  const cover = item.photos?.[0];

  return (
    <Card
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`Manage ${item.title} (${item.id})`}
      className="group cursor-pointer overflow-hidden border bg-white py-0 transition-shadow hover:shadow-md focus:outline-none focus:ring-2"
      style={{
        borderColor: "rgba(74,111,165,0.12)",
        // @ts-expect-error CSS var
        "--tw-ring-color": "var(--brand-light)",
      }}
    >
      {/* Top half — photo or placeholder */}
      <div className="relative h-48 w-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
        {cover ? (
          <img
            src={cover}
            alt={item.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/70 ring-1 ring-slate-300/60">
              <Icon className="h-7 w-7 text-slate-400" />
            </div>
          </div>
        )}

        {/* Photo count chip */}
        {item.photos && item.photos.length > 1 ? (
          <div className="absolute left-3 top-3 rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">
            +{item.photos.length - 1} more
          </div>
        ) : null}

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
        <div className="absolute bottom-3 left-3 rounded-md bg-white/85 px-2 py-1 text-[11px] font-medium tracking-wide text-slate-700 ring-1 ring-slate-300/60">
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

        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Pencil size={11} />
            Click to manage
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function ManageItemDialog({
  item,
  open,
  onClose,
}: {
  item: PledgedItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<PledgedStatus>("VAULTED");
  const [grossWeight, setGrossWeight] = useState("");
  const [netWeight, setNetWeight] = useState("");
  const [activePhoto, setActivePhoto] = useState(0);

  // Re-hydrate the local edit state every time a different item is selected.
  useEffect(() => {
    if (!item) return;
    setStatus(item.status);
    setGrossWeight(String(item.grossWeightG));
    setNetWeight(String(item.netWeightG));
    setActivePhoto(0);
  }, [item?.id, item]);

  if (!item) return null;

  const photos = item.photos ?? [];
  const hasPhotos = photos.length > 0;

  const onSave = () => {
    const gross = Number(grossWeight);
    const net = Number(netWeight);
    if (!Number.isFinite(gross) || gross <= 0) {
      toast.error("Gross weight must be a positive number.");
      return;
    }
    if (!Number.isFinite(net) || net <= 0) {
      toast.error("Net weight must be a positive number.");
      return;
    }
    if (net > gross) {
      toast.error("Net weight cannot exceed gross weight.");
      return;
    }
    updatePledgedItem(item.id, {
      status,
      grossWeightG: gross,
      netWeightG: net,
    });
    toast.success("Item updated", {
      description: `${item.id} · ${STATUS_META[status].label}`,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-3xl"
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
              <ShieldCheck size={18} style={{ color: "var(--brand-primary)" }} />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle
                className="text-lg font-bold"
                style={{ color: "var(--brand-primary)" }}
              >
                Manage Item · {item.id}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {item.title} · Loan {item.loanId} · Customer {item.customer}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
          {/* Photo viewer */}
          <div className="space-y-3">
            <div
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--brand-primary)" }}
            >
              Origination Photographs
            </div>

            <div
              className="relative aspect-square w-full overflow-hidden rounded-xl border bg-slate-100"
              style={{ borderColor: "rgba(74,111,165,0.18)" }}
            >
              {hasPhotos ? (
                <>
                  <img
                    src={photos[activePhoto]}
                    alt={`${item.title} — photo ${activePhoto + 1}`}
                    className="h-full w-full object-cover"
                  />
                  {photos.length > 1 ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setActivePhoto(
                            (i) => (i - 1 + photos.length) % photos.length,
                          )
                        }
                        aria-label="Previous photo"
                        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-1.5 shadow-sm hover:bg-white"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setActivePhoto((i) => (i + 1) % photos.length)
                        }
                        aria-label="Next photo"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-1.5 shadow-sm hover:bg-white"
                      >
                        <ChevronRight size={16} />
                      </button>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
                        {activePhoto + 1} / {photos.length}
                      </div>
                    </>
                  ) : null}
                </>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400">
                  <ImageOff size={32} />
                  <p className="text-xs">No photos captured at origination.</p>
                </div>
              )}
            </div>

            {photos.length > 1 ? (
              <div className="flex flex-wrap gap-2">
                {photos.map((src, i) => (
                  <button
                    type="button"
                    key={`${i}-${src.slice(-12)}`}
                    onClick={() => setActivePhoto(i)}
                    className="overflow-hidden rounded-md border ring-offset-2"
                    style={{
                      borderColor:
                        i === activePhoto
                          ? "var(--brand-primary)"
                          : "rgba(74,111,165,0.18)",
                      borderWidth: i === activePhoto ? 2 : 1,
                    }}
                    aria-label={`Show photo ${i + 1}`}
                    aria-current={i === activePhoto}
                  >
                    <img
                      src={src}
                      alt=""
                      className="h-12 w-12 object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Editable fields */}
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="manage-status"
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: "var(--brand-primary)" }}
              >
                Status
              </Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as PledgedStatus)}
              >
                <SelectTrigger
                  id="manage-status"
                  className="h-10 w-full bg-white"
                  style={inputBaseStyle}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VAULTED">Vaulted</SelectItem>
                  <SelectItem value="AUCTION">Under Auction</SelectItem>
                  <SelectItem value="RELEASED">Released</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Changing status here updates the gallery in real time.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="manage-gross"
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--brand-primary)" }}
                >
                  Gross Weight (g)
                </Label>
                <Input
                  id="manage-gross"
                  type="number"
                  step="0.01"
                  min="0"
                  value={grossWeight}
                  onChange={(e) => setGrossWeight(e.target.value)}
                  className="h-10 bg-white"
                  style={inputBaseStyle}
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="manage-net"
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--brand-primary)" }}
                >
                  Net Weight (g)
                </Label>
                <Input
                  id="manage-net"
                  type="number"
                  step="0.01"
                  min="0"
                  value={netWeight}
                  onChange={(e) => setNetWeight(e.target.value)}
                  className="h-10 bg-white"
                  style={inputBaseStyle}
                />
              </div>
            </div>

            <div
              className="rounded-lg border px-3 py-2.5 text-xs"
              style={{
                borderColor: "rgba(74,111,165,0.15)",
                backgroundColor: "rgba(191,221,245,0.18)",
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Pledged value</span>
                <span
                  className="font-semibold"
                  style={{ color: "var(--brand-primary)" }}
                >
                  {inr(item.pledgedValue)}
                </span>
              </div>
              {item.vaultLoc ? (
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-slate-500">Vault location</span>
                  <span className="font-medium text-slate-800">
                    {item.vaultLoc}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <DialogFooter
          className="border-t bg-white px-6 py-4"
          style={{ borderColor: "rgba(74,111,165,0.10)" }}
        >
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
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
            type="button"
            onClick={onSave}
            className="h-9 px-4 text-white"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
