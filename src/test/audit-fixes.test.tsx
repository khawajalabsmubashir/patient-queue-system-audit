import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  navigate: vi.fn(),
  pathname: "/patient/appointments",
  role: "patient" as "patient" | "admin" | "nurse" | "receptionist",
  clinics: [
    { id: "clinic", name: "Health Point", city: "Karachi", area: "Clifton", active: true },
  ],
}));

vi.mock("@/api/client", () => ({ api: mocks.api }));
vi.mock("@/services/auth", () => ({
  register: mocks.register,
  login: vi.fn(),
  logout: mocks.logout,
}));
vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    profile: {
      id: "u1",
      uid: "u1",
      fullName: "Dr. Admin",
      email: "user@clinic.local",
      phone: "03001234567",
      role: mocks.role,
      clinicId: "clinic",
    },
    loading: false,
    error: "",
    retry: vi.fn(),
  }),
}));
vi.mock("@/components/protected-route", () => ({
  ProtectedRoute: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/providers/clinic-provider", () => ({
  ClinicSwitcher: () => <div data-testid="clinic-switcher" />,
  useClinicContext: () => ({ selected: "clinic", clinics: mocks.clinics, select: vi.fn() }),
}));
vi.mock("@/components/appointment-slot-picker", () => ({
  AppointmentSlotPicker: () => (
    <input name="scheduledAt" aria-label="Available slot" defaultValue="2026-12-20T10:00" />
  ),
}));
vi.mock("@/components/queue-feedback", () => ({
  Notifications: () => <div data-testid="notifications" />,
  QueueBoundary: ({ children }: { children: ReactNode }) => (
    <div data-testid="queue-boundary">{children}</div>
  ),
}));
vi.mock("@/components/notification-center", () => ({
  NotificationCenter: () => <div data-testid="notification-center" />,
}));
vi.mock("@/components/final-operations", () => ({
  GlobalSearch: () => <div data-testid="global-search" />,
}));
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useLocation: () => ({ pathname: mocks.pathname }),
    Link: ({ to, children, className, onClick, onMouseEnter, onFocus, ...rest }: any) => (
      <a
        href={typeof to === "string" ? to : "#"}
        className={className}
        onClick={(e) => {
          e.preventDefault();
          onClick?.(e);
        }}
        onMouseEnter={onMouseEnter}
        onFocus={onFocus}
        aria-label={rest["aria-label"]}
      >
        {children}
      </a>
    ),
    Outlet: () => <div data-testid="route-outlet">Outlet Content</div>,
  };
});

import {
  clearClinicalCache,
  prefetchClinicalData,
  useClinicalData,
} from "@/components/clinical";
import { AttachmentFields } from "@/components/appointment-files";
import { Appointments } from "@/routes/patient.appointments";
import { PatientConditions } from "@/components/patient-conditions";
import { AppointmentRows } from "@/components/appointment-rows";
import { AppointmentCalendar } from "@/components/appointment-calendar";
import { Register } from "@/routes/register";
import { Route as LoginRoute } from "@/routes/login";
import { PageHeader } from "@/components/qc";
import { Route as AdminRoute } from "@/routes/admin";
import { Route as StaffRoute } from "@/routes/staff";
import { Route as PatientRoute } from "@/routes/patient";
import { validatePassword, validatePersonName, validatePhoneNumber } from "@/domain/input-validation";

afterEach(() => {
  cleanup();
  clearClinicalCache();
  mocks.api.mockReset();
  mocks.register.mockReset();
  mocks.logout.mockReset();
  mocks.navigate.mockReset();
  mocks.pathname = "/patient/appointments";
  mocks.role = "patient";
});

