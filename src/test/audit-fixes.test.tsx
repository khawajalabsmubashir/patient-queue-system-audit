import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  login: vi.fn(),
  logout: vi.fn(),
  beginGoogleLogin: vi.fn(),
  navigate: vi.fn(),
  pathname: "/patient/appointments",
  role: "patient" as "patient" | "admin" | "nurse" | "receptionist",
  clinics: [
    {
      id: "clinic",
      name: "Health Point",
      city: "Karachi",
      area: "Clifton",
      address: "Plot 12, Clifton Block 5",
      phone: "03001112233",
      department: "Neurology",
      doctorName: "Dr. Tariq",
      openingTime: "09:00",
      closingTime: "17:00",
      active: true,
    },
  ],
}));

vi.mock("@/api/client", () => ({ api: mocks.api }));
vi.mock("@/services/auth", () => ({
  register: mocks.register,
  login: mocks.login,
  logout: mocks.logout,
  beginGoogleLogin: mocks.beginGoogleLogin,
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
vi.mock("@/components/queue-feedback", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/queue-feedback")>();
  return {
    ...actual,
    Notifications: () => <div data-testid="notifications" />,
    QueueBoundary: ({ children }: { children: ReactNode }) => (
      <div data-testid="queue-boundary">{children}</div>
    ),
  };
});
vi.mock("@/components/notification-center", () => ({
  NotificationCenter: () => <div data-testid="notification-center" />,
}));
vi.mock("@/components/final-operations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/final-operations")>();
  return {
    ...actual,
    GlobalSearch: () => <div data-testid="global-search" />,
  };
});
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useLocation: () => ({ pathname: mocks.pathname }),
    Link: ({ to, children, className, onClick, onMouseEnter, onFocus, search: _search, activeProps: _activeProps, ...rest }: any) => (
      <a
        {...rest}
        href={typeof to === "string" ? to : "#"}
        className={className}
        onClick={(e) => {
          e.preventDefault();
          onClick?.(e);
        }}
        onMouseEnter={onMouseEnter}
        onFocus={onFocus}
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
import { AppointmentTokens } from "@/components/appointment-tokens";
import { PatientSummary } from "@/components/final-operations";
import { GoogleButton } from "@/components/google-button";
import { AccountSettings } from "@/components/final-operations";
import { Route as AdminRoute } from "@/routes/admin";
import { Route as StaffRoute } from "@/routes/staff";
import { Route as PatientRoute } from "@/routes/patient";
import { Route as DashboardRoute } from "@/routes/patient.dashboard";
import { BillingWorkspace } from "@/components/billing-workspace";
import { SelectField } from "@/components/form-controls";
import { validatePassword, validatePersonName, validatePhoneNumber } from "@/domain/input-validation";
import { formatDateOnly, formatDateTime } from "@/domain/date-format";

afterEach(() => {
  cleanup();
  clearClinicalCache();
  mocks.api.mockReset();
  mocks.register.mockReset();
  mocks.login.mockReset();
  mocks.beginGoogleLogin.mockReset();
  mocks.logout.mockReset();
  mocks.navigate.mockReset();
  mocks.pathname = "/patient/appointments";
  mocks.role = "patient";
  document.documentElement.classList.remove("dialog-scroll-locked");
  document.documentElement.removeAttribute("data-modal-lock-count");
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

  it("Fix 6 & Home UI Task 1-2 & 8: Single main nav bar, profile dropdown with Account & security + Sign Out, QueueBoundary scoping, and Clinic footer", async () => {
    mocks.api.mockResolvedValue({
      clinic: {
        display_name: "Health Point",
        logo_url: "",
        footer: "",
        email: "care@healthpoint.pk",
      },
      doctor: null,
    });
    mocks.pathname = "/patient/visits";
    const PatientComponent = PatientRoute.options.component!;
    render(<PatientComponent />);

    // Only one primary nav bar; secondary Patient records bar is removed
    expect(screen.queryByRole("navigation", { name: "Patient records" })).toBeNull();
    const mainNav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(mainNav).getByText("Home")).toBeVisible();
    expect(within(mainNav).getByText("Live queue")).toBeVisible();
    expect(within(mainNav).getByText("Appointments")).toBeVisible();
    const recordsTrigger = within(mainNav).getByRole("button", { name: /My records/i });
    expect(recordsTrigger).toBeVisible();
    fireEvent.keyDown(recordsTrigger, { key: "Enter", code: "Enter" });
    expect(await screen.findByRole("menuitem", { name: /My visits/i })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: /Prescriptions/i })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: /Billing/i })).toBeVisible();
    expect(document.body.style.overflow).toBe("");
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
    fireEvent.keyDown(recordsTrigger, { key: "Escape" });

    // Sign Out & Account & security are NOT separate standalone navbar links/buttons
    const header = document.querySelector("header")!;
    expect(within(header).queryByRole("button", { name: /^Sign Out$/i })).toBeNull();
    expect(within(header).queryByRole("link", { name: /Account & security/i })).toBeNull();

    // QueueBoundary remains omitted on non-queue visits route
    expect(screen.queryByTestId("queue-boundary")).toBeNull();
    expect(screen.getByTestId("route-outlet")).toBeVisible();

    // PDF-matched dark emerald Footer includes clinic identity, Quick links, My records, Help + interactive FAQ modal
    const footer = document.querySelector("footer")!;
    expect(footer.className).toContain("bg-[#0d4633]");
    expect(footer).toHaveTextContent("Health Point");
    expect(footer).toHaveTextContent("Plot 12, Clifton Block 5");
    expect(footer).toHaveTextContent("03001112233");
    expect(footer).toHaveTextContent(/All rights reserved/i);
    expect(within(footer).getByRole("link", { name: /Get directions/i })).toBeVisible();
    expect(within(footer).getByRole("link", { name: /Medical documents/i })).toBeVisible();
    expect(within(footer).getByRole("link", { name: /^Live queue$/i })).toBeVisible();
    fireEvent.click(within(footer).getByRole("button", { name: "FAQs" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(/Patient FAQs/i);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    // Profile dropdown includes My profile, Account & security, and Sign Out -> confirmation prompt without scroll-lock
    const profileTrigger = within(header).getByRole("button", { name: "Profile menu" });
    fireEvent.keyDown(profileTrigger, { key: "Enter", code: "Enter" });
    expect(await screen.findByRole("menuitem", { name: /My profile/i })).toBeVisible();
    expect(document.body.style.overflow).toBe("");
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
    expect(screen.getByRole("menuitem", { name: /Account & security/i })).toHaveAttribute(
      "href",
      "/account",
    );

    const signOutItem = screen.getByRole("menuitem", { name: /Sign Out/i });
    fireEvent.click(signOutItem);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/Are you sure you want to sign out/i);
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
  it("Register empty email shows Email is required and Full name maxLength is 50", async () => {
    expect(validatePersonName("A".repeat(51), "Full name").ok).toBe(false);
    expect(validatePersonName("A".repeat(50), "Full name").ok).toBe(true);

    render(<Register />);
    const nameInput = screen.getByLabelText("Full name") as HTMLInputElement;
    expect(nameInput.maxLength).toBe(50);
    fireEvent.change(nameInput, { target: { value: "Valid Patient" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "03001234567" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "StrongPass123!" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "StrongPass123!" } });
    fireEvent.click(screen.getByRole("button", { name: /Create account/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email is required.");
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("BUG-09: Network failure produces user-friendly connection message without local API text", async () => {
    const actualClient = await vi.importActual<typeof import("@/api/client")>("@/api/client");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("Failed to fetch"));
    try {
      await expect(actualClient.api("/auth/login", { method: "POST", body: {} })).rejects.toThrow(
        /Connection failed. Please check your internet connection and try again./i,
      );
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("BUG-10: Account & security rejects reusing current password as new password", async () => {
    mocks.api.mockResolvedValue({
      profile: { fullName: "Patient User", email: "patient@example.com", role: "patient" },
      googleLinked: false,
      sessions: [{ expiresAt: Date.now() + 60000, current: true }],
    });
    render(<AccountSettings />);
    fireEvent.change(await screen.findByLabelText("Current password"), {
      target: { value: "SamePassword123!" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "SamePassword123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "SamePassword123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "New password must be different from the current password.",
    );
    expect(mocks.api).not.toHaveBeenCalledWith("/account/password", expect.anything());
  });

  it("BUG-11 & BUG-12: Login submits via Enter key and keeps showing alert across 7 wrong attempts", async () => {
    mocks.login.mockRejectedValue(new Error("The email or password is incorrect."));
    const LoginComponent = LoginRoute.options.component!;
    render(<LoginComponent />);
    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");
    fireEvent.change(emailInput, { target: { value: "patient@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "WrongPassword1" } });

    // Submit form directly as triggered by pressing Enter inside password input
    const form = passwordInput.closest("form")!;
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent("The email or password is incorrect.");
    expect(mocks.login).toHaveBeenCalledTimes(1);

    for (let i = 2; i <= 7; i++) {
      fireEvent.click(screen.getByRole("button", { name: /Sign in/i }));
      await waitFor(() => expect(mocks.login).toHaveBeenCalledTimes(i));
      expect(await screen.findByRole("alert")).toHaveTextContent(/incorrect|locked|attempts/i);
    }
  });

  it("BUG-13: Continue with Google resets loading state on pageshow back navigation", async () => {
    mocks.beginGoogleLogin.mockReturnValue(new Promise(() => {}));
    render(<GoogleButton />);
    const btn = screen.getByRole("button", { name: /Continue with Google/i });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(btn).toBeDisabled();

    await act(async () => {
      window.dispatchEvent(new Event("pageshow"));
    });
    await waitFor(() => expect(btn).not.toBeDisabled());
  });

  it("Home UI Tasks 5-7: Shows color-coded appointment badges, retains cancelled appointments & omits Home Recent notifications", async () => {
    mocks.api.mockImplementation((path: string) => {
      if (path.includes("/patient/appointments")) {
        return Promise.resolve([
          {
            id: "appt-active",
            clinicId: "clinic",
            clinicName: "Health Point",
            scheduledAt: "2030-05-12T10:00",
            status: "scheduled",
            token: { id: "tok-1", tokenCode: "HP-010", status: "waiting" },
          },
          {
            id: "appt-cancelled",
            clinicId: "clinic",
            clinicName: "Health Point",
            scheduledAt: "2030-05-10T09:00",
            status: "cancelled",
            token: { id: "tok-2", tokenCode: "HP-009", status: "cancelled" },
          },
        ]);
      }
      if (path.includes("/patient/summary")) {
        return Promise.resolve({
          appointment: { scheduled_at: "2030-05-12T10:00", clinic_name: "Health Point" },
          visit: { visit_at: "2026-10-08T09:00:00Z", clinic_name: "Health Point" },
          prescription: null,
          document: null,
          bills: { balance: 0 },
          followups: [],
          notifications: [
            { id: "n1", title: "Turn approaching", message: "Arrive soon" },
          ],
        });
      }
      return Promise.resolve([]);
    });

    render(<AppointmentTokens />);
    expect(await screen.findByText("HP-010")).toBeVisible();
    expect(screen.getByText("Scheduled")).toBeVisible();
    expect(screen.getByText("Recent & cancelled appointments")).toBeVisible();
    expect(screen.getByText("Cancelled")).toBeVisible();
    expect(screen.getByRole("link", { name: /View full appointment history/i })).toHaveAttribute(
      "href",
      "/patient/appointments",
    );
    cleanup();

    render(<PatientSummary />);
    expect(await screen.findByRole("heading", { name: "Care summary" })).toBeVisible();
    expect(screen.getByText("Scheduled")).toBeVisible();
    // Task 7: Recent notifications section is completely removed from Home Page
    expect(screen.queryByText(/Recent notifications/i)).toBeNull();
    expect(screen.queryByText("Turn approaching")).toBeNull();
    cleanup();

    // Appointments page renders status badges and Cancelled filter tab works
    render(<Appointments />);
    expect(await screen.findByText(/HP-010/)).toBeVisible();
    const cancelledTab = screen.getByRole("tab", { name: /Cancelled/i });
    fireEvent.click(cancelledTab);
    expect(screen.getByText(/HP-009/)).toBeVisible();
    expect(screen.queryByText(/HP-010/)).toBeNull();
  });

  it("BUG-14, BUG-15 & BUG-18: Booking modal has uniform border radius, ignores outside clicks, warns on unsaved close & contains date picker inside dialog", async () => {
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
      return Promise.resolve([]);
    });

    render(<Appointments />);
    fireEvent.click(await screen.findByRole("button", { name: "Book appointment" }));
    const dialog = await screen.findByRole("dialog");

    // BUG-14: Uniform rounded-xl + overflow-hidden so scrollbars never square off corners
    expect(dialog.className).toContain("rounded-xl");
    expect(dialog.className).toContain("overflow-hidden");

    // BUG-18: Opening date picker inside the dialog mounts its popover inside the dialog element
    const dobPickerBtn = within(dialog).getByRole("button", { name: "Choose date" });
    fireEvent.click(dobPickerBtn);
    const grid = await within(dialog).findByRole("grid");
    expect(dialog.contains(grid)).toBe(true);
    fireEvent.keyDown(grid, { key: "Escape" });

    // BUG-15: Clicking outside on overlay does NOT close the modal; Cancel with unsaved notes asks confirmation
    fireEvent.change(within(dialog).getByLabelText("Patient notes (optional)"), {
      target: { value: "Follow-up MRI notes" },
    });
    const overlay = document.querySelector("[data-radix-dialog-overlay], .fixed.inset-0.z-50");
    if (overlay) {
      fireEvent.pointerDown(overlay);
      fireEvent.click(overlay);
    }
    expect(screen.getByRole("dialog")).toBeVisible();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(await within(dialog).findByText(/Discard unsaved appointment details/i)).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: /Discard & close/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("BUG-22, BUG-23 & BUG-26: Sorts upcoming appointments ascending before cancelled, scopes to selected clinic & formats dates consistently", async () => {
    mocks.api.mockImplementation((path: string) => {
      if (path.includes("/patient/appointments")) {
        return Promise.resolve([
          // Unsorted order: cancelled first, later date (20 Nov) before earlier date (18 Nov), plus another clinic
          {
            id: "appt-cancelled",
            clinicId: "clinic",
            clinicName: "Health Point",
            scheduledAt: "2030-11-21T09:00",
            status: "cancelled",
            token: { id: "tok-c", tokenCode: "HP-003", status: "cancelled" },
          },
          {
            id: "appt-other-clinic",
            clinicId: "northstar",
            clinicName: "Northstar Medical Clinic",
            scheduledAt: "2030-11-17T09:00",
            status: "scheduled",
            token: { id: "tok-other", tokenCode: "NM-001", status: "waiting" },
          },
          {
            id: "appt-later",
            clinicId: "clinic",
            clinicName: "Health Point",
            scheduledAt: "2030-11-20T14:15",
            status: "scheduled",
            token: { id: "tok-20", tokenCode: "HP-001", status: "waiting" },
          },
          {
            id: "appt-nearest",
            clinicId: "clinic",
            clinicName: "Health Point",
            scheduledAt: "2030-11-18T10:30",
            status: "scheduled",
            token: { id: "tok-18", tokenCode: "HP-002", status: "waiting" },
          },
        ]);
      }
      if (path.includes("/patient/summary")) {
        return Promise.resolve({
          appointment: {
            clinic_id: "northstar",
            scheduled_at: "2030-11-17T09:00",
            clinic_name: "Northstar Medical Clinic",
          },
          appointments: [
            {
              id: "appt-other-clinic",
              clinic_id: "northstar",
              scheduled_at: "2030-11-17T09:00",
              clinic_name: "Northstar Medical Clinic",
              status: "scheduled",
            },
            {
              id: "appt-nearest",
              clinic_id: "clinic",
              scheduled_at: "2030-11-18T10:30",
              clinic_name: "Health Point",
              status: "scheduled",
            },
            {
              id: "appt-later",
              clinic_id: "clinic",
              scheduled_at: "2030-11-20T14:15",
              clinic_name: "Health Point",
              status: "scheduled",
            },
          ],
          visit: null,
          prescription: null,
          document: null,
          bills: { balance: 0 },
          followups: [],
          notifications: [],
        });
      }
      return Promise.resolve([]);
    });

    expect(formatDateOnly("2030-11-18")).toBe("18 Nov 2030");
    expect(formatDateTime("2030-11-18T10:30")).toBe("18 Nov 2030, 10:30 AM");

    const { container } = render(<AppointmentTokens />);
    expect(await screen.findByText("HP-002")).toBeVisible();
    expect(screen.getByText("18 Nov 2030, 10:30 AM")).toBeVisible();
    expect(screen.getByText("20 Nov 2030, 2:15 PM")).toBeVisible();

    // BUG-23: Selected clinic is "clinic" (Health Point); Northstar clinic card must not leak onto Health Point dashboard
    expect(screen.queryByText("Northstar Medical Clinic")).toBeNull();
    expect(screen.queryByText("NM-001")).toBeNull();

    // BUG-22: 18 Nov (HP-002) renders BEFORE 20 Nov (HP-001), and cancelled (HP-003) renders separately after active cards
    const fullText = container.textContent ?? "";
    expect(fullText.indexOf("HP-002")).toBeLessThan(fullText.indexOf("HP-001"));
    expect(fullText.indexOf("HP-001")).toBeLessThan(fullText.indexOf("HP-003"));
    cleanup();

    // BUG-22 & BUG-23 in Care Summary: picks nearest appointment for Health Point (18 Nov), ignoring Northstar (17 Nov)
    render(<PatientSummary />);
    expect(await screen.findByText(/18 Nov 2030, 10:30 AM · Health Point/)).toBeVisible();
    expect(screen.queryByText(/Northstar Medical Clinic/)).toBeNull();
  });

  it("BUG-27, BUG-029 & BUG-034: Dashboard removes repeated quick-action links, renders PDF layout & places Live queue first on mobile", async () => {
    mocks.api.mockImplementation((path: string) => {
      if (path.includes("/patient/appointments")) {
        return Promise.resolve([
          {
            id: "appt-next",
            clinicId: "clinic",
            clinicName: "Health Point",
            scheduledAt: "2030-11-19T10:45",
            status: "confirmed",
            token: { id: "tok-1", tokenCode: "HP-001", status: "waiting" },
          },
          {
            id: "appt-later",
            clinicId: "clinic",
            clinicName: "Health Point",
            scheduledAt: "2030-11-20T11:45",
            status: "scheduled",
            token: { id: "tok-2", tokenCode: "HP-002", status: "waiting" },
          },
        ]);
      }
      if (path.includes("/patient/summary")) {
        return Promise.resolve({
          appointment: { id: "appt-next", clinic_id: "clinic", scheduled_at: "2030-11-19T10:45", clinic_name: "Health Point", status: "confirmed" },
          visit: { clinic_id: "clinic", visit_at: "2026-11-16T09:00:00Z", clinic_name: "Health Point" },
          prescription: { clinic_id: "clinic", prescribed_at: "2026-11-16T09:00:00Z", clinic_name: "Health Point" },
          document: null,
          bills: { balance: 25000, unpaid_count: 1 },
          followups: [
            {
              id: "fu-1",
              clinic_id: "clinic",
              follow_up_date: "2026-11-10",
              clinic_name: "Health Point",
              instructions: "Take proper rest and medicine on time.",
              status: "pending",
            },
          ],
          notifications: [],
        });
      }
      return Promise.resolve([]);
    });

    const DashboardComponent = DashboardRoute.options.component!;
    render(<DashboardComponent />);

    const greeting = await screen.findByText(/Good morning, Dr\./);
    expect(greeting).toBeVisible();
    const heroSection = greeting.closest("section")!;
    expect(within(heroSection).getByRole("button", { name: /Book appointment/i })).toBeVisible();
    expect(within(heroSection).queryByRole("link", { name: /Live queue/i })).toBeNull();
    // BUG-27: Repeated 4-card Quick actions navigation strip is removed
    expect(screen.queryByRole("region", { name: "Quick actions" })).toBeNull();
    // Next appointment + LATER + color-coded badges
    expect(await screen.findByText("HP-001")).toBeVisible();
    expect(screen.getByText("Confirmed")).toBeVisible();
    expect(screen.getByText("Scheduled")).toBeVisible();
    // Care summary 3 cards + Follow-up Pending pill
    expect(await screen.findByRole("heading", { name: "Care summary" })).toBeVisible();
    expect(screen.getByText("1 invoice unpaid")).toBeVisible();
    expect(screen.getByText("Pending")).toBeVisible();
    // BUG-034: Live queue card uses order-first on mobile and Before you arrive renders numbered steps
    const liveQueueRegion = screen.getByRole("heading", { name: "Live queue" }).closest("section")!;
    expect(liveQueueRegion.className).toContain("order-first");
    expect(liveQueueRegion.className).toContain("lg:order-none");
    expect(screen.getByText("Before you arrive")).toBeVisible();
  });

  it("BUG-033: Billing search includes helpful placeholder text and aligns with Status filter", async () => {
    mocks.api.mockResolvedValue([]);
    render(<BillingWorkspace portal />);
    const searchInput = await screen.findByPlaceholderText("Search invoices or patients");
    expect(searchInput).toBeVisible();
    const row = searchInput.closest(".flex.flex-wrap")!;
    expect(row.className).toContain("items-end");
  });

  it("BUG-035: Non-modal SelectField listbox opens without scroll-locking document.body or freezing pointer events", async () => {
    render(
      <SelectField aria-label="Clinic selector" defaultValue="clinic">
        <option value="clinic">Health Point</option>
        <option value="northstar">Northstar Medical Clinic</option>
      </SelectField>,
    );
    const trigger = screen.getByRole("combobox", { name: "Clinic selector" });
    fireEvent.click(trigger);
    expect(await screen.findByRole("option", { name: "Northstar Medical Clinic" })).toBeVisible();
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.pointerEvents).toBe("");
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
    fireEvent.click(screen.getByRole("option", { name: "Northstar Medical Clinic" }));
    expect(trigger).toHaveTextContent("Northstar Medical Clinic");
  });

  it("Issue 14: Admin header uses Profile dropdown, houses Account & security and Sign Out, and prevents horizontal overflow", async () => {
    mocks.role = "admin";
    mocks.logout.mockResolvedValue(undefined);
    mocks.api.mockResolvedValue([]);
    const AdminComponent = AdminRoute.options.component!;
    const { container } = render(<AdminComponent />);

    const layoutRoot = container.firstElementChild as HTMLElement;
    expect(layoutRoot.className).toContain("overflow-x-clip");
    expect(layoutRoot.className).toContain("max-w-full");

    const mainEl = container.querySelector("main") as HTMLElement;
    expect(mainEl.className).toContain("min-w-0");

    const header = document.querySelector("header")!;
    expect(header.className).toContain("max-w-full");
    expect(within(header).queryByRole("button", { name: /^Logout$/i })).toBeNull();
    expect(within(header).getByTestId("global-search")).toBeInTheDocument();
    expect(within(header).getByTestId("notifications")).toBeInTheDocument();

    const profileTrigger = within(header).getByRole("button", { name: "Profile menu" });
    fireEvent.keyDown(profileTrigger, { key: "Enter", code: "Enter" });
    const accountItem = await screen.findByRole("menuitem", { name: /Account & security/i });
    expect(accountItem).toBeVisible();
    expect(accountItem).toHaveAttribute("href", "/account");
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);

    fireEvent.click(screen.getByRole("menuitem", { name: /Sign Out/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/Are you sure you want to sign out/i);
    fireEvent.click(within(dialog).getByRole("button", { name: /Yes, Sign Out/i }));
    await waitFor(() => expect(mocks.logout).toHaveBeenCalledTimes(1));
  });

  it("BUG-036: Opening Book Appointment modal locks root document scroll without double scrollbars and unlocks on close", async () => {
    mocks.api.mockImplementation((path: string) => {
      if (path.includes("/patient/profile")) {
        return Promise.resolve({
          id: "u1",
          fullName: "Test Patient",
          phone: "03001234567",
          address: "12 Clifton",
          dateOfBirth: "1995-05-10",
          gender: "female",
        });
      }
      return Promise.resolve([]);
    });

    render(<Appointments />);
    expect(document.documentElement.classList.contains("dialog-scroll-locked")).toBe(false);

    fireEvent.click(await screen.findByRole("button", { name: /Book appointment/i }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/Book appointment/i);
    expect(dialog.className).toContain("overflow-hidden");
    expect(document.documentElement.classList.contains("dialog-scroll-locked")).toBe(true);

    const dialogBody = dialog.querySelector("[data-dialog-body=\"true\"]") as HTMLElement;
    expect(dialogBody).not.toBeNull();
    expect(dialogBody.className).toContain("overflow-y-auto");
    expect(dialogBody.className).toContain("thin-scrollbar");

    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.documentElement.classList.contains("dialog-scroll-locked")).toBe(false);
  });
});
