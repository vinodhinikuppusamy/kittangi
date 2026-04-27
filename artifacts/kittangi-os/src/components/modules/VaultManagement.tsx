import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Box,
  CheckCircle2,
  Key,
  Lock,
  Package,
  Printer,
  Shield,
  Vault,
} from "lucide-react";

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

type SafeId = "SAFE_A" | "SAFE_B";

type LockerStatus = "OCCUPIED" | "AVAILABLE";

type Locker = {
  id: string;
  status: LockerStatus;
  packageId?: string;
  loanId?: string;
  customerName?: string;
  itemDescription?: string;
  dateStored?: string;
};

const SAFES: {
  id: SafeId;
  name: string;
  subtitle: string;
  lockers: Locker[];
}[] = [
  {
    id: "SAFE_A",
    name: "Safe A",
    subtitle: "Main Vault • Ground Floor",
    lockers: [
      {
        id: "L-101",
        status: "OCCUPIED",
        packageId: "Pkg-45",
        loanId: "PWN-204512",
        customerName: "Aanya Sharma",
        itemDescription: "22K Gold Necklace, 25g",
        dateStored: "12 Apr 2026",
      },
      {
        id: "L-102",
        status: "OCCUPIED",
        packageId: "Pkg-46",
        loanId: "PWN-204519",
        customerName: "Meera Iyer",
        itemDescription: "22K Gold Bangles (pair), 38g",
        dateStored: "14 Apr 2026",
      },
      { id: "L-103", status: "AVAILABLE" },
      {
        id: "L-104",
        status: "OCCUPIED",
        packageId: "Pkg-47",
        loanId: "PWN-204527",
        customerName: "Kunal Mehta",
        itemDescription: "18K Gold Ring with Diamond, 6g",
        dateStored: "16 Apr 2026",
      },
      { id: "L-105", status: "AVAILABLE" },
      {
        id: "L-106",
        status: "OCCUPIED",
        packageId: "Pkg-48",
        loanId: "PWN-204533",
        customerName: "Rohan Verma",
        itemDescription: "22K Gold Chain, 18g",
        dateStored: "17 Apr 2026",
      },
      { id: "L-107", status: "AVAILABLE" },
      { id: "L-108", status: "AVAILABLE" },
      {
        id: "L-109",
        status: "OCCUPIED",
        packageId: "Pkg-49",
        loanId: "PWN-204540",
        customerName: "Priya Menon",
        itemDescription: "Silver Anklets (pair), 110g",
        dateStored: "18 Apr 2026",
      },
      {
        id: "L-110",
        status: "OCCUPIED",
        packageId: "Pkg-50",
        loanId: "PWN-204548",
        customerName: "Aanya Sharma",
        itemDescription: "22K Gold Earrings, 9g",
        dateStored: "19 Apr 2026",
      },
      { id: "L-111", status: "AVAILABLE" },
      {
        id: "L-112",
        status: "OCCUPIED",
        packageId: "Pkg-51",
        loanId: "PWN-204555",
        customerName: "Suresh Patel",
        itemDescription: "22K Gold Coin (10g) ×2",
        dateStored: "20 Apr 2026",
      },
      { id: "L-113", status: "AVAILABLE" },
      { id: "L-114", status: "AVAILABLE" },
      {
        id: "L-115",
        status: "OCCUPIED",
        packageId: "Pkg-52",
        loanId: "PWN-204561",
        customerName: "Divya Nair",
        itemDescription: "22K Gold Mangalsutra, 14g",
        dateStored: "21 Apr 2026",
      },
      { id: "L-116", status: "AVAILABLE" },
    ],
  },
  {
    id: "SAFE_B",
    name: "Safe B",
    subtitle: "Secondary Vault • First Floor",
    lockers: [
      {
        id: "L-201",
        status: "OCCUPIED",
        packageId: "Pkg-71",
        loanId: "PWN-204402",
        customerName: "Ravi Krishnan",
        itemDescription: "22K Gold Bracelet, 22g",
        dateStored: "08 Apr 2026",
      },
      { id: "L-202", status: "AVAILABLE" },
      {
        id: "L-203",
        status: "OCCUPIED",
        packageId: "Pkg-72",
        loanId: "PWN-204415",
        customerName: "Meera Iyer",
        itemDescription: "Silver Pooja Set, 320g",
        dateStored: "09 Apr 2026",
      },
      { id: "L-204", status: "AVAILABLE" },
      { id: "L-205", status: "AVAILABLE" },
      {
        id: "L-206",
        status: "OCCUPIED",
        packageId: "Pkg-73",
        loanId: "PWN-204430",
        customerName: "Kunal Mehta",
        itemDescription: "22K Gold Pendant Set, 12g",
        dateStored: "11 Apr 2026",
      },
      { id: "L-207", status: "AVAILABLE" },
      { id: "L-208", status: "AVAILABLE" },
      {
        id: "L-209",
        status: "OCCUPIED",
        packageId: "Pkg-74",
        loanId: "PWN-204441",
        customerName: "Aanya Sharma",
        itemDescription: "18K Gold Watch, 42g",
        dateStored: "13 Apr 2026",
      },
      { id: "L-210", status: "AVAILABLE" },
      { id: "L-211", status: "AVAILABLE" },
      { id: "L-212", status: "AVAILABLE" },
    ],
  },
];

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
  const [activeSafe, setActiveSafe] = useState<SafeId>("SAFE_A");
  const [selectedLocker, setSelectedLocker] = useState<Locker | null>(null);
  const [activeSafeName, setActiveSafeName] = useState<string>("Safe A");

  const stats = useMemo(() => {
    const totalSafes = SAFES.length;
    const totalLockers = SAFES.reduce((s, x) => s + x.lockers.length, 0);
    const occupied = SAFES.reduce(
      (s, x) => s + x.lockers.filter((l) => l.status === "OCCUPIED").length,
      0,
    );
    const available = totalLockers - occupied;
    return { totalSafes, totalLockers, occupied, available };
  }, []);

  const occupancyPct = Math.round((stats.occupied / stats.totalLockers) * 100);

  const handleLockerClick = (locker: Locker, safeName: string) => {
    if (locker.status !== "OCCUPIED") return;
    setSelectedLocker(locker);
    setActiveSafeName(safeName);
  };

  const handlePrintTag = () => {
    if (!selectedLocker) return;
    toast.success("Locker tag sent to printer", {
      description: `${selectedLocker.id} • ${selectedLocker.packageId} • ${selectedLocker.loanId}`,
      icon: <CheckCircle2 size={18} />,
    });
  };

  return (
    <div className="mx-auto max-w-7xl pb-10">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: "var(--brand-light)" }}
          >
            <Shield size={22} style={{ color: "var(--brand-primary)" }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--brand-primary)" }}
            >
              Vault Management
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Live view of pledged inventory across safes &amp; lockers.
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
                style={{ color: "var(--brand-primary)" }}
              >
                Safe Visualizer
              </CardTitle>
              <CardDescription className="text-xs">
                Click an occupied locker to inspect its contents.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeSafe}
            onValueChange={(v) => setActiveSafe(v as SafeId)}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TabsList
                className="bg-slate-100 p-1"
                style={{ backgroundColor: "rgba(191,221,245,0.30)" }}
              >
                {SAFES.map((s) => (
                  <TabsTrigger
                    key={s.id}
                    value={s.id}
                    className="data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  >
                    <Vault size={14} className="mr-1.5" />
                    {s.name}
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

            {SAFES.map((safe) => (
              <TabsContent key={safe.id} value={safe.id} className="mt-5">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">
                      {safe.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {safe.subtitle} • {safe.lockers.length} lockers •{" "}
                      {safe.lockers.filter((l) => l.status === "OCCUPIED").length}{" "}
                      occupied
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                  {safe.lockers.map((locker) => {
                    const isOccupied = locker.status === "OCCUPIED";
                    return (
                      <button
                        key={locker.id}
                        type="button"
                        onClick={() => handleLockerClick(locker, safe.name)}
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
              </TabsContent>
            ))}
          </Tabs>
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
                <Package size={18} style={{ color: "var(--brand-primary)" }} />
              </div>
              <div>
                <DialogTitle
                  className="text-base font-semibold"
                  style={{ color: "var(--brand-primary)" }}
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

          <DialogFooter className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedLocker(null)}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={handlePrintTag}
              className="text-white shadow-sm"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              <Printer size={16} className="mr-2" />
              Print Locker Tag
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
