import { useEffect, useId, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Calendar, ChevronRight, Download, Plus, Ticket } from "lucide-react";
import {
  AttachmentFields,
  uploadAppointmentFiles,
  type SelectedAttachment,
} from "@/components/appointment-files";
import { AppointmentSlotPicker } from "@/components/appointment-slot-picker";
import { AppointmentStatusBadge, TokenActions } from "@/components/appointment-tokens";
import { ClinicalLoading, useClinicalData } from "@/components/clinical";
import { SelectField } from "@/components/form-controls";
import { Btn, Field, PageHeader } from "@/components/qc";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/api/client";
import { formatDateOnly, formatDateTime, sortPatientAppointments } from "@/domain/date-format";
import {
  MAX_FULL_NAME_LENGTH,
  MIN_FULL_NAME_LENGTH,
  validatePersonName,
} from "@/domain/input-validation";
import { ageOnDate, validBirthDate } from "@/domain/patient-demographics";
import { usePatientToday } from "@/hooks/use-patient-today";
import { useClinicContext } from "@/providers/clinic-provider";
import { friendlyError } from "@/services/errors";
import type { PatientProfile } from "@/types/clinical";
import type { AppointmentContext } from "@/types/clinical-workflow";
import type { Appointment } from "@/types/local";

export const Route = createFileRoute("/patient/appointments")({ component: Appointments });

