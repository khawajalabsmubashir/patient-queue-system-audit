import { useEffect, useMemo, useState } from "react";
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
import {
  clinicTodayKey,
  clinicYesterdayKey,
  formatDateTime,
  formatFullDateTimeTooltip,
  toClinicDayKey,
} from "@/domain/date-format";
import type { AppNotification } from "@/types/operations";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";

type DateFilter = "all" | "today" | "yesterday";

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
        ? "/patient/visit/" + encodeURIComponent(n.entity_id)
        : "/admin/visits/" + encodeURIComponent(n.entity_id);
    case "prescription":
      return "/patient/prescription/" + encodeURIComponent(n.entity_id);
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
      return patient ? "/patient/live-queue" : role === "admin" ? "/admin/live-queue" : "/staff";
  }
}

function notificationMeta(n: AppNotification) {
  const kind = `${n.entity_type || ""} ${n.type || ""}`.toLowerCase();
  if (kind.includes("appointment")) {
    return {
      label: "Appointment",
      Icon: CalendarCheck,
      iconCls: "bg-primary-soft text-primary",
      badgeCls: "bg-primary-soft text-primary",
    };
  }
  if (kind.includes("prescription")) {
    return {
      label: "Prescription",
      Icon: Pill,
      iconCls: "bg-info-soft text-info",
      badgeCls: "bg-info-soft text-info",
    };
  }
  if (kind.includes("invoice") || kind.includes("payment") || kind.includes("billing")) {
    return {
      label: "Billing",
      Icon: Receipt,
      iconCls: "bg-warning-soft text-warning",
      badgeCls: "bg-warning-soft text-warning",
    };
  }
  if (kind.includes("document")) {
    return {
      label: "Document",
      Icon: FileText,
      iconCls: "bg-success-soft text-success",
      badgeCls: "bg-success-soft text-success",
    };
  }
  if (kind.includes("visit") || kind.includes("followup") || kind.includes("follow_up")) {
    return {
      label: "Visit",
      Icon: Stethoscope,
      iconCls: "bg-info-soft text-info",
      badgeCls: "bg-info-soft text-info",
    };
  }
  return {
    label: "Queue",
    Icon: Ticket,
    iconCls: "bg-primary-soft text-primary",
    badgeCls: "bg-muted text-muted-foreground",
  };
}

export function NotificationCenter() {
  const { profile } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<DateFilter>("all");
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

  const todayKey = clinicTodayKey();
  const yesterdayKey = clinicYesterdayKey();

  const grouped = useMemo(() => {
    const todayItems: AppNotification[] = [];
    const yesterdayItems: AppNotification[] = [];
    const olderItems: AppNotification[] = [];
    for (const item of items) {
      const day = toClinicDayKey(item.created_at);
      if (day === todayKey) todayItems.push(item);
      else if (day === yesterdayKey) yesterdayItems.push(item);
      else olderItems.push(item);
    }
    const groups: { key: "today" | "yesterday" | "older"; label: string; list: AppNotification[] }[] = [];
    if ((filter === "all" || filter === "today") && todayItems.length) {
      groups.push({ key: "today", label: "Today", list: todayItems });
    }
    if ((filter === "all" || filter === "yesterday") && yesterdayItems.length) {
      groups.push({ key: "yesterday", label: "Yesterday", list: yesterdayItems });
    }
    if (filter === "all" && olderItems.length) {
      groups.push({ key: "older", label: "Older", list: olderItems });
    }
    return groups;
  }, [items, filter, todayKey, yesterdayKey]);

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
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-foreground">Notifications</h2>
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Btn
            variant="ghost"
            className="h-8 shrink-0 whitespace-nowrap px-2.5 text-xs"
            onClick={() => void read()}
          >
            Mark all read
          </Btn>
          <button
            type="button"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
        {error && (
          <p role="alert" className="mb-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="space-y-2">
          {items.map((n) => {
            const meta = notificationMeta(n);
            const Icon = meta.Icon;
            const unread = !n.read_at;
            return (
              <article
                key={n.id}
                className={
                  "rounded-xl border px-3.5 py-3 transition " +
                  (unread
                    ? "border-primary/30 bg-primary/5"
                    : "border-border/60 bg-card hover:bg-muted/40")
                }
              >
                <div className="flex items-start gap-3">
                  <div
                    className={"mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg " + meta.iconCls}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <a
                      href={notificationHref(n, profile?.role ?? "patient")}
                      onClick={(e) => {
                        e.preventDefault();
                        setOpen(false);
                        void read(n.id).then(() =>
                          window.location.assign(
                            notificationHref(n, profile?.role ?? "patient"),
                          ),
                        );
                      }}
                      className="block"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span
                          className={"inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold " + meta.badgeCls}
                        >
                          {meta.label}
                        </span>
                        <time
                          dateTime={n.created_at}
                          title={formatFullDateTimeTooltip(n.created_at)}
                          className="tabular-nums text-[11px] text-muted-foreground"
                        >
                          {formatDateTime(n.created_at)}
                        </time>
                      </div>
                      <p className="mt-1 text-sm font-medium text-foreground">{n.title}</p>
                      <p className="mt-0.5 break-words text-xs leading-relaxed text-muted-foreground">
                        {n.message}
                      </p>
                    </a>
                    {unread && (
                      <button
                        type="button"
                        className="mt-1.5 text-xs font-medium text-primary hover:underline"
                        onClick={() => void read(n.id)}
                      >
                        Mark read
                      </button>
                    )}
                  </div>
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

  return (
                    <article
                      key={n.id}
                      className={
                        "rounded-lg border px-3.5 py-2.5 transition " +
                        (unread
                          ? "border-primary/30 bg-primary/5"
                          : "border-border/60 bg-card hover:bg-muted/40")
                      }
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${meta.iconCls}`}
                        >
                          <Icon className="size-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <a
                            href={notificationHref(n, profile?.role ?? "patient")}
                            onClick={(e) => {
                              e.preventDefault();
                              setOpen(false);
                              void read(n.id).then(() =>
                                window.location.assign(
                                  notificationHref(n, profile?.role ?? "patient"),
                                ),
                              );
                            }}
                            className="block"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <span
                                className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${meta.badgeCls}`}
                              >
                                {meta.label}
                              </span>
                              <time
                                dateTime={n.created_at}
                                title={formatFullDateTimeTooltip(n.created_at)}
                                className="tabular-nums text-[11px] text-muted-foreground"
                              >
                                {formatDateTime(n.created_at)}
                              </time>
                            </div>
                            <p className="mt-1 text-sm font-medium text-foreground">{n.title}</p>
                            <p className="mt-0.5 break-words text-xs leading-relaxed text-muted-foreground">
                              {n.message}
                            </p>
                          </a>
                          {unread && (
                            <button
                              type="button"
                              className="mt-1.5 text-xs font-medium text-primary hover:underline"
                              onClick={() => void read(n.id)}
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {!grouped.length && !error && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {items.length ? `No notifications for ${filter}.` : "You’re all caught up."}
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
        className="flex max-h-[min(70dvh,32rem)] w-[25rem] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl p-0 shadow-lg"
      >
        {panelBody}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
