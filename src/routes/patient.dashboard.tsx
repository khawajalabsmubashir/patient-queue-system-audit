import { useEffect, useState } from "react";
import { useClinicalData } from "@/components/clinical";
import { Btn, LiveDot } from "@/components/qc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  formatDateOnly,
  formatLongGreetingDate,
  formatWeekdayName,
  isUpcomingActiveAppointment,
  sortPatientAppointments,
} from "@/domain/date-format";
import { useQueue } from "@/lib/queue-store";
import { useAuth } from "@/providers/auth-provider";
import { useClinicContext } from "@/providers/clinic-provider";
import type { PatientVisit } from "@/types/clinical";
import type { Appointment } from "@/types/local";

interface DashboardFollowUp {
  id: string;
  clinic_id?: string;
  follow_up_date: string;
  clinic_name: string;
  instructions: string;
  status: string;
}
import { clinicDayKey } from "@/utils/clinic-date";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Calendar,
  CalendarCheck2,
  Check,
  ChevronDown,
  Clock,
  Download,
  FileText,
  Loader2,
  Ticket,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/patient/dashboard")({ component: Dashboard });

export function QueueHero() {
  const { clinic, serving, mine, ahead, avgMin } = useQueue();
  if (!mine) return null;
  const isServing = mine.status === "serving";
  const eta = Math.max(ahead * avgMin, avgMin);
  const progress = isServing ? 100 : Math.max(12, Math.min(92, 100 - ahead * 12));
  return (
    <section aria-label="Your queue status" className="surface token-in overflow-hidden">
      <div className="grid md:grid-cols-[1.15fr_0.85fr]">
        <div className="flex flex-col justify-between border-b border-border p-7 md:border-b-0 md:border-r md:p-9">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">{clinic.name}</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
              <LiveDot />
              {isServing ? "Your turn now" : "Live in queue"}
            </span>
          </div>
          <div className="my-7">
            <div className="text-xs text-muted-foreground">Your token</div>
            <div className="tabular mt-2 text-6xl font-semibold tracking-tight md:text-[72px] md:leading-none">
              {mine.token}
            </div>
          </div>
          <p className="text-[15px] text-muted-foreground">
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
              className={`flex items-center gap-4 p-5 sm:p-6 md:px-8 ${
                i === 2
                  ? "sm:col-span-2 sm:border-t sm:border-border md:col-span-1 md:border-t-0"
                  : ""
              } ${i === 0 ? "sm:border-r sm:border-border md:border-r-0" : ""}`}
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

function stepToken(code: string, delta: number) {
  const match = code.match(/^(.*?)(\d+)$/);
  if (!match) return delta < 0 ? "A-003" : "A-005";
  const prefix = match[1]!;
  const num = match[2]!;
  const next = Math.max(1, Number.parseInt(num, 10) + delta);
  return prefix + String(next).padStart(num.length, "0");
}

function UnifiedTokenQueueCard() {
  const { clinic, serving, waiting, mine, ahead, avgMin, open } = useQueue();
  const { clinics, selected } = useClinicContext();
  const appts = useClinicalData<Appointment[]>("/patient/appointments");
  const [simStage, setSimStage] = useState<null | 0 | 1 | 2>(null);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") appts.reload();
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("queuecare:updated", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("queuecare:updated", refresh);
    };
  }, [appts.reload]);

  const today = clinicDayKey();
  const hasClinicFilter = Boolean(selected && selected !== "all");
  const selectedClinic = hasClinicFilter
    ? clinics.find((c) => c.id === selected)
    : clinics[0];
  const scopedAppointments = sortPatientAppointments(
    (appts.data ?? []).filter((a) => !hasClinicFilter || a.clinicId === selected),
    today,
  );
  const nextAppointment = scopedAppointments.find(
    (a) => a.token && isUpcomingActiveAppointment(a, today),
  );

  const queueMatchesClinic =
    !hasClinicFilter ||
    !selectedClinic ||
    !clinic.name ||
    clinic.name.toLowerCase() === selectedClinic.name.toLowerCase();
  const activeMine = queueMatchesClinic ? mine : null;
  const realToken = activeMine?.token ?? nextAppointment?.token?.tokenCode ?? "";
  const isSimulating = simStage !== null;
  const activeToken = realToken || (isSimulating ? "A-004" : "");
  const headerClinic =
    nextAppointment?.clinicName || selectedClinic?.name || clinic.name || "Neuro Spine Care Center";
  const headerDate = nextAppointment
    ? `${formatWeekdayName(nextAppointment.scheduledAt) ? `${formatWeekdayName(nextAppointment.scheduledAt)}, ` : ""}${formatDateOnly(nextAppointment.scheduledAt.slice(0, 10))}`
    : formatLongGreetingDate(new Date());

  const cycleSimulation = () => {
    setSimStage((prev) => {
      if (prev === null) return 1;
      if (prev === 1) return 2;
      if (prev === 2) return 0;
      return null;
    });
  };

  // Derive display values from simulation when active, otherwise real live queue state
  let mode: "idle" | "waiting" | "serving" | "done" | "none" = "none";
  let nowServingVal = "--";
  let aheadVal = "--";
  let estWaitVal = "--";
  let headline = "No active appointment token";
  let progressPct = 15;
  let queueRows: { token: string; tag: string; isYou?: boolean; isNow?: boolean }[] = [];

  if (isSimulating) {
    const prevTok = stepToken(activeToken, -1);
    const nextTok = stepToken(activeToken, 1);
    if (simStage === 0) {
      mode = "idle";
      headline = "Queue not started yet";
      progressPct = 15;
      queueRows = [{ token: activeToken, tag: "Waiting for queue to open", isYou: true }];
    } else if (simStage === 1) {
      mode = "waiting";
      nowServingVal = prevTok;
      aheadVal = "1";
      estWaitVal = `~${avgMin || 5} min`;
      headline = "Your turn is coming soon...";
      progressPct = 70;
      queueRows = [
        { token: prevTok, tag: "Now Serving" },
        { token: `${activeToken} (You)`, tag: `~${avgMin || 5} min`, isYou: true },
        { token: nextTok, tag: `~${(avgMin || 5) * 2} min` },
      ];
    } else {
      mode = "serving";
      nowServingVal = activeToken;
      aheadVal = "0";
      estWaitVal = "Now";
      headline = "Your turn now — please proceed";
      progressPct = 100;
      queueRows = [
        { token: `${activeToken} (You)`, tag: "NOW", isYou: true, isNow: true },
        { token: nextTok, tag: `~${avgMin || 5} min` },
      ];
    }
  } else if (activeMine) {
    if (activeMine.status === "done") {
      mode = "done";
      nowServingVal = serving?.token ?? "--";
      aheadVal = "0";
      estWaitVal = "Done";
      headline = "Visit completed.";
      progressPct = 100;
      queueRows = [{ token: `${activeMine.token} (You)`, tag: "Completed", isYou: true }];
    } else if (activeMine.status === "serving") {
      mode = "serving";
      nowServingVal = serving?.token ?? activeMine.token;
      aheadVal = "0";
      estWaitVal = "Now";
      headline = "Your turn now — please proceed";
      progressPct = 100;
      queueRows = [
        { token: `${activeMine.token} (You)`, tag: "NOW", isYou: true, isNow: true },
        ...waiting.slice(0, 2).map((w, idx) => ({
          token: w.token,
          tag: `~${(idx + 1) * avgMin} min`,
        })),
      ];
    } else {
      mode = "waiting";
      const eta = Math.max(ahead * avgMin, avgMin);
      nowServingVal = serving?.token ?? "--";
      aheadVal = String(ahead);
      estWaitVal = ahead === 0 ? "Next" : `~${eta} min`;
      headline =
        ahead === 0
          ? "You're next — please proceed near the room"
          : ahead === 1
            ? "Your turn is coming soon..."
            : `${ahead} patients ahead in queue`;
      progressPct = Math.max(25, Math.min(90, 100 - ahead * 15));
      if (serving) queueRows.push({ token: serving.token, tag: "Now Serving" });
      queueRows.push({
        token: `${activeMine.token} (You)`,
        tag: ahead === 0 ? "Next" : `~${eta} min`,
        isYou: true,
      });
      const myIdx = waiting.findIndex((w) => w.token === activeMine.token);
      if (myIdx >= 0 && waiting[myIdx + 1]) {
        queueRows.push({
          token: waiting[myIdx + 1]!.token,
          tag: `~${(ahead + 1) * avgMin} min`,
        });
      }
    }
  } else if (nextAppointment && realToken) {
    mode = "idle";
    nowServingVal = serving?.token ?? "--";
    headline = open ? "Queue open — check in on arrival" : "Queue not started yet";
    progressPct = 15;
    queueRows = [
      ...(serving ? [{ token: serving.token, tag: "Now Serving" }] : []),
      {
        token: realToken,
        tag: open ? (nextAppointment.scheduledAt.startsWith(today) ? "Scheduled today" : formatDateOnly(nextAppointment.scheduledAt.slice(0, 10))) : "Waiting for queue to open",
        isYou: true,
      },
    ];
  } else {
    mode = "none";
    nowServingVal = serving?.token ?? "--";
    headline = open ? "Clinic queue is open" : "Queue not started yet";
    progressPct = 10;
    queueRows = [
      ...(serving ? [{ token: serving.token, tag: "Now Serving" }] : []),
      ...waiting.slice(0, 2).map((w, idx) => ({
        token: w.token,
        tag: `~${(idx + 1) * avgMin} min`,
      })),
    ];
  }

  const boxTone =
    mode === "serving"
      ? "bg-primary-soft border-primary"
      : mode === "waiting"
        ? "bg-primary-soft/60 border-primary/30"
        : mode === "done"
          ? "bg-success-soft/70 border-success/30"
          : "bg-muted/50 border-border";

  return (
    <section
      aria-label="Live queue status"
      className="surface overflow-hidden"
    >
      {/* Card Top Header: Day, Date & Clinic Name + animation-only non-clickable Live queue indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-4 sm:px-7">
        <h2 className="text-base font-bold text-foreground sm:text-lg">
          {headerDate} &bull; {headerClinic}
        </h2>
        <span className="pointer-events-none inline-flex shrink-0 select-none items-center gap-1.5 rounded-lg border border-primary/25 bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary">
          <LiveDot />
          <span>Live queue</span>
        </span>
      </div>

      {/* Unified 2-Column Content */}
      <div className="grid grid-cols-1 divide-y divide-border lg:grid-cols-12 lg:divide-x lg:divide-y-0">
        {/* Left Panel: Your Token & Minimal Tracking Bar (NO Give up token on Home) */}
        <div className="flex flex-col justify-between bg-card p-5 sm:p-7 lg:col-span-6">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:text-sm">
                Your Token
              </span>
              {isSimulating && (
                <button
                  type="button"
                  onClick={() => setSimStage(null)}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                >
                  Simulation preview · Reset
                </button>
              )}
            </div>

            <div className="my-4 sm:my-5">
              <div className="tabular text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl">
                {activeToken || "—"}
              </div>
              {!activeToken && !isSimulating && (
                <p className="mt-2 text-xs text-muted-foreground">
                  No upcoming appointment token yet. Book an appointment or click Simulate Queue to
                  preview.
                </p>
              )}
            </div>
          </div>

          <div className={`rounded-2xl border p-4 transition-colors sm:p-5 ${boxTone}`}>
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-primary">
                  {mode === "serving" || mode === "done" ? (
                    <Check className="size-4" aria-hidden="true" />
                  ) : mode === "waiting" ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
                  )}
                </span>
                <span
                  className={`text-sm font-semibold ${
                    mode === "serving" || mode === "waiting" ? "text-primary" : "text-foreground"
                  }`}
                >
                  {headline}
                </span>
              </div>

              <button
                type="button"
                onClick={cycleSimulation}
                className="cursor-pointer text-xs font-semibold text-primary hover:underline"
              >
                {simStage === 2 ? "Reset Live View" : "Simulate Queue →"}
              </button>
            </div>

            <div className="h-2.5 w-full overflow-hidden rounded-full border border-border bg-card">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  mode === "serving" || mode === "waiting"
                    ? "bg-primary"
                    : mode === "done"
                      ? "bg-success"
                      : "bg-muted-foreground/30"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right Panel: Simple Queue Stats & Queue Line */}
        <div className="flex flex-col justify-between bg-card p-5 sm:p-7 lg:col-span-6">
          <dl className="mb-5 grid grid-cols-3 gap-2.5 sm:gap-3">
            <div className="rounded-xl border border-border bg-muted/40 p-3 text-center sm:p-3.5">
              <dt className="text-xs font-medium text-muted-foreground">Now Serving</dt>
              <dd
                className={`tabular mt-1 text-lg font-extrabold sm:text-xl ${
                  nowServingVal !== "--" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {nowServingVal}
              </dd>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 p-3 text-center sm:p-3.5">
              <dt className="text-xs font-medium text-muted-foreground">Ahead</dt>
              <dd
                className={`tabular mt-1 text-lg font-extrabold sm:text-xl ${
                  aheadVal !== "--" ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {aheadVal}
              </dd>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 p-3 text-center sm:p-3.5">
              <dt className="text-xs font-medium text-muted-foreground">Est. Wait</dt>
              <dd
                className={`tabular mt-1 text-base font-bold sm:text-lg ${
                  estWaitVal === "Now"
                    ? "text-primary font-extrabold"
                    : estWaitVal !== "--"
                      ? "text-foreground"
                      : "text-muted-foreground"
                }`}
              >
                {estWaitVal}
              </dd>
            </div>
          </dl>

          <div>
            <h3 className="mb-2.5 text-sm font-bold text-foreground">Queue</h3>
            <div className="space-y-2">
              {queueRows.length > 0 ? (
                queueRows.map((row, index) => (
                  <div
                    key={`${row.token}-${index}`}
                    className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm ${
                      row.isNow
                        ? "border-primary bg-primary-soft"
                        : row.isYou
                          ? "border-primary/30 bg-primary-soft/60"
                          : "border-border bg-muted/35"
                    }`}
                  >
                    <span
                      className={`tabular font-semibold ${
                        row.isNow
                          ? "font-extrabold text-primary"
                          : row.isYou
                            ? "font-bold text-primary"
                            : "text-foreground"
                      }`}
                    >
                      {row.token}
                    </span>
                    <span
                      className={`tabular text-xs font-semibold ${
                        row.isNow
                          ? "font-extrabold text-primary"
                          : row.isYou
                            ? "text-primary"
                            : "text-muted-foreground"
                      }`}
                    >
                      {row.tag}
                    </span>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-border bg-muted/35 px-3.5 py-2.5 text-xs text-muted-foreground">
                  No tokens waiting in queue right now.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FollowUpSmallMessage() {
  const { selected } = useClinicContext();
  const activeClinicId = selected && selected !== "all" ? selected : "";
  const summary = useClinicalData<{
    followups: DashboardFollowUp[];
  }>("/patient/summary");

  const scopedFollowups = [...(summary.data?.followups ?? [])]
    .filter((f) => !activeClinicId || !f.clinic_id || f.clinic_id === activeClinicId)
    .sort((a, b) => String(a.follow_up_date).localeCompare(String(b.follow_up_date)));
  const latestFollowup = scopedFollowups[0];

  const statusLabel = latestFollowup
    ? latestFollowup.status === "pending"
      ? "Pending"
      : latestFollowup.status.replaceAll("_", " ").replace(/^\w/, (ch: string) => ch.toUpperCase())
    : "";

  return (
    <section
      aria-label="Follow-up message"
      className="flex flex-col justify-between gap-2.5 rounded-2xl border border-border bg-card px-5 py-3.5 sm:flex-row sm:items-center sm:px-6"
    >
      <div className="flex min-w-0 items-start gap-3 sm:items-center">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
          <CalendarCheck2 className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 text-sm">
          <span className="font-semibold text-foreground">Follow-up: </span>
          {latestFollowup ? (
            <span className="text-muted-foreground">
              <span className="tabular font-medium text-foreground">
                {formatDateOnly(String(latestFollowup.follow_up_date).slice(0, 10))}
              </span>
              {latestFollowup.clinic_name ? ` · ${latestFollowup.clinic_name}` : ""}
              {latestFollowup.instructions
                ? ` — ${latestFollowup.instructions}`
                : " — Follow-up visit recommended."}
            </span>
          ) : (
            <span className="text-muted-foreground">
              No follow-up visit is scheduled yet. Doctor follow-up guidance appears here after a
              completed visit.
            </span>
          )}
        </div>
      </div>
      {latestFollowup && (
        <span className="inline-flex w-fit shrink-0 items-center rounded-full border border-warning/30 bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning">
          {statusLabel}
        </span>
      )}
    </section>
  );
}

function HistoryMyVisitsCard() {
  const { selected } = useClinicContext();
  const activeClinicId = selected && selected !== "all" ? selected : "";
  const visitsRemote = useClinicalData<PatientVisit[]>("/patient/visits");
  const [selectedVisitId, setSelectedVisitId] = useState<string>("");

  const scopedVisits = (visitsRemote.data ?? []).filter(
    (v) => !activeClinicId || v.clinicId === activeClinicId,
  );
  const selectedVisit =
    scopedVisits.find((v) => v.id === selectedVisitId) ?? scopedVisits[0] ?? null;

  return (
    <section aria-label="History and my visits" className="surface p-5 sm:p-7">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground sm:text-xl">
            History &amp; My Visits
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Select any past visit date to view and download your prescription PDF.
          </p>
        </div>

        {scopedVisits.length > 0 && selectedVisit && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Select past visit"
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-left text-sm font-semibold text-foreground transition hover:bg-muted sm:w-auto sm:text-base"
              >
                <span className="flex items-center gap-2">
                  <Calendar className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>My Visits: {formatDateOnly(selectedVisit.visitAt)}</span>
                </span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 rounded-xl p-1.5">
              <DropdownMenuLabel className="px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Select a Past Visit Date
              </DropdownMenuLabel>
              {scopedVisits.map((visit) => {
                const isSelected = visit.id === selectedVisit.id;
                return (
                  <DropdownMenuItem
                    key={visit.id}
                    onSelect={() => setSelectedVisitId(visit.id)}
                    className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm ${
                      isSelected ? "bg-primary-soft font-semibold text-primary" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{formatDateOnly(visit.visitAt)}</p>
                      <p className="truncate text-xs text-muted-foreground">{visit.clinicName}</p>
                    </div>
                    {isSelected && <span className="text-xs font-bold text-primary">Selected</span>}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {selectedVisit ? (
        <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3.5">
            <div className="grid size-12 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary-soft text-primary">
              <FileText className="size-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="mb-1 inline-block rounded-md border border-primary/25 bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
                Visit Prescription Ready
              </span>
              <h3 className="text-base font-bold text-foreground sm:text-lg">
                {formatDateOnly(selectedVisit.visitAt)} &mdash; {selectedVisit.clinicName}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedVisit.prescription.items.length > 0
                  ? `${selectedVisit.prescription.items.length} prescribed item(s)`
                  : ""}
                
              </p>
            </div>
          </div>

          <a
            download
            href={"/api/patient/visits/" + encodeURIComponent(selectedVisit.id) + "/prescription-pdf"}
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition hover:bg-primary-hover sm:w-auto"
          >
            <Download className="size-4" aria-hidden="true" />
            <span>Download Your Prescription (PDF)</span>
          </a>
        </div>
      ) : (
        <div className="mt-5 flex flex-col justify-between gap-3 rounded-2xl border border-border bg-muted/40 p-5 sm:flex-row sm:items-center">
          <p className="text-sm text-muted-foreground">
            {visitsRemote.error
              ? visitsRemote.error
              : "No past visits yet. Completed clinic visits and prescription PDFs will appear here."}
          </p>
          
        </div>
      )}
    </section>
  );
}

function Dashboard() {
  const { profile } = useAuth();
  const fullName = profile?.fullName?.trim() || "Patient";

  return (
    <div className="space-y-6">
      {/* Clean Welcome Greeting + Book Appointment */}
      <section className="surface flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="min-w-0">
          <h1 className="break-words [overflow-wrap:anywhere] text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Welcome, {fullName}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Track your token and download your prescriptions easily.
          </p>
        </div>

        <div className="shrink-0">
          <Link
            to="/patient/appointments"
            search={{ book: "1" } as never}
            className="w-full sm:w-auto"
          >
            <Btn className="w-full font-bold sm:w-auto">+ Book Appointment</Btn>
          </Link>
        </div>
      </section>

      {/* Section 1: Unified Token & Live Queue Card */}
      <UnifiedTokenQueueCard />

      {/* Small Follow-up Message */}
      <FollowUpSmallMessage />

      {/* Section 2: History & My Visits Card */}
      <HistoryMyVisitsCard />
    </div>
  );
}
