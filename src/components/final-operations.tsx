import type { PrintBrandingData } from "@/types/clinical-workflow";
import { SelectField } from "@/components/form-controls";
import { AppointmentSlotPicker } from "@/components/appointment-slot-picker";
import { useQueue } from "@/lib/queue-store";
import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { useClinicContext } from "@/providers/clinic-provider";
import { useAuth } from "@/providers/auth-provider";
import { Btn, Field, PageHeader } from "@/components/qc";
import { useClinicalData, ClinicalLoading } from "@/components/clinical";
import { validatePassword } from "@/domain/input-validation";
import { friendlyError } from "@/services/errors";
import { money } from "@/types/operations";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { logout } from "@/services/auth";
import { NotificationCenter } from "@/components/notification-center";
import { AppointmentStatusBadge } from "@/components/appointment-tokens";
import { formatDateOnly, formatDateTime } from "@/domain/date-format";
import { Search } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Metrics = {
  patients: number;
  appointments: number;
  waiting: number;
  completed: number;
  cancelled: number;
  revenue: number;
  outstanding: number;
  documents: number;
  followups: number;
  averageWait: number;
};
type Report = {
  from: string;
  to: string;
  totals: Metrics;
  clinics: (Metrics & { id: string; name: string })[];
  trend: { date: string; visits: number; revenue: number; averageWait: number }[];
  statuses: { status: string; count: number }[];
  appointments: unknown[];
  visits: unknown[];
  payments: unknown[];
  invoices: unknown[];
};
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const inputClass = "mt-1 block w-full rounded-lg border border-input bg-card p-2.5 text-sm";
const STATUS_COLORS: Record<string, string> = {
  scheduled: "#0f766e",
  confirmed: "#0ea5e9",
  checked_in: "#6366f1",
  completed: "#10b981",
  cancelled: "#ef4444",
  no_show: "#f59e0b",
};

const CHART_PALETTE = ["#0f766e", "#0ea5e9", "#10b981", "#f59e0b", "#6366f1", "#ef4444"];

const formatShortDay = (isoDate: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
};

const formatCompactMoney = (value: number) => {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
};

