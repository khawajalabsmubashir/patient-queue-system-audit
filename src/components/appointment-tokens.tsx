import { useState, useEffect } from "react";
import { AppLink } from "@/components/app-link";
import { Btn } from "@/components/qc";
import { ConfirmAction } from "@/components/queue-feedback";
import { useClinicalData } from "@/components/clinical";
import { api } from "@/api/client";
import { friendlyError } from "@/services/errors";
import { useClinicContext, type ClinicOption } from "@/providers/clinic-provider";
import { clinicDayKey } from "@/utils/clinic-date";
import {
  formatDateTime,
  formatDayMonth,
  formatWeekdayName,
  isUpcomingActiveAppointment,
  sortPatientAppointments,
} from "@/domain/date-format";
import type { Appointment } from "@/types/local";

const STATUS_BADGE_MAP: Record<string, { label: string; cls: string }> = {
  scheduled: {
    label: "Scheduled",
    cls: "border border-primary/25 bg-primary-soft text-primary",
  },
  confirmed: {
    label: "Confirmed",
    cls: "border border-success/25 bg-success-soft text-success",
  },
  checked_in: {
    label: "Checked in",
    cls: "border border-info/25 bg-info-soft text-info",
  },
  completed: {
    label: "Completed",
    cls: "border border-success/25 bg-success-soft text-success",
  },
  cancelled: {
    label: "Cancelled",
    cls: "border border-destructive/25 bg-destructive/10 text-destructive",
  },
  no_show: {
    label: "No-show",
    cls: "border border-warning/30 bg-warning-soft text-warning",
  },
};

