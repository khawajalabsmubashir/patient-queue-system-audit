import { useState, useEffect } from "react";
import { Btn } from "@/components/qc";
import { ConfirmAction } from "@/components/queue-feedback";
import { useClinicalData } from "@/components/clinical";
import { api } from "@/api/client";
import { friendlyError } from "@/services/errors";
import { useClinicContext } from "@/providers/clinic-provider";
import { clinicDayKey } from "@/utils/clinic-date";
import { formatDateOnly, formatDateTime, isUpcomingActiveAppointment, sortPatientAppointments } from "@/domain/date-format";
import type { Appointment } from "@/types/local";

const STATUS_BADGE_MAP: Record<string, { label: string; cls: string }> = {
  scheduled: {
    label: "Scheduled",
    cls: "border border-primary/25 bg-primary-soft text-primary",
  },
  confirmed: {
    label: "Confirmed",
    cls: "border border-info/25 bg-info-soft text-info",
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
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}
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
          className="inline-flex min-h-10 items-center rounded-lg border border-border px-4 text-sm hover:bg-muted"
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
  const recentOrCancelled = scopedAppointments
    .filter((a) => !isUpcomingActiveAppointment(a, today))
    .slice(0, 3);
  if (!remote.data) return remote.error ? <p role="alert">{remote.error}</p> : null;
  return (
    <section className="mb-8 space-y-4" aria-label="Appointment tokens">
      {appointments.length ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold tracking-tight">
              {selectedClinic ? `Upcoming appointments · ${selectedClinic.name}` : "Upcoming appointments"}
            </h2>
            <a
              href="/patient/appointments"
              className="text-xs font-medium text-primary hover:underline"
            >
              View all appointments &amp; history →
            </a>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {appointments.map((a) => {
              const c = clinics.find((clinic) => clinic.id === a.clinicId);
              return (
                <article key={a.id} className="surface flex flex-col justify-between p-6">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Your appointment</p>
                        <h3 className="mt-1 truncate text-lg font-semibold">{a.clinicName}</h3>
                        {c?.area && c.city && (
                          <p className="text-sm text-muted-foreground">
                            {c.area} · {c.city}
                          </p>
                        )}
                      </div>
                      <AppointmentStatusBadge status={a.status} />
                    </div>
                    <p className="tabular-nums mt-3 text-sm text-foreground">
                      {formatDateTime(a.scheduledAt)}
                    </p>
                    <p className="tabular mt-3 break-all text-4xl font-semibold text-primary">
                      {a.token!.tokenCode}
                    </p>
                    {a.scheduledAt.slice(0, 10) > today && (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Your token becomes active in the clinic queue on{" "}
                        {formatDateOnly(a.scheduledAt.slice(0, 10))}
                        .
                      </p>
                    )}
                  </div>
                  <div className="mt-4 border-t border-border pt-3">
                    <a
                      className="inline-block text-sm font-medium text-primary hover:underline"
                      href={"/patient/appointment/" + a.id}
                    >
                      View appointment →
                    </a>
                    <TokenActions
                      token={a.token!}
                      appointmentStatus={a.status}
                      onChanged={remote.reload}
                    />
                  </div>
                </article>
              );
            })}
          </div>
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
            <a
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-soft transition hover:bg-primary-hover whitespace-nowrap"
              href="/patient/appointments?book=1"
            >
              Book appointment →
            </a>
            {recentOrCancelled.length > 0 && (
              <a
                className="text-sm font-medium text-primary hover:underline whitespace-nowrap"
                href="/patient/appointments"
              >
                View history
              </a>
            )}
          </div>
        </article>
      )}
      {recentOrCancelled.length > 0 && (
        <div className="surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              Recent &amp; cancelled appointments
            </h3>
            <a
              href="/patient/appointments"
              className="text-xs font-medium text-primary hover:underline"
            >
              View full appointment history →
            </a>
          </div>
          <div className="mt-3 divide-y divide-border">
            {recentOrCancelled.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-1 last:pb-1 text-sm"
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
                  <a
                    href={"/patient/appointment/" + a.id}
                    className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
                  >
                    View details →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
