export const CLINIC_TIME_ZONE = "Asia/Karachi";

const ACTIVE_APPOINTMENT_STATUSES = new Set(["scheduled", "confirmed", "checked_in"]);

export function clinicTodayKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function clinicYesterdayKey(now = new Date()): string {
  const today = clinicTodayKey(now);
  const [y, m, d] = today.split("-").map(Number);
  const prev = new Date(Date.UTC(y!, m! - 1, d! - 1, 12, 0, 0));
  return prev.toISOString().slice(0, 10);
}

function parseDateValue(value: string | number | Date): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Normalize SQLite "YYYY-MM-DD HH:mm(:ss)" to ISO when needed
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(trimmed)
    ? trimmed.replace(" ", "T")
    : trimmed;
  // Bare YYYY-MM-DD -> pin at noon UTC so date never shifts in Asia/Karachi
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const d = new Date(`${normalized}T12:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // Local clinic YYYY-MM-DDTHH:mm(:ss) without timezone -> interpret in Asia/Karachi (+05:00)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(normalized)) {
    const d = new Date(`${normalized}+05:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toClinicDayKey(value?: string | number | Date | null): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value.trim())) {
    return value.trim().slice(0, 10);
  }
  const d = parseDateValue(value);
  if (!d) return "";
  return clinicTodayKey(d);
}

/**
 * Formats date only in consistent clinic style: "18 Nov 2026"
 */
export function formatDateOnly(value?: string | number | Date | null): string {
  if (value === null || value === undefined || value === "") return "";
  const d = parseDateValue(value);
  if (!d) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CLINIC_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/**
 * Formats 12-hour clock without seconds: "10:30 AM"
 */
export function formatTime12h(clockOrDate?: string | number | Date | null): string {
  if (clockOrDate === null || clockOrDate === undefined || clockOrDate === "") return "";
  if (typeof clockOrDate === "string") {
    const trimmed = clockOrDate.trim();
    const clockMatch = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(trimmed);
    if (clockMatch) {
      const hour = Number(clockMatch[1]);
      const minute = clockMatch[2];
      return `${hour % 12 || 12}:${minute} ${hour < 12 ? "AM" : "PM"}`;
    }
  }
  const d = parseDateValue(clockOrDate);
  if (!d) return String(clockOrDate);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/**
 * Formats readable clinic date & 12-hour time without seconds: "18 Nov 2026, 10:30 AM"
 */
export function formatDateTime(value?: string | number | Date | null): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string") {
    const trimmed = value.trim().replace(" ", "T");
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return formatDateOnly(trimmed);
    }
    const localMatch = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/.exec(trimmed);
    if (localMatch) {
      return `${formatDateOnly(localMatch[1])}, ${formatTime12h(localMatch[2])}`;
    }
  }
  const d = parseDateValue(value);
  if (!d) return String(value);
  return `${formatDateOnly(d)}, ${formatTime12h(d)}`;
}

/**
 * Full verbose date/time with seconds for hover tooltips.
 */
export function formatFullDateTimeTooltip(value?: string | number | Date | null): string {
  if (value === null || value === undefined || value === "") return "";
  const d = parseDateValue(value);
  if (!d) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CLINIC_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(d);
}

/**
 * Consistent BUG-22 sorting:
 * 1) Upcoming active appointments (scheduled/confirmed/checked_in on/after today) first, ASC by scheduledAt.
 * 2) Past / completed / no_show / cancelled appointments afterwards, DESC by scheduledAt (non-cancelled before cancelled).
 */
export function isUpcomingActiveAppointment(
  a: { status: string; scheduledAt: string },
  today = clinicTodayKey(),
): boolean {
  const status = (a.status || "").toLowerCase();
  return ACTIVE_APPOINTMENT_STATUSES.has(status) && a.scheduledAt.slice(0, 10) >= today;
}

export function sortPatientAppointments<T extends { status: string; scheduledAt: string }>(
  rows: readonly T[],
  today = clinicTodayKey(),
): T[] {
  return [...rows].sort((a, b) => {
    const aActive = isUpcomingActiveAppointment(a, today);
    const bActive = isUpcomingActiveAppointment(b, today);
    if (aActive !== bActive) return aActive ? -1 : 1;
    if (aActive && bActive) {
      const cmp = a.scheduledAt.localeCompare(b.scheduledAt);
      if (cmp !== 0) return cmp;
    } else {
      const cmp = b.scheduledAt.localeCompare(a.scheduledAt);
      if (cmp !== 0) return cmp;
    }
    const statusWeight = (s: string) =>
      s === "checked_in"
        ? 0
        : s === "confirmed"
          ? 1
          : s === "scheduled"
            ? 2
            : s === "completed"
              ? 3
              : s === "no_show"
                ? 4
                : 5;
    return statusWeight(a.status) - statusWeight(b.status);
  });
}
