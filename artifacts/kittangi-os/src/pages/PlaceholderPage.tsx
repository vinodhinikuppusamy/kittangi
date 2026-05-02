import type { LucideIcon } from "lucide-react";

type Props = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export default function PlaceholderPage({ title, description, icon: Icon }: Props) {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ backgroundColor: "var(--brand-light)" }}
        >
          <Icon size={22} style={{ color: "var(--text-main)" }} />
        </div>
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--text-main)" }}
          >
            {title}
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {description}
          </p>
        </div>
      </div>

      <div
        className="rounded-2xl border bg-white p-8"
        style={{ borderColor: "rgba(74,111,165,0.10)" }}
      >
        <div
          className="rounded-xl border-2 border-dashed p-10 text-center"
          style={{
            borderColor: "var(--brand-light)",
            color: "var(--text-muted)",
          }}
        >
          <p className="text-sm">
            This screen is reserved for{" "}
            <span style={{ color: "var(--text-main)" }} className="font-semibold">
              {title}
            </span>
            . Modules will appear here in upcoming steps.
          </p>
        </div>
      </div>
    </div>
  );
}
