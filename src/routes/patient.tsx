import { useState } from "react";
import { ClinicSwitcher, useClinicContext } from "@/providers/clinic-provider";
import { ProtectedRoute } from "@/components/protected-route";
import { logout } from "@/services/auth";
import { runAction } from "@/services/queue";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import {
  Activity,
  Calendar,
  ClipboardList,
  History,
  Home,
  LogOut,
  Pill,
  Receipt,
  ShieldCheck,
  Ticket,
  User,
} from "lucide-react";
import { Notifications, QueueBoundary } from "@/components/queue-feedback";
import { prefetchClinicalData } from "@/components/clinical";
import { Logo } from "@/components/qc";

export const Route = createFileRoute("/patient")({ component: PatientLayout });

const links = [
  { to: "/patient/dashboard", label: "Home", icon: Home },
  { to: "/patient/live-queue", label: "Live queue", icon: Activity },
  { to: "/patient/appointments", label: "Appointments", icon: Ticket },
  { to: "/patient/history", label: "History", icon: History },
] as const;

const recordTabs = [
  { to: "/patient/profile", label: "My profile", icon: User, prefetch: "/patient/profile" },
  { to: "/patient/visits", label: "My visits", icon: ClipboardList, prefetch: "/patient/visits" },
  { to: "/patient/prescriptions", label: "Prescriptions", icon: Pill, prefetch: "/patient/prescriptions" },
  { to: "/patient/appointments", label: "Appointments", icon: Calendar, prefetch: "/patient/appointments" },
  { to: "/patient/billing", label: "Billing", icon: Receipt, prefetch: "/billing/invoices?clinicId=all" },
] as const;

const QUEUE_BOUNDARY_PATHS = new Set([
  "/patient/dashboard",
  "/patient/live-queue",
  "/patient/queue",
  "/patient/history",
  "/patient/join-queue",
  "/patient/get-token",
]);

function PatientLayout() {
  return (
    <ProtectedRoute role="patient">
      <PatientLayoutContent />
    </ProtectedRoute>
  );
}

function PatientLayoutContent() {
  const { pathname } = useLocation();
  const { selected } = useClinicContext();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const normalizedPath = pathname.replace(/\/$/, "") || "/patient/dashboard";
  const needsQueueBoundary = QUEUE_BOUNDARY_PATHS.has(normalizedPath);

  const prefetchMainNav = (to: string) => {
    if (to === "/patient/appointments") {
      prefetchClinicalData("/patient/appointments");
      prefetchClinicalData("/patient/profile");
    } else if (to === "/patient/dashboard") {
      prefetchClinicalData("/patient/summary");
      prefetchClinicalData("/patient/appointments");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center gap-3 px-5 py-3 md:gap-5">
          <Link to="/patient/dashboard">
            <Logo />
          </Link>

          <nav className="hidden gap-1 md:flex" aria-label="Main navigation">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onMouseEnter={() => prefetchMainNav(l.to)}
                onFocus={() => prefetchMainNav(l.to)}
                className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
                activeProps={{ className: "!text-foreground bg-muted font-medium" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="max-w-44 sm:max-w-60">
              <ClinicSwitcher />
            </div>

            <Notifications role="patient" />

            <Link
              to="/account"
              onMouseEnter={() => prefetchClinicalData("/account")}
              onFocus={() => prefetchClinicalData("/account")}
              aria-label="Account & security"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition hover:bg-muted"
              activeProps={{ className: "!border-primary !bg-primary-soft !text-primary" }}
            >
              <ShieldCheck className="size-4 text-primary" />
              <span className="hidden lg:inline">Account &amp; security</span>
            </Link>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm((value) => !value)}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>

              {showLogoutConfirm && (
                <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-border bg-card p-4 shadow-lg">
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
        className="mx-auto max-w-6xl px-5 py-6 md:py-10"
      >
        <nav
          aria-label="Patient records"
          className="mb-7 flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card p-1.5 shadow-soft print:hidden"
        >
          {recordTabs.map((item) => {
            const Icon = item.icon;
            const prefetchTarget =
              item.to === "/patient/billing"
                ? `/billing/invoices?clinicId=${encodeURIComponent(selected || "all")}`
                : item.prefetch;
            return (
              <Link
                key={item.to}
                to={item.to}
                onMouseEnter={() => prefetchClinicalData(prefetchTarget)}
                onFocus={() => prefetchClinicalData(prefetchTarget)}
                className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
                activeProps={{ className: "!bg-primary-soft !text-primary font-medium shadow-sm" }}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {needsQueueBoundary ? (
          <QueueBoundary kind={pathname.includes("history") ? "list" : "hero"}>
            <Outlet />
          </QueueBoundary>
        ) : (
          <Outlet />
        )}
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
