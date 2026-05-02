import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  FileText,
  Filter,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import PhotoCapture from "@/components/shared/PhotoCapture";
import CustomerLedgerSheet from "@/components/modules/CustomerLedgerSheet";
import {
  addCustomer,
  deleteCustomer,
  updateCustomer,
  useCustomers,
  type Customer,
  type KycStatus,
} from "@/lib/stores/customersStore";
import {
  getCurrentActor,
  logActivity,
} from "@/lib/stores/activityLogStore";

type KycFilter = "ALL" | KycStatus;

type CustomerForm = {
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  email: string;
  kycStatus: KycStatus;
  aadhar: string;
  pan: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
};

const CUSTOMER_ICON_TONES = [
  { bg: "rgba(59,130,246,0.14)", fg: "#1d4ed8" },
  { bg: "rgba(16,185,129,0.14)", fg: "#047857" },
  { bg: "rgba(245,158,11,0.14)", fg: "#b45309" },
  { bg: "rgba(239,68,68,0.14)", fg: "#030213" },
  { bg: "rgba(168,85,247,0.14)", fg: "#7e22ce" },
] as const;

function pickTone(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return CUSTOMER_ICON_TONES[hash % CUSTOMER_ICON_TONES.length];
}

function StatusBadge({ status }: { status: KycStatus }) {
  const styles: Record<KycStatus, { bg: string; color: string; border: string }> = {
    Verified: {
      bg: "rgba(34, 197, 94, 0.12)",
      color: "#15803D",
      border: "rgba(34, 197, 94, 0.30)",
    },
    Pending: {
      bg: "rgba(234, 179, 8, 0.14)",
      color: "#A16207",
      border: "rgba(234, 179, 8, 0.35)",
    },
    Rejected: {
      bg: "rgba(239, 68, 68, 0.12)",
      color: "#030213",
      border: "rgba(239, 68, 68, 0.30)",
    },
  };
  const s = styles[status];
  return (
    <Badge
      variant="outline"
      className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{
        backgroundColor: s.bg,
        color: s.color,
        borderColor: s.border,
      }}
    >
      <span
        className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: s.color }}
      />
      {status}
    </Badge>
  );
}

function FormSection({
  title,
  step,
  description,
  children,
}: {
  title: string;
  step: number;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          {step}
        </div>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>
            {title}
          </h3>
          {description ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 pl-10">{children}</div>
    </section>
  );
}

function FieldGroup({
  id,
  label,
  required,
  full,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "col-span-2 space-y-1.5" : "space-y-1.5"}>
      <Label
        htmlFor={id}
        className="text-xs font-medium"
        style={{ color: "var(--text-main)" }}
      >
        {label}
        {required ? (
          <span style={{ color: "#030213" }} className="ml-0.5">
            *
          </span>
        ) : null}
      </Label>
      {children}
    </div>
  );
}

function FileDropzone({
  label,
  fileName,
  onFile,
  onClear,
}: {
  label: string;
  fileName: string | null;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className="col-span-2 rounded-lg border-2 border-dashed px-4 py-5 transition-colors"
      style={{
        borderColor: isOver ? "var(--brand-primary)" : "var(--brand-light)",
        backgroundColor: isOver ? "rgba(74,111,165,0.04)" : "rgba(233,244,251,0.4)",
      }}
    >
      {fileName ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-main)" }}>
            <FileText size={16} style={{ color: "#000000" }} />
            <span className="font-medium">{fileName}</span>
            <span style={{ color: "var(--text-muted)" }}>· uploaded</span>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="rounded-full p-1 transition-colors hover:bg-black/5"
            aria-label="Remove file"
          >
            <X size={14} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 text-center">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--brand-light)" }}
          >
            <Upload size={16} style={{ color: "#000000" }} />
          </div>
          <div className="text-xs">
            <span className="font-semibold" style={{ color: "#000000" }}>
              Click to upload
            </span>{" "}
            <span style={{ color: "var(--text-muted)" }}>or drag and drop</span>
          </div>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {label} · PDF, JPG, PNG (max 5MB)
          </p>
          <input
            type="file"
            className="hidden"
            accept="image/*,application/pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </label>
      )}
    </div>
  );
}

