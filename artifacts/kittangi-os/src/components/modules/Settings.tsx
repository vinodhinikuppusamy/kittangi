import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  AlertTriangle,
  Banknote,
  Building2,
  CheckCircle2,
  IndianRupee,
  KeyRound,
  Landmark,
  Pencil,
  Percent,
  Plus,
  Settings as SettingsIcon,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users as UsersIcon,
  Vault,
  Wallet,
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
import {
  addAccount,
  deleteAccount,
  updateAccount,
  useAccounts,
  useAllAccountBalances,
  type Account,
  type AccountType,
} from "@/lib/stores/accountsStore";
import { useUserRole } from "@/lib/stores/userRoleStore";
import { Switch } from "@/components/ui/switch";
import {
  getSettings,
  setSettings,
  useSettings,
} from "@/lib/stores/settingsStore";
import {
  addUser,
  updateUser,
  useUsers,
  type User,
  type UserRole,
} from "@/lib/stores/usersStore";
import { useAuth } from "@/lib/auth/AuthContext";
import { performSystemReset } from "@/lib/systemReset";

const inputBaseStyle: React.CSSProperties = {
  borderColor: "rgba(74,111,165,0.20)",
  "--tw-ring-color": "var(--brand-light)",
} as React.CSSProperties;

type RatesForm = {
  pawnRate: string;
  vehicleRate: string;
  penaltyRate: string;
  /** Per-₹1,000 processing fee charged at origination (replaces legacy flat). */
  processingFeePer1000: string;
  /** % per annum that lands in the legal-rate ledger on every interest receipt. */
  legalInterestRate: string;
};

// Visual chip metadata for the User Management table. Roles in the
// authoritative store are just ADMIN | STAFF (per `usersStore.ts`); the
// extra colours are kept so future role types can plug in here without
// touching the table renderer.
const ROLE_META: Record<UserRole, { label: string; bg: string; fg: string; border: string }> = {
  ADMIN: {
    label: "Admin",
    bg: "rgba(74,111,165,0.14)",
    fg: "#1d4ed8",
    border: "rgba(74,111,165,0.35)",
  },
  STAFF: {
    label: "Staff",
    bg: "rgba(16,185,129,0.12)",
    fg: "#047857",
    border: "rgba(16,185,129,0.35)",
  },
};

const STATUS_META: Record<
  "ACTIVE" | "INACTIVE",
  { label: string; bg: string; fg: string; dot: string }
