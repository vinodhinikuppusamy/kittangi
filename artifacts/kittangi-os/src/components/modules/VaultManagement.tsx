import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { openLockerTagPrintWindow } from "@/lib/printLockerTag";
import {
  getCurrentActor,
  logActivity,
} from "@/lib/stores/activityLogStore";
import {
  ArrowLeftRight,
  Box,
  CheckCircle2,
  Key,
  Lock,
  Package,
  Printer,
  Settings as SettingsIcon,
  Shield,
  Vault,
} from "lucide-react";
import { Link } from "react-router-dom";
 
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  generateLockerIds,
  normalizeSafeKey,
  parseVaultLoc,
  useVaultConfig,
  type SafeConfig,
} from "@/lib/stores/vaultConfigStore";
import {
  transferPledgedItem,
  usePledgedItems,
} from "@/lib/stores/pledgedItemsStore";
import { useIsAdmin } from "@/lib/stores/userRoleStore";
 
type LockerStatus = "OCCUPIED" | "AVAILABLE";
 
type Locker = {
  id: string;
  status: LockerStatus;
  packageId?: string;
  loanId?: string;
  customerName?: string;
  itemDescription?: string;
  dateStored?: string;
  vaultLoc?: string;
};
 
type ResolvedSafe = {
  config: SafeConfig;
  lockers: Locker[];
};
 
const formatStoredDate = (iso?: string): string | undefined => {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};
 
type StatCardProps = {
  label: string;
  value: number;
  hint: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent?: "primary" | "green" | "amber";
};
 
function StatCard({ label, value, hint, icon: Icon, accent = "primary" }: StatCardProps) {
  const accentColors: Record<NonNullable<StatCardProps["accent"]>, { bg: string; fg: string }> = {
    primary: { bg: "var(--brand-light)", fg: "var(--brand-primary)" },
    green: { bg: "rgba(34,197,94,0.12)", fg: "rgb(21,128,61)" },
    amber: { bg: "rgba(245,158,11,0.14)", fg: "rgb(180,83,9)" },
  };
  const c = accentColors[accent];
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
              className="mt-2 text-3xl font-bold tracking-tight"
              style={{ color: "var(--brand-primary)" }}
            >
              {value.toLocaleString("en-IN")}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">{hint}</div>
          </div>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: c.bg }}
          >
            <Icon size={18} className="" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
 
