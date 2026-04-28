import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Building2,
  CheckCircle2,
  IndianRupee,
  Pencil,
  Percent,
  Plus,
  Settings as SettingsIcon,
  ShieldCheck,
  Trash2,
  Users as UsersIcon,
  Vault,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  useBranchProfile,
  updateBranchProfile,
  type BranchProfile,
} from "@/lib/stores/branchProfileStore";
import {
  addSafe,
  deleteSafe,
  lockerRangeLabel,
  updateSafe,
  useVaultConfig,
  type SafeConfig,
} from "@/lib/stores/vaultConfigStore";

const inputBaseStyle: React.CSSProperties = {
  borderColor: "rgba(74,111,165,0.20)",
  "--tw-ring-color": "var(--brand-light)",
} as React.CSSProperties;

type RatesForm = {
  pawnRate: string;
  vehicleRate: string;
  penaltyRate: string;
  processingFee: string;
};

type Role = "ADMIN" | "CASHIER" | "APPRAISER";
type StaffStatus = "ACTIVE" | "INACTIVE";

type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: StaffStatus;
};

const ROLE_META: Record<Role, { label: string; bg: string; fg: string; border: string }> = {
  ADMIN: {
    label: "Admin",
    bg: "rgba(74,111,165,0.14)",
    fg: "#1d4ed8",
    border: "rgba(74,111,165,0.35)",
  },
  CASHIER: {
    label: "Cashier",
    bg: "rgba(16,185,129,0.12)",
    fg: "#047857",
    border: "rgba(16,185,129,0.35)",
  },
  APPRAISER: {
    label: "Appraiser",
    bg: "rgba(234,179,8,0.16)",
    fg: "#a16207",
    border: "rgba(234,179,8,0.40)",
  },
};

const STATUS_META: Record<StaffStatus, { label: string; bg: string; fg: string; dot: string }> = {
  ACTIVE: {
    label: "Active",
    bg: "rgba(16,185,129,0.12)",
    fg: "#047857",
    dot: "#10b981",
  },
  INACTIVE: {
    label: "Inactive",
    bg: "rgba(100,116,139,0.12)",
    fg: "#475569",
    dot: "#94a3b8",
  },
};

const STAFF: StaffUser[] = [
  {
    id: "U-01",
    name: "Anita Krishnan",
    email: "anita.k@kittangi.in",
    role: "ADMIN",
    status: "ACTIVE",
  },
  {
    id: "U-02",
    name: "Rahul Subramaniam",
    email: "rahul.s@kittangi.in",
    role: "CASHIER",
    status: "ACTIVE",
  },
  {
    id: "U-03",
    name: "Priya Devarajan",
    email: "priya.d@kittangi.in",
    role: "APPRAISER",
    status: "ACTIVE",
  },
  {
    id: "U-04",
    name: "Vikram Hegde",
    email: "vikram.h@kittangi.in",
    role: "CASHIER",
    status: "ACTIVE",
  },
  {
    id: "U-05",
    name: "Sneha Bhat",
    email: "sneha.b@kittangi.in",
    role: "APPRAISER",
    status: "INACTIVE",
  },
  {
    id: "U-06",
    name: "Manoj Pillai",
    email: "manoj.p@kittangi.in",
    role: "CASHIER",
    status: "ACTIVE",
  },
];

