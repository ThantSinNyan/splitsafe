import {
  ArrowUpRight,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative flex size-10 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
        <div className="absolute inset-0 rounded-2xl bg-[linear-gradient(135deg,rgba(45,212,191,0.38),transparent_55%)]" />
        <ShieldCheck className="relative size-5" aria-hidden="true" />
      </div>
      {!compact ? (
        <div className="min-w-0">
          <p className="truncate text-base font-semibold tracking-tight text-slate-950">
            SplitSafe
          </p>
          <p className="truncate text-xs font-medium text-slate-500">
            Onchain group finance
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "slate",
  className,
}: {
  children: React.ReactNode;
  tone?: "teal" | "green" | "amber" | "rose" | "slate" | "blue";
  className?: string;
}) {
  const tones = {
    teal: "border-teal-200 bg-teal-50 text-teal-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    slate: "border-slate-200 bg-slate-50 text-slate-600",
    blue: "border-sky-200 bg-sky-50 text-sky-700",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionCard({
  children,
  className,
  elevated = false,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      {...props}
      className={cn(
        "rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_22px_70px_rgba(15,23,42,0.06)]",
        elevated && "shadow-[0_28px_90px_rgba(15,23,42,0.10)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-600">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "teal",
}: {
  label: string;
  value: string;
  detail?: string;
  icon: LucideIcon;
  tone?: "teal" | "green" | "amber" | "slate" | "blue";
}) {
  const tones = {
    teal: "from-teal-500/16 to-cyan-400/8 text-teal-700",
    green: "from-emerald-500/16 to-teal-400/8 text-emerald-700",
    amber: "from-amber-500/18 to-orange-400/8 text-amber-700",
    slate: "from-slate-500/12 to-slate-300/8 text-slate-700",
    blue: "from-sky-500/16 to-cyan-400/8 text-sky-700",
  };

  return (
    <div className="group relative overflow-hidden rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-[0_22px_70px_rgba(15,23,42,0.06)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-400 via-cyan-300 to-emerald-300 opacity-80" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
            {value}
          </p>
          {detail ? (
            <p className="mt-2 text-sm leading-5 text-slate-500">{detail}</p>
          ) : null}
        </div>
        <div
          className={cn(
            "flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br shadow-inner",
            tones[tone],
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

export function PrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(15,23,42,0.20)] hover:-translate-y-0.5 hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-teal-200",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 shadow-sm hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

export const fieldClassName =
  "h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-100";

export const textareaClassName =
  "min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-100";

export function ProgressBar({
  value,
  danger = false,
  className,
}: {
  value: number;
  danger?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("h-3 overflow-hidden rounded-full bg-slate-100", className)}>
      <div
        className={cn(
          "h-full rounded-full shadow-[0_0_24px_rgba(20,184,166,0.32)]",
          danger
            ? "bg-gradient-to-r from-rose-400 to-amber-400"
            : "bg-gradient-to-r from-teal-400 via-cyan-400 to-emerald-400",
        )}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-60 flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-gradient-to-b from-white to-slate-50/80 px-6 py-10 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-white text-teal-600 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <h3 className="mt-5 text-lg font-semibold tracking-tight text-slate-950">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function AvatarToken({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-950 to-slate-700 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)]",
        className,
      )}
    >
      {initials || "S"}
    </span>
  );
}

export function LinkArrow({ label = "Open" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700">
      {label}
      <ArrowUpRight className="size-4" aria-hidden="true" />
    </span>
  );
}
