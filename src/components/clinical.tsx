import type { PrintIdentity } from "@/types/clinical-workflow";
import { PrescriptionPreview } from "@/components/prescription-preview";
import { DoctorSignature, PrintBranding } from "@/components/final-operations";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { api } from "@/api/client";
import { Btn, PageHeader } from "@/components/qc";
import { formatDateOnly } from "@/domain/date-format";
import { friendlyError } from "@/services/errors";
import type { ClinicalVisit, PatientVisit } from "@/types/clinical";
type CacheEntry = { data: unknown; fetchedAt: number; stale: boolean };
const CLINICAL_STALE_MS = 30_000;
const clinicalCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<unknown>>();
let listenersRegistered = false;

export function seedClinicalCache<T>(path: string, data: T) {
  ensureCacheListeners();
  const existing = clinicalCache.get(path);
  if (existing && !existing.stale && Date.now() - existing.fetchedAt < CLINICAL_STALE_MS) return;
  clinicalCache.set(path, { data, fetchedAt: Date.now(), stale: false });
}

export function clearClinicalCache() {
  clinicalCache.clear();
  inFlightRequests.clear();
}

export function invalidateClinicalCache(prefix?: string) {
  for (const [key, entry] of clinicalCache.entries()) {
    if (!prefix || key.startsWith(prefix)) {
      entry.stale = true;
    }
  }
}

function ensureCacheListeners() {
  if (listenersRegistered || typeof window === "undefined") return;
  listenersRegistered = true;
  window.addEventListener("queuecare:invalidate-cache", () => invalidateClinicalCache());
  window.addEventListener("queuecare:refresh", () => invalidateClinicalCache());
  window.addEventListener("queuecare:updated", () => invalidateClinicalCache());
  window.addEventListener("queuecare:clear-cache", () => clearClinicalCache());
  window.addEventListener("queuecare:session-expired", () => clearClinicalCache());
}

function fetchClinical<T>(path: string, force = false): Promise<T> {
  ensureCacheListeners();
  const existing = !force ? inFlightRequests.get(path) : undefined;
  if (existing) return existing as Promise<T>;
  const req = Promise.resolve(api<T>(path))
    .then((next) => {
      clinicalCache.set(path, { data: next, fetchedAt: Date.now(), stale: false });
      return next;
    })
    .finally(() => {
      if (inFlightRequests.get(path) === req) {
        inFlightRequests.delete(path);
      }
    });
  inFlightRequests.set(path, req);
  return req;
}

export function prefetchClinicalData(path: string | null) {
  if (!path) return;
  ensureCacheListeners();
  const cached = clinicalCache.get(path);
  if (cached && !cached.stale && Date.now() - cached.fetchedAt < CLINICAL_STALE_MS) return;
  void fetchClinical(path).catch(() => {});
}

