import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/providers/auth-provider";
import { Clock, Ticket, Users } from "lucide-react";
import { useQueue } from "@/lib/queue-store";
import { Btn, Label, LiveDot, StatusPill } from "@/components/qc";
import { PatientStatus } from "@/components/queue-feedback";
import { AppointmentTokens } from "@/components/appointment-tokens";
import { PatientSummary } from "@/components/final-operations";
import { prefetchClinicalData, useClinicalData } from "@/components/clinical";
import { useClinicContext } from "@/providers/clinic-provider";
import { clinicDayKey } from "@/utils/clinic-date";
import {
  formatLongGreetingDate,
  isUpcomingActiveAppointment,
  sortPatientAppointments,
} from "@/domain/date-format";
import type { Appointment } from "@/types/local";

export const Route = createFileRoute("/patient/dashboard")({ component: Dashboard });

export function QueueHero() {
  const { mine, serving, ahead, eta, waiting, avgMin, clinic } = useQueue();
  if (!mine) return null;
  if (!["waiting", "serving"].includes(mine.status))
    return (
      <section className="surface p-7">
        <Label>Your token</Label>
        <p className="tabular mt-3 text-6xl font-semibold tracking-tight">{mine.token}</p>
        <div className="mt-4">
          <StatusPill status={mine.status} />
        </div>
      </section>
    );
  const isServing = mine.status === "serving";
  const total = Math.max(waiting.length + (serving ? 1 : 0), 1);
  const progress = isServing ? 100 : Math.round(((total - ahead) / (total + 1)) * 100);
  return (
    <section className="surface overflow-hidden">
      <div className="grid md:grid-cols-[1.1fr_1fr]">
        <div className="border-b border-border p-7 md:border-b-0 md:border-r md:p-10">
          <div className="flex items-center justify-between">
            <Label>Your token</Label>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-accent-foreground">
              <LiveDot className="text-primary" /> Live
            </span>
          </div>
          <div
            key={mine.token}
            className="token-in tabular mt-3 text-[72px] font-semibold leading-none tracking-[-0.04em] text-foreground md:text-[96px]"
          >
            {mine.token}
          </div>
          <p className="mt-4 text-[15px] text-muted-foreground">
            {isServing
              ? "It's your turn — please proceed to the consultation area."
              : ahead === 0
                ? "You're next. Please be near the consultation area."
                : `${clinic.department} · ${clinic.doctor}`}
          </p>
          <div className="mt-8">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>Joined {mine.joinedAt}</span>
              <span>Your turn</span>
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0 md:grid-cols-1 md:divide-y">
          {[
            {
              icon: Ticket,
              label: "Now serving",
              value: serving?.token ?? "—",
              hint: serving ? "Please proceed" : "Paused",
            },
            {
              icon: Users,
              label: "Ahead of you",
              value: isServing ? "0" : String(ahead),
              hint: ahead === 1 ? "patient" : "patients",
            },
            {
              icon: Clock,
              label: "Estimated wait",
              value: isServing ? "Now" : `~${eta} min`,
              hint: `≈ ${avgMin} min per patient`,
            },
          ].map((s, i) => (
            <div
              key={s.label}
              className={`flex items-center gap-4 p-5 sm:p-6 md:px-8 ${i === 2 ? "sm:col-span-2 sm:border-t sm:border-border md:col-span-1 md:border-t-0" : ""} ${i === 0 ? "sm:border-r sm:border-border md:border-r-0" : ""}`}
            >
              <div className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                <s.icon className="size-[18px]" />
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd className="tabular mt-0.5 text-2xl font-semibold tracking-tight">
                  {s.value}{" "}
                  <span className="text-xs font-normal text-muted-foreground">{s.hint}</span>
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function LiveQueueCard() {
  const { serving, waiting, mine, ahead, avgMin, open } = useQueue();
  const { selected } = useClinicContext();
  const appts = useClinicalData<Appointment[]>("/patient/appointments");
  const today = clinicDayKey();
  const hasClinicFilter = Boolean(selected && selected !== "all");
  const nextApptToken = sortPatientAppointments(
    (appts.data ?? []).filter((a) => !hasClinicFilter || a.clinicId === selected),
    today,
  ).find((a) => a.token && isUpcomingActiveAppointment(a, today))?.token?.tokenCode;

  const isServing = mine?.status === "serving";
  const eta = Math.max(ahead * avgMin, avgMin);
  const displayToken = mine?.token ?? nextApptToken ?? "—";

  return (
    <section
      aria-label="Live queue status"
      className="surface order-first p-6 lg:col-start-2 lg:row-start-1 lg:order-none"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight text-foreground">Live queue</h2>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            open
              ? "bg-primary-soft text-primary"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {open ? "Queue open" : "Queue closed"}
        </span>
      </div>

      {mine && (
        <div className="mt-4">
          <PatientStatus />
        </div>
      )}

      <dl className="mt-4 divide-y divide-border text-sm">
        <div className="flex items-center justify-between py-2.5 first:pt-0">
          <dt className="text-muted-foreground">Now serving</dt>
          <dd className="tabular font-semibold text-foreground">{serving?.token ?? "—"}</dd>
        </div>
        <div className="flex items-center justify-between py-2.5">
          <dt className="text-muted-foreground">Your token</dt>
          <dd className="tabular font-semibold text-foreground">{displayToken}</dd>
        </div>
        <div className="flex items-center justify-between py-2.5">
          <dt className="text-muted-foreground">Ahead of you</dt>
          <dd className="tabular font-semibold text-foreground">
            {mine ? (isServing ? "0" : String(ahead)) : "—"}
          </dd>
        </div>
        <div className="flex items-center justify-between py-2.5 last:pb-0">
          <dt className="text-muted-foreground">Estimated wait</dt>
          <dd className="tabular font-semibold text-foreground">
            {mine ? (isServing ? "Now" : `~${eta} min`) : "—"}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-muted-foreground">
        {mine
          ? `Joined ${mine.joinedAt} · ${waiting.length} waiting in clinic queue`
          : "Live numbers appear here once your token is active."}
      </p>

      <Link
        to="/patient/live-queue"
        className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-muted"
      >
        Open live queue
      </Link>
    </section>
  );
}

function Dashboard() {
  const { profile } = useAuth();
  const firstName = profile?.fullName.split(" ")[0] || "Patient";
  const todayLabel = formatLongGreetingDate(new Date());

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="break-words [overflow-wrap:anywhere] text-[26px] font-bold tracking-tight text-foreground md:text-[30px]">
            Good morning, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {todayLabel} · Your appointments, queue and care summary.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          <Link
            to="/patient/appointments"
            search={{ book: "1" } as never}
            onMouseEnter={() => prefetchClinicalData("/patient/appointments")}
          >
            <Btn>Book appointment</Btn>
          </Link>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.48fr)_minmax(310px,0.92fr)] lg:items-start">
        <div className="space-y-6 lg:col-start-1 lg:row-start-1 lg:row-span-2">
          <AppointmentTokens />
          <PatientSummary hideUpcoming />
        </div>

        <LiveQueueCard />

        <section className="surface p-6 lg:col-start-2 lg:row-start-2">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Before you arrive
          </h2>
          <ol className="mt-4 space-y-4">
            {(
              [
                [
                  "1",
                  "Arrive when 3 patients are ahead",
                  "We will notify you when it is almost your turn.",
                ],
                [
                  "2",
                  "Show your token at reception",
                  "Keep this page open or note your token number.",
                ],
                [
                  "3",
                  "Wait near the consultation area",
                  "Tokens are called on the screen in the lobby.",
                ],
              ] as const
            ).map(([step, title, desc]) => (
              <li key={step} className="flex items-start gap-3.5">
                <span className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                  {step}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
