import { usePatientToday } from "@/hooks/use-patient-today";
import { SelectField } from "@/components/form-controls";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "@/api/client";
import { restoreSession } from "@/services/auth";
import { PageHeader, Btn, Field } from "@/components/qc";
import { ClinicalLoading, useClinicalData } from "@/components/clinical";
import { AccountSecurityPanel } from "@/components/final-operations";
import { friendlyError } from "@/services/errors";
import {
  MAX_FULL_NAME_LENGTH,
  MIN_FULL_NAME_LENGTH,
  MAX_PHONE_LENGTH,
  validatePersonName,
  validatePhoneNumber,
} from "@/domain/input-validation";
import type { PatientProfile } from "@/types/clinical";

export const Route = createFileRoute("/patient/profile")({ component: Profile });

function initialsOf(name?: string) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "PT";
  return parts.length === 1
    ? parts[0]!.slice(0, 2).toUpperCase()
    : (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function Profile() {
  const today = usePatientToday();
  const remote = useClinicalData<PatientProfile>("/patient/profile");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  if (!remote.data) return <ClinicalLoading error={remote.error} retry={remote.reload} />;
  const p = remote.data;
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      value = (k: string) => String(f.get(k) ?? "");
    const nameCheck = validatePersonName(value("fullName"), "Full name");
    if (!nameCheck.ok) {
      setError(nameCheck.error);
      return;
    }
    const phoneCheck = validatePhoneNumber(value("phone"));
    if (!phoneCheck.ok) {
      setError(phoneCheck.error);
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api("/patient/profile", {
        method: "PUT",
        body: {
          fullName: nameCheck.value,
          phone: phoneCheck.value,
          dateOfBirth: value("dateOfBirth") || null,
          gender: value("gender"),
        },
      });
      await restoreSession();
      remote.reload();
      setMessage("Personal details saved successfully.");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Profile & Account"
        sub="Manage your personal details and account security."
      />

      <section className="surface p-5 sm:p-7">
        <div className="flex items-center gap-3.5 border-b border-border pb-4">
          <div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-base font-bold text-primary-foreground">
            {initialsOf(p.fullName)}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Personal Details</h2>
            <p className="text-sm text-muted-foreground">
              One patient profile, shared across your clinics.
            </p>
          </div>
        </div>

        <form onSubmit={save} className="mt-5 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Full name"
              name="fullName"
              required
              minLength={MIN_FULL_NAME_LENGTH}
              maxLength={MAX_FULL_NAME_LENGTH}
              defaultValue={p.fullName}
            />
            <Field label="Email (sign-in identity)" value={p.email} readOnly />
            <Field
              label="Phone"
              name="phone"
              required
              minLength={7}
              maxLength={MAX_PHONE_LENGTH}
              defaultValue={p.phone}
            />
            <Field
              label="Date of birth"
              name="dateOfBirth"
              type="date"
              max={today}
              defaultValue={p.dateOfBirth ?? ""}
            />
            <label className="block text-sm font-medium sm:col-span-2 sm:max-w-xs">
              Gender
              <SelectField
                name="gender"
                defaultValue={p.gender}
                className="mt-2 block h-11 w-full rounded-lg border border-input bg-card px-3"
              >
                {[
                  ["", "Not provided"],
                  ["female", "Female"],
                  ["male", "Male"],
                  ["other", "Other"],
                  ["prefer_not_to_say", "Prefer not to say"],
                ].map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </SelectField>
            </label>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="text-sm text-success">
              {message}
            </p>
          )}
          <div className="flex justify-end">
            <Btn disabled={busy}>{busy ? "Saving…" : "Save Personal Details"}</Btn>
          </div>
        </form>
      </section>

      <AccountSecurityPanel embedded />

      <section className="surface p-5 sm:p-7">
        <h2 className="text-lg font-semibold text-foreground">Doctor-recorded information</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Contact your clinic to correct clinical information.
        </p>
        <dl className="mt-5 grid gap-5 sm:grid-cols-3">
          {[
            ["Allergies", p.allergies],
            ["Chronic conditions", p.chronicConditions],
            ["Current medications", p.currentMedications],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm font-medium text-foreground">{label}</dt>
              <dd className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">
                {value || "None recorded"}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
