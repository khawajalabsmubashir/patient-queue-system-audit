import { AppointmentStatusBadge, TokenActions } from "@/components/appointment-tokens";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/qc";
import { useClinicalData, ClinicalLoading } from "@/components/clinical";
import type { AppointmentContext } from "@/types/clinical-workflow";

export const Route = createFileRoute("/patient/appointment/$appointmentId")({
  component: AppointmentDetail,
});

function AppointmentDetail() {
  const { appointmentId } = Route.useParams();
  const remote = useClinicalData<AppointmentContext>(
    `/appointments/${encodeURIComponent(appointmentId)}/context`,
  );
  if (!remote.data) return <ClinicalLoading error={remote.error} retry={remote.reload} />;
  const a = remote.data;
  return (
    <>
      <PageHeader
        title="Appointment details"
        sub={`${a.clinicName} · ${a.scheduledAt.replace("T", " ")}`}
        right={<AppointmentStatusBadge status={a.status} />}
      />
      <section className="surface space-y-5 p-6">
        {a.token && (
          <div>
            <p className="text-xs text-muted-foreground">Appointment token</p>
            <p className="tabular mt-2 text-4xl font-semibold text-primary">{a.token.tokenCode}</p>
            <TokenActions token={a.token} appointmentStatus={a.status} onChanged={remote.reload} />
          </div>
        )}
        <div>
          <h2 className="text-sm font-semibold text-foreground">Notes</h2>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {a.patientNotes || a.reason || "No additional notes."}
          </p>
        </div>
      </section>
      <a className="mt-6 inline-block text-sm text-primary hover:underline" href="/patient/appointments">
        Back to appointments
      </a>
    </>
  );
}