export function Appointments() {
  const clinicSelectId = useId();
  const today = usePatientToday();
  const patient = useClinicalData<PatientProfile>("/patient/profile");
  const remote = useClinicalData<Appointment[]>("/patient/appointments");
  const { clinics, selected } = useClinicContext();

  const activeClinics = clinics.filter((c) => c.active !== false);

  const [booking, setBooking] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("book") === "1",
  );
  const [clinicId, setClinicId] = useState(selected === "all" ? "" : selected);
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [ageValue, setAgeValue] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<SelectedAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  const [statusFilter, setStatusFilter] = useState<"all" | "scheduled" | "completed" | "cancelled">(
    "all",
  );
  const [confirmed, setConfirmed] = useState<{
    id: string;
    clinicName: string;
    token: { id: string; tokenCode: string; status: string };
    scheduledAt: string;
  } | null>(null);

  const [detailAppointment, setDetailAppointment] = useState<Appointment | null>(null);
  const [detailContext, setDetailContext] = useState<AppointmentContext | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailAttempt, setDetailAttempt] = useState(0);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const effectiveClinicId =
    clinicId && activeClinics.some((c) => c.id === clinicId)
      ? clinicId
      : selected !== "all" && activeClinics.some((c) => c.id === selected)
        ? selected
        : (activeClinics[0]?.id ?? "");

  const progress = (key: string, state: string, fileErr = "") =>
    setFiles((previous) =>
      previous.map((f) => (f.key === key ? { ...f, state, error: fileErr } : f)),
    );

  useEffect(() => {
    if (!booking || !patient.data) return;
    setFullName((prev) => prev || patient.data!.fullName || "");
    const initialDob = patient.data.dateOfBirth ?? "";
    setDob((prev) => {
      if (prev) return prev;
      const calc = ageOnDate(initialDob, today);
      if (calc !== null) setAgeValue((a) => a || String(calc));
      return initialDob;
    });
  }, [booking, patient.data, today]);

  useEffect(() => {
    if (!detailAppointment) {
      setDetailContext(null);
      setDetailError("");
      setDetailLoading(false);
      setConfirmCancel(false);
      setDownloadError("");
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError("");
    void api<AppointmentContext>(
      `/appointments/${encodeURIComponent(detailAppointment.id)}/context`,
    )
      .then((ctx) => {
        if (!cancelled) setDetailContext(ctx);
      })
      .catch((e) => {
        if (!cancelled) setDetailError(friendlyError(e));
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailAppointment, detailAttempt]);

  const openBookingModal = () => {
    const p = patient.data;
    const initialDob = p?.dateOfBirth ?? "";
    const calcAge = ageOnDate(initialDob, today);
    setFullName(p?.fullName ?? "");
    setDob(initialDob);
    setAgeValue(calcAge !== null ? String(calcAge) : "");
    setClinicId(effectiveClinicId);
    setNotes("");
    setFiles([]);
    setError("");
    setConfirmDiscard(false);
    setConfirmed(null);
    setStatusMessage("");
    setBooking(true);
  };

  const resetAndCloseBooking = () => {
    setConfirmDiscard(false);
    setNotes("");
    setFiles([]);
    setError("");
    setFullName("");
    setDob("");
    setAgeValue("");
    setBooking(false);
  };

  const hasUnsavedBooking = Boolean(
    notes.trim() ||
    files.length > 0 ||
    (patient.data &&
      ((fullName.trim() && fullName.trim() !== patient.data.fullName.trim()) ||
        (dob && dob !== (patient.data.dateOfBirth ?? "")))),
  );

  const sortedAppointments = sortPatientAppointments(remote.data ?? [], today);
  const filterCounts = {
    all: sortedAppointments.length,
    scheduled: sortedAppointments.filter(
      (a) => !["cancelled", "completed", "no_show"].includes(a.status),
    ).length,
    completed: sortedAppointments.filter((a) => a.status === "completed").length,
    cancelled: sortedAppointments.filter((a) => a.status === "cancelled" || a.status === "no_show")
      .length,
  };
  const filteredAppointments = sortedAppointments.filter((a) => {
    if (statusFilter === "scheduled")
      return !["cancelled", "completed", "no_show"].includes(a.status);
    if (statusFilter === "completed") return a.status === "completed";
    if (statusFilter === "cancelled") return a.status === "cancelled" || a.status === "no_show";
    return true;
  });

  const detailStatus = detailContext?.status ?? detailAppointment?.status ?? "scheduled";
  const detailClinicName = detailContext?.clinicName ?? detailAppointment?.clinicName ?? "";
  const detailClinicId = detailContext?.clinicId ?? detailAppointment?.clinicId ?? "";
  const detailDepartment =
    detailContext?.department ||
    clinics.find((c) => c.id === detailClinicId)?.department ||
    "Outpatient";
  const detailTokenCode =
    detailContext?.token?.tokenCode ?? detailAppointment?.token?.tokenCode ?? "";
  const detailTokenStatus = detailContext?.token?.status ?? detailAppointment?.token?.status ?? "";
  const detailPatientName =
    detailContext?.patientName ||
    detailAppointment?.patientName ||
    patient.data?.fullName ||
    "Patient";
  const detailDob = detailContext?.dateOfBirth ?? patient.data?.dateOfBirth ?? null;
  const detailAge = ageOnDate(detailDob, today);
  const detailScheduledAt = detailContext?.scheduledAt ?? detailAppointment?.scheduledAt ?? "";
  const detailNotes =
    detailContext?.patientNotes || detailContext?.reason || detailAppointment?.reason || "";
  const canCancelDetail =
    Boolean(detailAppointment) &&
    !["cancelled", "completed", "no_show"].includes(detailStatus) &&
    !["serving", "completed"].includes(detailTokenStatus);

  const handleCancelDetailAppointment = async () => {
    if (!detailAppointment) return;
    setCancelBusy(true);
    setDetailError("");
    try {
      await api(`/patient/appointments/${encodeURIComponent(detailAppointment.id)}/cancel`, {
        method: "POST",
        body: {},
      });
      setDetailAppointment(null);
      setConfirmCancel(false);
      setStatusMessage("Appointment cancelled.");
      remote.reload();
      window.dispatchEvent(new Event("queuecare:refresh"));
      window.dispatchEvent(new Event("queuecare:updated"));
    } catch (e) {
      setDetailError(friendlyError(e));
    } finally {
      setCancelBusy(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="surface p-5 sm:p-6">
        <PageHeader
          title="Your Appointments"
          sub="Select an appointment to view details or book a new visit."
          right={
            <Btn
              onClick={openBookingModal}
              className="min-h-11 w-full font-semibold sm:min-h-10 sm:w-auto"
            >
              <Plus className="size-4" aria-hidden="true" />
              <span>Book Appointment</span>
            </Btn>
          }
        />

        <div
          role="tablist"
          aria-label="Filter appointments by status"
          className="inline-flex w-full items-center gap-1.5 overflow-x-auto rounded-xl border border-border bg-muted/50 p-1 sm:w-auto"
        >
          {(
            [
              ["all", "All"],
              ["scheduled", "Scheduled"],
              ["completed", "Completed"],
              ["cancelled", "Cancelled"],
            ] as const
          ).map(([key, label]) => {
            const active = statusFilter === key;
            const count = filterCounts[key];
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusFilter(key)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all sm:px-4 sm:text-sm ${
                  active
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{label}</span>
                <span
                  className={`tabular rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                    active
                      ? "bg-primary-soft text-primary"
                      : "bg-background/80 text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {statusMessage && (
        <div
          role="status"
          className="rounded-xl border border-primary/25 bg-primary-soft px-4 py-3 text-sm font-medium text-primary"
        >
          {statusMessage}
        </div>
      )}

      {confirmed && (
        <section className="surface p-5 sm:p-6" role="status">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="inline-flex items-center rounded-md border border-success/25 bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">
                Confirmed
              </span>
              <h2 className="mt-2 text-base font-semibold text-foreground">
                Appointment confirmed
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {confirmed.clinicName} ·{" "}
                <span className="tabular-nums">{formatDateTime(confirmed.scheduledAt)}</span>
              </p>
              <p className="tabular mt-3 text-4xl font-bold text-primary">
                {confirmed.token.tokenCode}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setDetailAppointment({
                  id: confirmed.id,
                  clinicId: effectiveClinicId,
                  clinicName: confirmed.clinicName,
                  patientId: patient.data?.id ?? "",
                  patientName: patient.data?.fullName ?? "",
                  scheduledAt: confirmed.scheduledAt,
                  status: "scheduled",
                  reason: "",
                  token: confirmed.token,
                })
              }
              className="text-sm font-semibold text-primary hover:underline"
            >
              View details →
            </button>
          </div>
          <TokenActions token={confirmed.token} onChanged={remote.reload} />
          {files.length > 0 && (
            <div className="mt-4 space-y-3">
              <p role="status" className="text-sm">
                {files.every((f) => f.state === "Uploaded")
                  ? "All supporting documents uploaded privately."
                  : "Your appointment is confirmed. Retry any unfinished supporting documents below; do not book again."}
              </p>
              <AttachmentFields files={files} onChange={setFiles} disabled={uploading} />
              <Btn
                type="button"
                disabled={uploading || files.every((f) => f.state === "Uploaded")}
                onClick={() => {
                  setUploading(true);
                  void uploadAppointmentFiles(confirmed.id, files, progress).finally(() =>
                    setUploading(false),
                  );
                }}
              >
                Retry unfinished uploads
              </Btn>
            </div>
          )}
        </section>
      )}

      {!remote.data ? (
        <ClinicalLoading error={remote.error} retry={remote.reload} />
      ) : filteredAppointments.length > 0 ? (
        <div className="grid gap-4">
          {filteredAppointments.map((a) => {
            const isCancelled = a.status === "cancelled" || a.status === "no_show";
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setDetailAppointment(a)}
                className="surface group flex w-full cursor-pointer flex-col gap-4 p-4 text-left transition hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between sm:p-5"
              >
                <div className="flex min-w-0 items-start gap-3.5 sm:items-center sm:gap-4">
                  <div
                    className={`flex min-w-[4.75rem] shrink-0 flex-col items-center justify-center rounded-xl border px-3 py-2.5 text-center ${
                      isCancelled
                        ? "border-border bg-muted/50 text-muted-foreground"
                        : "border-primary/25 bg-primary-soft/75 text-primary"
                    }`}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider opacity-75">
                      Token
                    </span>
                    <span className="tabular mt-0.5 text-base font-extrabold tracking-tight sm:text-lg">
                      {a.token?.tokenCode || "—"}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-words text-base font-bold text-foreground sm:text-lg">
                        {a.clinicName}
                      </span>
                      <AppointmentStatusBadge status={a.status} />
                      {a.status === "completed" && (
                        <span className="rounded-full border border-primary/25 bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
                          Prescription
                        </span>
                      )}
                    </div>
                    <p className="tabular-nums flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
                      <Calendar className="size-3.5 shrink-0" aria-hidden="true" />
                      <span>{formatDateTime(a.scheduledAt)}</span>
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border/70 pt-3 text-xs font-semibold text-primary sm:justify-end sm:border-t-0 sm:pt-0 sm:text-sm">
                  <span className="group-hover:underline">View details</span>
                  <ChevronRight
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="surface flex flex-col items-center justify-center gap-3 p-8 text-center sm:p-10">
          <div className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <Ticket className="size-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {remote.data.length
                ? "No appointments match this filter"
                : "No appointments scheduled yet"}
            </p>
            <p className="text-xs text-muted-foreground sm:text-sm">
              {remote.data.length
                ? "Switch tabs above to view your other clinic visits."
                : "Book an appointment to reserve your slot and receive a queue token."}
            </p>
          </div>
          {!remote.data.length && (
            <Btn onClick={openBookingModal} className="mt-1">
              <Plus className="size-4" aria-hidden="true" />
              <span>Book Appointment</span>
            </Btn>
          )}
        </div>
      )}

      {/* MODAL 1: APPOINTMENT DETAILS MODAL */}
      <Dialog
        open={Boolean(detailAppointment)}
        onOpenChange={(open) => {
          if (cancelBusy) return;
          if (!open) setDetailAppointment(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] max-w-md overflow-hidden rounded-xl">
          <div className="pr-8">
            <AppointmentStatusBadge status={detailStatus} />
            <DialogTitle className="mt-2.5 text-xl font-bold text-foreground">
              {detailClinicName || "Appointment Details"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Full appointment details, attached documents, and visit prescription.
            </DialogDescription>
          </div>

          <div className="space-y-2.5 rounded-xl border border-border bg-muted/40 p-4 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Token Number</span>
              <span className="tabular font-bold text-foreground">
                {detailTokenCode || "Not assigned"}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Patient Name</span>
              <span className="text-right font-semibold text-foreground">{detailPatientName}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Age / DOB</span>
              <span className="text-right font-semibold text-foreground">
                {detailDob
                  ? `${detailAge !== null ? `${detailAge} yrs ` : ""}(${formatDateOnly(detailDob)})`
                  : "Not provided"}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Date &amp; Time</span>
              <span className="tabular-nums text-right font-semibold text-foreground">
                {formatDateTime(detailScheduledAt)}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Department</span>
              <span className="text-right font-semibold text-foreground">{detailDepartment}</span>
            </div>
            <div className="flex items-start justify-between gap-2">
              <span className="shrink-0 text-muted-foreground">Attached Document</span>
              <div className="min-w-0 text-right">
                {detailLoading && !detailContext ? (
                  <span className="text-xs text-muted-foreground">Loading…</span>
                ) : detailContext?.attachments?.length ? (
                  <div className="space-y-1">
                    {detailContext.attachments.map((file) =>
                      file.status === "ready" ? (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => {
                            setDownloadError("");
                            void api<{ url: string }>(
                              `/appointment-attachments/${file.id}/download`,
                            )
                              .then((d) => {
                                const a = document.createElement("a");
                                a.href = d.url;
                                a.target = "_blank";
                                a.rel = "noopener noreferrer";
                                a.click();
                              })
                              .catch((err) => setDownloadError(friendlyError(err)));
                          }}
                          className="block max-w-[200px] truncate text-right font-semibold text-primary hover:underline"
                          title={`Download ${file.filename}`}
                        >
                          {file.filename}
                        </button>
                      ) : (
                        <span
                          key={file.id}
                          className="block max-w-[200px] truncate font-medium text-muted-foreground"
                        >
                          {file.filename} ({file.status})
                        </span>
                      ),
                    )}
                  </div>
                ) : (
                  <span className="font-medium text-muted-foreground">None attached</span>
                )}
              </div>
            </div>
            <div className="border-t border-border pt-2.5">
              <span className="mb-1.5 block text-xs text-muted-foreground">
                Patient Notes / Symptoms
              </span>
              <p className="whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-2.5 text-xs text-foreground sm:text-sm">
                {detailNotes || "No additional notes provided."}
              </p>
            </div>
          </div>

          {downloadError && (
            <p role="alert" className="text-xs text-destructive">
              {downloadError}
            </p>
          )}

          {detailError && (
            <div
              role="alert"
              className="flex items-center justify-between gap-2 text-xs text-destructive"
            >
              <span>{detailError}</span>
              <button
                type="button"
                onClick={() => setDetailAttempt((n) => n + 1)}
                className="font-semibold underline"
              >
                Retry
              </button>
            </div>
          )}

          {detailStatus === "completed" && (
            <div className="space-y-2.5 rounded-xl border border-primary/25 bg-primary-soft p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Visit Prescription
                </span>
                <span className="text-xs font-semibold text-primary">
                  {detailContext?.visitId ? "PDF Ready" : "Completed"}
                </span>
              </div>
              <p className="text-xs text-foreground sm:text-sm">
                {detailLoading && !detailContext
                  ? "Loading prescription summary…"
                  : detailContext?.prescriptionSummary ||
                    "Consultation completed. Prescription ready to download."}
              </p>
              {detailContext?.visitId ? (
                <a
                  download
                  href={`/api/patient/visits/${encodeURIComponent(detailContext.visitId)}/prescription-pdf`}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary-hover sm:text-sm"
                >
                  <Download className="size-4" aria-hidden="true" />
                  <span>Download Your Prescription (PDF)</span>
                </a>
              ) : !detailLoading ? (
                <p className="text-xs text-muted-foreground">
                  Prescription PDF will appear on your Home screen once finalized by the clinic.
                </p>
              ) : null}
            </div>
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
                  disabled={cancelBusy}
                  onClick={() => setConfirmCancel(false)}
                  className="flex-1"
                >
                  Keep appointment
                </Btn>
                <Btn
                  type="button"
                  disabled={cancelBusy}
                  onClick={() => void handleCancelDetailAppointment()}
                  className="flex-1 bg-destructive text-destructive-foreground hover:opacity-90"
                >
                  {cancelBusy ? "Cancelling…" : "Yes, Cancel"}
                </Btn>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2.5 pt-1 sm:flex-row">
            {canCancelDetail && !confirmCancel && (
              <button
                type="button"
                disabled={cancelBusy}
                onClick={() => setConfirmCancel(true)}
                className="min-h-11 flex-1 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive transition hover:bg-destructive/15 disabled:opacity-50"
              >
                Cancel Appointment
              </button>
            )}
            <Btn
              type="button"
              onClick={() => setDetailAppointment(null)}
              disabled={cancelBusy}
              className="min-h-11 flex-1 rounded-xl py-2.5 font-semibold"
            >
              Done
            </Btn>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: BOOK APPOINTMENT MODAL */}
      <Dialog
        open={booking}
        onOpenChange={(open) => {
          if (busy) return;
          if (!open && hasUnsavedBooking) {
            setConfirmDiscard(true);
            return;
          }
          if (!open) resetAndCloseBooking();
          else setBooking(true);
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-hidden rounded-xl"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            if (busy) {
              e.preventDefault();
              return;
            }
            if (hasUnsavedBooking) {
              e.preventDefault();
              setConfirmDiscard(true);
            }
          }}
        >
          <div className="border-b border-border pb-3 pr-8">
            <DialogTitle className="text-xl font-bold">Book Appointment</DialogTitle>
            <DialogDescription className="mt-0.5 text-xs sm:text-sm">
              Confirm your details and pick a clinic time to receive your token.
            </DialogDescription>
          </div>

          {confirmDiscard && (
            <div
              role="alert"
              className="rounded-lg border border-warning/40 bg-warning-soft/50 p-3 text-sm"
            >
              <p className="font-medium text-foreground">Discard unsaved appointment details?</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your entered notes, attachments, or changes will be lost.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Btn type="button" variant="secondary" onClick={() => setConfirmDiscard(false)}>
                  Keep editing
                </Btn>
                <Btn type="button" variant="danger" onClick={resetAndCloseBooking}>
                  Discard &amp; close
                </Btn>
              </div>
            </div>
          )}

          <form
            className="space-y-4 pb-[env(safe-area-inset-bottom)]"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const nameCheck = validatePersonName(
                fullName || String(f.get("fullName") ?? ""),
                "Full name",
              );
              if (!nameCheck.ok) {
                setError(nameCheck.error);
                return;
              }
              const submittedDob = dob || String(f.get("dateOfBirth") ?? "");
              if (!submittedDob || !validBirthDate(submittedDob, today)) {
                setError("Please enter a valid date of birth.");
                return;
              }
              const scheduledAt = String(f.get("scheduledAt") ?? "");
              if (!scheduledAt) {
                setError("Please select an appointment time.");
                return;
              }
              const selectedClinicId = effectiveClinicId || String(f.get("clinicId") ?? "");
              if (!selectedClinicId) {
                setError("Please select a clinic.");
                return;
              }
              setBusy(true);
              setError("");
              void (async () => {
                if (!patient.data)
                  throw Error("Your patient profile is still loading. Please try again.");
                await api("/patient/profile", {
                  method: "PUT",
                  body: {
                    fullName: nameCheck.value,
                    phone: patient.data.phone,
                    dateOfBirth: submittedDob,
                    gender: patient.data.gender || "",
                  },
                });
                const booked = await api<{ id: string; token: { id: string; tokenCode: string } }>(
                  "/patient/appointments",
                  {
                    method: "POST",
                    body: {
                      clinicId: selectedClinicId,
                      scheduledAt,
                      reason: "",
                      patientNotes: notes,
                    },
                  },
                );
                const clinicName =
                  activeClinics.find((c) => c.id === selectedClinicId)?.name ??
                  clinics.find((c) => c.id === selectedClinicId)?.name ??
                  "Clinic";
                setConfirmed({
                  ...booked,
                  clinicName,
                  token: { ...booked.token, status: "waiting" },
                  scheduledAt,
                });
                if (files.length) {
                  await uploadAppointmentFiles(booked.id, files, progress);
                }
                patient.reload();
                remote.reload();
                window.dispatchEvent(new Event("queuecare:refresh"));
                window.dispatchEvent(new Event("queuecare:updated"));
                setBooking(false);
                setConfirmDiscard(false);
              })()
                .catch((err) => {
                  setError(friendlyError(err));
                  setRefresh((n) => n + 1);
                })
                .finally(() => setBusy(false));
            }}
          >
            {!patient.data ? (
              <ClinicalLoading error={patient.error} retry={patient.reload} />
            ) : (
              <>
                <Field
                  label="Full Name *"
                  name="fullName"
                  required
                  minLength={MIN_FULL_NAME_LENGTH}
                  maxLength={MAX_FULL_NAME_LENGTH}
                  autoComplete="name"
                  placeholder="Enter patient full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <Field
                    label="Date of Birth *"
                    name="dateOfBirth"
                    type="date"
                    required
                    max={today}
                    value={dob}
                    onChange={(e) => {
                      const nextDob = e.target.value;
                      setDob(nextDob);
                      const calc = ageOnDate(nextDob, today);
                      setAgeValue(calc !== null ? String(calc) : "");
                    }}
                  />
                  <Field
                    label="Age (Years) *"
                    name="age"
                    type="number"
                    min={0}
                    max={120}
                    placeholder="e.g. 34"
                    required
                    value={ageValue}
                    onChange={(e) => setAgeValue(e.target.value)}
                  />
                </div>

                <div className="block">
                  <label htmlFor={clinicSelectId} className="mb-1.5 block text-sm font-medium">
                    Select Clinic / Center *
                  </label>
                  <SelectField
                    id={clinicSelectId}
                    name="clinicId"
                    aria-label="Select Clinic / Center"
                    required
                    className="h-11 w-full rounded-lg border border-input bg-card px-3"
                    value={effectiveClinicId}
                    onChange={(e) => {
                      setClinicId(e.target.value);
                      setError("");
                    }}
                  >
                    {!activeClinics.length && <option value="">No clinics available</option>}
                    {activeClinics.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </SelectField>
                </div>

                {effectiveClinicId && (
                  <AppointmentSlotPicker
                    clinicId={effectiveClinicId}
                    refresh={refresh}
                    variant="portal"
                  />
                )}

                <AttachmentFields files={files} onChange={setFiles} disabled={busy} />

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">
                    Notes / Symptoms{" "}
                    <span className="font-normal text-muted-foreground">(Optional)</span>
                  </span>
                  <textarea
                    aria-label="Notes / Symptoms (Optional)"
                    maxLength={2000}
                    rows={2}
                    placeholder="Write any symptoms, pain area, or note for the doctor..."
                    className="w-full rounded-lg border border-input bg-card p-3 text-base outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
              </>
            )}

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex gap-2.5 pt-2">
              <Btn
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  if (hasUnsavedBooking) setConfirmDiscard(true);
                  else resetAndCloseBooking();
                }}
                className="min-h-11 flex-1 rounded-xl py-2.5 font-semibold"
              >
                Cancel
              </Btn>
              <Btn
                type="submit"
                disabled={busy || !effectiveClinicId || !patient.data}
                className="min-h-11 flex-1 rounded-xl py-2.5 font-bold"
              >
                {busy ? "Booking…" : "Confirm Booking"}
              </Btn>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
