import { useState } from "react";
import { ClinicSwitcher, useClinicContext } from "@/providers/clinic-provider";
import { useAuth } from "@/providers/auth-provider";
import { ProtectedRoute } from "@/components/protected-route";
import { logout } from "@/services/auth";
import { runAction } from "@/services/queue";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { LogOut, ShieldCheck } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
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

const primaryNavLinks = [
  { to: "/patient/dashboard", label: "Home", prefetch: "/patient/summary" },
  { to: "/patient/appointments", label: "Appointments", prefetch: "/patient/appointments" },
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

type HelpTopic = "contact" | "faqs" | "privacy" | "terms";

function PatientFooter() {
  const { clinics, selected } = useClinicContext();
  const activeClinic = clinics.find((c) => c.id === selected) ?? clinics[0];
  const branding = useClinicalData<PrintBrandingData>(
    selected ? "/branding?clinicId=" + encodeURIComponent(selected) : null,
  );
  const [helpTopic, setHelpTopic] = useState<HelpTopic | null>(null);

  const brandName = branding.data?.clinic?.display_name || "Neuro Spine Care Center";
  const clinicName = activeClinic?.name || brandName;
  const clinicAddress = activeClinic?.address || "";
  const clinicPhone = activeClinic?.phone || branding.data?.doctor?.phone || "";
  const clinicEmail = branding.data?.clinic?.email || branding.data?.doctor?.email || "";
  const opening = formatFooterTime(activeClinic?.openingTime) || "9:00 AM";
  const closing = formatFooterTime(activeClinic?.closingTime) || "5:00 PM";
  const locationParts = [activeClinic?.area, activeClinic?.city].filter(Boolean).join(", ");
  const addressDisplay =
    [clinicAddress, locationParts].filter(Boolean).join(", ") || "Clinic address at reception";
  const mapsQuery = encodeURIComponent([clinicName, clinicAddress, locationParts].filter(Boolean).join(", "));
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  return (
    <>
      <footer className="mt-14 bg-[#0d4633] text-emerald-50/90 print:hidden">
        <div className="mx-auto max-w-6xl px-5 py-11">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_1fr]">
            {/* Column 1: Clinic Identity & Directions */}
            <div className="min-w-0 space-y-2.5 text-sm">
              <div className="flex items-center gap-2.5">
                <div className="grid size-7 shrink-0 place-items-center rounded-md bg-white text-[#0d4633]">
                  <svg
                    viewBox="0 0 24 24"
                    className="size-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
                <span className="text-[15px] font-semibold tracking-tight text-white">
                  {brandName}
                </span>
              </div>

              <div className="space-y-1 pt-1 text-xs leading-relaxed text-emerald-100/80">
                {clinicName !== brandName && <p className="font-medium text-white">{clinicName}</p>}
                <p className="break-words">{addressDisplay}</p>
                {clinicPhone && (
                  <p>
                    <a
                      href={`tel:${clinicPhone.replace(/[^+\d]/g, "")}`}
                      className="tabular-nums hover:text-white hover:underline"
                    >
                      {clinicPhone}
                    </a>
                  </p>
                )}
                <p className="tabular-nums">
                  Today · {opening} – {closing}
                </p>
              </div>

              <p className="pt-1">
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-emerald-200 underline-offset-4 hover:text-white hover:underline"
                >
                  Get directions
                </a>
              </p>
            </div>

            {/* Column 2: Quick Links */}
            <div className="min-w-0 space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-200/75">
                Quick links
              </h2>
              <ul className="space-y-2 text-xs text-emerald-100/85">
                <li>
                  <Link
                    to="/patient/appointments"
                    search={{ book: "1" } as never}
                    className="hover:text-white hover:underline"
                  >
                    Book appointment
                  </Link>
                </li>
                <li>
                  <Link to="/patient/live-queue" className="hover:text-white hover:underline">
                    Live queue
                  </Link>
                </li>
                <li>
                  <Link to="/patient/appointments" className="hover:text-white hover:underline">
                    My appointments
                  </Link>
                </li>
                <li>
                  <Link to="/patient/profile" className="hover:text-white hover:underline">
                    Profile &amp; Account
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: My Records */}
            <div className="min-w-0 space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-200/75">
                My records
              </h2>
              <ul className="space-y-2 text-xs text-emerald-100/85">
                <li>
                  <Link to="/patient/visits" className="hover:text-white hover:underline">
                    My visits
                  </Link>
                </li>
                <li>
                  <Link to="/patient/prescriptions" className="hover:text-white hover:underline">
                    Prescriptions
                  </Link>
                </li>
                <li>
                  <Link to="/patient/documents" className="hover:text-white hover:underline">
                    Medical documents
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 4: Help */}
            <div className="min-w-0 space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-200/75">
                Help
              </h2>
              <ul className="space-y-2 text-xs text-emerald-100/85">
                <li>
                  <button
                    type="button"
                    onClick={() => setHelpTopic("contact")}
                    className="text-left hover:text-white hover:underline"
                  >
                    Contact clinic
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setHelpTopic("faqs")}
                    className="text-left hover:text-white hover:underline"
                  >
                    FAQs
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setHelpTopic("privacy")}
                    className="text-left hover:text-white hover:underline"
                  >
                    Privacy policy
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setHelpTopic("terms")}
                    className="text-left hover:text-white hover:underline"
                  >
                    Terms of use
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-9 flex flex-col justify-between gap-2 border-t border-white/15 pt-5 text-xs text-emerald-200/70 sm:flex-row sm:items-center">
            <p>
              &copy; {new Date().getFullYear()} {clinicName}. All rights reserved.
            </p>
            <p>All clinic times shown in Asia/Karachi (PKT)</p>
          </div>
        </div>
      </footer>

      <Dialog open={helpTopic !== null} onOpenChange={(open) => !open && setHelpTopic(null)}>
        <DialogContent className="max-w-md">
          <DialogTitle>
            {helpTopic === "contact"
              ? "Contact clinic"
              : helpTopic === "faqs"
                ? "Patient FAQs"
                : helpTopic === "privacy"
                  ? "Privacy policy"
                  : "Terms of use"}
          </DialogTitle>
          <DialogDescription>
            {helpTopic === "contact"
              ? `Reach ${clinicName} reception during clinic hours.`
              : helpTopic === "faqs"
                ? "Helpful answers about appointments, queue tokens, and visits."
                : helpTopic === "privacy"
                  ? "How your clinical records and appointment details are safeguarded."
                  : "Guidelines for booking appointments and using the patient queue portal."}
          </DialogDescription>
          <div className="space-y-3 text-sm text-muted-foreground">
            {helpTopic === "contact" && (
              <>
                <p>
                  <strong className="text-foreground">Clinic:</strong> {clinicName}
                </p>
                <p>
                  <strong className="text-foreground">Address:</strong> {addressDisplay}
                </p>
                {clinicPhone && (
                  <p>
                    <strong className="text-foreground">Phone:</strong>{" "}
                    <a
                      href={`tel:${clinicPhone.replace(/[^+\d]/g, "")}`}
                      className="text-primary hover:underline"
                    >
                      {clinicPhone}
                    </a>
                  </p>
                )}
                {clinicEmail && (
                  <p>
                    <strong className="text-foreground">Email:</strong>{" "}
                    <a href={`mailto:${clinicEmail}`} className="text-primary hover:underline">
                      {clinicEmail}
                    </a>
                  </p>
                )}
                <p>
                  <strong className="text-foreground">Hours:</strong> {opening} – {closing}
                </p>
              </>
            )}
            {helpTopic === "faqs" && (
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  Your token becomes active in the live queue on the day of your appointment.
                </li>
                <li>
                  Arrive at the waiting room when 3 patients remain ahead of your token.
                </li>
                <li>
                  To cancel an upcoming slot, open your appointment in Appointments and manage its token.
                </li>
              </ul>
            )}
            {helpTopic === "privacy" && (
              <p>
                Appointment bookings, prescriptions, and visit summaries are visible only to you and
                authorized clinic care staff. Never share your account password or active session
                links.
              </p>
            )}
            {helpTopic === "terms" && (
              <p>
                Please arrive on time when your token approaches the front of the queue. For
                medical emergencies, contact emergency services or visit the nearest emergency
                department immediately.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
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
  useClinicContext();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const normalizedPath = pathname.replace(/\/$/, "") || "/patient/dashboard";
  const needsQueueBoundary = QUEUE_BOUNDARY_PATHS.has(normalizedPath);
  const isHomePage =
    normalizedPath === "/patient/dashboard" || normalizedPath === "/patient";

  const prefetchNav = (to: string, prefetchPath: string) => {
    if (to === "/patient/appointments") {
      prefetchClinicalData("/patient/appointments");
      prefetchClinicalData("/patient/profile");
      return;
    }
    if (to === "/patient/dashboard") {
      prefetchClinicalData("/patient/summary");
      prefetchClinicalData("/patient/appointments");
      prefetchClinicalData("/patient/visits");
      return;
    }
    if (prefetchPath) prefetchClinicalData(prefetchPath);
  };

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-background">
      {/* Single Primary Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur print:hidden">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-2 sm:h-[72px] sm:gap-4">
            <Link to="/patient/dashboard" className="min-w-0 shrink">
              <Logo subtitle="Patient Portal" />
            </Link>

            <nav
              aria-label="Main navigation"
              className="flex shrink-0 items-center gap-1 rounded-xl border border-border/80 bg-muted/60 p-1"
            >
              {primaryNavLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onMouseEnter={() => prefetchNav(l.to, l.prefetch)}
                  onFocus={() => prefetchNav(l.to, l.prefetch)}
                  className="shrink-0 whitespace-nowrap rounded-lg border border-transparent px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground sm:px-4 sm:py-2 sm:text-sm"
                  activeProps={{
                    className:
                      "!border-primary/25 !bg-primary-soft !text-primary font-semibold",
                  }}
                >
                  {l.label}
                </Link>
              ))}
            </nav>

            <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
              <div className="hidden max-w-48 md:block md:max-w-56">
                <ClinicSwitcher />
              </div>

              <Notifications role="patient" />

              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Profile menu"
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-xs transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:size-10 sm:text-sm"
                  >
                    {initialsOf(profile?.fullName)}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60 rounded-xl p-1.5">
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
                      <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                      Profile &amp; Account
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
            </div>
          </div>

          {/* Mobile Clinic Selector inside the same single header */}
          <div className="pb-3 md:hidden">
            <ClinicSwitcher />
          </div>
        </div>
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
        className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8"
      >
        {needsQueueBoundary ? (
          <QueueBoundary kind={pathname.includes("history") ? "list" : "hero"}>
            <Outlet />
          </QueueBoundary>
        ) : (
          <Outlet />
        )}
      </main>

      {isHomePage && <PatientFooter />}
    </div>
  );
}
