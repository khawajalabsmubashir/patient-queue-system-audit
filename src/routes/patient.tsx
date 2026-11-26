import { useState } from "react";
import { ClinicSwitcher, useClinicContext } from "@/providers/clinic-provider";
import { useAuth } from "@/providers/auth-provider";
import { ProtectedRoute } from "@/components/protected-route";
import { logout } from "@/services/auth";
import { runAction } from "@/services/queue";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { ExternalLink, LogOut, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { Notifications, QueueBoundary } from "@/components/queue-feedback";
import { prefetchClinicalData } from "@/components/clinical";
import { Logo } from "@/components/qc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
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

export const Route = createFileRoute("/patient")({ component: PatientLayout });

const primaryNavLinks = [
  { to: "/patient/dashboard", label: "Home", prefetch: "/patient/summary" },
  { to: "/patient/appointments", label: "Appointments", prefetch: "/patient/appointments" },
] as const;

const QUEUE_BOUNDARY_PATHS = new Set(["/patient/dashboard"]);

const CLINIC_CONTACT = {
  clinicName: "Neuro Medical Clinic",
  doctor: "Dr. Umar Zafar Ali — Consultant Neurophysician & Neurologist (MBBS, FCPS Neurology)",
  address:
    "Ground Floor, Mall Road (Opposite State Life Building, Adjacent to Bank Alfalah), Saddar, Rawalpindi, 46000",
  mobileDisplay: "+92 304 540 5530",
  mobileHref: "tel:+923045405530",
  whatsappDisplay: "+92 333 331 1042",
  whatsappHref: "https://wa.me/923333311042",
  landlineDisplay: "(051) 6128100",
  landlineHref: "tel:+92516128100",
  email: "clinicneurology4@gmail.com",
  contactPageUrl: "https://drumarzafar.com/contact-us/",
  directionsUrl:
    "https://www.google.com/maps/place/Dr.+Umar+Zafar+%7C+Neuro+Medical+Clinic/@33.5954252,73.0497297,17z/data=!4m7!3m6!1s0x38df958b4b5b0c57:0xd7b883c9ed34ae9b!8m2!3d33.5954252!4d73.0497297!10e1!16s%2Fg%2F11h80p7mjy?entry=ttu&g_ep=EgoyMDI2MTEyMy4wIKXMDSoASAFQAw%3D%3D",
} as const;

function initialsOf(name?: string) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "PT";
  return parts.length === 1
    ? parts[0]!.slice(0, 2).toUpperCase()
    : (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

type HelpTopic = "privacy" | "terms";

function PatientFooter() {
  const [helpTopic, setHelpTopic] = useState<HelpTopic | null>(null);

  return (
    <>
      <footer className="mt-14 bg-[#0d4633] text-emerald-50/90 pb-[env(safe-area-inset-bottom)] print:hidden">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-11">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.65fr_1fr_0.9fr] lg:gap-10">
            {/* Column 1: Contact */}
            <div className="min-w-0 space-y-3 text-sm sm:col-span-2 lg:col-span-1">
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
                  {CLINIC_CONTACT.clinicName}
                </span>
              </div>

              <p className="text-xs font-medium leading-relaxed text-emerald-100">
                {CLINIC_CONTACT.doctor}
              </p>

              <div className="space-y-2 text-xs leading-relaxed text-emerald-100/85">
                <p className="flex items-start gap-2 break-words">
                  <MapPin
                    className="mt-0.5 size-3.5 shrink-0 text-emerald-300"
                    aria-hidden="true"
                  />
                  <span>{CLINIC_CONTACT.address}</span>
                </p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="size-3.5 shrink-0 text-emerald-300" aria-hidden="true" />
                    <span className="text-emerald-200/80">Mobile:</span>
                    <a
                      href={CLINIC_CONTACT.mobileHref}
                      className="tabular-nums font-medium text-white hover:underline"
                    >
                      {CLINIC_CONTACT.mobileDisplay}
                    </a>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-emerald-200/80">WhatsApp:</span>
                    <a
                      href={CLINIC_CONTACT.whatsappHref}
                      target="_blank"
                      rel="noreferrer"
                      className="tabular-nums font-medium text-white hover:underline"
                    >
                      {CLINIC_CONTACT.whatsappDisplay}
                    </a>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-emerald-200/80">Landline:</span>
                    <a
                      href={CLINIC_CONTACT.landlineHref}
                      className="tabular-nums font-medium text-white hover:underline"
                    >
                      {CLINIC_CONTACT.landlineDisplay}
                    </a>
                  </span>
                </div>

                <p className="flex items-center gap-2">
                  <Mail className="size-3.5 shrink-0 text-emerald-300" aria-hidden="true" />
                  <a
                    href={`mailto:${CLINIC_CONTACT.email}`}
                    className="font-medium text-white hover:underline"
                  >
                    {CLINIC_CONTACT.email}
                  </a>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-xs">
                <a
                  href={CLINIC_CONTACT.contactPageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-emerald-200 underline-offset-4 hover:text-white hover:underline"
                >
                  <span>Dr. Umar Zafar Contact Page</span>
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
                <a
                  href={CLINIC_CONTACT.directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-emerald-200 underline-offset-4 hover:text-white hover:underline"
                >
                  <span>Get directions</span>
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              </div>
            </div>

            {/* Column 2: Quick Links */}
            <div className="min-w-0 space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-200/75">
                Quick links
              </h2>
              <ul className="space-y-2.5 text-xs text-emerald-100/85">
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

            {/* Column 3: Legal */}
            <div className="min-w-0 space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-200/75">
                Policies
              </h2>
              <ul className="space-y-2.5 text-xs text-emerald-100/85">
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
              &copy; {new Date().getFullYear()} {CLINIC_CONTACT.clinicName}. All rights reserved.
            </p>
            <p>All clinic times shown in Asia/Karachi (PKT)</p>
          </div>
        </div>
      </footer>

      <Dialog open={helpTopic !== null} onOpenChange={(open) => !open && setHelpTopic(null)}>
        <DialogContent className="max-w-md">
          <DialogTitle>{helpTopic === "privacy" ? "Privacy policy" : "Terms of use"}</DialogTitle>
          <DialogDescription>
            {helpTopic === "privacy"
              ? "How your clinical records and appointment details are safeguarded."
              : "Guidelines for booking appointments and using the patient queue portal."}
          </DialogDescription>
          <div className="space-y-3 text-sm text-muted-foreground">
            {helpTopic === "privacy" && (
              <p>
                Appointment bookings, prescriptions, and visit summaries are visible only to you and
                authorized clinic care staff. Never share your account password or active session
                links.
              </p>
            )}
            {helpTopic === "terms" && (
              <p>
                Please arrive on time when your token approaches the front of the queue. For medical
                emergencies, contact emergency services or visit the nearest emergency department
                immediately.
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
  const isHomePage = normalizedPath === "/patient/dashboard" || normalizedPath === "/patient";

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
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 pt-[env(safe-area-inset-top)] backdrop-blur print:hidden">
        <div className="mx-auto max-w-6xl px-3.5 sm:px-6">
          <div className="flex h-14 items-center justify-between gap-2 sm:h-[72px] sm:gap-4">
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
                  className="shrink-0 whitespace-nowrap rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground sm:px-4 sm:py-2 sm:text-sm"
                  activeProps={{
                    className: "!border-primary/25 !bg-primary-soft !text-primary font-semibold",
                  }}
                >
                  {l.label}
                </Link>
              ))}
            </nav>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
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

          <div className="pb-2.5 md:hidden">
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
        className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-5 sm:px-6 sm:py-8"
      >
        {needsQueueBoundary ? (
          <QueueBoundary kind="hero">
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