export default function VaultManagement() {
  const safesConfig = useVaultConfig();
  const pledgedItems = usePledgedItems();
  const isAdmin = useIsAdmin();
 
  // Build an occupancy map keyed by `<normalizedSafeName>::<lockerId>` so we
  // can join pledged items to their configured locker even if the admin has
  // renamed a safe (whitespace, hyphenation, casing all normalised).
  const resolvedSafes = useMemo<ResolvedSafe[]>(() => {
    const occupancy = new Map<string, Locker>();
    for (const item of pledgedItems) {
      if (item.status !== "VAULTED") continue;
      const parsed = parseVaultLoc(item.vaultLoc);
      if (!parsed) continue;
      occupancy.set(`${parsed.safeKey}::${parsed.lockerId}`, {
        id: parsed.lockerId,
        status: "OCCUPIED",
        packageId: item.id,
        loanId: item.loanId,
        customerName: item.customer,
        itemDescription: `${item.title} • ${item.netWeightG}g net`,
        dateStored: formatStoredDate(item.originatedAt),
        vaultLoc: item.vaultLoc,
      });
    }
 
    return safesConfig.map((cfg) => {
      const safeKey = normalizeSafeKey(cfg.name);
      const lockers: Locker[] = generateLockerIds(cfg).map((lockerId) => {
        const occ = occupancy.get(`${safeKey}::${lockerId}`);
        if (occ) return occ;
        return { id: lockerId, status: "AVAILABLE" };
      });
      return { config: cfg, lockers };
    });
  }, [safesConfig, pledgedItems]);
 
  const [activeSafeId, setActiveSafeId] = useState<string>("");
  const [selectedLocker, setSelectedLocker] = useState<Locker | null>(null);
  const [activeSafeName, setActiveSafeName] = useState<string>("");
 
  // Transfer dialog state
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTargetSafeId, setTransferTargetSafeId] = useState<string>("");
  const [transferTargetLockerId, setTransferTargetLockerId] = useState<string>("");
 
  // Keep the active tab in range as safes are added/removed in Settings.
  useEffect(() => {
    if (resolvedSafes.length === 0) {
      if (activeSafeId !== "") setActiveSafeId("");
      return;
    }
    if (!resolvedSafes.some((s) => s.config.id === activeSafeId)) {
      setActiveSafeId(resolvedSafes[0].config.id);
    }
  }, [resolvedSafes, activeSafeId]);
 
  const stats = useMemo(() => {
    const totalSafes = resolvedSafes.length;
    const totalLockers = resolvedSafes.reduce((s, x) => s + x.lockers.length, 0);
    const occupied = resolvedSafes.reduce(
      (s, x) => s + x.lockers.filter((l) => l.status === "OCCUPIED").length,
      0,
    );
    const available = totalLockers - occupied;
    return { totalSafes, totalLockers, occupied, available };
  }, [resolvedSafes]);
 
  const occupancyPct =
    stats.totalLockers > 0
      ? Math.round((stats.occupied / stats.totalLockers) * 100)
      : 0;
 
  const handleLockerClick = (locker: Locker, safeName: string) => {
    if (locker.status !== "OCCUPIED") return;
    setSelectedLocker(locker);
    setActiveSafeName(safeName);
  };
 
  const handlePrintTag = () => {
    if (!selectedLocker) return;
    openLockerTagPrintWindow({
      lockerId: selectedLocker.id,
      loanId: selectedLocker.loanId ?? "—",
      customerName: selectedLocker.customerName ?? "—",
      safeName: activeSafeName,
      packageId: selectedLocker.packageId ?? "—",
    });
  };
 
  // Targets available for transfer — every AVAILABLE locker across all safes,
  // grouped by safe so the cashier can see the destination context.
  const transferTargetSafe = useMemo(
    () => resolvedSafes.find((s) => s.config.id === transferTargetSafeId),
    [resolvedSafes, transferTargetSafeId],
  );
  const transferAvailableLockers = useMemo(() => {
    if (!transferTargetSafe) return [] as string[];
    return transferTargetSafe.lockers
      .filter((l) => l.status === "AVAILABLE")
      .map((l) => l.id);
  }, [transferTargetSafe]);
 
  const openTransferDialog = () => {
    if (!selectedLocker?.packageId) return;
    setTransferTargetSafeId(activeSafeId);
    setTransferTargetLockerId("");
    setTransferOpen(true);
  };
 
  const handleConfirmTransfer = () => {
    if (!selectedLocker?.packageId) return;
    if (!transferTargetSafe || !transferTargetLockerId) {
      toast.error("Pick a target safe and locker.");
      return;
    }
    const newVaultLoc = `${transferTargetSafe.config.name} · ${transferTargetLockerId}`;
    if (newVaultLoc === selectedLocker.vaultLoc) {
      toast.error("Target locker is the same as the current location.");
      return;
    }
    try {
      transferPledgedItem(selectedLocker.packageId, newVaultLoc);
      try {
        logActivity({
          actor: getCurrentActor(),
          kind: "VAULT",
          summary: `${selectedLocker.packageId} moved → ${newVaultLoc}`,
        });
      } catch {
        /* best effort */
      }
      toast.success("Item transferred", {
        description: `${selectedLocker.packageId} moved from ${selectedLocker.vaultLoc} → ${newVaultLoc}.`,
        icon: <ArrowLeftRight size={16} />,
      });
      setTransferOpen(false);
      setSelectedLocker(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transfer failed.";
      toast.error(msg);
    }
  };
 
  return (
    <div className="mx-auto max-w-7xl pb-10">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{
              backgroundColor: "rgba(168,85,247,0.14)",
              boxShadow: "inset 0 0 0 1px rgba(168,85,247,0.30)",
            }}
          >
            <Shield size={22} style={{ color: "#7e22ce" }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold text-slate-900"
            >
              Vault Management
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Live view of pledged inventory across safes &amp; lockers.
              Locker status is bound to the linked Loan — a locker only
              becomes Empty when the loan is Closed.
            </p>
          </div>
        </div>
 
        <div
          className="flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs font-medium"
          style={{
            borderColor: "rgba(74,111,165,0.18)",
            color: "var(--brand-primary)",
          }}
        >
          <Lock size={14} />
          {occupancyPct}% Occupancy
        </div>
      </div>
 
      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Safes"
          value={stats.totalSafes}
          hint="Physical safe units"
          icon={(props) => (
            <Vault {...props} style={{ color: "var(--brand-primary)" }} />
          )}
          accent="primary"
        />
        <StatCard
          label="Total Lockers"
          value={stats.totalLockers}
          hint="Across all safes"
          icon={(props) => (
            <Box {...props} style={{ color: "var(--brand-primary)" }} />
          )}
          accent="primary"
        />
        <StatCard
          label="Occupied Lockers"
          value={stats.occupied}
          hint="Holding pledged items"
          icon={(props) => (
            <Key {...props} style={{ color: "rgb(180,83,9)" }} />
          )}
          accent="amber"
        />
        <StatCard
          label="Available Lockers"
          value={stats.available}
          hint="Ready for assignment"
          icon={(props) => (
            <CheckCircle2
              {...props}
              style={{ color: "rgb(21,128,61)" }}
            />
          )}
          accent="green"
        />
      </div>
 
      {/* Safe Visualizer */}
      <Card
        className="border bg-white shadow-sm"
        style={{ borderColor: "rgba(74,111,165,0.12)" }}
      >
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ backgroundColor: "var(--brand-light)" }}
              >
                <Vault size={16} style={{ color: "var(--brand-primary)" }} />
              </div>
              <div>
                <CardTitle
                  className="text-base font-semibold"
                  style={{ color: "var(--text-main)" }}
                >
                  Safe Visualizer
                </CardTitle>
                <CardDescription className="text-xs">
                  Click an occupied locker to inspect or transfer its contents.
                </CardDescription>
              </div>
            </div>
 
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9"
              style={{
                borderColor: "rgba(74,111,165,0.30)",
                color: "var(--brand-primary)",
              }}
            >
              <Link to="/settings">
                <SettingsIcon size={14} className="mr-1.5" />
                Configure Safes
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {resolvedSafes.length === 0 ? (
            <div
              className="rounded-xl border bg-white py-12 text-center"
              style={{ borderColor: "rgba(74,111,165,0.15)" }}
            >
              <Vault className="mx-auto mb-2 h-7 w-7 text-slate-300" />
              <p className="text-sm font-medium text-slate-700">
                No safes configured yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Add a safe in{" "}
                <Link
                  to="/settings"
                  className="underline"
                  style={{ color: "var(--brand-primary)" }}
                >
                  Settings → Vault Configuration
                </Link>{" "}
                to start placing pledged items.
              </p>
            </div>
          ) : (
            <Tabs
              value={activeSafeId}
              onValueChange={(v) => setActiveSafeId(v)}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <TabsList
                  className="bg-slate-100 p-1"
                  style={{ backgroundColor: "rgba(227,30,36,0.08)" }}
                >
                  {resolvedSafes.map((s) => (
                    <TabsTrigger
                      key={s.config.id}
                      value={s.config.id}
                    >
                      <Vault size={14} className="mr-1.5" />
                      {s.config.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
 
                {/* Legend */}
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-3 w-3 rounded border"
                      style={{
                        backgroundColor: "white",
                        borderColor: "rgb(34,197,94)",
                      }}
                    />
                    Available
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-3 w-3 rounded border"
                      style={{
                        backgroundColor: "var(--brand-light)",
                        borderColor: "rgba(74,111,165,0.40)",
                      }}
                    />
                    Occupied
                  </div>
                </div>
              </div>
 
              {resolvedSafes.map((safe) => (
                <TabsContent key={safe.config.id} value={safe.config.id} className="mt-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">
                        {safe.config.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {safe.config.subtitle} • {safe.lockers.length} lockers •{" "}
                        {safe.lockers.filter((l) => l.status === "OCCUPIED").length}{" "}
                        occupied
                      </div>
                    </div>
                    <div
                      className="rounded-md border bg-white px-2 py-1 font-mono text-[11px]"
                      style={{
                        borderColor: "rgba(74,111,165,0.18)",
                        color: "var(--brand-primary)",
                      }}
                    >
                      Prefix: {safe.config.prefix}
                      {safe.config.startNumber}…
                    </div>
                  </div>
 
                  {safe.lockers.length === 0 ? (
                    <div
                      className="rounded-lg border bg-white py-8 text-center text-xs text-slate-500"
                      style={{ borderColor: "rgba(74,111,165,0.15)" }}
                    >
                      This safe has no lockers yet. Set the locker count in
                      Settings to populate the grid.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                      {safe.lockers.map((locker) => {
                        const isOccupied = locker.status === "OCCUPIED";
                        return (
                          <button
                            key={locker.id}
                            type="button"
                            onClick={() => handleLockerClick(locker, safe.config.name)}
                            disabled={!isOccupied}
                            className={`group relative aspect-square rounded-lg border p-2 text-left transition-all ${
                              isOccupied
                                ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md"
                                : "cursor-default"
                            }`}
                            style={
                              isOccupied
                                ? {
                                    backgroundColor: "var(--brand-light)",
                                    borderColor: "rgba(74,111,165,0.35)",
                                  }
                                : {
                                    backgroundColor: "white",
                                    borderColor: "rgba(34,197,94,0.55)",
                                  }
                            }
                          >
                            <div className="flex h-full flex-col justify-between">
                              <div className="flex items-start justify-end">
                                {isOccupied ? (
                                  <Lock
                                    size={12}
                                    style={{ color: "var(--brand-primary)" }}
                                  />
                                ) : (
                                  <Key
                                    size={12}
                                    style={{ color: "rgb(21,128,61)" }}
                                  />
                                )}
                              </div>
 
                              {isOccupied ? (
                                <div className="space-y-0.5">
                                  <div className="truncate text-xs font-semibold text-slate-800">
                                    {locker.id}: {locker.packageId}
                                  </div>
                                  <div className="truncate text-[10px] text-slate-500">
                                    {locker.loanId}
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  <div className="truncate text-xs font-semibold text-slate-700">
                                    {locker.id}
                                  </div>
                                  <div
                                    className="text-[11px] font-medium"
                                    style={{ color: "rgb(21,128,61)" }}
                                  >
                                    Empty
                                  </div>
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>
 
      {/* Locker Details Modal */}
      <Dialog
        open={!!selectedLocker}
        onOpenChange={(o) => !o && setSelectedLocker(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: "var(--brand-light)" }}
              >
                <Package size={18} style={{ color: "var(--text-main)" }} />
              </div>
              <div>
                <DialogTitle
                  className="text-base font-semibold"
                  style={{ color: "var(--text-main)" }}
                >
                  Locker {selectedLocker?.id}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {activeSafeName} • {selectedLocker?.packageId}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
 
          {selectedLocker && (
            <div
              className="mt-2 space-y-3 rounded-lg border p-4"
              style={{
                borderColor: "rgba(74,111,165,0.15)",
                backgroundColor: "var(--bg-main)",
              }}
            >
              <DetailRow label="Loan ID" value={selectedLocker.loanId ?? "—"} mono />
              <DetailRow
                label="Customer Name"
                value={selectedLocker.customerName ?? "—"}
              />
              <DetailRow
                label="Item Description"
                value={selectedLocker.itemDescription ?? "—"}
              />
              <DetailRow
                label="Date Stored"
                value={selectedLocker.dateStored ?? "—"}
              />
            </div>
          )}
 
          <p className="text-[11px] text-slate-500">
            <Lock size={11} className="-mt-0.5 mr-1 inline" />
            This locker can only become Empty when the linked loan is Closed
            from Loan Management.
          </p>
 
          <DialogFooter className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedLocker(null)}
            >
              Close
            </Button>
            {isAdmin && (
              <Button
                type="button"
                variant="outline"
                onClick={openTransferDialog}
                data-testid="button-transfer-locker"
                style={{
                  borderColor: "rgba(74,111,165,0.40)",
                  color: "var(--brand-primary)",
                }}
              >
                <ArrowLeftRight size={16} className="mr-2" />
                Transfer
              </Button>
            )}
            <Button
              type="button"
              onClick={handlePrintTag}
              data-testid="button-print-locker-tag"
              className="text-white shadow-sm"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              <Printer size={16} className="mr-2" />
              Print Locker Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
 
      {/* Internal Transfer dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle
              className="flex items-center gap-2 text-base font-semibold"
              style={{ color: "var(--brand-primary)" }}
            >
              <ArrowLeftRight size={16} />
              Transfer Pledged Item
            </DialogTitle>
            <DialogDescription className="text-xs">
              Move <span className="font-mono">{selectedLocker?.packageId}</span>{" "}
              to a different locker without touching the linked loan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div
              className="rounded-md border bg-white px-3 py-2 text-xs"
              style={{ borderColor: "rgba(74,111,165,0.18)" }}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Current Location
              </div>
              <div className="mt-0.5 font-mono text-sm text-slate-800">
                {selectedLocker?.vaultLoc ?? "—"}
              </div>
            </div>
 
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Target Safe
                </div>
                <Select
                  value={transferTargetSafeId}
                  onValueChange={(v) => {
                    setTransferTargetSafeId(v);
                    setTransferTargetLockerId("");
                  }}
                >
                  <SelectTrigger
                    className="h-10 bg-white"
                    data-testid="select-transfer-target-safe"
                  >
                    <SelectValue placeholder="Pick safe" />
                  </SelectTrigger>
                  <SelectContent>
                    {resolvedSafes.map((s) => (
                      <SelectItem key={s.config.id} value={s.config.id}>
                        {s.config.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
 
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Target Locker
                </div>
                <Select
                  value={transferTargetLockerId}
                  onValueChange={setTransferTargetLockerId}
                  disabled={!transferTargetSafe}
                >
                  <SelectTrigger
                    className="h-10 bg-white"
                    data-testid="select-transfer-target-locker"
                  >
                    <SelectValue
                      placeholder={
                        transferAvailableLockers.length === 0
                          ? "No empty lockers"
                          : "Pick locker"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {transferAvailableLockers.map((id) => (
                      <SelectItem key={id} value={id}>
                        {id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
 
            <p className="text-[11px] text-slate-500">
              Only Available (Empty) lockers can be picked. The pledged item
              keeps its loan link; only the physical location changes.
            </p>
          </div>
          <DialogFooter className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTransferOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmTransfer}
              data-testid="button-confirm-transfer"
              disabled={!transferTargetLockerId}
              className="text-white"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              <ArrowLeftRight size={16} className="mr-2" />
              Confirm Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
 
function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className={`text-right text-sm font-medium text-slate-800 ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}