export default function Settings() {
  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* Page header */}
      <div className="mb-6 flex items-start gap-4">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ background: "var(--brand-light)" }}
        >
          <SettingsIcon
            className="h-6 w-6"
            style={{ color: "var(--brand-primary)" }}
          />
        </div>
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--brand-primary)" }}
          >
            System Settings
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Admin control center — branch profile, staff access, financial parameters, and vault layout.
          </p>
        </div>
      </div>

      <Tabs defaultValue="branch" className="w-full">
        <TabsList
          className="mb-6 h-auto w-full justify-start gap-1 rounded-xl border bg-white p-1.5"
          style={{ borderColor: "rgba(74,111,165,0.15)" }}
        >
          <TabsTrigger
            value="branch"
            className="data-[state=active]:bg-[var(--brand-light)] data-[state=active]:text-[color:var(--brand-primary)] data-[state=active]:shadow-none gap-2 rounded-lg px-4 py-2 text-sm font-medium"
          >
            <Building2 className="h-4 w-4" />
            Branch Profile
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="data-[state=active]:bg-[var(--brand-light)] data-[state=active]:text-[color:var(--brand-primary)] data-[state=active]:shadow-none gap-2 rounded-lg px-4 py-2 text-sm font-medium"
          >
            <UsersIcon className="h-4 w-4" />
            User Management
          </TabsTrigger>
          <TabsTrigger
            value="rates"
            className="data-[state=active]:bg-[var(--brand-light)] data-[state=active]:text-[color:var(--brand-primary)] data-[state=active]:shadow-none gap-2 rounded-lg px-4 py-2 text-sm font-medium"
          >
            <Percent className="h-4 w-4" />
            Rates &amp; Fees
          </TabsTrigger>
          <TabsTrigger
            value="vault"
            className="data-[state=active]:bg-[var(--brand-light)] data-[state=active]:text-[color:var(--brand-primary)] data-[state=active]:shadow-none gap-2 rounded-lg px-4 py-2 text-sm font-medium"
          >
            <Vault className="h-4 w-4" />
            Vault Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branch" className="m-0">
          <BranchProfileTab />
        </TabsContent>

        <TabsContent value="users" className="m-0">
          <UserManagementTab />
        </TabsContent>

        <TabsContent value="rates" className="m-0">
          <RatesAndFeesTab />
        </TabsContent>

        <TabsContent value="vault" className="m-0">
          <VaultConfigurationTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------- Tab 1: Branch Profile -------------------- */

function BranchProfileTab() {
  const branch = useBranchProfile();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BranchProfile>({
    defaultValues: branch,
  });

  // Keep the form in sync if another surface (e.g. a future API import) writes
  // to the branch store while this tab is mounted.
  useEffect(() => {
    reset(branch);
  }, [branch, reset]);

  const onSubmit = (data: BranchProfile) => {
    updateBranchProfile(data);
    toast.success("Branch profile saved", {
      icon: <CheckCircle2 className="h-4 w-4" />,
      description: `${data.branchName} (${data.branchCode}) updated successfully.`,
    });
  };

  return (
    <Card
      className="border bg-white"
      style={{ borderColor: "rgba(74,111,165,0.12)" }}
    >
      <CardHeader>
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: "var(--brand-light)" }}
          >
            <Building2 className="h-5 w-5" style={{ color: "var(--brand-primary)" }} />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              Branch Profile
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Identification, address, and tax registration details for this branch. Used on every printed receipt and statement.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <FieldGroup label="Branch Name" htmlFor="branchName" error={errors.branchName?.message}>
              <Input
                id="branchName"
                placeholder="e.g., Kittangi Main"
                style={inputBaseStyle}
                className="h-11"
                {...register("branchName", { required: "Branch name is required" })}
              />
            </FieldGroup>

            <FieldGroup label="Branch Code" htmlFor="branchCode" error={errors.branchCode?.message}>
              <Input
                id="branchCode"
                placeholder="e.g., KTG-001"
                style={inputBaseStyle}
                className="h-11"
                {...register("branchCode", { required: "Branch code is required" })}
              />
            </FieldGroup>

            <FieldGroup label="GSTIN" htmlFor="gstin" error={errors.gstin?.message}>
              <Input
                id="gstin"
                placeholder="15-digit GSTIN"
                style={inputBaseStyle}
                className="h-11 font-mono uppercase"
                {...register("gstin", {
                  required: "GSTIN is required",
                  pattern: {
                    value: /^[0-9A-Z]{15}$/,
                    message: "GSTIN must be 15 alphanumeric characters",
                  },
                })}
              />
            </FieldGroup>

            <FieldGroup label="Contact Number" htmlFor="contact" error={errors.contact?.message}>
              <Input
                id="contact"
                type="tel"
                placeholder="+91 ..."
                style={inputBaseStyle}
                className="h-11"
                {...register("contact", { required: "Contact number is required" })}
              />
            </FieldGroup>
          </div>

          <FieldGroup label="Full Address" htmlFor="address" error={errors.address?.message}>
            <Textarea
              id="address"
              rows={3}
              placeholder="Street, area, city, state, pincode"
              style={inputBaseStyle}
              {...register("address", { required: "Address is required" })}
            />
          </FieldGroup>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="submit"
              className="h-11 px-6 font-semibold text-white shadow-sm"
              style={{ background: "var(--brand-primary)" }}
            >
              <CheckCircle2 className="mr-1 h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* -------------------- Tab 2: User Management -------------------- */

