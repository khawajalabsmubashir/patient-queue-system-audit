import { groupClinicLocations, normalizeLocation } from "@/domain/locations";
import { ConfirmAction } from "@/components/queue-feedback";
import { SearchableChoice } from "@/components/searchable-choice";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "@/api/client";
import { useAuth } from "@/providers/auth-provider";
import { useClinicContext } from "@/providers/clinic-provider";
import { ClinicalLoading, invalidateClinicalCache, useClinicalData } from "@/components/clinical";
import { AppLink } from "@/components/app-link";
import { PageHeader, Btn, Field } from "@/components/qc";
import { friendlyError } from "@/services/errors";
import { DEFAULT_CITIES } from "@/domain/cities";
import type { ManagedClinic } from "@/types/local";

export const Route = createFileRoute("/admin/clinics")({ component: Clinics });

export function Clinics() {
  const { profile } = useAuth(),
    { select } = useClinicContext();
  const remote = useClinicalData<ManagedClinic[]>("/admin/clinics");
  const clinics = remote.data ?? [];
  const [editing, setEditing] = useState<ManagedClinic | null | undefined>(undefined),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [fixedCity, setFixedCity] = useState(false),
    [city, setCity] = useState(""),
    [area, setArea] = useState(""),
    [created, setCreated] = useState<ManagedClinic | null>(null);

  const reloadClinics = () => {
    invalidateClinicalCache("/admin/");
    remote.reload();
  };

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const value = (key: string) => String(data.get(key) ?? "");
    if (!city.trim()) {
      setError("Select or enter a city before creating this clinic.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api<ManagedClinic>(`/admin/clinics${editing ? `/${editing.id}` : ""}`, {
        method: editing ? "PUT" : "POST",
        body: {
          city,
          area: area.trim() || undefined,
          name: value("name"),
          publicName: editing?.publicDisplayName ?? value("name"),
          address: value("address"),
          phone: value("phone"),
          department: editing?.department ?? "General",
          doctor: editing?.doctorName ?? profile?.fullName ?? "Doctor",
          opening: value("opening"),
          closing: value("closing"),
          showNext: editing?.publicDisplayShowNext ?? true,
          active: data.get("active") === "on",
          consultationFee: value("fee") === "" ? null : Number(value("fee")),
        },
      });
      if (!editing) setCreated(result);
      setEditing(undefined);
      reloadClinics();
      window.dispatchEvent(new Event("queuecare:refresh"));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };
  const cityOptions = [
    ...new Map(
      [...DEFAULT_CITIES, ...clinics.map((c) => c.city || "")]
        .filter(Boolean)
        .map((name) => [normalizeLocation(name), name]),
    ).values(),
  ].sort((a, b) => a.localeCompare(b));
  const areaOptions = [
    ...new Set(
      clinics
        .filter((c) => normalizeLocation(c.city || "") === normalizeLocation(city))
        .map((c) => c.area || "")
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));
  return (
    <>
      <PageHeader
        title="Clinics"
        sub="Manage your clinic locations. Appointment availability follows each clinic's opening and closing times automatically."
        right={
          editing === undefined && (
            <Btn
              onClick={() => {
                setFixedCity(false);
                setEditing(null);
                setCity("");
                setArea("");
                setCreated(null);
              }}
            >
              Add clinic
            </Btn>
          )
        }
      />
      {created && (
        <div className="surface mb-6 p-5">
          <p className="font-medium">Clinic created.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Appointment slots automatically follow {created.name}'s opening and closing hours (
            {created.openingTime} – {created.closingTime}).
          </p>
          <AppLink
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
            href="/admin/appointments"
          >
            View appointments →
          </AppLink>
        </div>
      )}
      {error && (
        <p role="alert" className="mb-5 text-sm text-destructive">
          {error}
        </p>
      )}
      {editing !== undefined && (
        <form onSubmit={save} key={editing?.id ?? "new"} className="surface mb-8 space-y-5 p-6">
          <h2 className="text-lg font-semibold">{editing ? "Edit clinic" : "New clinic"}</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {fixedCity ? (
              <Field label="City" value={city} readOnly />
            ) : (
              <SearchableChoice
                label="City"
                value={city}
                allowCreate
                options={cityOptions}
                onChange={(v) => {
                  setCity(v);
                }}
              />
            )}
            <SearchableChoice
              label="Area"
              value={area}
              allowCreate
              options={areaOptions}
              disabled={!city}
              onChange={(v) => setArea(v)}
            />
            <Field
              label="Clinic name *"
              name="name"
              required
              maxLength={120}
              defaultValue={editing?.name ?? ""}
            />
            <Field
              label="Address *"
              name="address"
              required
              maxLength={250}
              defaultValue={editing?.address ?? ""}
            />
            <Field
              label="Phone *"
              name="phone"
              required
              maxLength={30}
              defaultValue={editing?.phone ?? ""}
            />
            <Field
              label="Opening time"
              name="opening"
              type="time"
              required
              defaultValue={editing?.openingTime ?? "09:00"}
            />
            <Field
              label="Closing time"
              name="closing"
              type="time"
              required
              defaultValue={editing?.closingTime ?? "17:00"}
            />
            <Field
              label="Consultation fee (optional)"
              name="fee"
              type="number"
              min={0}
              max={10000000}
              defaultValue={editing?.consultationFee ?? ""}
            />
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <label>
              <input
                type="checkbox"
                name="active"
                defaultChecked={editing?.active ?? true}
                className="mr-2 accent-primary"
              />
              Active clinic
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Appointment booking slots and doctor hours automatically follow the clinic's opening and
            closing times. Deactivating stops new tokens and queue openings while preserving
            existing records.
          </p>
          <div className="flex gap-3">
            <Btn disabled={busy}>{busy ? "Saving…" : "Save clinic"}</Btn>
            <Btn
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => setEditing(undefined)}
            >
              Cancel
            </Btn>
          </div>
        </form>
      )}
      {!remote.data ? (
        <ClinicalLoading error={remote.error} retry={remote.reload} />
      ) : (
        <div className="surface divide-y divide-border">
          {!clinics.length && (
            <p className="p-6 text-sm text-muted-foreground">
              Add your first clinic to start scheduling patients.
            </p>
          )}
          {groupClinicLocations(clinics).map((g) => (
            <section key={normalizeLocation(g.city)} className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{g.city}</h2>
                <Btn
                  variant="secondary"
                  onClick={() => {
                    setFixedCity(true);
                    setCity(g.city);
                    setArea("");
                    setEditing(null);
                    setCreated(null);
                  }}
                >
                  + Add Area
                </Btn>
              </div>
              {g.areas.map((a) => (
                <section
                  key={normalizeLocation(a.area)}
                  className="divide-y divide-border overflow-hidden rounded-lg border border-border"
                >
                  {a.area !== "Area not yet specified" && (
                    <h3 className="bg-muted/25 px-5 py-3 text-sm font-semibold text-foreground">
                      {a.area}
                    </h3>
                  )}
                  {a.clinics.map((c) => (
                    <article key={c.id} className="p-5">
                      <div className="flex justify-between gap-3">
                        <h2 className="font-semibold">{c.name}</h2>
                        <span
                          className={
                            c.active ? "text-xs text-success" : "text-xs text-muted-foreground"
                          }
                        >
                          {c.active ? "Active" : "Inactive"}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-muted-foreground">{c.address}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {c.department} · {c.phone}
                      </p>
                      <p className="mt-3 text-sm tabular-nums">
                        {c.openingTime} – {c.closingTime}
                      </p>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Btn
                          variant="secondary"
                          onClick={() => {
                            setFixedCity(false);
                            setEditing(c);
                            setCity(c.city || "");
                            setArea(c.area || "");
                            setCreated(null);
                          }}
                        >
                          Edit clinic
                        </Btn>
                        <ConfirmAction
                          title="Delete or archive clinic?"
                          description="An empty clinic can be deleted. A clinic with patient or appointment records must be archived to preserve its history."
                          confirm="Delete empty clinic"
                          onConfirm={() =>
                            void api("/admin/clinics/" + c.id, { method: "DELETE" })
                              .then(() => {
                                reloadClinics();
                                window.dispatchEvent(new Event("queuecare:refresh"));
                              })
                              .catch((e) => setError(friendlyError(e)))
                          }
                        >
                          <Btn variant="ghost">Delete clinic</Btn>
                        </ConfirmAction>
                        {c.active && (
                          <ConfirmAction
                            title="Archive this clinic?"
                            description="Existing records will be preserved. This clinic will no longer accept bookings or queue actions."
                            confirm="Archive clinic"
                            onConfirm={() =>
                              void api("/admin/clinics/" + c.id + "?archive=1", {
                                method: "DELETE",
                              })
                                .then(() => {
                                  reloadClinics();
                                  window.dispatchEvent(new Event("queuecare:refresh"));
                                })
                                .catch((e) => setError(friendlyError(e)))
                            }
                          >
                            <Btn variant="ghost">Archive clinic</Btn>
                          </ConfirmAction>
                        )}
                        <Btn variant="ghost" onClick={() => select(c.id)}>
                          Select clinic
                        </Btn>
                        <a
                          className="inline-flex items-center px-3 text-sm text-primary hover:underline"
                          target="_blank"
                          rel="noreferrer"
                          href={`/public-display?clinicId=${encodeURIComponent(c.id)}`}
                        >
                          Public display
                        </a>
                      </div>
                    </article>
                  ))}
                </section>
              ))}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