export function AppointmentStatusBadge({ status }: { status: string }) {
  const s = STATUS_BADGE_MAP[status] ?? {
    label: status.replaceAll("_", " "),
    cls: "border border-border bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

export function TokenActions({
  token,
  appointmentStatus,
  onChanged,
}: {
  token: { id: string; tokenCode: string; status: string };
  appointmentStatus?: string;
  onChanged?: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const canGiveUp =
    ["waiting", "reserved", "skipped"].includes(token.status) &&
    !["cancelled", "completed", "no_show"].includes(appointmentStatus ?? "");
  async function giveUp() {
    setBusy(true);
    setError("");
    try {
      await api("/patient/tokens/" + encodeURIComponent(token.id) + "/give-up", {
        method: "POST",
        body: {},
      });
      onChanged?.();
      window.dispatchEvent(new Event("queuecare:refresh"));
      window.dispatchEvent(new Event("queuecare:updated"));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-3">
        <a
          className="inline-flex min-h-10 items-center rounded-lg border border-border px-4 text-sm font-medium transition hover:bg-muted"
          download
          href={"/api/patient/tokens/" + encodeURIComponent(token.id) + "/pdf"}
        >
          Download token PDF
        </a>
        {canGiveUp && (
          <ConfirmAction
            title="Give up this token?"
            description="Your place in this appointment queue will be released."
            cancel="Keep token"
            confirm="Give up token"
            onConfirm={() => void giveUp()}
          >
            <Btn variant="ghost" disabled={busy}>
              Give up token
            </Btn>
          </ConfirmAction>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function NextAppointmentCard({
  appointment,
  clinicMeta,
  today,
  onChanged,
}: {
  appointment: Appointment;
  clinicMeta?: ClinicOption | undefined;
  today: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const token = appointment.token!;
  const canGiveUp =
    ["waiting", "reserved", "skipped"].includes(token.status) &&
    !["cancelled", "completed", "no_show"].includes(appointment.status ?? "");
  const isFuture = appointment.scheduledAt.slice(0, 10) > today;
  const weekday = formatWeekdayName(appointment.scheduledAt);
  const metaLine = [appointment.clinicName, clinicMeta?.department, clinicMeta?.doctorName]
    .filter(Boolean)
    .join(" · ");
  const addressLine =
    clinicMeta?.address || [clinicMeta?.area, clinicMeta?.city].filter(Boolean).join(" · ");

  async function giveUp() {
    setBusy(true);
    setError("");
    try {
      await api("/patient/tokens/" + encodeURIComponent(token.id) + "/give-up", {
        method: "POST",
        body: {},
      });
      onChanged();
      window.dispatchEvent(new Event("queuecare:refresh"));
      window.dispatchEvent(new Event("queuecare:updated"));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="surface p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Next appointment
        </span>
        <AppointmentStatusBadge status={appointment.status} />
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-7">
        <div className="shrink-0">
          <p className="tabular text-[36px] font-bold leading-none tracking-tight text-primary sm:text-[42px]">
            {token.tokenCode}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">Your token</p>
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <p className="tabular-nums text-[15px] font-semibold text-foreground">
            {weekday && <span className="font-medium text-muted-foreground">{weekday}, </span>}
            <span>{formatDateTime(appointment.scheduledAt)}</span>
          </p>
          <p className="text-sm text-muted-foreground">{metaLine}</p>
          {addressLine && <p className="text-xs text-muted-foreground">{addressLine}</p>}
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {isFuture
          ? `Your token becomes active in the clinic queue on ${formatDayMonth(appointment.scheduledAt.slice(0, 10))}.`
          : "Your token is active in today's clinic queue."}
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <AppLink
            href={"/patient/appointment/" + appointment.id}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-soft transition hover:bg-primary-hover whitespace-nowrap"
          >
            View details
          </AppLink>
          <a
            download
            href={"/api/patient/tokens/" + encodeURIComponent(token.id) + "/pdf"}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-card px-4 text-xs font-medium text-foreground transition hover:bg-muted whitespace-nowrap"
          >
            Download token PDF
          </a>
        </div>

        {canGiveUp && (
          <ConfirmAction
            title="Give up this token?"
            description="Your place in this appointment queue will be released."
            cancel="Keep token"
            confirm="Give up token"
            onConfirm={() => void giveUp()}
          >
            <button
              type="button"
              disabled={busy}
              className="text-xs font-medium text-destructive transition hover:underline disabled:opacity-50"
            >
              Give up token
            </button>
          </ConfirmAction>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </article>
  );
}

export function AppointmentTokens() {
  const remote = useClinicalData<Appointment[]>("/patient/appointments");
  const { clinics, selected } = useClinicContext();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") remote.reload();
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("queuecare:updated", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("queuecare:updated", refresh);
    };
  }, [remote.reload]);

  const today = clinicDayKey();
  const hasClinicFilter = Boolean(selected && selected !== "all");
  const selectedClinic = hasClinicFilter
    ? clinics.find((clinic) => clinic.id === selected)
    : undefined;
  const scopedAppointments = sortPatientAppointments(
    (remote.data ?? []).filter((a) => !hasClinicFilter || a.clinicId === selected),
    today,
  );
  const appointments = scopedAppointments.filter(
    (a) => a.token && isUpcomingActiveAppointment(a, today),
  );
  const nextAppointment = appointments[0];
  const laterAppointments = appointments.slice(1, 3);
  const recentOrCancelled = scopedAppointments
    .filter((a) => !isUpcomingActiveAppointment(a, today))
    .slice(0, 3);

  if (!remote.data) return remote.error ? <p role="alert">{remote.error}</p> : null;

  return (
    <section className="space-y-4" aria-label="Appointment tokens">
      {nextAppointment ? (
        <>
          <NextAppointmentCard
            appointment={nextAppointment}
            clinicMeta={clinics.find((c) => c.id === nextAppointment.clinicId) ?? selectedClinic}
            today={today}
            onChanged={remote.reload}
          />

          {laterAppointments.length > 0 && (
            <div className="surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Later
                </span>
                {appointments.length > 3 && (
                  <AppLink
                    href="/patient/appointments"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    View all ({appointments.length}) →
                  </AppLink>
                )}
              </div>
              <div className="mt-2.5 divide-y divide-border">
                {laterAppointments.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0.5 last:pb-0.5 text-sm"
                  >
                    <p className="tabular-nums min-w-0 font-medium text-foreground">
                      <span>{formatDateTime(a.scheduledAt)}</span>
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {a.clinicName} · Token {a.token!.tokenCode}
                      </span>
                    </p>
                    <div className="flex shrink-0 items-center gap-3">
                      <AppointmentStatusBadge status={a.status} />
                      <AppLink
                        href={"/patient/appointment/" + a.id}
                        className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
                      >
                        View details →
                      </AppLink>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <article className="surface flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold">Book your next appointment</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Your appointment includes a token automatically.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <AppLink
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-soft transition hover:bg-primary-hover whitespace-nowrap"
              href="/patient/appointments?book=1"
            >
              Book appointment →
            </AppLink>
            {recentOrCancelled.length > 0 && (
              <AppLink
                className="text-sm font-medium text-primary hover:underline whitespace-nowrap"
                href="/patient/appointments"
              >
                View history
              </AppLink>
            )}
          </div>
        </article>
      )}

      {recentOrCancelled.length > 0 && (
        <div className="surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Recent &amp; cancelled appointments
            </h3>
            <AppLink
              href="/patient/appointments"
              className="text-xs font-medium text-primary hover:underline"
            >
              View full appointment history →
            </AppLink>
          </div>
          <div className="mt-2.5 divide-y divide-border">
            {recentOrCancelled.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0.5 last:pb-0.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{a.clinicName}</p>
                  <p className="tabular-nums text-xs text-muted-foreground">
                    {formatDateTime(a.scheduledAt)}
                    {a.token ? ` · Token ${a.token.tokenCode}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <AppointmentStatusBadge status={a.status} />
                  <AppLink
                    href={"/patient/appointment/" + a.id}
                    className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
                  >
                    View details →
                  </AppLink>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