export function useClinicalData<T>(path: string | null, options?: { keepPreviousData?: boolean }) {
  ensureCacheListeners();
  const cached = path ? (clinicalCache.get(path) as CacheEntry | undefined) : undefined;
  const [data, setData] = useState<T | null>(() => (cached ? (cached.data as T) : null));
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const loadedPath = useRef<string | null>(cached && path ? path : null);
  const reload = useCallback(() => {
    if (path) {
      const entry = clinicalCache.get(path);
      if (entry) entry.stale = true;
    }
    setAttempt((n) => n + 1);
  }, [path]);

  useEffect(() => {
    if (!path) {
      setData(null);
      loadedPath.current = null;
      return;
    }
    let active = true;
    const entry = clinicalCache.get(path);
    if (entry) {
      loadedPath.current = path;
      setData(entry.data as T);
      const fresh = !entry.stale && Date.now() - entry.fetchedAt < CLINICAL_STALE_MS;
      if (fresh && attempt === 0) {
        setError("");
        return () => {
          active = false;
        };
      }
    } else if (loadedPath.current !== path && !options?.keepPreviousData) {
      setData(null);
    }
    setError("");
    fetchClinical<T>(path, attempt > 0)
      .then((next) => {
        if (active) {
          loadedPath.current = path;
          setData(next);
        }
      })
      .catch((e) => {
        if (active) setError(friendlyError(e));
      });
    return () => {
      active = false;
    };
  }, [path, attempt, options?.keepPreviousData]);

  return { data, error, reload };
}
export function ClinicalLoading({ error, retry }: { error: string; retry: () => void }) {
  return (
    <div className="surface p-8 text-sm">
      {error ? (
        <>
          <p role="alert" className="mb-4 text-destructive">
            {error}
          </p>
          <Btn variant="secondary" onClick={retry}>
            Try again
          </Btn>
        </>
      ) : (
        <p className="text-muted-foreground">Loading patient record…</p>
      )}
    </div>
  );
}
export function StartConsultation({
  patientId,
  clinicId,
  tokenId,
  appointmentId,
  compact = false,
}: {
  patientId: string;
  clinicId: string;
  tokenId?: string | undefined;
  appointmentId?: string | undefined;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const visit = await api<ClinicalVisit>(
        `/admin/patients/${encodeURIComponent(patientId)}/visits`,
        {
          method: "POST",
          body: {
            clinicId,
            ...(tokenId ? { tokenId } : {}),
            ...(appointmentId ? { appointmentId } : {}),
          },
        },
      );
      window.dispatchEvent(new Event("queuecare:refresh"));
      await navigate({ to: "/admin/visits/$visitId", params: { visitId: visit.id } });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={compact ? "min-w-0 shrink-0" : undefined}>
      <Btn
        className="whitespace-nowrap"
        type="button"
        disabled={busy || clinicId === "all"}
        onClick={() => void start()}
      >
        {busy ? "Opening…" : "Start Consultation"}
      </Btn>
      {clinicId === "all" && (
        <p className="mt-2 text-xs text-muted-foreground">
          Select a clinic to start a consultation.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
export function VisitTimeline({
  visits,
  admin = false,
}: {
  visits: PatientVisit[];
  admin?: boolean;
}) {
  return (
    <div className="surface divide-y divide-border overflow-hidden">
      {visits.length ? (
        visits.map((v) => {
          const content = (
            <>
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-medium">{v.clinicName}</p>
                <span className="text-xs text-muted-foreground">
                  {formatDateOnly(v.visitAt)} ·{" "}
                  {v.status === "completed" ? "Completed" : "In progress"}
                </span>
              </div>
              <p className="mt-2 text-sm">
                {admin ? (v as ClinicalVisit).reasonForVisit : v.patientSummary || "Visit summary"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {v.diagnosis || "Diagnosis not released"}
              </p>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>{v.doctorName}</span>
                <span>
                  {v.prescription.items.length ? "Prescription available" : "No prescription"}
                </span>
                {v.followUpDate && <span>Follow-up: {formatDateOnly(v.followUpDate)}</span>}
              </div>
            </>
          );
          return admin ? (
            <Link
              key={v.id}
              to="/admin/visits/$visitId"
              params={{ visitId: v.id }}
              className="block p-5 hover:bg-muted/40"
            >
              {content}
            </Link>
          ) : (
            <article key={v.id} className="p-5">
              {content}
            </article>
          );
        })
      ) : (
        <p className="p-8 text-sm text-muted-foreground">
          No clinical visits yet. Previous queue tokens remain in queue history.
        </p>
      )}
    </div>
  );
}
export function PrescriptionView({
  visit,
  printIdentity,
}: {
  visit: PatientVisit;
  printIdentity?: PrintIdentity;
}) {
  return (
    <section className="prescription-sheet surface mt-6 p-6 md:p-9">
      <p className="mb-3 text-sm font-semibold text-primary">Neuro Spine Care Center</p>
      <PrintBranding
        clinicId={visit.clinicId}
        {...(printIdentity ? { data: printIdentity.branding } : {})}
      />
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <h2 className="text-2xl font-semibold">{visit.clinicName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{visit.clinicAddress}</p>
          <p className="text-sm text-muted-foreground">{visit.clinicPhone}</p>
        </div>
        <div className="text-sm">
          <p className="font-medium">Prescription</p>
          <p>{visit.doctorName}</p>
          <p>{formatDateOnly(visit.prescription.prescribedAt ?? visit.visitAt)}</p>
        </div>
      </div>
      <p className="my-5 text-sm">
        <span className="text-muted-foreground">Patient: </span>
        <strong>{visit.patientName}</strong>
      </p>
      <p className="mb-3 text-3xl font-semibold text-primary" aria-label="Prescription">
        Rx
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[540px] text-left text-sm">
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              {["Medicine", "Dose", "Frequency", "Duration", "Instructions"].map((h) => (
                <th key={h} className="px-2 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visit.prescription.items.map((m, i) => (
              <tr key={i} className="border-b border-border">
                {[
                  [m.medicine, m.strength, m.dosageForm].filter(Boolean).join(" "),
                  m.dose,
                  m.frequency,
                  m.duration,
                  m.instructions,
                ].map((v, j) => (
                  <td key={j} className="whitespace-pre-wrap px-2 py-4 align-top">
                    {v || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visit.prescription.items.length && (
        <p className="py-5 text-sm text-muted-foreground">No medicines prescribed.</p>
      )}
      {visit.prescription.instructions && (
        <p className="mt-6 whitespace-pre-wrap text-sm">{visit.prescription.instructions}</p>
      )}
      {visit.followUpDate && <p className="mt-5 text-sm">Follow-up: {visit.followUpDate}</p>}
      <p className="mt-2 whitespace-pre-wrap text-sm">{visit.followUpInstructions}</p>
      <DoctorSignature {...(printIdentity ? { data: printIdentity.signature } : {})} />
    </section>
  );
}
export function PatientVisitView({
  visit,
  prescriptionOnly = false,
}: {
  visit: PatientVisit;
  prescriptionOnly?: boolean;
}) {
  return (
    <div className={prescriptionOnly ? "" : "print-visit-summary"}>
      <div>
        <div className="print:hidden">
          <PageHeader
            title={prescriptionOnly ? "Prescription" : "Visit details"}
            sub={`${visit.clinicName} · ${formatDateOnly(visit.visitAt)}`}
            right={
              prescriptionOnly ? (
                <PrescriptionPreview visit={visit} />
              ) : (
                <Btn variant="secondary" onClick={() => window.print()}>
                  Print visit summary
                </Btn>
              )
            }
          />
        </div>
        {!prescriptionOnly && (
          <section className="visit-summary-sheet surface space-y-5 p-6">
            <PrintBranding clinicId={visit.clinicId} />
            <p className="text-sm">
              {visit.patientName} · {visit.clinicName} · {formatDateOnly(visit.visitAt)}
            </p>
            {[
              ["Visit summary", visit.patientSummary],
              ["Diagnosis", visit.diagnosis],
              ["Treatment plan", visit.treatmentPlan],
              ["Follow-up instructions", visit.followUpInstructions],
            ].map(([label, value]) => (
              <div key={label}>
                <h2 className="text-sm font-semibold">{label}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {value || "Not provided"}
                </p>
              </div>
            ))}
          </section>
        )}
      </div>
      <PrescriptionView visit={visit} />
    </div>
  );
}