> = {
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
            value="accounts"
            className="data-[state=active]:bg-[var(--brand-light)] data-[state=active]:text-[color:var(--brand-primary)] data-[state=active]:shadow-none gap-2 rounded-lg px-4 py-2 text-sm font-medium"
          >
            <Landmark className="h-4 w-4" />
            Accounts
          </TabsTrigger>
          <TabsTrigger
            value="vault"
            className="data-[state=active]:bg-[var(--brand-light)] data-[state=active]:text-[color:var(--brand-primary)] data-[state=active]:shadow-none gap-2 rounded-lg px-4 py-2 text-sm font-medium"
          >
            <Vault className="h-4 w-4" />
            Vault Configuration
          </TabsTrigger>
          <TabsTrigger
            value="danger"
            data-testid="tab-danger-zone"
            className="data-[state=active]:bg-rose-50 data-[state=active]:text-rose-700 data-[state=active]:shadow-none gap-2 rounded-lg px-4 py-2 text-sm font-medium text-rose-600"
          >
            <ShieldAlert className="h-4 w-4" />
            Danger Zone
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

        <TabsContent value="accounts" className="m-0">
          <AccountsTab />
        </TabsContent>

        <TabsContent value="vault" className="m-0">
          <VaultConfigurationTab />
        </TabsContent>

        <TabsContent value="danger" className="m-0">
          <DangerZoneTab />
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

type NewUserForm = {
  name: string;
  username: string;
  email: string;
  role: UserRole;
};

function UserManagementTab() {
  const users = useUsers();
  const role = useUserRole();
  const { user: currentUser } = useAuth();
  const isAdmin = role === "ADMIN";
  const [addOpen, setAddOpen] = useState(false);

  const toggleStatus = (id: string) => {
    const u = users.find((x) => x.id === id);
    if (!u) return;
    if (currentUser && currentUser.id === id) {
      toast.error("You can't deactivate your own account.");
      return;
    }
    updateUser(id, { status: u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
    toast.success(u.status === "ACTIVE" ? "User deactivated" : "User reactivated", {
      description: `${u.name} is now ${u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"}.`,
    });
  };

  return (
    <div className="space-y-5">
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
              onClick={() => setAddOpen(true)}
              disabled={!isAdmin}
              data-testid="button-add-user"
              className="h-10 font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
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
                      {isAdmin ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleStatus(u.id)}
                          data-testid={`button-toggle-status-${u.id}`}
                          className="h-8 px-3 text-xs font-semibold"
                          style={{ color: "var(--brand-primary)" }}
                        >
                          {u.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    <AddUserDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

/* -------------------- Add User Dialog (admin only) -------------------- */

function AddUserDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewUserForm>({
    defaultValues: { name: "", username: "", email: "", role: "STAFF" },
  });

  useEffect(() => {
    if (!open) reset({ name: "", username: "", email: "", role: "STAFF" });
  }, [open, reset]);

  const onSubmit = async (data: NewUserForm) => {
    try {
      // Default password "kittangi123" hashed with a fresh per-user salt,
      // matching the salted scheme in usersStore (SHA-256 over salt+password).
      const saltBytes = crypto.getRandomValues(new Uint8Array(16));
      const passwordSalt = Array.from(saltBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const enc = new TextEncoder().encode(passwordSalt + "kittangi123");
      const buf = await crypto.subtle.digest("SHA-256", enc);
      const passwordHash = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      addUser({
        name: data.name.trim(),
        username: data.username.trim().toLowerCase(),
        email: data.email.trim().toLowerCase(),
        role: data.role,
        status: "ACTIVE",
        passwordSalt,
        passwordHash,
      });
      toast.success("User created", {
        icon: <CheckCircle2 className="h-4 w-4" />,
        description: `${data.name} can sign in with default password "kittangi123" — ask them to change it from Profile.`,
      });
      onClose();
    } catch (err) {
      toast.error("Failed to create user", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Creates a new staff or admin account with default password
            “kittangi123”. They should change it on first sign-in.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-user-name">Full Name</Label>
            <Input
              id="new-user-name"
              data-testid="input-new-user-name"
              placeholder="e.g. Anita Krishnan"
              {...register("name", { required: "Required" })}
            />
            {errors.name && (
              <p className="text-xs text-rose-600">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-user-username">Username</Label>
            <Input
              id="new-user-username"
              data-testid="input-new-user-username"
              placeholder="e.g. anita"
              {...register("username", {
                required: "Required",
                pattern: {
                  value: /^[a-z0-9._-]{3,}$/i,
                  message: "3+ chars, letters/numbers/._-",
                },
              })}
            />
            {errors.username && (
              <p className="text-xs text-rose-600">{errors.username.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-user-email">Email</Label>
            <Input
              id="new-user-email"
              type="email"
              data-testid="input-new-user-email"
              placeholder="e.g. anita@kittangi.in"
              {...register("email", {
                required: "Required",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Enter a valid email",
                },
              })}
            />
            {errors.email && (
              <p className="text-xs text-rose-600">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-user-role">Role</Label>
            <select
              id="new-user-role"
              data-testid="select-new-user-role"
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-light)]"
              {...register("role", { required: true })}
            >
              <option value="STAFF">Staff (Cashier/Appraiser)</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              data-testid="button-submit-new-user"
              className="font-semibold text-white"
              style={{ background: "var(--brand-primary)" }}
            >
              <Plus className="mr-1 h-4 w-4" /> Create User
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- Tab: Danger Zone (admin only) -------------------- */

function DangerZoneTab() {
  const role = useUserRole();
  const isAdmin = role === "ADMIN";
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    try {
      const result = performSystemReset();
      toast.success("System Reset complete", {
        icon: <CheckCircle2 className="h-4 w-4" />,
        description: `Wiped: ${result.wiped.join(", ")}. Preserved: ${result.preserved.join(", ")}.`,
      });
      setConfirmOpen(false);
      setConfirmText("");
    } catch (err) {
      toast.error("System Reset failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setResetting(false);
    }
  };

  if (!isAdmin) {
    return (
      <Card className="border bg-white" style={{ borderColor: "rgba(74,111,165,0.12)" }}>
        <CardContent className="p-8 text-center text-sm text-slate-500">
          <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-slate-400" />
          The Danger Zone is restricted to administrators.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="border bg-white"
      style={{ borderColor: "rgba(244,63,94,0.30)" }}
    >
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50">
            <ShieldAlert className="h-5 w-5 text-rose-600" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-rose-700">
              Danger Zone
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Irreversible operations. Use these tools only after backing up
              your branch data.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="flex flex-wrap items-start justify-between gap-4 rounded-lg border p-4"
          style={{ borderColor: "rgba(244,63,94,0.30)", background: "rgba(254,242,242,0.50)" }}
        >
          <div className="max-w-xl space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-rose-700">
              <AlertTriangle className="h-4 w-4" /> System Reset
            </div>
            <p className="text-xs text-slate-600">
              Permanently deletes <strong>all daybook entries, loans,
              pledged items, day locks and receipts</strong>. Your users,
              global settings, branch profile, vault layout and customer
              records are preserved. This cannot be undone.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setConfirmOpen(true)}
            data-testid="button-system-reset"
            className="h-10 bg-rose-600 font-semibold text-white hover:bg-rose-700"
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Run System Reset
          </Button>
        </div>
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={(v) => !v && setConfirmOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-700">
              Confirm System Reset
            </DialogTitle>
            <DialogDescription>
              This will permanently delete all transactional data. Type{" "}
              <strong>RESET</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type RESET to confirm"
              data-testid="input-system-reset-confirm"
            />
            <div className="rounded-md bg-rose-50 p-3 text-xs text-rose-700">
              <p className="font-semibold">Will be wiped:</p>
              <p>Daybook entries · Loans · Pledged items · Day locks · Receipts</p>
              <p className="mt-2 font-semibold">Will be preserved:</p>
              <p>Users · Settings · Branch profile · Vault config · Customers</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmOpen(false);
                setConfirmText("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleReset}
              disabled={confirmText !== "RESET" || resetting}
              data-testid="button-confirm-system-reset"
              className="bg-rose-600 font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {resetting ? "Resetting..." : "Yes, Reset Everything"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* -------------------- Tab 4: Accounts -------------------- */

type AccountFormValues = {
  id: string;
  name: string;
  type: AccountType;
  subtitle: string;
  openingBalance: string;
  openedAtIso: string;
};

function todayIsoForAccount(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function AccountsTab() {
  const accounts = useAccounts();
  const balances = useAllAccountBalances();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Account | null>(null);

  const totalLiquid = accounts.reduce(
    (s, a) => s + (balances[a.id] ?? 0),
    0,
  );

  const openAdd = () => {
    setEditing(null);
    setDrawerOpen(true);
  };
  const openEdit = (a: Account) => {
    setEditing(a);
    setDrawerOpen(true);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteAccount(pendingDelete.id);
    toast.success("Account removed", {
      description: `${pendingDelete.name} was removed. Existing ledger entries pinned to it remain on the books.`,
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
              <Landmark
                className="h-5 w-5"
                style={{ color: "var(--brand-primary)" }}
              />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Accounts &amp; Cash Sources
              </CardTitle>
              <CardDescription className="text-sm text-slate-500">
                Every cash drawer and bank account the firm transacts on.
                Balances are derived live from the Daybook.
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
            Add Account
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <SummaryTile
            label="Configured Accounts"
            value={String(accounts.length)}
          />
          <SummaryTile
            label="Total Liquid Position"
            value={new Intl.NumberFormat("en-IN", {
              style: "currency",
              currency: "INR",
              maximumFractionDigits: 0,
            }).format(totalLiquid)}
          />
          <SummaryTile
            label="Cash Drawers"
            value={String(accounts.filter((a) => a.type === "CASH").length)}
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
                  Account
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Type
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Opening Balance
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Current Balance
                </TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <Wallet className="h-6 w-6 text-slate-300" />
                      <p className="text-sm font-medium text-slate-700">
                        No accounts configured yet
                      </p>
                      <p className="text-xs text-slate-500">
                        Click <strong>Add Account</strong> to register your
                        first cash drawer or bank account.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((a) => {
                  const bal = balances[a.id] ?? 0;
                  return (
                    <TableRow key={a.id} className="hover:bg-slate-50/60">
                      <TableCell className="py-3">
                        <div className="flex items-start gap-2">
                          <div
                            className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg"
                            style={{
                              background:
                                a.type === "CASH"
                                  ? "rgba(34,197,94,0.10)"
                                  : "var(--brand-light)",
                            }}
                          >
                            {a.type === "CASH" ? (
                              <Banknote
                                size={14}
                                style={{ color: "rgb(21,128,61)" }}
                              />
                            ) : (
                              <Landmark
                                size={14}
                                style={{ color: "var(--brand-primary)" }}
                              />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">
                              {a.name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {a.subtitle ?? a.id}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-xs text-slate-600">
                        {a.type === "CASH" ? "Cash" : "Bank"}
                      </TableCell>
                      <TableCell className="py-3 text-right text-sm text-slate-600">
                        {new Intl.NumberFormat("en-IN", {
                          style: "currency",
                          currency: "INR",
                          maximumFractionDigits: 0,
                        }).format(a.openingBalance)}
                      </TableCell>
                      <TableCell
                        className="py-3 text-right text-sm font-bold"
                        style={{
                          color:
                            bal < 0
                              ? "rgb(185,28,28)"
                              : "var(--brand-primary)",
                        }}
                      >
                        {new Intl.NumberFormat("en-IN", {
                          style: "currency",
                          currency: "INR",
                          maximumFractionDigits: 0,
                        }).format(bal)}
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(a)}
                            className="h-8 w-8 p-0"
                            style={{ color: "var(--brand-primary)" }}
                            aria-label={`Edit ${a.name}`}
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setPendingDelete(a)}
                            className="h-8 w-8 p-0"
                            style={{ color: "#B91C1C" }}
                            aria-label={`Delete ${a.name}`}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <p className="mt-3 text-[11px] text-slate-500">
          Current balance = Opening Balance + Σ Credits − Σ Debits across all
          Daybook entries pinned to this account.
        </p>
      </CardContent>

      <AccountDrawer
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
            <AlertDialogTitle>Remove this account?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingDelete?.name}</strong> will no longer appear in
              the account pickers across Pawn Origination, Receipts and
              Deposits. Existing Daybook entries pinned to it remain on the
              books for audit purposes. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              style={{ backgroundColor: "#B91C1C", color: "#fff" }}
            >
              Remove Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function AccountDrawer({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  editing: Account | null;
}) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AccountFormValues>({
    defaultValues: {
      id: "",
      name: "",
      type: "BANK",
      subtitle: "",
      openingBalance: "0",
      openedAtIso: todayIsoForAccount(),
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      reset({
        id: editing.id,
        name: editing.name,
        type: editing.type,
        subtitle: editing.subtitle ?? "",
        openingBalance: String(editing.openingBalance),
        openedAtIso: editing.openedAtIso,
      });
    } else {
      reset({
        id: "",
        name: "",
        type: "BANK",
        subtitle: "",
        openingBalance: "0",
        openedAtIso: todayIsoForAccount(),
      });
    }
  }, [open, editing, reset]);

  const typeValue = watch("type");

  const onSubmit = (data: AccountFormValues) => {
    const opening = parseFloat(data.openingBalance || "0");
    const payload = {
      name: data.name.trim(),
      type: data.type,
      subtitle: data.subtitle.trim() || undefined,
      openingBalance: Number.isFinite(opening) ? opening : 0,
      openedAtIso: data.openedAtIso || todayIsoForAccount(),
    };
    if (editing) {
      updateAccount(editing.id, payload);
      toast.success("Account updated", {
        description: `${payload.name} is now ${payload.type === "CASH" ? "a cash drawer" : "a bank account"}.`,
      });
    } else {
      const created = addAccount(payload);
      toast.success("Account added", {
        description: `${created.name} (${created.id}) is ready to receive ledger entries.`,
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
            {editing ? `Edit ${editing.name}` : "Add a new account"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Used as a source/destination across Pawn Origination, Receipts and
            Investor Payouts.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup
            label="Account Name"
            htmlFor="acc-name"
            error={errors.name?.message}
          >
            <Input
              id="acc-name"
              placeholder="e.g., HDFC Bank"
              className="h-10"
              style={inputBaseStyle}
              {...register("name", { required: "Required" })}
            />
          </FieldGroup>

          <FieldGroup label="Subtitle / Sub-account" htmlFor="acc-sub">
            <Input
              id="acc-sub"
              placeholder="e.g., Current A/c ••• 4521"
              className="h-10"
              style={inputBaseStyle}
              {...register("subtitle")}
            />
          </FieldGroup>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Account Type
              </Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setValue("type", "CASH")}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                    typeValue === "CASH"
                      ? "bg-[var(--brand-light)] text-[color:var(--brand-primary)]"
                      : "bg-white text-slate-600"
                  }`}
                  style={{ borderColor: "rgba(74,111,165,0.20)" }}
                >
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => setValue("type", "BANK")}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                    typeValue === "BANK"
                      ? "bg-[var(--brand-light)] text-[color:var(--brand-primary)]"
                      : "bg-white text-slate-600"
                  }`}
                  style={{ borderColor: "rgba(74,111,165,0.20)" }}
                >
                  Bank
                </button>
              </div>
            </div>

            <FieldGroup
              label="Opened On"
              htmlFor="acc-date"
              error={errors.openedAtIso?.message}
            >
              <Input
                id="acc-date"
                type="date"
                className="h-10"
                style={inputBaseStyle}
                {...register("openedAtIso")}
              />
            </FieldGroup>
          </div>

          <FieldGroup
            label="Opening Balance (₹)"
            htmlFor="acc-opening"
            error={errors.openingBalance?.message}
          >
            <Input
              id="acc-opening"
              type="number"
              step="1"
              placeholder="0"
              className="h-10"
              style={inputBaseStyle}
              {...register("openingBalance", { required: "Required" })}
            />
          </FieldGroup>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="font-semibold text-white shadow-sm"
              style={{ background: "var(--brand-primary)" }}
            >
              <CheckCircle2 className="mr-1 h-4 w-4" />
              {editing ? "Save Changes" : "Add Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- Tab 3: Rates & Fees -------------------- */

function RatesAndFeesTab() {
  const settings = useSettings();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RatesForm>({
    defaultValues: {
      pawnRate: settings.pawnRatePctPerMonth.toFixed(2),
      vehicleRate: settings.vehicleRatePctPerAnnum.toFixed(2),
      penaltyRate: settings.penaltyRatePctPerMonth.toFixed(2),
      processingFeePer1000: String(settings.processingFeePer1000),
      legalInterestRate: settings.globalLegalInterestRatePct.toFixed(2),
    },
  });

  // Re-hydrate the form whenever the persisted settings change. This keeps
  // the inputs in sync if a System Reset (or some other surface) writes to
  // the store while this tab is mounted.
  useEffect(() => {
    reset({
      pawnRate: settings.pawnRatePctPerMonth.toFixed(2),
      vehicleRate: settings.vehicleRatePctPerAnnum.toFixed(2),
      penaltyRate: settings.penaltyRatePctPerMonth.toFixed(2),
      processingFeePer1000: String(settings.processingFeePer1000),
      legalInterestRate: settings.globalLegalInterestRatePct.toFixed(2),
    });
  }, [settings, reset]);

  const onSubmit = (data: RatesForm) => {
    setSettings({
      pawnRatePctPerMonth: parseFloat(data.pawnRate || "0") || 0,
      vehicleRatePctPerAnnum: parseFloat(data.vehicleRate || "0") || 0,
      penaltyRatePctPerMonth: parseFloat(data.penaltyRate || "0") || 0,
      processingFeePer1000: parseInt(data.processingFeePer1000 || "0", 10) || 0,
      globalLegalInterestRatePct:
        parseFloat(data.legalInterestRate || "0") || 0,
    });
    toast.success("Global rates updated", {
      icon: <CheckCircle2 className="h-4 w-4" />,
      description: `Pawn ${data.pawnRate}% · Vehicle ${data.vehicleRate}% · Legal ${data.legalInterestRate}% · Fee ₹${data.processingFeePer1000}/₹1k`,
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
              label="Processing Fee (per ₹1,000)"
              htmlFor="processingFeePer1000"
              error={errors.processingFeePer1000?.message}
            >
              <RateInput
                id="processingFeePer1000"
                prefix="₹"
                placeholder="15"
                {...register("processingFeePer1000", {
                  required: "Required",
                  pattern: { value: /^\d+$/, message: "Enter a whole rupee amount" },
                })}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Auto-applied at origination — e.g. ₹15/₹1,000 charges ₹1,500
                on a ₹1,00,000 loan.
              </p>
            </FieldGroup>

            <FieldGroup
              label="Default Legal Interest Component (% p.a.)"
              htmlFor="legalInterestRate"
              error={errors.legalInterestRate?.message}
            >
              <RateInput
                id="legalInterestRate"
                suffix="%"
                placeholder="12.00"
                {...register("legalInterestRate", {
                  required: "Required",
                  pattern: {
                    value: /^\d+(\.\d{1,2})?$/,
                    message: "Enter a valid % (max 2 decimals)",
                  },
                })}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Portion of every interest receipt that is booked to the
                legal-rate ledger. Per-loan overrides set at origination win.
              </p>
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