describe("Audit fixes verification", () => {
  it("Fix 1: useClinicalData caches & deduplicates requests across mounts", async () => {
    mocks.api.mockResolvedValue([{ id: "v1" }]);
    await prefetchClinicalData("/patient/visits");

    function Probe() {
      const state = useClinicalData<{ id: string }[]>("/patient/visits");
      return <div>{state.data ? `loaded:${state.data.length}` : "loading"}</div>;
    }

    render(<Probe />);
    expect(screen.getByText("loaded:1")).toBeVisible();
    expect(mocks.api).toHaveBeenCalledTimes(1);
  });

  it("Fix 2: Admin and Staff sign out buttons show warning prompt before logging out", async () => {
    mocks.role = "admin";
    mocks.logout.mockResolvedValue(undefined);
    const AdminComponent = AdminRoute.options.component!;
    render(<AdminComponent />);

    const signOutButtons = screen.getAllByRole("button", { name: /Sign out/i });
    fireEvent.click(signOutButtons[0]!);
    expect(mocks.logout).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/Are you sure you want to sign out/i);
    fireEvent.click(within(dialog).getByRole("button", { name: /Yes, Sign Out/i }));
    await waitFor(() => expect(mocks.logout).toHaveBeenCalledTimes(1));

    cleanup();
    mocks.logout.mockReset();
    mocks.role = "nurse";
    mocks.api.mockResolvedValue({ clinic: { name: "Clinic" }, queue: [], patients: [], appointments: [] });
    const StaffComponent = StaffRoute.options.component!;
    render(<StaffComponent />);

    fireEvent.click(await screen.findByRole("button", { name: /Sign out/i }));
    expect(mocks.logout).not.toHaveBeenCalled();
    const staffDialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(staffDialog).getByRole("button", { name: /Yes, Sign Out/i }));
    await waitFor(() => expect(mocks.logout).toHaveBeenCalledTimes(1));
  });

  it("Fix 3: Book appointment rejects >5MB attachments, validates Patient name, and omits Reason for appointment", async () => {
    mocks.api.mockImplementation((path: string) => {
      if (path.includes("/patient/profile")) {
        return Promise.resolve({
          id: "p1",
          fullName: "Ali Khan",
          phone: "03001234567",
          dateOfBirth: "1995-05-05",
          gender: "male",
        });
      }
      if (path.includes("/patient/appointments")) return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const onChange = vi.fn();
    render(<AttachmentFields files={[]} onChange={onChange} />);
    const fileInput = screen.getByLabelText("Add supporting files") as HTMLInputElement;
    const tooBig = new File(["x"], "scan.pdf", { type: "application/pdf" });
    Object.defineProperty(tooBig, "size", { value: 5 * 1024 * 1024 + 1 });
    fireEvent.change(fileInput, { target: { files: [tooBig] } });
    expect(onChange).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(/5 MB/i);
    cleanup();

    render(<Appointments />);
    fireEvent.click(await screen.findByRole("button", { name: "Book appointment" }));
    expect(screen.queryByLabelText(/Reason for appointment/i)).toBeNull();

    const nameInput = screen.getByLabelText("Patient name") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Ali'; DROP TABLE users;--" } });
    fireEvent.click(screen.getByRole("button", { name: "Review booking" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid characters|disallowed code/i);
  });

  it("Fix 4: Conditions dropdown reveals 'Other condition' input when 'Other' is selected", async () => {
    mocks.api.mockImplementation((path: string, opts?: any) => {
      if (opts?.method === "POST") return Promise.resolve({ id: "c-new", name: "Sciatica" });
      if (path.includes("/conditions") && !path.includes("/patients/")) {
        return Promise.resolve([{ id: "c1", name: "Migraine" }]);
      }
      return Promise.resolve([]);
    });

    render(<PatientConditions patientId="pat-1" />);
    const trigger = await screen.findByRole("button", { name: "Condition" });
    fireEvent.click(trigger);

    const otherOption = await screen.findByRole("option", { name: "Other" });
    fireEvent.click(otherOption);

    const otherInput = await screen.findByLabelText("Other condition");
    expect(otherInput).toBeVisible();
    fireEvent.change(otherInput, { target: { value: "Sciatica" } });
    fireEvent.click(screen.getByRole("button", { name: "Add condition" }));

    await waitFor(() =>
      expect(mocks.api).toHaveBeenCalledWith("/admin/patients/pat-1/conditions", {
        method: "POST",
        body: { name: "Sciatica" },
      }),
    );
  });

  it("Fix 5: Admin appointments list does not render 'Manage tags' button", () => {
    render(
      <AppointmentRows
        items={[
          {
            id: "a1",
            clinicId: "clinic",
            clinicName: "Health Point",
            patientId: "p1",
            patientName: "Sara Ahmed",
            reason: "",
            status: "scheduled",
            scheduledAt: "2026-10-12T10:00",
          },
        ]}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByText("Sara Ahmed")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Manage tags/i })).toBeNull();
  });

  it("Fix 6: Account & security is a dedicated header nav button and records tabs render without QueueBoundary", () => {
    mocks.pathname = "/patient/visits";
    const PatientComponent = PatientRoute.options.component!;
    render(<PatientComponent />);

    const recordsNav = screen.getByRole("navigation", { name: "Patient records" });
    expect(within(recordsNav).queryByText(/Account & security/i)).toBeNull();
    expect(within(recordsNav).getByText("My profile")).toBeVisible();
    expect(within(recordsNav).getByText("My visits")).toBeVisible();

    const header = document.querySelector("header")!;
    expect(within(header).getByRole("link", { name: /Account & security/i })).toHaveAttribute(
      "href",
      "/account",
    );
    expect(screen.queryByTestId("queue-boundary")).toBeNull();
    expect(screen.getByTestId("route-outlet")).toBeVisible();
  });

  it("Fix 7: Validation rejects oversized name/phone and SQL/script injection on Register", async () => {
    expect(validatePersonName("A".repeat(81), "Full name").ok).toBe(false);
    expect(validatePersonName("Robert'; DROP TABLE patients;--", "Full name").ok).toBe(false);
    expect(validatePersonName("<script>alert(1)</script>", "Full name").ok).toBe(false);
    expect(validatePhoneNumber("1".repeat(25)).ok).toBe(false);

    render(<Register />);
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "SELECT * FROM users" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Phone"), {
      target: { value: "03001234567" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "StrongPass123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "StrongPass123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/disallowed/i);
    expect(mocks.register).not.toHaveBeenCalled();
  });
  it("Fix 8: Receptionist sees Book appointment button, can book walk-in/lookup patients, and open appointment details", async () => {
    mocks.role = "receptionist";
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Karachi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    mocks.api.mockImplementation((path: string, opts?: any) => {
      if (path.includes("/staff/appointment-flow")) {
        return Promise.resolve([
          {
            id: "appt-1",
            clinicId: "clinic",
            clinicName: "Health Point",
            patientId: "p1",
            patientName: "Existing Patient",
            reason: "Checkup",
            status: "scheduled",
            scheduledAt: today + "T10:00",
          },
        ]);
      }
      if (path.includes("/staff/state")) {
        return Promise.resolve({
          clinic: { name: "Health Point" },
          queue: [],
          patients: [{ id: "p1", name: "Existing Patient", phone: "03001234567" }],
          appointments: [],
        });
      }
      if (path.includes("/staff/patient-lookup")) {
        return Promise.resolve({ id: "p-lookup", name: "Lookup Patient" });
      }
      if (opts?.method === "POST" && path.includes("/staff/appointments")) {
        return Promise.resolve({ id: "appt-new" });
      }
      return Promise.resolve([]);
    });

    render(<AppointmentCalendar />);
    const bookBtn = await screen.findByRole("button", { name: "Book appointment" });
    expect(bookBtn).toBeVisible();
    fireEvent.click(bookBtn);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Existing patient" })).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Find by email" })).toBeVisible();
    const walkInBtn = within(dialog).getByRole("button", { name: "New walk-in" });
    fireEvent.click(walkInBtn);

    fireEvent.change(within(dialog).getByLabelText("Patient full name"), {
      target: { value: "Ali'; DROP TABLE users;--" },
    });
    fireEvent.change(within(dialog).getByLabelText("Phone number"), {
      target: { value: "03009876543" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Book appointment" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/disallowed/i);
    expect(mocks.api).not.toHaveBeenCalledWith(
      expect.stringContaining("/staff/appointments"),
      expect.objectContaining({ method: "POST" }),
    );

    fireEvent.change(within(dialog).getByLabelText("Patient full name"), {
      target: { value: "Walkin Patient" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Book appointment" }));
    await waitFor(() =>
      expect(mocks.api).toHaveBeenCalledWith("/staff/appointments?clinicId=clinic", {
        method: "POST",
        body: {
          walkIn: { fullName: "Walkin Patient", phone: "03009876543" },
          scheduledAt: "2026-12-20T10:00",
          reason: "",
        },
      }),
    );

    const detailsBtn = await screen.findByRole("button", { name: "Appointment details" });
    fireEvent.click(detailsBtn);
    const manageDialog = await screen.findByRole("dialog");
    expect(manageDialog).toHaveTextContent("Manage appointment");
    expect(within(manageDialog).getByRole("button", { name: "Reschedule" })).toBeVisible();
  });
  it("BUG-01: Register and Login password fields include accessible Show/Hide eye toggle", () => {
    render(<Register />);
    const regPassword = screen.getByLabelText("Password") as HTMLInputElement;
    const regConfirm = screen.getByLabelText("Confirm password") as HTMLInputElement;
    expect(regPassword.type).toBe("password");
    expect(regConfirm.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Show Password" }));
    expect(regPassword.type).toBe("text");
    fireEvent.click(screen.getByRole("button", { name: "Hide Password" }));
    expect(regPassword.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Show Confirm password" }));
    expect(regConfirm.type).toBe("text");

    cleanup();
    const LoginComponent = LoginRoute.options.component!;
    render(<LoginComponent />);
    const loginPassword = screen.getByLabelText("Password") as HTMLInputElement;
    expect(loginPassword.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Show Password" }));
    expect(loginPassword.type).toBe("text");
  });

  it("BUG-02, BUG-04, BUG-07: Rejects spaces-only passwords, 1-2 char names, and special-char-only names", async () => {
    expect(validatePassword("         ").ok).toBe(false);
    expect(validatePassword("   abc  ").ok).toBe(false);
    expect(validatePassword("StrongPass123!").ok).toBe(true);

    expect(validatePersonName("A", "Full name").ok).toBe(false);
    expect(validatePersonName("Ab", "Full name").ok).toBe(false);
    expect(validatePersonName("Ali", "Full name").ok).toBe(true);
    expect(validatePersonName("@#$%^&&^%$#", "Full name").ok).toBe(false);
    expect(validatePersonName("@#$%^&&^%$#", "Full name", { strictAllowlist: false }).ok).toBe(false);

    render(<Register />);
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Ab" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "short@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Phone"), {
      target: { value: "03001234567" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "         " },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "         " },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create account/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/at least 3 characters/i);

    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Valid Patient" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create account/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/blank or contain only spaces/i);
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("BUG-05: Long 80-character unbroken names wrap cleanly without horizontal overflow", () => {
    const longName = "A".repeat(80);
    render(<PageHeader title={longName} sub={longName} />);
    const heading = screen.getByRole("heading", { name: longName });
    expect(heading.className).toContain("break-words");
    expect(heading.className).toContain("[overflow-wrap:anywhere]");
    expect(heading.parentElement?.className).toContain("min-w-0");
  });
});
