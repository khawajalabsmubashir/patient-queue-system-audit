import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  CalendarCheck,
  FileText,
  Pill,
  Receipt,
  Stethoscope,
  Ticket,
  X,
} from "lucide-react";
import { api } from "@/api/client";
import { Btn } from "@/components/qc";
import { useAuth } from "@/providers/auth-provider";
import { friendlyError } from "@/services/errors";
import { formatDateTime, formatFullDateTimeTooltip } from "@/domain/date-format";
import type { AppNotification } from "@/types/operations";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";

function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 639px)").matches
      : false,
  );
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return isMobile;
}

export function notificationHref(n: AppNotification, role: string) {
  const patient = role === "patient";
  switch (n.entity_type) {
    case "visit":
      return patient
        ? "/patient/dashboard"
        : "/admin/visits/" + encodeURIComponent(n.entity_id);
    case "prescription":
      return patient
        ? "/patient/dashboard"
        : "/admin/visits/" + encodeURIComponent(n.entity_id);
    case "invoice":
      return (
        (patient ? "/patient/billing" : "/admin/billing") +
        "?invoiceId=" +
        encodeURIComponent(n.entity_id)
      );
    case "document":
      return patient ? "/patient/documents" : "/admin/documents";
    case "appointment":
      return patient
        ? "/patient/appointments"
        : role === "admin"
          ? "/admin/appointments"
          : "/staff";
    default:
      return patient ? "/patient/dashboard" : role === "admin" ? "/admin/live-queue" : "/staff";
  }
}

function notificationMeta(n: AppNotification) {
  const kind = `${n.entity_type || ""} ${n.type || ""}`.toLowerCase();
  if (kind.includes("appointment")) {
    return {
      label: "Appointment",
      Icon: CalendarCheck,
      iconCls: "bg-primary-soft text-primary",
    };
  }
  if (kind.includes("prescription")) {
    return {
      label: "Prescription",
      Icon: Pill,
      iconCls: "bg-info-soft text-info",
    };
  }
  if (kind.includes("invoice") || kind.includes("payment") || kind.includes("billing")) {
    return {
      label: "Billing",
      Icon: Receipt,
      iconCls: "bg-warning-soft text-warning",
    };
  }
  if (kind.includes("document")) {
    return {
      label: "Document",
      Icon: FileText,
      iconCls: "bg-success-soft text-success",
    };
  }
  if (kind.includes("visit") || kind.includes("followup") || kind.includes("follow_up")) {
    return {
      label: "Visit",
      Icon: Stethoscope,
      iconCls: "bg-info-soft text-info",
    };
  }
  return {
    label: "Queue",
    Icon: Ticket,
    iconCls: "bg-primary-soft text-primary",
  };
}

export function NotificationCenter() {
  const { profile } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobileViewport();

  async function refresh() {
    try {
      setItems(await api<AppNotification[]>("/notifications"));
      setError("");
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  useEffect(() => {
    if (!profile) return;
    void refresh();
    const reload = () => void refresh();
    window.addEventListener("queuecare:refresh", reload);
    window.addEventListener("queuecare:updated", reload);
    const timer = setInterval(reload, 20000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("queuecare:refresh", reload);
      window.removeEventListener("queuecare:updated", reload);
    };
  }, [profile?.id]);

  async function read(id?: string) {
    try {
      await api(id ? "/notifications/" + id + "/read" : "/notifications/read-all", {
        method: "POST",
        body: {},
      });
      await refresh();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  useEffect(() => {
    if (!isMobile || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobile, open]);

  const unreadCount = items.filter((n) => !n.read_at).length;

  const panelBody = (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-foreground">Notifications</h2>
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {items.length > 0 && (
            <Btn
              variant="ghost"
              className="h-8 shrink-0 whitespace-nowrap px-2.5 text-xs"
              onClick={() => void read()}
            >
              Mark all read
            </Btn>
          )}
          <button
            type="button"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        {error && (
          <p role="alert" className="mx-2 my-1 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="space-y-1">
          {items.map((n) => {
            const meta = notificationMeta(n);
            const Icon = meta.Icon;
            const unread = !n.read_at;
            const href = notificationHref(n, profile?.role ?? "patient");
            return (
              <article
                key={n.id}
                className={
                  "group flex items-start gap-3 rounded-xl px-3 py-2.5 transition " +
                  (unread ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/60")
                }
              >
                <div
                  className={
                    "mt-0.5 grid size-9 shrink-0 place-items-center rounded-full " + meta.iconCls
                  }
                >
                  <Icon className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <a
                    href={href}
                    onClick={(e) => {
                      e.preventDefault();
                      setOpen(false);
                      void read(n.id).then(() => window.location.assign(href));
                    }}
                    className="block"
                  >
                    <p
                      className={
                        "text-sm leading-snug text-foreground " +
                        (unread ? "font-semibold" : "font-medium")
                      }
                    >
                      {n.title}
                    </p>
                    <p className="mt-0.5 break-words text-xs leading-relaxed text-muted-foreground">
                      {n.message}
                    </p>
                    <time
                      dateTime={n.created_at}
                      title={formatFullDateTimeTooltip(n.created_at)}
                      className={
                        "tabular-nums mt-1 block text-[11px] " +
                        (unread ? "font-semibold text-primary" : "text-muted-foreground")
                      }
                    >
                      {formatDateTime(n.created_at)}
                    </time>
                  </a>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5 pt-1">
                  {unread ? (
                    <>
                      <span
                        className="size-2.5 rounded-full bg-primary"
                        aria-label="Unread notification"
                      />
                      <button
                        type="button"
                        className="text-[11px] font-medium text-primary hover:underline"
                        onClick={() => void read(n.id)}
                      >
                        Mark read
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        {!items.length && !error && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            You’re all caught up.
          </p>
        )}
      </div>
    </>
  );

  const bellTrigger = (
    <button
      type="button"
      aria-label="Notifications"
      aria-expanded={open}
      onClick={isMobile ? () => setOpen((v) => !v) : undefined}
      onKeyDown={
        isMobile
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpen((v) => !v);
              }
            }
          : undefined
      }
      className="relative grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Bell className="size-[18px]" aria-hidden="true" />
      {unreadCount > 0 && (
        <span className="tabular absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
          {unreadCount}
        </span>
      )}
    </button>
  );

  if (isMobile) {
    const mobileOverlay = open ? (
      <div className="fixed inset-0 z-50 flex flex-col justify-end" role="presentation">
        <div
          className="fixed inset-0 bg-black/35 backdrop-blur-[1px]"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
        <section
          role="dialog"
          aria-label="Notifications"
          className="relative z-10 flex max-h-[65dvh] w-full flex-col overflow-hidden rounded-t-2xl border-t border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-2xl"
        >
          <div className="flex shrink-0 justify-center pt-2">
            <span className="h-1 w-10 rounded-full bg-border" aria-hidden="true" />
          </div>
          {panelBody}
        </section>
      </div>
    ) : null;

    return (
      <>
        {bellTrigger}
        {mobileOverlay &&
          (typeof document !== "undefined"
            ? createPortal(mobileOverlay, document.body)
            : mobileOverlay)}
      </>
    );
  }

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{bellTrigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="flex max-h-[min(70dvh,32rem)] w-[23rem] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl p-0 shadow-lg"
      >
        {panelBody}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