const inputClass =
  "h-9 rounded-md border bg-white text-sm outline-none transition-colors focus:ring-2";
const inputStyle = {
  borderColor: "rgba(74,111,165,0.20)",
  "--tw-ring-color": "var(--brand-light)",
} as React.CSSProperties;

function CustomerDrawer({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  editing: Customer | null;
}) {
  const isEdit = !!editing;
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CustomerForm>({
    defaultValues: {
      firstName: "",
      lastName: "",
      dob: "",
      phone: "",
      email: "",
      kycStatus: "Pending",
      aadhar: "",
      pan: "",
      street: "",
      city: "",
      state: "",
      pincode: "",
    },
  });

  const [aadharFile, setAadharFile] = useState<string | null>(null);
  const [panFile, setPanFile] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  // When the drawer opens, hydrate the form. Splits the stored fullName so the
  // user still sees a familiar first / last name pair while editing.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      const parts = editing.fullName.trim().split(/\s+/);
      const first = parts.shift() ?? "";
      const last = parts.join(" ");
      reset({
        firstName: first,
        lastName: last,
        dob: editing.dob ?? "",
        phone: editing.phone,
        email: editing.email,
        kycStatus: editing.kycStatus,
        aadhar: editing.aadhar ?? "",
        pan: editing.pan ?? "",
        street: editing.address?.street ?? "",
        city: editing.address?.city ?? "",
        state: editing.address?.state ?? "",
        pincode: editing.address?.pincode ?? "",
      });
      setPhoto(editing.photoDataUrl ?? null);
      setAadharFile(null);
      setPanFile(null);
    } else {
      reset({
        firstName: "",
        lastName: "",
        dob: "",
        phone: "",
        email: "",
        kycStatus: "Pending",
        aadhar: "",
        pan: "",
        street: "",
        city: "",
        state: "",
        pincode: "",
      });
      setPhoto(null);
      setAadharFile(null);
      setPanFile(null);
    }
  }, [open, editing, reset]);

  const kycStatus = watch("kycStatus");

  const onSubmit = (data: CustomerForm) => {
    const fullName = `${data.firstName} ${data.lastName}`.trim();
    const address = {
      street: data.street,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
    };
    if (isEdit && editing) {
      updateCustomer(editing.id, {
        fullName,
        phone: data.phone,
        email: data.email,
        kycStatus: data.kycStatus,
        photoDataUrl: photo ?? undefined,
        dob: data.dob,
        aadhar: data.aadhar,
        pan: data.pan,
        address,
      });
      toast.success("Customer updated", {
        description: `${fullName} saved to the registry.`,
      });
    } else {
      const created = addCustomer({
        fullName,
        phone: data.phone,
        email: data.email,
        kycStatus: data.kycStatus,
        photoDataUrl: photo ?? undefined,
        dob: data.dob,
        aadhar: data.aadhar,
        pan: data.pan,
        address,
      });
      try {
        logActivity({
          actor: getCurrentActor(),
          kind: "CUSTOMER",
          summary: `Customer ${created.fullName} added (${created.id})`,
          link: `/customers/${created.id}`,
        });
      } catch {
        /* best effort */
      }
      toast.success("Customer saved", {
        description: `${created.fullName} added · ID ${created.id}`,
      });
    }
    onOpenChange(false);
  };

  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-xl"
        style={{ backgroundColor: "#fff" }}
      >
        <SheetHeader
          className="border-b px-6 py-5"
          style={{ borderColor: "rgba(74,111,165,0.10)" }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: "var(--brand-light)" }}
            >
              {isEdit ? (
                <Pencil size={18} style={{ color: "#000000" }} />
              ) : (
                <UserPlus size={18} style={{ color: "#000000" }} />
              )}
            </div>
            <div>
              <SheetTitle
                className="text-lg font-bold"
                style={{ color: "#000000" }}
              >
                {isEdit ? "Edit Customer" : "Add New Customer"}
              </SheetTitle>
              <SheetDescription
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                {isEdit
                  ? `Update KYC details for ${editing?.fullName}.`
                  : "Capture KYC details to onboard a customer to the global registry."}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
            {/* Step 1 — Profile photo */}
            <FormSection
              step={1}
              title="Profile Photo"
              description="Capture a clear face photo or upload one from disk."
            >
              <div className="col-span-2">
                <PhotoCapture
                  value={photo}
                  onChange={setPhoto}
                  label="Customer Photo"
                />
              </div>
            </FormSection>

            <FormSection
              step={2}
              title="Personal Details"
              description="Basic identifying information."
            >
              <FieldGroup id="firstName" label="First Name" required>
                <Input
                  id="firstName"
                  className={inputClass}
                  style={inputStyle}
                  placeholder="Aanya"
                  {...register("firstName", { required: true })}
                />
                {errors.firstName ? (
                  <p className="text-[11px]" style={{ color: "#030213" }}>
                    First name is required.
                  </p>
                ) : null}
              </FieldGroup>
              <FieldGroup id="lastName" label="Last Name" required>
                <Input
                  id="lastName"
                  className={inputClass}
                  style={inputStyle}
                  placeholder="Sharma"
                  {...register("lastName", { required: true })}
                />
                {errors.lastName ? (
                  <p className="text-[11px]" style={{ color: "#030213" }}>
                    Last name is required.
                  </p>
                ) : null}
              </FieldGroup>
              <FieldGroup id="dob" label="Date of Birth" required>
                <Input
                  id="dob"
                  type="date"
                  className={inputClass}
                  style={inputStyle}
                  {...register("dob", { required: true })}
                />
              </FieldGroup>
              <FieldGroup id="phone" label="Phone Number" required>
                <Input
                  id="phone"
                  type="tel"
                  className={inputClass}
                  style={inputStyle}
                  placeholder="+91 98212 44510"
                  {...register("phone", { required: true })}
                />
              </FieldGroup>
              <FieldGroup id="email" label="Email" required full>
                <Input
                  id="email"
                  type="email"
                  className={inputClass}
                  style={inputStyle}
                  placeholder="customer@gmail.com"
                  {...register("email", { required: true })}
                />
                {errors.email ? (
                  <p className="text-[11px]" style={{ color: "#030213" }}>
                    Email is required.
                  </p>
                ) : null}
              </FieldGroup>
              <FieldGroup id="kycStatus" label="KYC Status" required full>
                <Select
                  value={kycStatus}
                  onValueChange={(v) => setValue("kycStatus", v as KycStatus)}
                >
                  <SelectTrigger
                    id="kycStatus"
                    className="h-9 w-full bg-white text-sm"
                    style={inputStyle}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Verified">Verified</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </FieldGroup>
            </FormSection>

            <FormSection
              step={3}
              title="KYC Documents"
              description="Government-issued identity proofs."
            >
              <FieldGroup id="aadhar" label="Aadhar Number" required>
                <Input
                  id="aadhar"
                  className={inputClass}
                  style={inputStyle}
                  placeholder="XXXX XXXX XXXX"
                  {...register("aadhar", { required: true })}
                />
              </FieldGroup>
              <FieldGroup id="pan" label="PAN Number" required>
                <Input
                  id="pan"
                  className={inputClass}
                  style={inputStyle}
                  placeholder="ABCDE1234F"
                  {...register("pan", { required: true })}
                />
              </FieldGroup>
              <FileDropzone
                label="Aadhar Card upload"
                fileName={aadharFile}
                onFile={(f) => setAadharFile(f.name)}
                onClear={() => setAadharFile(null)}
              />
              <FileDropzone
                label="PAN Card upload"
                fileName={panFile}
                onFile={(f) => setPanFile(f.name)}
                onClear={() => setPanFile(null)}
              />
            </FormSection>

            <FormSection
              step={4}
              title="Address Details"
              description="Current residential address."
            >
              <FieldGroup id="street" label="Street" required full>
                <Input
                  id="street"
                  className={inputClass}
                  style={inputStyle}
                  placeholder="14, Brigade Road"
                  {...register("street", { required: true })}
                />
              </FieldGroup>
              <FieldGroup id="city" label="City" required>
                <Input
                  id="city"
                  className={inputClass}
                  style={inputStyle}
                  placeholder="Bengaluru"
                  {...register("city", { required: true })}
                />
              </FieldGroup>
              <FieldGroup id="state" label="State" required>
                <Input
                  id="state"
                  className={inputClass}
                  style={inputStyle}
                  placeholder="Karnataka"
                  {...register("state", { required: true })}
                />
              </FieldGroup>
              <FieldGroup id="pincode" label="Pincode" required>
                <Input
                  id="pincode"
                  className={inputClass}
                  style={inputStyle}
                  placeholder="560001"
                  {...register("pincode", { required: true })}
                />
              </FieldGroup>
            </FormSection>
          </div>

          <div
            className="flex items-center justify-end gap-3 border-t bg-white px-6 py-4"
            style={{ borderColor: "rgba(74,111,165,0.10)" }}
          >
            <Button
              type="button"
              variant="outline"
              onClick={close}
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
              type="submit"
              disabled={isSubmitting}
              className="h-9 px-4 text-white"
              style={{
                backgroundColor: "var(--brand-primary)",
              }}
            >
              {isEdit ? (
                <>
                  <Pencil size={16} className="mr-1.5" />
                  Save Changes
                </>
              ) : (
                <>
                  <UserPlus size={16} className="mr-1.5" />
                  Save Customer
                </>
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function CustomerAvatar({ customer }: { customer: Customer }) {
  const tone = pickTone(customer.id || customer.fullName);
  if (customer.photoDataUrl) {
    return (
      <img
        src={customer.photoDataUrl}
        alt={customer.fullName}
        className="h-9 w-9 rounded-full object-cover ring-2"
        style={{
          // @ts-expect-error CSS var
          "--tw-ring-color": tone.bg,
        }}
      />
    );
  }
  const initials = customer.fullName
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");
  return (
    <div
      className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold"
      style={{
        backgroundColor: tone.bg,
        color: tone.fg,
        boxShadow: `inset 0 0 0 1px ${tone.fg}33`,
      }}
      aria-hidden
    >
      {initials || "?"}
    </div>
  );
}

export default function Customers() {
  const customers = useCustomers();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Customer | null>(null);
  const [viewing, setViewing] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<KycFilter>("ALL");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      const matchesSearch =
        !q ||
        c.fullName.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "ALL" || c.kycStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter, customers]);

  const openAdd = () => {
    setEditing(null);
    setDrawerOpen(true);
  };
  const openEdit = (c: Customer) => {
    setEditing(c);
    setDrawerOpen(true);
  };
  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteCustomer(pendingDelete.id);
    toast.success("Customer deleted", {
      description: `${pendingDelete.fullName} removed from the registry.`,
    });
    setPendingDelete(null);
  };

  return (
    <div className="mx-auto max-w-7xl">
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
            <Users size={22} style={{ color: "#1d4ed8" }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold text-slate-900"
            >
              Global Customers
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Unified customer registry across Pawn and Vehicle verticals.
            </p>
          </div>
        </div>

        <Button
          onClick={openAdd}
          className="h-10 px-4 text-sm font-semibold text-white shadow-sm"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          <Plus size={16} className="mr-1.5" />
          Add New Customer
        </Button>
      </div>

      {/* Filters Card */}
      <div
        className="mb-4 rounded-xl border bg-white p-4"
        style={{ borderColor: "rgba(74,111,165,0.10)" }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex min-w-65 flex-1 items-center gap-2 rounded-lg border bg-white px-3 py-2 transition-colors focus-within:ring-4"
            style={{
              borderColor: "rgba(74,111,165,0.18)",
              // @ts-expect-error CSS var
              "--tw-ring-color": "var(--brand-light)",
            }}
          >
            <Search size={16} style={{ color: "var(--text-muted)" }} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-text-muted"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={14} style={{ color: "var(--text-muted)" }} />
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as KycFilter)}
            >
              <SelectTrigger
                className="h-10 w-45 rounded-lg border bg-white text-sm"
                style={{
                  borderColor: "rgba(74,111,165,0.18)",
                  color: "var(--text-main)",
                }}
              >
                <SelectValue placeholder="KYC Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All KYC Statuses</SelectItem>
                <SelectItem value="Verified">Verified</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div
        className="overflow-hidden rounded-xl border bg-white"
        style={{ borderColor: "rgba(74,111,165,0.10)" }}
      >
        <Table>
          <TableHeader>
            <TableRow
              className="hover:bg-transparent"
              style={{ backgroundColor: "rgba(233,244,251,0.55)" }}
            >
              <TableHead
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Customer
              </TableHead>
              <TableHead
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Customer ID
              </TableHead>
              <TableHead
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Contact Info
              </TableHead>
              <TableHead
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                KYC Status
              </TableHead>
              <TableHead
                className="text-right text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Active Loans
              </TableHead>
              <TableHead
                className="text-right text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <FileText size={20} style={{ color: "var(--text-muted)" }} />
                    <p
                      className="text-sm font-medium"
                      style={{ color: "var(--text-main)" }}
                    >
                      No customers found
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Try adjusting your search or filters.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow
                  key={c.id}
                  onClick={() => setViewing(c)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setViewing(c);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open Customer 360 for ${c.fullName}`}
                  className="cursor-pointer transition-colors hover:bg-slate-50/70 focus:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-light"
                  style={{ borderColor: "rgba(74,111,165,0.08)" }}
                >
                  <TableCell className="py-3">
                    <div className="flex items-center gap-3">
                      <CustomerAvatar customer={c} />
                      <span
                        className="text-left text-sm font-semibold"
                        style={{ color: "#000000" }}
                      >
                        {c.fullName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell
                    className="font-mono text-xs"
                    style={{ color: "#000000" }}
                  >
                    {c.id}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div style={{ color: "var(--text-main)" }}>{c.phone}</div>
                    <div style={{ color: "var(--text-muted)" }}>{c.email}</div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={c.kycStatus} />
                  </TableCell>
                  <TableCell className="text-right">
                    {c.activeLoans > 0 ? (
                      <span
                        className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold"
                        style={{
                          backgroundColor: "var(--brand-light)",
                          color: "#000000",
                        }}
                      >
                        {c.activeLoans}
                      </span>
                    ) : (
                      <span
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        —
                      </span>
                    )}
                  </TableCell>
                  <TableCell
                    className="text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(c);
                        }}
                        className="h-8 w-8 p-0"
                        style={{ color: "#000000" }}
                        aria-label={`Edit ${c.fullName}`}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDelete(c);
                        }}
                        className="h-8 w-8 p-0"
                        style={{ color: "#B91C1C" }}
                        aria-label={`Delete ${c.fullName}`}
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

        <div
          className="flex items-center justify-between border-t px-4 py-3 text-xs"
          style={{
            borderColor: "rgba(74,111,165,0.08)",
            color: "var(--text-muted)",
          }}
        >
          <span>
            Showing <strong style={{ color: "var(--text-main)" }}>{filtered.length}</strong>{" "}
            of {customers.length} customers
          </span>
          <span>Saved locally · persists across page refreshes</span>
        </div>
      </div>

      <CustomerDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        editing={editing}
      />

      <CustomerLedgerSheet
        customer={viewing}
        open={!!viewing}
        onOpenChange={(o) => {
          if (!o) setViewing(null);
        }}
      />

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <strong>{pendingDelete?.fullName}</strong> ({pendingDelete?.id})
              from the registry. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              style={{ backgroundColor: "#B91C1C", color: "#fff" }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
