import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Building2,
  CheckCircle2,
  IndianRupee,
  Percent,
  Plus,
  Settings as SettingsIcon,
  ShieldCheck,
  Users as UsersIcon,
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

const inputBaseStyle: React.CSSProperties = {
  borderColor: "rgba(74,111,165,0.20)",
  "--tw-ring-color": "var(--brand-light)",
} as React.CSSProperties;

type BranchForm = {
  branchName: string;
  branchCode: string;
  gstin: string;
  address: string;
  contact: string;
};

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
            Admin control center — branch profile, staff access, and global financial parameters.
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
      </Tabs>
    </div>
  );
}

/* -------------------- Tab 1: Branch Profile -------------------- */

function BranchProfileTab() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BranchForm>({
    defaultValues: {
      branchName: "Kittangi Main",
      branchCode: "KTG-001",
      gstin: "29ABCDE1234F1Z5",
      address: "No. 14, MG Road, Bengaluru, Karnataka — 560001",
      contact: "+91 98450 12345",
    },
  });

  const onSubmit = (data: BranchForm) => {
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
              Identification, address, and tax registration details for this branch.
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

/* -------------------- Helpers -------------------- */

function FieldGroup({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
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
