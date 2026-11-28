import { useState } from "react";
import { ClinicSwitcher, useClinicContext } from "@/providers/clinic-provider";
import { useAuth } from "@/providers/auth-provider";
import { ProtectedRoute } from "@/components/protected-route";
import { logout } from "@/services/auth";
import { runAction } from "@/services/queue";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { LogOut, ShieldCheck } from "lucide-react";
import { NotificationCenter } from "@/components/notification-center";
import { QueueBoundary } from "@/components/queue-feedback";
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

export const Route = createFileRoute("/patient")({ component: PatientLayout });

const primaryNavLinks = [
  { to: "/patient/dashboard", label: "Home", prefetch: "/patient/summary" },
  { to: "/patient/appointments", label: "Appointments", prefetch: "/patient/appointments" },
] as const;

const QUEUE_BOUNDARY_PATHS = new Set(["/patient/dashboard"]);

function initialsOf(name?: string) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "PT";
  return parts.length === 1
    ? parts[0]!.slice(0, 2).toUpperCase()
    : (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}


type HelpTopic = "contact" | "faqs" | "privacy" | "terms";

function PatientFooter() {
  const { clinics, selected } = useClinicContext();
  const activeClinic = clinics.find((c) => c.id === selected) ?? clinics[0];
  const [helpTopic, setHelpTopic] = useState<HelpTopic | null>(null);

  const clinicName = activeClinic?.name || "Neuro Medical Clinic";
  const clinicAddress =
    activeClinic?.address ||
    "Ground Floor, Mall Road (Opposite State Life Building, Adjacent to Bank Alfalah), Saddar, Rawalpindi, 46000";
  const clinicPhone = activeClinic?.phone || "+92 304 540 5530";
  const clinicEmail = "clinicneurology4@gmail.com";
  const mapsQuery = encodeURIComponent([clinicName, clinicAddress].filter(Boolean).join(", "));
  const drUmarMapsUrl =
    "https://www.google.com/maps/place/Dr.+Umar+Zafar+%7C+Neuro+Medical+Clinic/@33.5954252,73.0497297,17z/data=!4m7!3m6!1s0x38df958b4b5b0c57:0xd7b883c9ed34ae9b!8m2!3d33.5954252!4d73.0497297!10e1!16s%2Fg%2F11h80p7mjy?entry=ttu";
  const directionsUrl =
    activeClinic?.id === "northstar" || !activeClinic?.address
      ? drUmarMapsUrl
      : `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  return (
    <>
      <footer className="mt-14 bg-[#0d4633] text-emerald-50/90 print:hidden">
        <div className="mx-auto max-w-6xl px-5 py-10">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
            {/* Column 1: Clinic Contact Info */}
            <div className="min-w-0 space-y-2.5 text-sm">
              <div className="flex items-center gap-2.5">
                <span className="text-[15px] font-bold tracking-tight text-white">
                  {clinicName}
                </span>
              </div>
              <div className="space-y-1 pt-1 text-xs leading-relaxed text-emerald-100/80">
                <p className="font-medium text-emerald-200">
                  Dr. Umar Zafar Ali — Consultant Neurophysician &amp; Neurologist (MBBS, FCPS Neurology)
                </p>
                <p className="break-words">Consultation Fee: PKR 1,000</p>
                <p className="break-words">{clinicAddress}</p>
                <p className="space-x-3">
                  <span>
                    Mobile:{" "}
                    <a
                      href={`tel:${clinicPhone.replace(/[^+\d]/g, "")}`}
                      className="hover:text-white hover:underline"
                    >
                      {clinicPhone}
                    </a>
                  </span>
                </p>
                <p className="space-x-3">
                  <span>
                    WhatsApp:{" "}
                    <a
                      href="https://wa.me/923333311042"
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-white hover:underline"
                    >
                      +92 333 331 1042
                    </a>
                  </span>
                </p>
                <p>
                  Landline:{" "}
                  <a href="tel:0516128100" className="hover:text-white hover:underline">
                    (051) 6128100
                  </a>
                </p>
                <p>
                  Email:{" "}
                  <a href={`mailto:${clinicEmail}`} className="hover:text-white hover:underline">
                    {clinicEmail}
                  </a>
                </p>
              </div>
              <p className="flex flex-wrap gap-4 pt-1 text-xs font-medium">
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-200 underline-offset-4 hover:text-white hover:underline"
                >
                  Google Maps Directions Link
                </a>
                <a
                  href="https://www.google.com/maps/place/Dr.+Umar+Zafar+%7C+Neuro+Medical+Clinic/@33.5954252,73.0497297,17z"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-200 underline-offset-4 hover:text-white hover:underline"
                >
                  Dr. Umar Zafar Contact Page
                </a>
              </p>
            </div>

            {/* Column 2: Quick Links */}
            <div className="min-w-0 space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-200/75">
                Quick Links
              </h2>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link to="/patient/dashboard" className="text-emerald-100/80 hover:text-white">
                    Patient Home
                  </Link>
                </li>
                <li>
                  <Link to="/patient/appointments" className="text-emerald-100/80 hover:text-white">
                    Appointments &amp; Booking
                  </Link>
                </li>
                <li>
                  <Link to="/patient/profile" className="text-emerald-100/80 hover:text-white">
                    Profile &amp; Account
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Support & Legal */}
            <div className="min-w-0 space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-200/75">
                Support &amp; Legal
              </h2>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    type="button"
                    onClick={() => setHelpTopic("faqs")}
                    className="text-emerald-100/80 hover:text-white"
                  >
                    Help &amp; FAQs
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setHelpTopic("privacy")}
                    className="text-emerald-100/80 hover:text-white"
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setHelpTopic("terms")}
                    className="text-emerald-100/80 hover:text-white"
                  >
                    Terms of Use
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 border-t border-emerald-800/60 pt-5 text-xs text-emerald-200/70">
            &copy; {new Date().getFullYear()} {clinicName}. All rights reserved.
          </div>
        </div>
      </footer>

      <Dialog open={helpTopic !== null} onOpenChange={(open) => { if (!open) setHelpTopic(null); }}>
        <DialogContent className="max-w-lg">
          <DialogTitle>
            {helpTopic === "faqs"
              ? "Help & FAQs"
              : helpTopic === "privacy"
                ? "Privacy Policy"
                : helpTopic === "terms"
                  ? "Terms of Use"
                  : "Clinic Contact Information"}
          </DialogTitle>
          <DialogDescription>
            {clinicName} — Dr. Umar Zafar Ali
          </DialogDescription>
          <div className="space-y-3 text-sm text-muted-foreground">
            {helpTopic === "faqs" && (
              <>
                <p>
                  Book appointments from the Appointments tab using your preferred clinic center,
                  date, and available time slot.
                </p>
                <p>
                  Your live queue token and completed visit prescription PDFs are available directly
                  on your Patient Home page.
                </p>
              </>
            )}
            {helpTopic === "privacy" && (
              <p>
                Your clinical records, appointments, and attached documents are strictly private to
                your patient account and authorized clinic care staff.
              </p>
            )}
            {helpTopic === "terms" && (
              <p>
                Please arrive ahead of your scheduled appointment time. Cancelled appointments release
                their queue token automatically.
              </p>
            )}
            {helpTopic === "contact" && (
              <p>
                Call {clinicPhone} or email {clinicEmail} for clinic assistance.
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

              <NotificationCenter />

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
