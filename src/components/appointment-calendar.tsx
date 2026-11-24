import { AppointmentRows, todayKey } from "@/components/appointment-rows";
import type { FlowAppointment } from "@/types/workflow";
import { DoctorSnapshot } from "@/components/doctor-snapshot";
import { AppointmentSlotPicker } from "@/components/appointment-slot-picker";
import { SelectField } from "@/components/form-controls";
import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { useAuth } from "@/providers/auth-provider";
import { useClinicContext } from "@/providers/clinic-provider";
import { ClinicalLoading, useClinicalData } from "@/components/clinical";
import { Btn, Field, PageHeader } from "@/components/qc";
import { PatientPicker } from "@/components/patient-picker";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  MAX_FULL_NAME_LENGTH,
  MAX_PHONE_LENGTH,
  validatePersonName,
  validatePhoneNumber,
} from "@/domain/input-validation";
import { friendlyError } from "@/services/errors";
import type { Appointment } from "@/types/local";

type BookingPatientMode = "existing" | "lookup" | "walkin";

export function AppointmentCalendar() {
  const { selected } = useClinicContext(),
    { profile } = useAuth(),
    [view, setView] = useState(() =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("view") === "upcoming"
        ? "upcoming"
        : "day",
    ),
    [date, setDate] = useState(() =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Karachi",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    ),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [edit, setEdit] = useState<Appointment | "new" | null>(null),
    [patientMode, setPatientMode] = useState<BookingPatientMode>("existing"),
    [lookupEmail, setLookupEmail] = useState(""),
    [lookupBusy, setLookupBusy] = useState(false),
    [lookupPatient, setLookupPatient] = useState<{ id: string; name: string } | null>(null),
    [walkInName, setWalkInName] = useState(""),
    [walkInPhone, setWalkInPhone] = useState(""),
    [walkInEmail, setWalkInEmail] = useState("");
  const target =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("appointmentId");
  const receptionist = profile?.role === "receptionist",
    remote = useClinicalData<FlowAppointment[]>(
      (receptionist ? "/staff/appointment-flow?clinicId=" : "/admin/appointment-flow?clinicId=") +
        encodeURIComponent(selected),
    ),
    admin = profile?.role === "admin";
  useEffect(() => {
    const fn = () => remote.reload();
    window.addEventListener("queuecare:updated", fn);
    const timer = window.setInterval(() => {
      if (!document.hidden) fn();
    }, 30000);
    return () => {
      window.removeEventListener("queuecare:updated", fn);
      window.clearInterval(timer);
    };
  }, [selected]);
  function resetBookingState() {
    setError("");
    setPatientMode("existing");
    setLookupEmail("");
    setLookupPatient(null);
    setLookupBusy(false);
    setWalkInName("");
    setWalkInPhone("");
    setWalkInEmail("");
  }
  useEffect(() => {
    setEdit(null);
    resetBookingState();
  }, [selected]);
  useEffect(() => {
    const found = remote.data?.find((a) => a.id === target);
    if (found) {
      setView("day");
      setDate(found.scheduledAt.slice(0, 10));
    }
  }, [remote.data, target]);
  const filtered = remote.data
    ?.filter(
      (a) =>
        (!status || a.status === status) &&
        (view === "day"
          ? a.scheduledAt.startsWith(date)
          : view === "upcoming"
            ? a.scheduledAt.slice(0, 10) > todayKey()
            : a.scheduledAt.slice(0, 10) < todayKey() ||
              ["completed", "cancelled", "no_show"].includes(a.status)),
    )
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  async function action(a: Appointment, target: string, time = a.scheduledAt) {
    setBusy(true);
    setError("");
    try {
      await api("/operations/appointments/" + encodeURIComponent(a.id), {
        method: "PUT",
        body: { status: target, scheduledAt: time },
      });
      setEdit(null);
      remote.reload();
      window.dispatchEvent(new Event("queuecare:refresh"));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  async function findPatientByEmail() {
    const email = lookupEmail.trim();
    if (!email) {
      setError("Enter the patient's email address to search.");
      return;
    }
    setLookupBusy(true);
    setError("");
    try {
      const found = await api<{ id: string; name: string }>(
        "/staff/patient-lookup?clinicId=" +
          encodeURIComponent(selected) +
          "&email=" +
          encodeURIComponent(email),
      );
      setLookupPatient(found);
    } catch (e) {
      setLookupPatient(null);
      setError(friendlyError(e));
    } finally {
      setLookupBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Appointments"
        sub="Today → patient → consultation."
        right={
          selected !== "all" && (
            <Btn
              onClick={() => {
                resetBookingState();
                setEdit("new");
              }}
            >
              {receptionist ? "Book appointment" : "Add appointment"}
            </Btn>
          )
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {[
          ["day", "Today"],
          ["upcoming", "Upcoming"],
          ["past", "Past / completed"],
        ].map(([v, label]) => (
          <Btn
            key={v}
            variant={view === v ? "secondary" : "ghost"}
            onClick={() => {
              setView(v!);
              if (v === "day") setDate(todayKey());
            }}
          >
            {label}
          </Btn>
        ))}
        <details className="w-full">
          <summary className="cursor-pointer text-sm text-primary">Date and status filters</summary>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            {view === "day" && (
              <Field
                label="Date"
                type="date"
                value={date}
                onChange={(e) => {
                  if (e.target.value) setDate(e.target.value);
                }}
              />
            )}
            <label className="text-sm">
              Status
              <SelectField
                aria-label="Appointment status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                {["scheduled", "confirmed", "checked_in", "completed", "cancelled", "no_show"].map(
                  (v) => (
                    <option key={v} value={v}>
                      {v.replaceAll("_", " ")}
                    </option>
                  ),
                )}
              </SelectField>
            </label>
            <Btn variant="ghost" onClick={remote.reload}>
              Refresh
            </Btn>
          </div>
        </details>
      </div>
      {error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>
      )}
      {!remote.data ? (
        <ClinicalLoading error={remote.error} retry={remote.reload} />
      ) : (
        <div className="surface">
          <AppointmentRows
            items={filtered ?? []}
            onChanged={remote.reload}
            onOpen={(a) => {
              resetBookingState();
              setEdit(a);
            }}
            readOnly={receptionist}
          />
          {!filtered?.length && (
            <div className="p-6 text-sm text-muted-foreground">
              <p>
                {view === "day"
                  ? "No appointments are scheduled for this date."
                  : "No appointments match these filters."}
              </p>
              {view === "day" && (
                <button className="mt-3 text-primary" onClick={() => setView("upcoming")}>
                  View upcoming →
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <Dialog
        open={!!edit}
        onOpenChange={(o) => {
          if (!o) {
            setEdit(null);
            resetBookingState();
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogTitle>{edit === "new" ? "Book appointment" : "Manage appointment"}</DialogTitle>
          {admin && edit && edit !== "new" && (
            <DoctorSnapshot patientId={edit.patientId} appointmentId={edit.id} />
          )}
          <DialogDescription>
            {edit && edit !== "new"
              ? edit.patientName + " · " + edit.clinicName
              : receptionist
                ? "Select an existing patient, look up a registered patient by email, or register a walk-in patient."
                : "Select an existing patient for this clinic."}
          </DialogDescription>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {(edit === "new" ||
            (edit &&
              !["completed", "cancelled", "no_show", "checked_in"].includes(edit.status))) && (
            <form
              key={edit === "new" ? "new" : edit?.id}
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget),
                  time = String(f.get("scheduledAt"));
                if (edit && edit !== "new") {
                  void action(edit, "scheduled", time);
                  return;
                }
                const reason = String(f.get("reason") ?? "");
                let body: Record<string, unknown>;
                if (receptionist && patientMode === "walkin") {
                  const nameCheck = validatePersonName(walkInName, "Patient full name");
                  if (!nameCheck.ok) {
                    setError(nameCheck.error);
                    return;
                  }
                  const phoneCheck = validatePhoneNumber(walkInPhone);
                  if (!phoneCheck.ok) {
                    setError(phoneCheck.error);
                    return;
                  }
                  const cleanEmail = walkInEmail.trim();
                  body = {
                    walkIn: {
                      fullName: nameCheck.value,
                      phone: phoneCheck.value,
                      ...(cleanEmail ? { email: cleanEmail } : {}),
                    },
                    scheduledAt: time,
                    reason,
                  };
                } else if (receptionist && patientMode === "lookup") {
                  if (!lookupPatient?.id) {
                    setError("Search and select a registered patient by email first.");
                    return;
                  }
                  body = {
                    patientId: lookupPatient.id,
                    scheduledAt: time,
                    reason,
                  };
                } else {
                  const patientId = String(f.get("patientId") ?? "");
                  if (!patientId) {
                    setError("Choose a patient before booking.");
                    return;
                  }
                  body = {
                    patientId,
                    scheduledAt: time,
                    reason,
                  };
                }
                setBusy(true);
                setError("");
                void api(
                  (admin ? "/admin/appointments" : "/staff/appointments") +
                    "?clinicId=" +
                    encodeURIComponent(selected),
                  {
                    method: "POST",
                    body,
                  },
                )
                  .then(() => {
                    setEdit(null);
                    resetBookingState();
                    remote.reload();
                    window.dispatchEvent(new Event("queuecare:refresh"));
                    window.dispatchEvent(new Event("queuecare:updated"));
                  })
                  .catch((e) => setError(friendlyError(e)))
                  .finally(() => setBusy(false));
              }}
            >
              {edit === "new" &&
                (receptionist ? (
                  <div className="space-y-3">
                    <div
                      role="group"
                      aria-label="Patient booking type"
                      className="flex flex-wrap gap-2"
                    >
                      {(
                        [
                          ["existing", "Existing patient"],
                          ["lookup", "Find by email"],
                          ["walkin", "New walk-in"],
                        ] as const
                      ).map(([mode, label]) => (
                        <Btn
                          key={mode}
                          type="button"
                          variant={patientMode === mode ? "secondary" : "ghost"}
                          onClick={() => {
                            setPatientMode(mode);
                            setError("");
                          }}
                        >
                          {label}
                        </Btn>
                      ))}
                    </div>
                    {patientMode === "existing" && <PatientPicker />}
                    {patientMode === "lookup" && (
                      <div className="space-y-3 rounded-lg border border-border p-3">
                        <div className="flex flex-wrap items-end gap-2">
                          <div className="min-w-0 w-full sm:min-w-[200px] sm:flex-1">
                            <Field
                              label="Registered patient email"
                              type="email"
                              value={lookupEmail}
                              onChange={(e) => setLookupEmail(e.target.value)}
                              placeholder="patient@example.com"
                            />
                          </div>
                          <Btn
                            type="button"
                            variant="secondary"
                            disabled={lookupBusy || !lookupEmail.trim()}
                            onClick={() => void findPatientByEmail()}
                          >
                            {lookupBusy ? "Searching…" : "Find patient"}
                          </Btn>
                        </div>
                        {lookupPatient && (
                          <p className="text-sm font-medium text-foreground">
                            Selected patient: {lookupPatient.name}
                          </p>
                        )}
                      </div>
                    )}
                    {patientMode === "walkin" && (
                      <div className="space-y-3 rounded-lg border border-border p-3">
                        <Field
                          label="Patient full name"
                          name="walkInName"
                          value={walkInName}
                          maxLength={MAX_FULL_NAME_LENGTH}
                          required
                          onChange={(e) => setWalkInName(e.target.value)}
                        />
                        <Field
                          label="Phone number"
                          name="walkInPhone"
                          value={walkInPhone}
                          maxLength={MAX_PHONE_LENGTH}
                          required
                          onChange={(e) => setWalkInPhone(e.target.value)}
                        />
                        <Field
                          label="Email (optional)"
                          name="walkInEmail"
                          type="email"
                          value={walkInEmail}
                          maxLength={254}
                          onChange={(e) => setWalkInEmail(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <PatientPicker />
                ))}
              <AppointmentSlotPicker
                clinicId={edit && edit !== "new" ? edit.clinicId : selected}
                exclude={edit && edit !== "new" ? edit.id : undefined}
                defaultValue={edit && edit !== "new" ? edit.scheduledAt : date}
                refresh={error ? 1 : 0}
              />
              {edit === "new" && <Field label="Reason (optional)" name="reason" maxLength={300} />}
              <Btn disabled={busy}>{edit === "new" ? "Book appointment" : "Reschedule"}</Btn>
            </form>
          )}
          {edit && edit !== "new" && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
              {[
                ["confirmed", "Confirm"],
                ["checked_in", "Check in"],
                ["no_show", "Mark no-show"],
                ["cancelled", "Cancel appointment"],
              ]
                .filter(([state]) =>
                  state === "confirmed"
                    ? edit.status === "scheduled"
                    : state === "checked_in"
                      ? ["scheduled", "confirmed"].includes(edit.status) &&
                        edit.scheduledAt.startsWith(todayKey())
                      : state === "no_show"
                        ? ["scheduled", "confirmed"].includes(edit.status) &&
                          edit.scheduledAt.slice(0, 10) <= todayKey()
                        : !["completed", "cancelled", "no_show"].includes(edit.status),
                )
                .map(([s, label]) => (
                  <Btn
                    variant="secondary"
                    disabled={busy}
                    key={s}
                    onClick={() => void action(edit, s!)}
                  >
                    {label}
                  </Btn>
                ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