export function OperationalAnalytics({ reports = false }: { reports?: boolean }) {
  const { selected } = useClinicContext(),
    [from, setFrom] = useState(today),
    [to, setTo] = useState(today),
    [status, setStatus] = useState(""),
    [error, setError] = useState("");
  const params = new URLSearchParams({ clinicId: selected, from, to, status }),
    remote = useClinicalData<Report>(
      "/admin/" + (reports ? "reports" : "analytics") + "?" + params,
    );
  useEffect(() => {
    const refresh = () => remote.reload();
    window.addEventListener("queuecare:updated", refresh);
    return () => window.removeEventListener("queuecare:updated", refresh);
  }, [selected, from, to, status]);
  function period(value: string) {
    const d = new Date(today() + "T12:00:00");
    if (value === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    if (value === "month") d.setDate(1);
    setFrom(d.toISOString().slice(0, 10));
    setTo(today());
  }
  async function download(kind: string) {
    try {
      const r = await fetch("/api/admin/exports/" + kind + "?" + params, {
        credentials: "same-origin",
      });
      if (!r.ok) throw Error("Export unavailable. Please try again.");
      const url = URL.createObjectURL(await r.blob()),
        a = document.createElement("a");
      a.href = url;
      a.download = "queuecare-" + kind + ".csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(friendlyError(e));
    }
  }
  const labels: Record<keyof Metrics, string> = {
    patients: "Patients",
    appointments: "Appointments",
    waiting: "Waiting now",
    completed: "Completed consultations",
    cancelled: "Cancelled / no-show",
    revenue: "Revenue received",
    outstanding: "Outstanding balance",
    documents: "Documents uploaded",
    followups: "Follow-ups due",
    averageWait: "Average wait (min)",
  };
  const data = remote.data;
  const totalStatuses = (data?.statuses ?? []).reduce((sum, item) => sum + item.count, 0);
  const clinicChartData = (data?.clinics ?? []).map((c) => ({
    name: c.name.length > 18 ? c.name.slice(0, 16) + "…" : c.name,
    fullName: c.name,
    Appointments: c.appointments,
    Completed: c.completed,
    Waiting: c.waiting,
  }));
  const trendChartData = (data?.trend ?? []).map((t) => ({
    ...t,
    label: formatShortDay(t.date),
  }));
  return (
    <>
      <PageHeader
        title="Analytics"
        sub="Visual clinic trends, queue throughput, appointment breakdown, and operational exports."
      />
      <div className="surface mb-6 flex flex-wrap items-end gap-3 p-4 print:hidden">
        <label className="text-sm">
          Period
          <SelectField
            aria-label="Report period"
            className={inputClass}
            defaultValue="today"
            onChange={(e) => period(e.target.value)}
          >
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="custom">Custom range</option>
          </SelectField>
        </label>
        <Field label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Field label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <label className="text-sm">
          Status
          <SelectField
            aria-label="Status filter"
            className={inputClass}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {[
              "scheduled",
              "confirmed",
              "checked_in",
              "completed",
              "cancelled",
              "no_show",
              "unpaid",
              "partially_paid",
              "paid",
              "void",
            ].map((x) => (
              <option key={x} value={x}>
                {x.replaceAll("_", " ")}
              </option>
            ))}
          </SelectField>
        </label>
        <Btn variant="secondary" onClick={remote.reload}>
          Refresh
        </Btn>
      </div>
      {error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>
      )}
      {!data ? (
        <ClinicalLoading error={remote.error} retry={remote.reload} />
      ) : (
        <>
          <dl className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            {(Object.keys(labels) as (keyof Metrics)[]).map((k) => (
              <div className="surface p-4" key={k}>
                <dt className="text-xs text-muted-foreground">{labels[k]}</dt>
                <dd className="mt-2 break-words text-xl font-semibold tabular-nums">
                  {k === "revenue" || k === "outstanding" ? money(data.totals[k]) : data.totals[k]}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mb-5 text-xs text-muted-foreground">
            Waiting is current today. Dates use clinic local time (Asia/Karachi).
          </p>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Patient visits chart */}
            <section className="surface min-w-0 p-5" aria-label="Patient visits chart">
              <div className="mb-4 flex items-baseline justify-between gap-2">
                <div>
                  <h2 className="font-semibold">Patient visits</h2>
                  <p className="text-xs text-muted-foreground">Daily consultations in selected range</p>
                </div>
                <span className="tabular-nums text-sm font-semibold text-primary">
                  {data.totals.completed} completed
                </span>
              </div>
              {trendChartData.length ? (
                <div className="h-60 w-full min-w-0">
                  <ResponsiveContainer width="100%" height={240} initialDimension={{ width: 480, height: 240 }}>
                    <AreaChart data={trendChartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="visitsFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0f766e" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#0f766e" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#64748b" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#64748b" />
                      <Tooltip
                        formatter={(value: number) => [value, "Visits"]}
                        labelFormatter={(label, payload) => payload?.[0]?.payload?.date ?? label}
                      />
                      <Area
                        type="monotone"
                        dataKey="visits"
                        stroke="#0f766e"
                        strokeWidth={2.5}
                        fill="url(#visitsFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No activity in this period.</p>
              )}
            </section>

            {/* Average queue wait chart */}
            <section className="surface min-w-0 p-5" aria-label="Average queue wait chart">
              <div className="mb-4 flex items-baseline justify-between gap-2">
                <div>
                  <h2 className="font-semibold">Average queue wait (minutes)</h2>
                  <p className="text-xs text-muted-foreground">Mean minutes from token issue to call</p>
                </div>
                <span className="tabular-nums text-sm font-semibold text-foreground">
                  {data.totals.averageWait} min avg
                </span>
              </div>
              {trendChartData.length ? (
                <div className="h-60 w-full min-w-0">
                  <ResponsiveContainer width="100%" height={240} initialDimension={{ width: 480, height: 240 }}>
                    <LineChart data={trendChartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#64748b" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#64748b" />
                      <Tooltip
                        formatter={(value: number) => [`${value} min`, "Avg wait"]}
                        labelFormatter={(label, payload) => payload?.[0]?.payload?.date ?? label}
                      />
                      <Line
                        type="monotone"
                        dataKey="averageWait"
                        stroke="#0ea5e9"
                        strokeWidth={2.5}
                        dot={{ r: 3.5, fill: "#0ea5e9" }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No activity in this period.</p>
              )}
            </section>

            {/* Revenue trend chart */}
            <section className="surface min-w-0 p-5" aria-label="Revenue trend chart">
              <div className="mb-4 flex items-baseline justify-between gap-2">
                <div>
                  <h2 className="font-semibold">Revenue trend</h2>
                  <p className="text-xs text-muted-foreground">Daily collected consultation revenue</p>
                </div>
                <span className="tabular-nums text-sm font-semibold text-foreground">
                  {money(data.totals.revenue)}
                </span>
              </div>
              {trendChartData.length ? (
                <div className="h-60 w-full min-w-0">
                  <ResponsiveContainer width="100%" height={240} initialDimension={{ width: 480, height: 240 }}>
                    <BarChart data={trendChartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#64748b" />
                      <YAxis
                        tickFormatter={(val: number) => formatCompactMoney(val)}
                        tick={{ fontSize: 12 }}
                        stroke="#64748b"
                      />
                      <Tooltip
                        formatter={(value: number) => [money(value), "Revenue"]}
                        labelFormatter={(label, payload) => payload?.[0]?.payload?.date ?? label}
                      />
                      <Bar dataKey="revenue" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={42} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No activity in this period.</p>
              )}
            </section>

            {/* Appointment status breakdown chart */}
            <section className="surface min-w-0 p-5" aria-label="Appointment status chart">
              <div className="mb-4 flex items-baseline justify-between gap-2">
                <div>
                  <h2 className="font-semibold">Appointment status</h2>
                  <p className="text-xs text-muted-foreground">Distribution across booking states</p>
                </div>
                <span className="tabular-nums text-sm font-semibold text-foreground">
                  {data.totals.appointments} total
                </span>
              </div>
              {data.statuses.length ? (
                <div className="grid items-center gap-4 sm:grid-cols-[1fr_1.1fr]">
                  <div className="h-56 w-full min-w-0">
                    <ResponsiveContainer width="100%" height={224} initialDimension={{ width: 260, height: 224 }}>
                      <PieChart>
                        <Pie
                          data={data.statuses}
                          dataKey="count"
                          nameKey="status"
                          innerRadius={52}
                          outerRadius={82}
                          paddingAngle={2}
                        >
                          {data.statuses.map((entry, index) => (
                            <Cell
                              key={entry.status}
                              fill={
                                STATUS_COLORS[entry.status] ??
                                CHART_PALETTE[index % CHART_PALETTE.length]!
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number, name: string) => [
                            value,
                            String(name).replaceAll("_", " "),
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="space-y-2.5 text-sm">
                    {data.statuses.map((s, index) => {
                      const pct = totalStatuses
                        ? Math.round((s.count / totalStatuses) * 100)
                        : 0;
                      const color =
                        STATUS_COLORS[s.status] ?? CHART_PALETTE[index % CHART_PALETTE.length]!;
                      return (
                        <li key={s.status} className="flex items-center justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className="size-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: color }}
                              aria-hidden="true"
                            />
                            <span className="truncate capitalize">
                              {s.status.replaceAll("_", " ")}
                            </span>
                          </span>
                          <span className="tabular-nums shrink-0 font-medium text-foreground">
                            {s.count}{" "}
                            <span className="text-xs text-muted-foreground">({pct}%)</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No appointments in this period.</p>
              )}
            </section>
          </div>

          {/* Clinic comparison bar chart + compact table */}
          <section className="surface mt-6 min-w-0 p-5" aria-label="Clinic comparison chart">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="font-semibold">Clinic comparison</h2>
                <p className="text-xs text-muted-foreground">
                  Side-by-side appointments, completed visits, and active waiting across clinics
                </p>
              </div>
            </div>
            {clinicChartData.length ? (
              <>
                <div className="mb-6 h-64 w-full min-w-0">
                  <ResponsiveContainer width="100%" height={256} initialDimension={{ width: 640, height: 256 }}>
                    <BarChart data={clinicChartData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#64748b" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#64748b" />
                      <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Appointments" fill="#0f766e" radius={[4, 4, 0, 0]} maxBarSize={32} />
                      <Bar dataKey="Completed" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                      <Bar dataKey="Waiting" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        {["Clinic", "Appointments", "Waiting", "Completed", "Avg wait", "Revenue"].map(
                          (x) => (
                            <th className="p-2 text-xs font-semibold text-muted-foreground" key={x}>
                              {x}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {data.clinics.map((c) => (
                        <tr key={c.id} className="border-t border-border">
                          <th className="p-2 font-medium">{c.name}</th>
                          <td className="tabular-nums p-2">{c.appointments}</td>
                          <td className="tabular-nums p-2">{c.waiting}</td>
                          <td className="tabular-nums p-2">{c.completed}</td>
                          <td className="tabular-nums p-2">{c.averageWait} min</td>
                          <td className="tabular-nums p-2">{money(c.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No clinics found.</p>
            )}
          </section>

          <section className="surface mt-6 space-y-4 p-6 print:hidden">
            <h2 className="font-semibold">Operational CSV exports</h2>
            <div className="flex flex-wrap gap-2">
              {["patients", "appointments", "visits", "billing", "payments"].map((k) => (
                <Btn key={k} variant="secondary" onClick={() => void download(k)}>
                  Export {k}
                </Btn>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Authorized exports exclude private clinical notes and file URLs. Exports are audited.
            </p>
            <a href="/admin/data-management" className="text-sm text-primary underline">
              Data management and email delivery
            </a>
          </section>
        </>
      )}
    </>
  );
}
export const OperationalReports = OperationalAnalytics;
export function GlobalSearch() {
  const [open, setOpen] = useState(false),
    [term, setTerm] = useState(""),
    [results, setResults] = useState<
      { id: string; label: string; detail: string; type: string; href: string }[]
    >([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((x) => !x);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!open || term.trim().length < 2) {
      setResults([]);
      return;
    }
    const c = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      api<typeof results>("/admin/search?q=" + encodeURIComponent(term.trim()), {
        signal: c.signal,
      })
        .then((r) => {
          setResults(r);
          setError("");
        })
        .catch((e) => {
          if (!c.signal.aborted) setError(friendlyError(e));
        })
        .finally(() => {
          if (!c.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(t);
      c.abort();
    };
  }, [term, open]);
  return (
    <>
      <Btn
        variant="secondary"
        onClick={() => setOpen(true)}
        aria-label="Search Neuro Spine Care Center (Control K)"
        className="size-10 shrink-0 px-0 sm:h-10 sm:w-auto sm:px-3.5"
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">Search</span>
      </Btn>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Search Neuro Spine Care Center</DialogTitle>
          <DialogDescription>
            Patients, phone, email, appointments, invoices, tokens and clinics.
          </DialogDescription>
          <Field
            label="Search"
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Name, phone, invoice or token"
          />
          {error && <p role="alert">{error}</p>}
          <div aria-live="polite" className="max-h-80 overflow-y-auto">
            {loading && term.length >= 2 ? (
              <p className="p-3 text-sm">Searching…</p>
            ) : (
              results.map((x) => (
                <a
                  className="block rounded-lg p-3 hover:bg-muted focus:bg-muted"
                  href={x.href}
                  key={x.type + x.id}
                >
                  <span className="block text-sm font-medium break-all">{x.label}</span>
                  <span className="text-xs text-muted-foreground break-all">
                    {x.type} · {x.detail}
                  </span>
                </a>
              ))
            )}
            {!loading && term.length >= 2 && !results.length && !error && (
              <p className="p-3 text-sm">No matches found.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
interface FollowUp {
  id: string;
  clinic_id: string;
  patient_id: string;
  patient_name: string;
  clinic_name: string;
  visit_at: string;
  follow_up_date: string;
  instructions: string;
  status: string;
}
export function FollowUps() {
  const { selected } = useClinicContext(),
    remote = useClinicalData<FollowUp[]>(
      "/admin/follow-ups?clinicId=" + encodeURIComponent(selected),
    ),
    [bucket, setBucket] = useState("today"),
    [editing, setEditing] = useState<FollowUp | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const rows = remote.data?.filter((f) => {
    const d = String(f.follow_up_date).slice(0, 10);
    return bucket === "completed"
      ? f.status === "completed"
      : f.status !== "completed" &&
          (bucket === "overdue" ? d < today() : bucket === "today" ? d === today() : d > today());
  });
  async function action(id: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      await api("/admin/follow-ups/" + id, { method: "PUT", body });
      remote.reload();
      setEditing(null);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Follow-ups"
        sub="Doctor-written follow-up recommendations across clinics."
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {["overdue", "today", "upcoming", "completed"].map((x) => (
          <Btn
            variant={bucket === x ? "primary" : "secondary"}
            key={x}
            onClick={() => setBucket(x)}
          >
            {x}
          </Btn>
        ))}
      </div>
      {error && (
        <p role="alert" className="mb-3 text-destructive">
          {error}
        </p>
      )}
      {!remote.data ? (
        <ClinicalLoading error={remote.error} retry={remote.reload} />
      ) : (
        <div className="surface divide-y divide-border">
          {rows?.map((f) => (
            <article key={f.id} className="space-y-3 p-5">
              <a
                className="font-medium text-primary"
                href={"/admin/patient-record/" + encodeURIComponent(f.patient_id)}
              >
                {f.patient_name}
              </a>
              <p className="text-sm text-muted-foreground">
                {f.clinic_name} · Follow-up {String(f.follow_up_date).slice(0, 10)} · Last visit{" "}
                {formatDateOnly(f.visit_at)} · {f.status}
              </p>
              <p className="whitespace-pre-wrap break-words text-sm">
                {f.instructions || "Follow-up visit recommended."}
              </p>
              {f.status !== "completed" && (
                <div className="flex flex-wrap gap-2">
                  <Btn
                    disabled={busy}
                    variant="secondary"
                    onClick={() => void action(f.id, { action: "contacted" })}
                  >
                    Mark contacted
                  </Btn>
                  <Btn disabled={busy} variant="secondary" onClick={() => setEditing(f)}>
                    Book / reschedule
                  </Btn>
                  <Btn disabled={busy} onClick={() => void action(f.id, { action: "completed" })}>
                    Mark completed
                  </Btn>
                </div>
              )}
            </article>
          ))}
          {!rows?.length && (
            <p className="p-8 text-sm text-muted-foreground">No {bucket} follow-ups.</p>
          )}
        </div>
      )}
      <Dialog
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Follow-up scheduling</DialogTitle>
          <DialogDescription>{editing?.patient_name} — clinic local time</DialogDescription>
          {error && <p role="alert">{error}</p>}
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              if (editing)
                void action(editing.id, { action: "book", scheduledAt: d.get("scheduledAt") });
            }}
          >
            {editing && (
              <AppointmentSlotPicker clinicId={editing.clinic_id} refresh={error ? 1 : 0} />
            )}
            <Btn disabled={busy}>Book appointment</Btn>
          </form>
          <form
            className="space-y-4 border-t pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              if (editing) void action(editing.id, { action: "reschedule", date: d.get("date") });
            }}
          >
            <Field required label="Recommended follow-up date" type="date" name="date" />
            <Btn disabled={busy} variant="secondary">
              Reschedule recommendation
            </Btn>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
interface Branding {
  doctor: {
    full_name?: string;
    title?: string;
    specialty?: string;
    license?: string;
    phone?: string;
    email?: string;
    photo_url?: string;
    signature_url?: string;
  };
  clinic: { email?: string; logo_url?: string; footer?: string; slot_minutes?: number };
}
export function BrandingSettings() {
  const { selected } = useClinicContext(),
    remote = useClinicalData<Branding>(
      selected === "all" ? null : "/admin/branding?clinicId=" + encodeURIComponent(selected),
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  if (selected === "all")
    return <p className="surface p-6">Choose a clinic to configure branding.</p>;
  if (!remote.data) return <ClinicalLoading error={remote.error} retry={remote.reload} />;
  const d = remote.data,
    doctorFields = [
      "full_name",
      "title",
      "specialty",
      "license",
      "phone",
      "email",
      "photo_url",
      "signature_url",
    ] as const,
    clinicFields = ["email", "logo_url", "footer"] as const;
  return (
    <>
      <PageHeader
        title="Doctor & clinic branding"
        sub="These contact details appear on patient documents and public clinic information."
      />
      <form
        key={selected}
        className="surface space-y-5 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setSaved(false);
          setError("");
          void api("/admin/branding?clinicId=" + encodeURIComponent(selected), {
            method: "PUT",
            body: {
              doctor: Object.fromEntries(
                doctorFields.map((k) => [k, String(f.get("doctor." + k) ?? "")]),
              ),
              clinic: {
                ...Object.fromEntries(
                  clinicFields.map((k) => [k, String(f.get("clinic." + k) ?? "")]),
                ),
                slot_minutes: Number(f.get("slot_minutes")),
              },
            },
          })
            .then(() => {
              setSaved(true);
              remote.reload();
            })
            .catch((e) => setError(friendlyError(e)))
            .finally(() => setBusy(false));
        }}
      >
        <h2 className="font-semibold">Main doctor profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {doctorFields.map((k) => (
            <Field
              key={k}
              label={k.replaceAll("_", " ")}
              name={"doctor." + k}
              defaultValue={d.doctor[k] ?? ""}
              type={k === "email" ? "email" : k.endsWith("_url") ? "url" : "text"}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Optional images use public HTTPS image URLs. Use only images intended for patient-facing
          branding; never link private medical files.
        </p>
        <h2 className="font-semibold">Selected clinic</h2>
        <p className="text-sm text-muted-foreground">
          Name, address, hours, fee and queue preferences remain in Clinic management / Settings.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {clinicFields.map((k) => (
            <Field
              key={k}
              label={k.replaceAll("_", " ")}
              name={"clinic." + k}
              defaultValue={d.clinic[k] ?? ""}
              type={k === "email" ? "email" : k === "logo_url" ? "url" : "text"}
            />
          ))}
          <Field
            required
            label="Appointment slot duration (minutes)"
            name="slot_minutes"
            type="number"
            min={5}
            max={120}
            defaultValue={d.clinic.slot_minutes ?? 15}
          />
        </div>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {saved && <p role="status">Branding saved.</p>}
        <Btn disabled={busy}>{busy ? "Saving…" : "Save branding"}</Btn>
      </form>
    </>
  );
}
export function AccountSecurityPanel({ embedded = false }: { embedded?: boolean }) {
  const remote = useClinicalData<{
      profile: { fullName: string; email: string; role: string };
      googleLinked: boolean;
      sessions: { expiresAt: number; current: boolean }[];
    }>("/account"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function action(path: string, body: unknown, method: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(path, { body, method });
      setMessage("Account security updated. Other sessions have been signed out.");
      remote.reload();
      return true;
    } catch (e) {
      setError(friendlyError(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (!remote.data) return <ClinicalLoading error={remote.error} retry={remote.reload} />;
  const d = remote.data;
  const card = (
    <section className="surface space-y-5 p-6">
      {embedded ? (
        <div className="border-b border-border pb-4">
          <h2 className="text-lg font-semibold text-foreground">Account Security</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Update your password and manage active Neuro Spine Care Center sessions.
          </p>
        </div>
      ) : (
        <p className="break-words [overflow-wrap:anywhere]">
          {d.profile.fullName} · {d.profile.email} · {d.profile.role}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Google account:{" "}
        <span className="font-medium text-foreground">
          {d.googleLinked ? "Linked" : "Not linked"}
        </span>
      </p>
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
      <form
        className="max-w-md space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          const currentPw = String(f.get("currentPassword") ?? "");
          const nextPw = String(f.get("newPassword") ?? "");
          const pwCheck = validatePassword(nextPw, 12);
          if (!pwCheck.ok) {
            setError(pwCheck.error);
            return;
          }
          if (nextPw === currentPw) {
            setError("New password must be different from the current password.");
            return;
          }
          if (nextPw !== String(f.get("confirm") ?? "")) {
            setError("New passwords must match.");
            return;
          }
          void action(
            "/account/password",
            { currentPassword: currentPw, newPassword: nextPw },
            "PUT",
          ).then((ok) => {
            if (ok) form.reset();
          });
        }}
      >
        <Field
          required
          label="Current password"
          type="password"
          name="currentPassword"
          autoComplete="current-password"
        />
        <Field
          required
          minLength={12}
          maxLength={72}
          label="New password"
          type="password"
          name="newPassword"
          autoComplete="new-password"
        />
        <Field
          required
          label="Confirm new password"
          type="password"
          name="confirm"
          autoComplete="new-password"
        />
        <Btn disabled={busy}>Change password</Btn>
      </form>
      <div className="border-t border-border pt-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Active sessions ({d.sessions.length})
        </h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {d.sessions.map((s, i) => (
            <li key={i}>
              {s.current ? "This session" : "Other session"} · Expires{" "}
              {formatDateTime(s.expiresAt)}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3 pt-1">
          <Btn
            variant="secondary"
            disabled={busy}
            onClick={() => void action("/account/revoke-sessions", {}, "POST")}
          >
            Sign out other sessions
          </Btn>
          {!embedded && (
            <Btn variant="secondary" onClick={() => void logout()}>
              Sign out
            </Btn>
          )}
        </div>
      </div>
    </section>
  );
  if (embedded) return card;
  return (
    <>
      <PageHeader
        title="Account & security"
        sub="Manage your password and active Neuro Spine Care Center sessions."
      />
      {card}
    </>
  );
}
export function AccountSettings() {
  return <AccountSecurityPanel />;
}
export function PatientSummary({ hideUpcoming = false }: { hideUpcoming?: boolean }) {
  const { clinic } = useQueue();
  const { selected } = useClinicContext();
  const activeClinicId = selected && selected !== "all" ? selected : "";
  const remote = useClinicalData<{
    appointment: { clinic_id?: string; scheduled_at: string; clinic_name: string; status?: string } | null;
    appointments?: { id: string; clinic_id: string; scheduled_at: string; clinic_name: string; status?: string }[];
    visit: { clinic_id?: string; visit_at: string; clinic_name: string } | null;
    visits?: { clinic_id?: string; visit_at: string; clinic_name: string }[];
    prescription: { clinic_id?: string; clinic_name?: string; prescribed_at: string } | null;
    prescriptions?: { clinic_id?: string; clinic_name?: string; prescribed_at: string }[];
    document: { title: string } | null;
    bills: { balance: number; unpaid_count?: number };
    followups: (FollowUp & { clinic_id?: string })[];
    notifications: { id: string; title: string; message: string }[];
  }>("/patient/summary");
  if (!remote.data)
    return (
      <section className="surface flex flex-col justify-center p-6">
        <ClinicalLoading error={remote.error} retry={remote.reload} />
      </section>
    );
  const d = remote.data;
  const scopedAppointments = (d.appointments ?? (d.appointment ? [d.appointment] : []))
    .filter((a) => !activeClinicId || !a.clinic_id || a.clinic_id === activeClinicId)
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const upcomingAppointment = scopedAppointments[0] ?? null;
  const latestVisit =
    d.visits?.find((v) => !activeClinicId || !v.clinic_id || v.clinic_id === activeClinicId) ??
    (d.visit && (!activeClinicId || !d.visit.clinic_id || d.visit.clinic_id === activeClinicId)
      ? d.visit
      : null);
  const latestPrescription =
    d.prescriptions?.find(
      (p) => !activeClinicId || !p.clinic_id || p.clinic_id === activeClinicId,
    ) ??
    (d.prescription &&
    (!activeClinicId || !d.prescription.clinic_id || d.prescription.clinic_id === activeClinicId)
      ? d.prescription
      : null);
  const scopedFollowups = [...d.followups]
    .filter((f) => !activeClinicId || !f.clinic_id || f.clinic_id === activeClinicId)
    .sort((a, b) => String(a.follow_up_date).localeCompare(String(b.follow_up_date)));
  const hasSummaryGrid = Boolean(latestVisit || latestPrescription);
  const hasCareData = hasSummaryGrid || scopedFollowups.length > 0;

  return (
    <section aria-label="Your care summary" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight text-foreground">Care summary</h2>
      </div>
      {!hideUpcoming && (
        <div className="surface p-5">
          {upcomingAppointment ? (
            <a
              href="/patient/appointments"
              className="block transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Upcoming appointment</h3>
                <AppointmentStatusBadge status={upcomingAppointment.status || "scheduled"} />
              </div>
              <p className="tabular-nums mt-1 break-words text-sm text-muted-foreground">
                {formatDateTime(upcomingAppointment.scheduled_at) + " · " + upcomingAppointment.clinic_name}
              </p>
            </a>
          ) : (
            <div>
              <h3 className="text-sm font-semibold text-foreground">Upcoming appointment</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                No upcoming appointment. Choose an available time at {clinic.name || "your clinic"}.
              </p>
              <a
                href="/patient/appointments?book=1"
                className="mt-3 inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3.5 text-xs font-medium text-primary-foreground shadow-soft transition hover:bg-primary-hover"
              >
                Book Appointment
              </a>
            </div>
          )}
        </div>
      )}
      {!hasCareData && (
        <div className="surface p-5">
          <p className="text-sm text-muted-foreground">
            Your care summary will appear here after your first appointment or clinic visit.
          </p>
        </div>
      )}
      {hasSummaryGrid && (
        <div className="surface p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {latestVisit && (
              <a
                href="/patient/visits"
                className="group flex flex-col justify-between rounded-xl border border-border/80 bg-background/60 p-4 transition hover:border-primary/40 hover:bg-card"
              >
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Latest visit
                  </p>
                  <p className="tabular-nums mt-2 text-base font-semibold text-foreground">
                    {formatDateOnly(latestVisit.visit_at)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {latestVisit.clinic_name}
                  </p>
                </div>
                <span className="mt-4 text-xs font-medium text-primary group-hover:underline">
                  View visit →
                </span>
              </a>
            )}

            {latestPrescription && (
              <a
                href="/patient/prescriptions"
                className="group flex flex-col justify-between rounded-xl border border-border/80 bg-background/60 p-4 transition hover:border-primary/40 hover:bg-card"
              >
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Latest prescription
                  </p>
                  <p className="tabular-nums mt-2 text-base font-semibold text-foreground">
                    {formatDateOnly(latestPrescription.prescribed_at)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {latestPrescription.clinic_name || clinic.name || "Neuro Spine Care Center"}
                  </p>
                </div>
                <span className="mt-4 text-xs font-medium text-primary group-hover:underline">
                  View prescription →
                </span>
              </a>
            )}


          </div>
        </div>
      )}
      {scopedFollowups.map((f) => {
        const statusLabel =
          f.status === "pending"
            ? "Pending"
            : f.status.replaceAll("_", " ").replace(/^\w/, (ch) => ch.toUpperCase());
        return (
          <div key={f.id} className="surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">Follow-up recommendation</h3>
              <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning">
                {statusLabel}
              </span>
            </div>
            <p className="tabular-nums mt-2 text-xs text-muted-foreground">
              {formatDateOnly(String(f.follow_up_date).slice(0, 10))} · {f.clinic_name}
            </p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground/90">
              {f.instructions || "Follow-up visit recommended."}
            </p>
          </div>
        );
      })}
    </section>
  );
}
export function PrintBranding({
  clinicId,
  data: provided,
}: {
  clinicId: string;
  data?: PrintBrandingData | null;
}) {
  const remote = useClinicalData<PrintBrandingData>(
    provided === undefined ? "/branding?clinicId=" + encodeURIComponent(clinicId) : null,
  );
  const d = provided === undefined ? remote.data : provided;
  if (!d?.clinic?.display_name) return null;
  return (
    <div className="mb-4 border-b border-border pb-3 text-sm">
      {d.clinic.logo_url && (
        <img
          className="mb-2 h-14 max-w-48 object-contain"
          src={d.clinic.logo_url}
          alt={d.clinic.display_name + " logo"}
          referrerPolicy="no-referrer"
        />
      )}
      {d.doctor?.photo_url && (
        <img
          className="mb-2 size-12 rounded-full object-cover"
          src={d.doctor.photo_url}
          alt="Doctor profile"
          referrerPolicy="no-referrer"
        />
      )}
      {d.doctor && (
        <p>
          {[d.doctor.title, d.doctor.full_name, d.doctor.specialty, d.doctor.license]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      <p>{[d.clinic.email, d.clinic.footer].filter(Boolean).join(" · ")}</p>
    </div>
  );
}
export function DataManagement() {
  const remote = useClinicalData<{
      provider: string;
      pending: { count: number };
      statuses: { status: string; count: number }[];
    }>("/admin/email-status"),
    [result, setResult] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <PageHeader
        title="Data management & delivery"
        sub="Admin-only operational exports and application email status."
      />
      <div className="surface space-y-4 p-6">
        <a className="text-primary underline" href="/admin/analytics">
          Open analytics and CSV exports
        </a>
        <p className="text-sm">
          Full backups: use Supabase database backups or an authenticated CLI pg_dump on a trusted
          machine. Back up the private queuecare-medical Storage bucket separately. Encrypt backups,
          restrict access, and test restores in a separate project. Database backups do not include
          Storage file contents.
        </p>
        <h2 className="font-semibold">Private upload cleanup</h2>
        <p className="text-sm text-muted-foreground">
          Retry removal of expired, unfinished appointment uploads. Completed files are retained.
        </p>
        <Btn
          disabled={busy}
          type="button"
          variant="secondary"
          onClick={() => {
            setBusy(true);
            void api<{ removed: number; failed: number }>(
              "/admin/appointment-attachments/cleanup",
              { method: "POST", body: {} },
            )
              .then((x) =>
                setResult(`Cleaned ${x.removed} unfinished files; ${x.failed} require retry.`),
              )
              .catch((e) => setResult(friendlyError(e)))
              .finally(() => setBusy(false));
          }}
        >
          Clean expired uploads
        </Btn>
        <h2 className="font-semibold">Application email delivery</h2>
        {!remote.data ? (
          <ClinicalLoading error={remote.error} retry={remote.reload} />
        ) : (
          <>
            <p className="text-sm">
              Provider: {remote.data.provider} · Pending: {remote.data.pending.count}
            </p>
            <p className="text-sm text-muted-foreground">
              In-app notifications remain active. Supabase Auth handles sign-in and password
              recovery emails only. Application delivery requires a verified email provider
              configured on the server. No delivery is claimed when unconfigured. New appointment,
              released-document, invoice and follow-up notices queue automatically.
            </p>
            {remote.data.statuses.map((x) => (
              <p className="text-sm" key={x.status}>
                {x.status}: {x.count}
              </p>
            ))}
            <Btn
              disabled={busy || remote.data.provider === "not_configured"}
              onClick={() => {
                setBusy(true);
                void api<{ configured: boolean; sent: number; failed: number }>(
                  "/admin/email-delivery",
                  { method: "POST", body: {} },
                )
                  .then((x) => {
                    setResult(
                      x.configured
                        ? `${x.sent} sent; ${x.failed} failed.`
                        : "Provider not configured.",
                    );
                    remote.reload();
                  })
                  .catch((e) => setResult(friendlyError(e)))
                  .finally(() => setBusy(false));
              }}
            >
              Deliver pending notices
            </Btn>
            {result && <p role="status">{result}</p>}
          </>
        )}
      </div>
    </>
  );
}

export function DoctorSignature({
  data: provided,
}: { data?: { signature_url?: string } | null } = {}) {
  const remote = useClinicalData<{ signature_url?: string }>(
    provided === undefined ? "/branding/signature" : null,
  );
  const data = provided === undefined ? remote.data : provided;
  return data?.signature_url ? (
    <img
      className="mt-6 h-12 max-w-48 object-contain"
      src={data.signature_url}
      alt="Doctor signature"
      referrerPolicy="no-referrer"
    />
  ) : null;
}
