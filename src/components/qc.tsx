import { useId, useState, useSyncExternalStore } from "react";
import { Eye, EyeOff } from "lucide-react";
import { TemporalInput } from "@/components/form-controls";
import { subscribePending, isQueueActionPending } from "@/services/queue";
import { cn } from "@/lib/utils";
import type { Status } from "@/lib/queue-store";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Logo({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </div>
      {subtitle ? (
        <div className="min-w-0">
          <span className="block min-w-0 truncate text-[15px] font-semibold leading-tight tracking-tight">
            Neuro Spine Care Center
          </span>
          <span className="hidden text-xs font-normal text-muted-foreground sm:block">
            {subtitle}
          </span>
        </div>
      ) : (
        <span className="min-w-0 truncate text-[15px] font-semibold leading-tight tracking-tight">
          Neuro Spine Care Center
        </span>
      )}
    </div>
  );
}

const statusMap: Record<Status, { label: string; cls: string }> = {
  reserved: { label: "Reserved", cls: "bg-primary-soft text-primary" },
  waiting: { label: "Waiting", cls: "bg-warning-soft text-warning" },
  serving: { label: "Serving", cls: "bg-info-soft text-info" },
  done: { label: "Completed", cls: "bg-success-soft text-success" },
  skipped: { label: "Skipped", cls: "bg-muted text-muted-foreground" },
  left: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
};

export function StatusPill({ status }: { status: Status }) {
  const s = statusMap[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        s.cls,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

export function LiveDot({ className }: { className?: string }) {
  return <span className={cn("live-dot inline-block size-2 rounded-full bg-current", className)} />;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "lg";
};

export function Btn({ variant = "primary", size = "md", className, ...p }: BtnProps) {
  const pending = useSyncExternalStore(subscribePending, isQueueActionPending, () => false);
  return (
    <button
      {...p}
      disabled={p.disabled || pending}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        size === "md" ? "h-10 px-4 text-sm" : "h-12 px-5 text-[15px]",
        variant === "primary" &&
          "bg-primary text-primary-foreground shadow-soft hover:bg-primary-hover",
        variant === "secondary" && "border border-border bg-card text-foreground hover:bg-muted",
        variant === "ghost" && "text-muted-foreground hover:bg-muted hover:text-foreground",
        variant === "danger" && "text-destructive hover:bg-destructive/10",
        className,
      )}
    />
  );
}

export function PageHeader({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="break-words [overflow-wrap:anywhere] text-[28px] font-semibold tracking-tight md:text-[32px]">
          {title}
        </h1>
        {sub && (
          <p className="mt-1.5 break-words [overflow-wrap:anywhere] text-[15px] text-muted-foreground">
            {sub}
          </p>
        )}
      </div>
      {right}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </div>
  );
}

export function Field({
  label,
  ...p
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId();
  const [showPassword, setShowPassword] = useState(false);

  if (["date", "time", "datetime-local"].includes(p.type ?? "")) {
    const id = p.id ?? generatedId;
    return (
      <div className="block">
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
          {label}
        </label>
        <TemporalInput {...p} id={id} aria-label={p["aria-label"] ?? label} />
      </div>
    );
  }

  if (p.type === "password") {
    const id = p.id ?? generatedId;
    return (
      <div className="block">
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
          {label}
        </label>
        <div className="relative">
          <input
            {...p}
            id={id}
            type={showPassword ? "text" : "password"}
            className={cn(
              "h-11 w-full rounded-lg border border-input bg-card pl-3.5 pr-11 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10",
              p.className,
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? `Hide ${label}` : `Show ${label}`}
            aria-pressed={showPassword}
            className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input
        {...p}
        className={cn(
          "h-11 w-full rounded-lg border border-input bg-card px-3.5 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10",
          p.className,
        )}
      />
    </label>
  );
}
