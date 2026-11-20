import { useState } from "react";
import { ClinicSwitcher, useClinicContext } from "@/providers/clinic-provider";
import { useAuth } from "@/providers/auth-provider";
import { ProtectedRoute } from "@/components/protected-route";
import { logout } from "@/services/auth";
import { runAction } from "@/services/queue";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import {
  Activity,
  ChevronDown,
  ClipboardList,
  Clock,
  History,
  Home,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Phone,
  Pill,
  Receipt,
  ShieldCheck,
  Ticket,
  User,
  X,
} from "lucide-react";
import { Notifications, QueueBoundary } from "@/components/queue-feedback";
import { prefetchClinicalData, useClinicalData } from "@/components/clinical";
import { Logo } from "@/components/qc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { PrintBrandingData } from "@/types/clinical-workflow";

export const Route = createFileRoute("/patient")({ component: PatientLayout });

const navLinks = [
  { to: "/patient/dashboard", label: "Home", icon: Home, prefetch: "/patient/summary" },
  { to: "/patient/live-queue", label: "Live queue", icon: Activity, prefetch: "" },
  {
    to: "/patient/appointments",
    label: "Appointments",
    icon: Ticket,
    prefetch: "/patient/appointments",
  },
  { to: "/patient/visits", label: "My visits", icon: ClipboardList, prefetch: "/patient/visits" },
  {
    to: "/patient/prescriptions",
    label: "Prescriptions",
    icon: Pill,
    prefetch: "/patient/prescriptions",
  },
  { to: "/patient/billing", label: "Billing", icon: Receipt, prefetch: "/billing/invoices?clinicId=all" },
  { to: "/patient/history", label: "History", icon: History, prefetch: "" },
] as const;

const QUEUE_BOUNDARY_PATHS = new Set([
  "/patient/dashboard",
  "/patient/live-queue",
  "/patient/queue",
  "/patient/history",
  "/patient/join-queue",
  "/patient/get-token",
]);

