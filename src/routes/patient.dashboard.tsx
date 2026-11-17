import { AppointmentTokens } from "@/components/appointment-tokens";
import { PatientSummary } from "@/components/final-operations";
import { useAuth } from "@/providers/auth-provider";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BellRing,
  CalendarPlus,
  ClipboardList,
  Clock,
  MapPin,
  Phone,
  Pill,
  Receipt,
  Ticket,
  Users,
} from "lucide-react";
import { formatTime, useQueue } from "@/lib/queue-store";
import { PatientStatus } from "@/components/queue-feedback";
import { prefetchClinicalData } from "@/components/clinical";
import { Btn, Label, LiveDot, StatusPill } from "@/components/qc";

export const Route = createFileRoute("/patient/dashboard")({
  head: () => ({
    meta: [
      { title: "Your queue status — Neuro Spine Care Center" },
      {
        name: "description",
        content: "See your token, people ahead, and estimated wait at a glance.",
      },
      { property: "og:title", content: "Your queue status — Neuro Spine Care Center" },
      {
        property: "og:description",
        content: "See your token, people ahead, and estimated wait at a glance.",
      },
    ],
  }),
  component: Dashboard,
});

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

function Dashboard() {
  const { mine, open, clinic } = useQueue();
  const { profile } = useAuth();
  return (
    <>
      <section className="surface mb-8 flex flex-col justify-between gap-6 bg-gradient-to-br from-card via-card to-primary-soft/45 p-6 md:flex-row md:items-center md:p-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className={`size-2 rounded-full ${open ? "bg-success" : "bg-muted-foreground"}`} />
            {clinic.name || "Selected clinic"} · {open ? "Queue open" : "Queue closed"}
          </div>
          <h1 className="mt-3 text-[28px] font-semibold tracking-tight md:text-[34px]">
            Good morning, {profile?.fullName.split(" ")[0]}
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Here's your queue status, upcoming appointments, and care summary for today.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link
            to="/patient/appointments"
            search={{ book: "1" } as never}
            onMouseEnter={() => prefetchClinicalData("/patient/appointments")}
          >
            <Btn>
              <CalendarPlus className="size-4" />
              Book appointment
            </Btn>
          </Link>
          <Link
            to="/patient/live-queue"
          >
            <Btn variant="secondary">
              Live queue
            </Btn>
          </Link>
        </div>
      </section>

      <AppointmentTokens />
      {mine && (
        <>
          <PatientStatus />
          <QueueHero />
        </>
      )}

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            to: "/patient/appointments",
            title: "Appointments",
            desc: "Schedule or view tokens",
            icon: Ticket,
            prefetch: "/patient/appointments",
          },
          {
            to: "/patient/visits",
            title: "My visits",
            desc: "Consultation summaries",
            icon: ClipboardList,
            prefetch: "/patient/visits",
          },
          {
            to: "/patient/prescriptions",
            title: "Prescriptions",
            desc: "Medicines & A4 print",
            icon: Pill,
            prefetch: "/patient/prescriptions",
          },
          {
            to: "/patient/billing",
            title: "Billing",
            desc: "Invoices & payments",
            icon: Receipt,
            prefetch: "/billing/invoices?clinicId=all",
          },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onMouseEnter={() => prefetchClinicalData(item.prefetch)}
            onFocus={() => prefetchClinicalData(item.prefetch)}
            className="surface group flex items-center gap-3.5 p-4 transition hover:border-primary/40 hover:shadow-lift"
          >
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
              <item.icon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="truncate text-xs text-muted-foreground">{item.desc}</p>
            </div>
          </Link>
        ))}
      </section>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <div className="surface p-6 md:col-span-2">
          <h2 className="text-lg font-semibold tracking-tight">Before you arrive</h2>
          <ul className="mt-4 divide-y divide-border">
            {(
              [
                [
                  BellRing,
                  "Arrive when 3 patients are ahead",
                  "We'll notify you when it's almost your turn.",
                ],
                [
                  Ticket,
                  "Show your token at reception",
                  "Keep this page open or note your token number.",
                ],
                [
                  MapPin,
                  "Wait near the consultation area",
                  "Tokens are called on the screen in the lobby.",
                ],
              ] as const
            ).map(([Icon, t, d]) => (
              <li key={t} className="flex gap-4 py-4 first:pt-1 last:pb-1">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                  <Icon className="size-[18px]" />
                </div>
                <div>
                  <div className="text-sm font-medium">{t}</div>
                  <div className="text-sm text-muted-foreground">{d}</div>
                </div>
              </li>
            ))}
          </ul>
          {mine && (
            <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5">
              <Link to="/patient/live-queue">
                <Btn>
                  View live queue <ArrowRight className="size-4" />
                </Btn>
              </Link>
              <Link to="/patient/get-token">
                <Btn variant="secondary">Appointments</Btn>
              </Link>
              <Link to="/patient/history">
                <Btn variant="secondary">Visit history</Btn>
              </Link>
            </div>
          )}
        </div>
        <aside className="surface flex flex-col justify-between p-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Clinic</h2>
            <div className="mt-4 space-y-3.5 text-sm">
              <div className="font-semibold text-foreground">{clinic.name}</div>
              <div className="flex gap-2.5 text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{clinic.address || "Address on file"}</span>
              </div>
              <div className="flex gap-2.5 text-muted-foreground">
                <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  Today · {formatTime(clinic.opening)} – {formatTime(clinic.closing)}
                </span>
              </div>
              <div className="flex gap-2.5 text-muted-foreground">
                <Phone className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{clinic.phone || "Phone on file"}</span>
              </div>
            </div>
          </div>
          <div className="mt-5 border-t border-border pt-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-success-soft px-3 py-1 text-xs font-medium text-success">
              <span className="size-1.5 rounded-full bg-current" />
              {open ? "Queue open" : "Queue closed"}
            </div>
          </div>
        </aside>
      </div>
      <PatientSummary />
    </>
  );
}
