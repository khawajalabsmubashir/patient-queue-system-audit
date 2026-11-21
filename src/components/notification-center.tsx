import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarCheck,
  FileText,
  Pill,
  Receipt,
  Stethoscope,
  Ticket,
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

  const unreadCount = items.filter((n) => !n.read_at).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <Bell className="size-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute right-0 top-0 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-[75vh] w-[24rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl p-4"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-semibold text-foreground">Notifications</h2>
          <Btn variant="ghost" onClick={() => void read()}>
            Mark all read
          </Btn>
        </div>

        <div
          role="tablist"
          aria-label="Filter notifications by date"
          className="mb-3 inline-flex w-full items-center gap-1 rounded-lg bg-muted/60 p-1"
        >
          {(
            [
              ["all", "All"],
              ["today", "Today"],
              ["yesterday", "Yesterday"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={`flex-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                filter === key
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="mb-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="space-y-4">
          {grouped.map((group) => (
            <section key={group.key} aria-label={group.label}>
              <h3 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </h3>
              <div className="space-y-1.5">
                {group.list.map((n) => {
                  const meta = notificationMeta(n);
                  const Icon = meta.Icon;
                  const unread = !n.read_at;
                  return (
                    <article
                      key={n.id}
                      className={
                        "rounded-lg border px-3.5 py-2.5 transition " +
                        (unread
                          ? "border-primary/20 border-l-4 border-l-primary bg-primary/5"
                          : "border-transparent hover:bg-muted/50")
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
          <p className="py-5 text-center text-sm text-muted-foreground">
            {items.length ? `No notifications for ${filter}.` : "You’re all caught up."}
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
