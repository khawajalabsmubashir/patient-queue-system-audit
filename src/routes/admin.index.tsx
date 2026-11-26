import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useClinicContext } from "@/providers/clinic-provider";
import { useClinicalData, ClinicalLoading } from "@/components/clinical";
import { AppLink } from "@/components/app-link";
import { PageHeader, Btn } from "@/components/qc";
import { AppointmentRows } from "@/components/appointment-rows";
import type { TodayState } from "@/types/workflow";
export const Route = createFileRoute("/admin/")({ component: Today });
export function Today() {
  const { selected } = useClinicContext(),
    remote = useClinicalData<TodayState>("/admin/today?clinicId=" + encodeURIComponent(selected));
  useEffect(() => {
    const reload = () => remote.reload(),
      timer = window.setInterval(() => {
        if (!document.hidden) reload();
      }, 30000);
    window.addEventListener("queuecare:updated", reload);
    return () => {
      clearInterval(timer);
      window.removeEventListener("queuecare:updated", reload);
    };
  }, [selected]);
  if (!remote.data) return <ClinicalLoading error={remote.error} retry={remote.reload} />;
  const d = remote.data,
    waiting = d.queue.filter((t) => t.status === "waiting"),
    serving = d.queue.filter((t) => t.status === "serving"),
    next = d.appointments.filter(
      (a) =>
        !["completed", "cancelled", "no_show"].includes(a.status) && a.visitStatus !== "completed",
    );
  return (
    <>
      <PageHeader
        title="Today"
        sub={
          (selected === "all" ? "All clinics" : d.clinics[0]?.name || "Clinic setup") +
          " · " +
          d.date
        }
        right={
          <AppLink href="/admin/appointments">
            <Btn variant="secondary">View appointments</Btn>
          </AppLink>
        }
      />
      {d.setup === "clinic" ? (
        <section className="surface p-6">
          <h2 className="text-lg font-semibold">Add your first clinic</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Add a clinic and configure its opening and closing times so patients can book
            appointments right away.
          </p>
          <ol className="my-5 space-y-2 text-sm">
            <li>1. Add clinic &amp; set opening hours</li>
            <li>2. Patients &amp; staff can book immediately</li>
          </ol>
          <AppLink href="/admin/clinics">
            <Btn>Add clinic</Btn>
          </AppLink>
        </section>
      ) : (
        <>
          <dl className="mb-7 grid grid-cols-2 gap-4 border-y border-border py-4 md:grid-cols-4">
            {[
              [
                "Appointments today",
                d.appointments.filter((a) => !["cancelled", "no_show"].includes(a.status)).length,
              ],
              ["Patients waiting", waiting.length],
              ["Currently serving", serving.length],
              [
                "Completed today",
                d.completedToday ?? d.queue.filter((t) => t.status === "completed").length,
              ],
            ].map(([l, v]) => (
              <div key={l}>
                <dt className="text-sm text-muted-foreground">{l}</dt>
                <dd className="mt-1 text-2xl font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          <section className="surface mb-6">
            <h2 className="border-b border-border px-5 py-4 font-semibold">Next up</h2>
            {next.length ? (
              <AppointmentRows items={next.slice(0, 5)} onChanged={remote.reload} />
            ) : (
              <div className="p-5 text-sm">
                <p>No upcoming appointments remain for today.</p>
                <AppLink
                  className="mt-3 inline-block text-primary"
                  href="/admin/appointments?view=upcoming"
                >
                  View upcoming →
                </AppLink>
              </div>
            )}
          </section>
          <section className="surface mb-6 p-5">
            <div className="flex flex-wrap justify-between gap-3">
              <h2 className="font-semibold">Live queue</h2>
              <AppLink
                className="text-sm text-primary"
                href={"/admin/live-queue?clinicId=" + encodeURIComponent(selected)}
              >
                Open queue →
              </AppLink>
            </div>
            {serving.map((t) => (
              <p key={t.id} className="mt-3 text-sm">
                Now serving: {t.token_code} · {t.patient_name}{" "}
                <AppLink
                  className="text-primary"
                  href={"/admin/patient-record/" + t.patient_id + "?clinicId=" + t.clinic_id}
                >
                  Open patient →
                </AppLink>
              </p>
            ))}
            {waiting[0] ? (
              <p className="mt-2 text-sm">
                Next: {waiting[0].token_code} · {waiting[0].patient_name}
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No one is waiting right now.</p>
            )}
          </section>
          <section className="surface divide-y divide-border">
            <h2 className="p-5 font-semibold">Needs attention</h2>
            {next.filter((a) => ["scheduled", "confirmed"].includes(a.status)).length > 0 && (
              <AppLink className="block p-5 text-sm text-primary" href="/admin/appointments">
                {next.filter((a) => ["scheduled", "confirmed"].includes(a.status)).length}{" "}
                appointments waiting for check-in →
              </AppLink>
            )}
            {d.inProgress.map((v) => (
              <AppLink
                key={v.id}
                className="flex flex-wrap justify-between gap-2 p-5 text-sm"
                href={"/admin/visits/" + v.id}
              >
                <span>{v.patient_name} · consultation in progress</span>
                <span className="text-primary">Continue consultation →</span>
              </AppLink>
            ))}
            {!d.inProgress.length &&
              !next.some((a) => ["scheduled", "confirmed"].includes(a.status)) && (
                <p className="p-5 text-sm text-muted-foreground">You’re up to date.</p>
              )}
          </section>
          <AppLink href="/admin/analytics" className="mt-6 inline-block text-sm text-primary">
            View analytics and exports →
          </AppLink>
        </>
      )}
    </>
  );
}