function UserManagementTab() {
  const [users, setUsers] = useState<StaffUser[]>(STAFF);

  const handleAdd = () => {
    toast.success("Add new user", {
      icon: <Plus className="h-4 w-4" />,
      description: "Stub: invite/onboard flow will open here.",
    });
  };

  const toggleStatus = (id: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? { ...u, status: u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }
          : u,
      ),
    );
  };

  return (
    <Card
      className="border bg-white"
      style={{ borderColor: "rgba(74,111,165,0.12)" }}
    >
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: "var(--brand-light)" }}
            >
              <ShieldCheck className="h-5 w-5" style={{ color: "var(--brand-primary)" }} />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Staff Access &amp; Roles
              </CardTitle>
              <CardDescription className="text-sm text-slate-500">
                Manage user accounts, assign roles, and toggle access for branch staff.
              </CardDescription>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleAdd}
            className="h-10 font-semibold text-white shadow-sm"
            style={{ background: "var(--brand-primary)" }}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add New User
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
              <TableRow style={{ background: "rgba(191,221,245,0.25)" }}>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Name
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Email
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Role
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Status
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const role = ROLE_META[u.role];
                const status = STATUS_META[u.status];
                return (
                  <TableRow key={u.id} className="hover:bg-slate-50/60">
                    <TableCell className="py-3 font-medium text-slate-900">
                      {u.name}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-slate-600">
                      {u.email}
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge
                        className="border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                        style={{
                          background: role.bg,
                          color: role.fg,
                          borderColor: role.border,
                        }}
                      >
                        {role.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                        style={{ background: status.bg, color: status.fg }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: status.dot }}
                        />
                        {status.label}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleStatus(u.id)}
                        className="h-8 px-3 text-xs font-semibold"
                        style={{ color: "var(--brand-primary)" }}
                      >
                        {u.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------- Tab 3: Rates & Fees -------------------- */

function RatesAndFeesTab() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RatesForm>({
    defaultValues: {
      pawnRate: "1.50",
      vehicleRate: "1.20",
      penaltyRate: "2.00",
      processingFee: "500",
    },
  });

  const onSubmit = (data: RatesForm) => {
    toast.success("Global rates updated", {
      icon: <CheckCircle2 className="h-4 w-4" />,
      description: `Pawn ${data.pawnRate}% · Vehicle ${data.vehicleRate}% · Penalty ${data.penaltyRate}% · Fee ₹${data.processingFee}`,
    });
  };

  return (
    <Card
      className="border bg-white"
      style={{ borderColor: "rgba(74,111,165,0.12)" }}
    >
      <CardHeader>
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: "var(--brand-light)" }}
          >
            <Percent className="h-5 w-5" style={{ color: "var(--brand-primary)" }} />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              Global Financial Parameters
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Default rates and fees applied across all new loans. Changes take effect immediately.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <FieldGroup
              label="Standard Pawn Interest Rate (Monthly %)"
              htmlFor="pawnRate"
              error={errors.pawnRate?.message}
            >
              <RateInput
                id="pawnRate"
                suffix="%"
                placeholder="1.50"
                {...register("pawnRate", {
                  required: "Required",
                  pattern: { value: /^\d+(\.\d{1,2})?$/, message: "Enter a valid % (max 2 decimals)" },
                })}
              />
            </FieldGroup>

            <FieldGroup
              label="Vehicle Loan Interest Rate (Monthly %)"
              htmlFor="vehicleRate"
              error={errors.vehicleRate?.message}
            >
              <RateInput
                id="vehicleRate"
                suffix="%"
                placeholder="1.20"
                {...register("vehicleRate", {
                  required: "Required",
                  pattern: { value: /^\d+(\.\d{1,2})?$/, message: "Enter a valid % (max 2 decimals)" },
                })}
              />
            </FieldGroup>

            <FieldGroup
              label="Default Penalty Rate (%)"
              htmlFor="penaltyRate"
              error={errors.penaltyRate?.message}
            >
              <RateInput
                id="penaltyRate"
                suffix="%"
                placeholder="2.00"
                {...register("penaltyRate", {
                  required: "Required",
                  pattern: { value: /^\d+(\.\d{1,2})?$/, message: "Enter a valid % (max 2 decimals)" },
                })}
              />
            </FieldGroup>

            <FieldGroup
              label="Standard Processing Fee (₹)"
              htmlFor="processingFee"
              error={errors.processingFee?.message}
            >
              <RateInput
                id="processingFee"
                prefix="₹"
                placeholder="500"
                {...register("processingFee", {
                  required: "Required",
                  pattern: { value: /^\d+$/, message: "Enter a whole rupee amount" },
                })}
              />
            </FieldGroup>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="submit"
              className="h-11 px-6 font-semibold text-white shadow-sm"
              style={{ background: "var(--brand-primary)" }}
            >
              <CheckCircle2 className="mr-1 h-4 w-4" />
              Update Global Rates
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* -------------------- Tab 4: Vault Configuration -------------------- */