function initialsOf(name?: string) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "PT";
  return parts.length === 1
    ? parts[0]!.slice(0, 2).toUpperCase()
    : (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function formatFooterTime(value?: string) {
  if (!value || !value.includes(":")) return "";
  const [hour, minute] = value.split(":");
  const h = Number(hour);
  if (Number.isNaN(h)) return value;
  return `${h % 12 || 12}:${minute} ${h >= 12 ? "PM" : "AM"}`;
}

function PatientFooter() {
  const { clinics, selected } = useClinicContext();
  const activeClinic = clinics.find((c) => c.id === selected) ?? clinics[0];
  const branding = useClinicalData<PrintBrandingData>(
    selected ? "/branding?clinicId=" + encodeURIComponent(selected) : null,
  );
  const clinicName =
    branding.data?.clinic?.display_name || activeClinic?.name || "Neuro Spine Care Center";
  const clinicAddress = activeClinic?.address || "";
  const clinicPhone = activeClinic?.phone || branding.data?.doctor?.phone || "";
  const clinicEmail = branding.data?.clinic?.email || branding.data?.doctor?.email || "";
  const opening = formatFooterTime(activeClinic?.openingTime);
  const closing = formatFooterTime(activeClinic?.closingTime);
  const locationParts = [activeClinic?.area, activeClinic?.city].filter(Boolean).join(" · ");
  const displayUrl = "/public-display?clinicId=" + encodeURIComponent(selected || "northstar");

  return (
    <footer className="mt-14 border-t border-border bg-card/80 print:hidden">
      <div className="mx-auto max-w-7xl px-5 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Column 1: Clinic Identity & Hours */}
          <div className="min-w-0 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">{clinicName}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {activeClinic?.department
                ? `${activeClinic.department}${activeClinic.doctorName ? " · " + activeClinic.doctorName : ""}`
                : "Outpatient queue tracking, scheduled consultations, and patient care portal."}
            </p>
            {(opening || closing) && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Clock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="tabular-nums">
                  Clinic hours: {opening || "09:00 AM"} – {closing || "05:00 PM"}
                </span>
              </div>
            )}
          </div>

          {/* Column 2: Address & Contact Details */}
          <div className="min-w-0 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Contact &amp; Location</h2>
            <div className="space-y-2.5 text-sm text-muted-foreground">
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="break-words">
                  {clinicAddress || "Clinic address available at reception"}
                  {locationParts ? ` (${locationParts})` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="size-4 shrink-0 text-primary" aria-hidden="true" />
                {clinicPhone ? (
                  <a
                    href={`tel:${clinicPhone.replace(/[^+\d]/g, "")}`}
                    className="tabular-nums hover:text-foreground hover:underline"
                  >
                    {clinicPhone}
                  </a>
                ) : (
                  <span>Phone listed at clinic reception</span>
                )}
              </div>
              {clinicEmail && (
                <div className="flex items-center gap-2.5">
                  <Mail className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <a
                    href={`mailto:${clinicEmail}`}
                    className="truncate hover:text-foreground hover:underline"
                  >
                    {clinicEmail}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Quick Links (distinct from main top navigation) */}
          <div className="min-w-0 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Quick Links</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  to="/patient/appointments"
                  search={{ book: "1" } as never}
                  className="hover:text-foreground hover:underline"
                >
                  Book new appointment
                </Link>
              </li>
              <li>
                <Link to="/patient/documents" className="hover:text-foreground hover:underline">
                  Medical documents
                </Link>
              </li>
              <li>
                <Link to="/patient/profile" className="hover:text-foreground hover:underline">
                  My profile &amp; details
                </Link>
              </li>
              <li>
                <Link to="/account" className="hover:text-foreground hover:underline">
                  Account &amp; security
                </Link>
              </li>
              <li>
                <a href={displayUrl} className="hover:text-foreground hover:underline">
                  Waiting room display
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Patient Resources & Support */}
          <div className="min-w-0 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Patient Support</h2>
            <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
              <li>Arrive at the clinic when 3 patients remain ahead of your token.</li>
              <li>
                To cancel a booking, open your appointment card and select Give up token.
              </li>
              <li>All clinic appointment times follow Asia/Karachi (PKT).</li>
              <li className="text-foreground/80">
                For medical emergencies, contact emergency services or visit the nearest ER
                immediately.
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>
            &copy; {new Date().getFullYear()} {clinicName}. All rights reserved.
          </p>
          <p>{locationParts ? `${locationParts} · Patient Care Portal` : "Patient Care Portal"}</p>
        </div>
      </div>
    </footer>
  );
}

function PatientLayout() {
  return (
    <ProtectedRoute role="patient">
      <PatientLayoutContent />
    </ProtectedRoute>
  );
}

function PatientLayoutContent() {
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const { selected } = useClinicContext();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const normalizedPath = pathname.replace(/\/$/, "") || "/patient/dashboard";
  const needsQueueBoundary = QUEUE_BOUNDARY_PATHS.has(normalizedPath);

  const prefetchNav = (to: string, prefetchPath: string) => {
    if (to === "/patient/billing") {
      prefetchClinicalData(`/billing/invoices?clinicId=${encodeURIComponent(selected || "all")}`);
      return;
    }
    if (to === "/patient/appointments") {
      prefetchClinicalData("/patient/appointments");
      prefetchClinicalData("/patient/profile");
      return;
    }
    if (to === "/patient/dashboard") {
      prefetchClinicalData("/patient/summary");
      prefetchClinicalData("/patient/appointments");
      return;
    }
    if (prefetchPath) prefetchClinicalData(prefetchPath);
  };

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-background">
      {/* Single Primary Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur print:hidden">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5">
          <div className="flex min-w-0 items-center gap-5">
            <Link to="/patient/dashboard" className="min-w-0 shrink-0">
              <Logo />
            </Link>

            <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
              {navLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onMouseEnter={() => prefetchNav(l.to, l.prefetch)}
                  onFocus={() => prefetchNav(l.to, l.prefetch)}
                  className="shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
                  activeProps={{ className: "!text-primary !bg-primary-soft font-semibold" }}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-2.5">
            <div className="hidden max-w-44 sm:block md:max-w-52">
              <ClinicSwitcher />
            </div>

            <Notifications role="patient" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Profile menu"
                  className="inline-flex h-10 max-w-48 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                    {initialsOf(profile?.fullName)}
                  </span>
                  <span className="hidden truncate sm:inline">
                    {profile?.fullName?.split(" ")[0] || "Account"}
                  </span>
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-xl p-1.5">
                <DropdownMenuLabel className="px-2.5 py-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {profile?.fullName || "Patient"}
                  </p>
                  {profile?.email && (
                    <p className="truncate text-xs font-normal text-muted-foreground">
                      {profile.email}
                    </p>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    to="/patient/profile"
                    onMouseEnter={() => prefetchClinicalData("/patient/profile")}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm"
                  >
                    <User className="size-4 text-muted-foreground" aria-hidden="true" />
                    My profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to="/account"
                    onMouseEnter={() => prefetchClinicalData("/account")}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm"
                  >
                    <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                    Account &amp; security
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => setShowLogoutConfirm(true)}
                  className="cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              type="button"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-card text-foreground transition hover:bg-muted lg:hidden"
            >
              {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>

        {/* Collapsible mobile link list inside the single header navigation */}
        {mobileMenuOpen && (
          <nav
            aria-label="Mobile navigation"
            className="border-t border-border bg-background px-5 py-3 lg:hidden"
          >
            <div className="mb-3 sm:hidden">
              <ClinicSwitcher />
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {navLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setMobileMenuOpen(false)}
                  onMouseEnter={() => prefetchNav(l.to, l.prefetch)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  activeProps={{ className: "!bg-primary-soft !text-primary font-semibold" }}
                >
                  <l.icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{l.label}</span>
                </Link>
              ))}
            </div>
          </nav>
        )}
      </header>

      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need to log in again to access your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void runAction(logout, "Signed out.")}
              className="bg-destructive text-destructive-foreground hover:opacity-90"
            >
              Yes, Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-5 py-6 md:py-10"
      >
        {needsQueueBoundary ? (
          <QueueBoundary kind={pathname.includes("history") ? "list" : "hero"}>
            <Outlet />
          </QueueBoundary>
        ) : (
          <Outlet />
        )}
      </main>

      <PatientFooter />
    </div>
  );
}
