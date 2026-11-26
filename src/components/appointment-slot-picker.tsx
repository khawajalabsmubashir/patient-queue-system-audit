import { useEffect, useId, useState } from "react";
import { api } from "@/api/client";
import { Field, Btn } from "@/components/qc";
import { SelectField } from "@/components/form-controls";
import { friendlyError } from "@/services/errors";
import { clinicToday } from "@/lib/appointment-time";

export function AppointmentSlotPicker({
  clinicId,
  exclude,
  defaultValue = "",
  refresh = 0,
  variant = "default",
}: {
  clinicId: string;
  exclude?: string | undefined;
  defaultValue?: string;
  refresh?: number;
  variant?: "default" | "portal";
}) {
  const timeId = useId();
  const [day, setDay] = useState(defaultValue.slice(0, 10) || clinicToday());
  const [value, setValue] = useState("");
  const [slots, setSlots] = useState<{ value: string; label: string }[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setSlots(null);
    setValue("");
    setError("");
    if (!clinicId || clinicId === "all" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    void api<{ slots: { value: string; label: string }[] }>(
      `/appointments/available-slots?clinicId=${encodeURIComponent(clinicId)}&date=${encodeURIComponent(day)}${exclude ? "&exclude=" + encodeURIComponent(exclude) : ""}`,
      { signal: controller.signal },
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        setSlots(data.slots);
        if (data.slots.some((s) => s.value === defaultValue)) setValue(defaultValue);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(friendlyError(e));
      });
    return () => controller.abort();
  }, [clinicId, day, exclude, defaultValue, refresh, attempt]);

  const isPortal = variant === "portal";

  return (
    <div className="space-y-2.5">
      <div className={isPortal ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : "space-y-3"}>
        <Field
          required
          label={isPortal ? "Appointment Date *" : "Appointment date"}
          type="date"
          min={clinicToday()}
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
        <div className="block">
          <label htmlFor={timeId} className="mb-1.5 block text-sm font-medium">
            {isPortal ? "Preferred Time *" : "Available times"}
          </label>
          <SelectField
            id={timeId}
            className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm"
            name="scheduledAt"
            aria-label={isPortal ? "Preferred Time" : "Available times"}
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={!slots?.length}
          >
            <option value="">Choose a time</option>
            {slots?.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      {!error && slots === null && (
        <p role="status" className="text-xs text-muted-foreground">
          Loading available times…
        </p>
      )}
      {!error && slots?.length === 0 && (
        <p role="status" className="text-xs text-muted-foreground">
          No appointments are available on this date.
        </p>
      )}
      {error && (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
          <Btn type="button" variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Btn>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Clinic local time · Asia/Karachi</p>
      <input
        type="text"
        tabIndex={-1}
        aria-label="Selected appointment time"
        className="sr-only"
        required
        value={value}
        onChange={() => {}}
      />
    </div>
  );
}
