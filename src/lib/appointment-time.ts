import { clinicTodayKey, formatTime12h } from "@/domain/date-format";

export const clinicToday = () => clinicTodayKey();

export function appointmentTimeLabel(clock: string) {
  return formatTime12h(clock);
}