type SafeFormValues = {
  name: string;
  subtitle: string;
  prefix: string;
  startNumber: string;
  lockerCount: string;
};

const EMPTY_SAFE_FORM: SafeFormValues = {
  name: "",
  subtitle: "",
  prefix: "L-",
  startNumber: "101",
  lockerCount: "12",
};

function VaultConfigurationTab() {
  const safes = useVaultConfig();
  const [editing, setEditing] = useState<SafeConfig | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SafeConfig | null>(null);

  const totalLockers = safes.reduce((s, x) => s + x.lockerCount, 0);

  const openAdd = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const openEdit = (safe: SafeConfig) => {
    setEditing(safe);
    setDrawerOpen(true);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteSafe(pendingDelete.id);
    toast.success("Safe removed", {
      description: `${pendingDelete.name} and its ${pendingDelete.lockerCount} lockers were removed from the layout.`,
    });
    setPendingDelete(null);
  };

  return (
    <Card
      className="border bg-white"
      style={{ borderColor: "rgba(74,111,165,0.12)" }}
    >
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: "var(--brand-light)" }}
            >
              <Vault className="h-5 w-5" style={{ color: "var(--brand-primary)" }} />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Vault Layout
              </CardTitle>
              <CardDescription className="text-sm text-slate-500">
                Define the physical safes in this branch. Each safe generates its own ordered set of lockers from the prefix and start number.
              </CardDescription>
            </div>
          </div>

          <Button
            type="button"
            onClick={openAdd}
            className="h-10 font-semibold text-white shadow-sm"
            style={{ background: "var(--brand-primary)" }}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Safe
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div
          className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <SummaryTile label="Configured Safes" value={String(safes.length)} />
          <SummaryTile label="Total Lockers" value={totalLockers.toLocaleString("en-IN")} />
          <SummaryTile
            label="Avg. Lockers / Safe"
            value={
              safes.length === 0
                ? "—"
                : Math.round(totalLockers / safes.length).toString()
            }
          />
          <SummaryTile
            label="Status"
            value={safes.length === 0 ? "Empty" : "Live"}
          />
        </div>

        <div
          className="overflow-hidden rounded-lg border"
          style={{ borderColor: "rgba(74,111,165,0.12)" }}
        >
          <Table>
            <TableHeader>
              <TableRow style={{ background: "rgba(191,221,245,0.25)" }}>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Safe
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Location
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Locker Range
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Lockers
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {safes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <Vault className="h-6 w-6 text-slate-300" />
                      <p className="text-sm font-medium text-slate-700">
                        No safes configured yet
                      </p>
                      <p className="text-xs text-slate-500">
                        Click <strong>Add Safe</strong> to define your first vault.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                safes.map((s) => (
                  <TableRow key={s.id} className="hover:bg-slate-50/60">
                    <TableCell className="py-3">
                      <div className="font-semibold text-slate-900">{s.name}</div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {s.id}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-sm text-slate-600">
                      {s.subtitle || "—"}
                    </TableCell>
                    <TableCell className="py-3 font-mono text-xs">
                      <span
                        className="rounded-md border bg-white px-2 py-1"
                        style={{
                          borderColor: "rgba(74,111,165,0.18)",
                          color: "var(--brand-primary)",
                        }}
                      >
                        {lockerRangeLabel(s)}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <span
                        className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold"
                        style={{
                          backgroundColor: "var(--brand-light)",
                          color: "var(--brand-primary)",
                        }}
                      >
                        {s.lockerCount}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(s)}
                          className="h-8 w-8 p-0"
                          style={{ color: "var(--brand-primary)" }}
                          aria-label={`Edit ${s.name}`}
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setPendingDelete(s)}
                          className="h-8 w-8 p-0"
                          style={{ color: "#B91C1C" }}
                          aria-label={`Delete ${s.name}`}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="mt-3 text-[11px] text-slate-500">
          Locker IDs are derived as <span className="font-mono">prefix + (start + index)</span>.
          E.g. prefix <span className="font-mono">L-</span>, start <span className="font-mono">101</span>, count
          <span className="font-mono"> 16</span> → <span className="font-mono">L-101 … L-116</span>.
          Saved locally · persists across page refreshes.
        </p>
      </CardContent>

      <SafeDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        editing={editing}
      />

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this safe?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingDelete?.name}</strong> ({pendingDelete?.lockerCount} lockers)
              will no longer appear in the Vault Visualizer. Pledged items mapped to its
              lockers will remain in the registry but will need to be re-assigned.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              style={{ backgroundColor: "#B91C1C", color: "#fff" }}
            >
              Remove Safe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg border bg-white px-3 py-2.5"
      style={{ borderColor: "rgba(74,111,165,0.12)" }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className="mt-0.5 text-base font-bold"
        style={{ color: "var(--brand-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}

function SafeDrawer({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  editing: SafeConfig | null;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SafeFormValues>({
    defaultValues: EMPTY_SAFE_FORM,
  });

  // Hydrate the form whenever the drawer opens, either with the safe being
  // edited or the empty defaults for a brand-new safe.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      reset({
        name: editing.name,
        subtitle: editing.subtitle,
        prefix: editing.prefix,
        startNumber: String(editing.startNumber),
        lockerCount: String(editing.lockerCount),
      });
    } else {
      reset(EMPTY_SAFE_FORM);
    }
  }, [open, editing, reset]);

  const onSubmit = (data: SafeFormValues) => {
    const startNumber = parseInt(data.startNumber, 10);
    const lockerCount = parseInt(data.lockerCount, 10);
    const payload = {
      name: data.name.trim(),
      subtitle: data.subtitle.trim(),
      prefix: data.prefix,
      startNumber: Number.isFinite(startNumber) ? startNumber : 1,
      lockerCount: Number.isFinite(lockerCount) ? Math.max(0, lockerCount) : 0,
    };

    if (editing) {
      updateSafe(editing.id, payload);
      toast.success("Safe updated", {
        description: `${payload.name} now has ${payload.lockerCount} lockers (${payload.prefix}${payload.startNumber}…).`,
      });
    } else {
      const created = addSafe(payload);
      toast.success("Safe added", {
        description: `${created.name} (${created.id}) created with ${created.lockerCount} lockers.`,
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle
            className="text-base font-semibold"
            style={{ color: "var(--brand-primary)" }}
          >
            {editing ? `Edit ${editing.name}` : "Add a new safe"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Lockers are auto-numbered from the prefix + start number for the
            given count.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup label="Safe Name" htmlFor="safe-name" error={errors.name?.message}>
            <Input
              id="safe-name"
              placeholder="e.g., Safe A"
              className="h-10"
              style={inputBaseStyle}
              {...register("name", { required: "Safe name is required" })}
            />
          </FieldGroup>

          <FieldGroup label="Location / Subtitle" htmlFor="safe-subtitle">
            <Input
              id="safe-subtitle"
              placeholder="e.g., Main Vault • Ground Floor"
              className="h-10"
              style={inputBaseStyle}
              {...register("subtitle")}
            />
          </FieldGroup>

          <div className="grid grid-cols-3 gap-3">
            <FieldGroup label="Locker Prefix" htmlFor="safe-prefix" error={errors.prefix?.message}>
              <Input
                id="safe-prefix"
                placeholder="L-"
                className="h-10 font-mono"
                style={inputBaseStyle}
                {...register("prefix", {
                  required: "Required",
                  maxLength: { value: 6, message: "Max 6 chars" },
                })}
              />
            </FieldGroup>

            <FieldGroup
              label="Start Number"
              htmlFor="safe-start"
              error={errors.startNumber?.message}
            >
              <Input
                id="safe-start"
                type="number"
                min={1}
                placeholder="101"
                className="h-10"
                style={inputBaseStyle}
                {...register("startNumber", {
                  required: "Required",
                  pattern: { value: /^\d+$/, message: "Whole number" },
                })}
              />
            </FieldGroup>

            <FieldGroup
              label="Locker Count"
              htmlFor="safe-count"
              error={errors.lockerCount?.message}
            >
              <Input
                id="safe-count"
                type="number"
                min={0}
                max={500}
                placeholder="12"
                className="h-10"
                style={inputBaseStyle}
                {...register("lockerCount", {
                  required: "Required",
                  pattern: { value: /^\d+$/, message: "Whole number" },
                  validate: (v) => {
                    const n = parseInt(v, 10);
                    if (!Number.isFinite(n) || n < 0) return "Must be ≥ 0";
                    if (n > 500) return "Max 500 lockers";
                    return true;
                  },
                })}
              />
            </FieldGroup>
          </div>

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="font-semibold text-white shadow-sm"
              style={{ background: "var(--brand-primary)" }}
            >
              <CheckCircle2 className="mr-1 h-4 w-4" />
              {editing ? "Save Changes" : "Add Safe"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- Helpers -------------------- */

function FieldGroup({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-semibold text-slate-700">
        {label}
      </Label>
      {children}
      {error && (
        <p className="text-xs font-medium text-rose-600">{error}</p>
      )}
    </div>
  );
}

const RateInput = ({
  prefix,
  suffix,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  prefix?: string;
  suffix?: string;
  id?: string;
}) => {
  return (
    <div
      className="flex h-11 items-center overflow-hidden rounded-md border bg-white focus-within:ring-4"
      style={inputBaseStyle}
    >
      {prefix && (
        <span
          className="flex h-full items-center justify-center px-3 text-sm font-semibold"
          style={{
            background: "rgba(191,221,245,0.35)",
            color: "var(--brand-primary)",
            borderRight: "1px solid rgba(74,111,165,0.18)",
          }}
        >
          {prefix === "₹" ? <IndianRupee className="h-4 w-4" /> : prefix}
        </span>
      )}
      <input
        id={id}
        className="flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-slate-400"
        {...props}
      />
      {suffix && (
        <span
          className="flex h-full items-center justify-center px-3 text-sm font-semibold"
          style={{
            background: "rgba(191,221,245,0.35)",
            color: "var(--brand-primary)",
            borderLeft: "1px solid rgba(74,111,165,0.18)",
          }}
        >
          {suffix === "%" ? <Percent className="h-4 w-4" /> : suffix}
        </span>
      )}
    </div>
  );
};
