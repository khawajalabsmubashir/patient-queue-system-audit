
import { useState } from "react";
import { ClinicSwitcher } from "@/providers/clinic-provider";
import { ProtectedRoute } from "@/components/protected-route";
import { logout } from "@/services/auth";
import { runAction } from "@/services/queue";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { History, Home, Ticket, Activity, LogOut } from "lucide-react";
import { Notifications, QueueBoundary } from "@/components/queue-feedback";
import { Logo } from "@/components/qc";

export const Route = createFileRoute("/patient")({ component: PatientLayout });

const links = [
  { to: "/patient/dashboard", label: "Home", icon: Home },
  { to: "/patient/live-queue", label: "Live queue", icon: Activity },
  { to: "/patient/appointments", label: "Appointments", icon: Ticket },
  { to: "/patient/history", label: "History", icon: History },
] as const;

function PatientLayout() {
  return (
    <ProtectedRoute role="patient">
      <PatientLayoutContent />
    </ProtectedRoute>
  );
}

function PatientLayoutContent() {
  const { pathname } = useLocation();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  return (
    <div className="min-h-screen pb-24 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center gap-3 px-5 py-3 md:gap-6">
          <Link to="/patient/dashboard">
            <Logo />
          </Link>

          <nav className="hidden gap-1 md:flex">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground"
                activeProps={{ className: "!text-foreground bg-muted font-medium" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="max-w-48 sm:max-w-64">
              <ClinicSwitcher />
            </div>

            <Notifications role="patient" />

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm((value) => !value)}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                <LogOut className="size-4" />
                <span>Sign Out</span>
              </button>

              {showLogoutConfirm && (
                <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-border bg-card p-4 shadow-lg">
                  <p className="text-sm font-medium">
                    Are you sure you want to sign out?
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    You will need to log in again to access your account.
                  </p>

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowLogoutConfirm(false)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={() => void runAction(logout, "Signed out.")}
                      className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:opacity-90"
                    >
                      Yes, Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-6xl px-5 py-8 md:py-12"
      >
        <nav
          aria-label="Patient records"
          className="mb-6 flex flex-wrap gap-2 print:hidden"
        >
          {[
            { to: "/account", label: "Account & security" },
            { to: "/patient/profile", label: "My profile" },
            { to: "/patient/visits", label: "My visits" },
            { to: "/patient/prescriptions", label: "Prescriptions" },
            { to: "/patient/appointments", label: "Appointments" },
            { to: "/patient/billing", label: "Billing" },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
              activeProps={{ className: "!text-primary bg-primary-soft font-medium" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <QueueBoundary kind={pathname.includes("history") ? "list" : "hero"}>
          <Outlet />
        </QueueBoundary>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-card/95 backdrop-blur md:hidden">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground"
            activeProps={{ className: "!text-primary font-medium" }}
          >
            <l.icon className="size-5" />
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
