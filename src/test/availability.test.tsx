import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppointmentSlotPicker } from "@/components/appointment-slot-picker";
import { Clinics } from "@/routes/admin.clinics";
import { clearClinicalCache } from "@/components/clinical";
import { selectOption } from "./select-option";

const fixture = vi.hoisted(() => ({ api: vi.fn(), selected: "northstar" }));
vi.mock("@/api/client", () => ({ api: fixture.api }));
vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ profile: { role: "admin", fullName: "Doctor" } }),
}));
vi.mock("@/providers/clinic-provider", () => ({
  useClinicContext: () => ({
    selected: fixture.selected,
    select: vi.fn(),
    clinics: [{ id: "northstar", name: "Northstar" }],
  }),
}));
beforeEach(() => {
  clearClinicalCache();
  fixture.api.mockReset();
  fixture.selected = "northstar";
});
afterEach(cleanup);

it("slot picker uses only backend times and preserves normalized submission values", async () => {
  fixture.api.mockResolvedValue({
    slots: [
      { value: "2030-01-07T10:30", label: "10:30 AM" },
      { value: "2030-01-07T14:00", label: "2:00 PM" },
    ],
  });
  const { container } = render(
    <form>
      <AppointmentSlotPicker clinicId="northstar" defaultValue="2030-01-07" />
    </form>,
  );
  await waitFor(() => expect(screen.getByLabelText("Available times")).not.toBeDisabled());
  await selectOption(screen.getByLabelText("Available times"), "2:00 PM");
  expect(new FormData(container.querySelector("form")!).get("scheduledAt")).toBe(
    "2030-01-07T14:00",
  );
  expect(fixture.api).toHaveBeenCalledWith(
    "/appointments/available-slots?clinicId=northstar&date=2030-01-07",
    expect.anything(),
  );
  expect(screen.queryByText("1:00 PM")).toBeNull();
});

it("slot picker clears selection when date changes and shows no availability", async () => {
  fixture.api
    .mockResolvedValueOnce({ slots: [{ value: "2030-01-07T10:30", label: "10:30 AM" }] })
    .mockResolvedValue({ slots: [] });
  const { container } = render(
    <form>
      <AppointmentSlotPicker clinicId="northstar" defaultValue="2030-01-07T10:30" />
    </form>,
  );
  await waitFor(() =>
    expect(new FormData(container.querySelector("form")!).get("scheduledAt")).toBe(
      "2030-01-07T10:30",
    ),
  );
  fireEvent.change(screen.getByLabelText("Appointment date"), { target: { value: "2030-01-08" } });
  expect(
    await screen.findByText("No appointments are available on this date."),
  ).toBeInTheDocument();
  expect(new FormData(container.querySelector("form")!).get("scheduledAt")).not.toBe(
    "2030-01-07T10:30",
  );
});

it("clinics creation informs admin that booking follows clinic opening and closing hours automatically", async () => {
  fixture.api.mockImplementation((path: string, opts?: { method?: string }) => {
    if (opts?.method === "POST") {
      return Promise.resolve({
        id: "new-clinic",
        name: "Care Clinic",
        openingTime: "09:00",
        closingTime: "18:00",
        city: "Karachi",
        address: "Clifton",
        phone: "03001112233",
        department: "General",
        doctorName: "Doctor",
        active: true,
        publicDisplayName: "Care Clinic",
        publicDisplayShowNext: true,
        averageConsultationMinutes: 5,
        tokenPrefix: "CC",
        consultationFee: null,
      });
    }
    return Promise.resolve([]);
  });
  render(<Clinics />);
  fireEvent.click(await screen.findByRole("button", { name: "Add clinic" }));
  fireEvent.click(screen.getByRole("button", { name: "City" }));
  fireEvent.click(await screen.findByRole("option", { name: "Karachi" }));
  fireEvent.change(screen.getByLabelText("Clinic name *"), { target: { value: "Care Clinic" } });
  fireEvent.change(screen.getByLabelText("Address *"), { target: { value: "Clifton" } });
  fireEvent.change(screen.getByLabelText("Phone *"), { target: { value: "03001112233" } });
  fireEvent.click(screen.getByRole("button", { name: "Save clinic" }));
  expect(
    await screen.findByText(/Appointment slots automatically follow Care Clinic/i),
  ).toBeVisible();
  expect(screen.queryByRole("link", { name: /Set doctor schedule/i })).toBeNull();
  expect(screen.getByRole("link", { name: /View appointments/i })).toHaveAttribute(
    "href",
    "/admin/appointments",
  );
});
