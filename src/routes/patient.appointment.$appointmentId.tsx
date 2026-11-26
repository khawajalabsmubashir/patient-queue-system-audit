import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { AppointmentStatusBadge } from "@/components/appointment-tokens";
import { ClinicalLoading, useClinicalData } from "@/components/clinical";
import { Btn, PageHeader } from "@/components/qc";
import { api } from "@/api/client";
import { formatDateOnly, formatDateTime } from "@/domain/date-format";
import { ageOnDate } from "@/domain/patient-demographics";
import { usePatientToday } from "@/hooks/use-patient-today";
import { friendlyError } from "@/services/errors";
import type { AppointmentContext } from "@/types/clinical-workflow";

export const Route = createFileRoute("/patient/appointment/$appointmentId")({
  component: AppointmentDetail,
});

function AppointmentDetail() {
  const { appointmentId } = Route.useParams();
  const today = usePatientToday();
  const remote = useClinicalData<AppointmentContext>(
    `/appointments/${encodeURIComponent(appointmentId)}/context`,
  );
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!remote.data) return <ClinicalLoading error={remote.error} retry={remote.reload} />;
  const a = remote.data;
  const age = ageOnDate(a.dateOfBirth ?? null, today);
  const canCancel =
    !["cancelled", "completed", "no_show"].includes(a.status) &&
    !["serving", "completed"].includes(a.token?.status ?? "");

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader
        title={a.clinicName}
        sub={formatDateTime(a.scheduledAt)}
        right={<AppointmentStatusBadge status={a.status} />}
      />

      <section className="surface space-y-5 p-6">
        <div className="space-y-2.5 rounded-xl border border-border bg-muted/40 p-4 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Token Number</span>
            <span className="tabular font-bold text-foreground">
              {a.token?.tokenCode || "Not assigned"}
            </span>
          </div>
          {a.patientName && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Patient Name</span>
              <span className="font-semibold text-foreground">{a.patientName}</span>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Age / DOB</span>
            <span className="font-semibold text-foreground">
              {a.dateOfBirth
                ? `${age !== null ? `${age} yrs ` : ""}(${formatDateOnly(a.dateOfBirth)})`
                : "Not provided"}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Date &amp; Time</span>
            <span className="tabular-nums font-semibold text-foreground">
              {formatDateTime(a.scheduledAt)}
            </span>
          </div>
          {a.department && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Department</span>
              <span className="font-semibold text-foreground">{a.department}</span>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Attached Document</span>
            <span className="font-semibold text-foreground">
              {a.attachments.length
                ? a.attachments.map((f) => f.filename).join(", ")
                : "None attached"}
            </span>
          </div>
          <div className="border-t border-border pt-2.5">
            <span className="mb-1 block text-xs text-muted-foreground">
              Patient Notes / Symptoms
            </span>
            <p className="whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-2.5 text-sm text-foreground">
              {a.patientNotes || a.reason || "No additional notes provided."}
            </p>
          </div>
        </div>

        {a.status === "completed" && (
          <div className="space-y-2.5 rounded-xl border border-primary/25 bg-primary-soft p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Visit Prescription
              </span>
              <span className="text-xs font-semibold text-primary">PDF Ready</span>
            </div>
            <p className="text-sm text-foreground">
              {a.prescriptionSummary || "Consultation completed. Prescription ready to download."}
            </p>
            {a.visitId && (
              <a
                download
                href={`/api/patient/visits/${encodeURIComponent(a.visitId)}/prescription-pdf`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover"
              >
                <Download className="size-4" aria-hidden="true" />
                <span>Download Your Prescription (PDF)</span>
              </a>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {confirmCancel && (
          <div
            role="alert"
            className="space-y-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm"
          >
            <p className="font-semibold text-foreground">
              Cancel this appointment and release your token?
            </p>
            <div className="flex flex-wrap gap-2">
              <Btn
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => setConfirmCancel(false)}
              >
                Keep appointment
              </Btn>
              <Btn
                type="button"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setError("");
                  void api(`/patient/appointments/${encodeURIComponent(a.id)}/cancel`, {
                    method: "POST",
                    body: {},
                  })
                    .then(() => {
                      setConfirmCancel(false);
                      remote.reload();
                      window.dispatchEvent(new Event("queuecare:refresh"));
                      window.dispatchEvent(new Event("queuecare:updated"));
                    })
                    .catch((e) => setError(friendlyError(e)))
                    .finally(() => setBusy(false));
                }}
                className="bg-destructive text-destructive-foreground hover:opacity-90"
              >
                {busy ? "Cancelling…" : "Yes, Cancel"}
              </Btn>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          {canCancel && !confirmCancel && (
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive transition hover:bg-destructive/15"
            >
              Cancel Appointment
            </button>
          )}
          <Link
            to="/patient/appointments"
            className="ml-auto text-sm font-semibold text-primary hover:underline"
          >
            ← Back to appointments
          </Link>
        </div>
      </section>
    </div>
  );
}
