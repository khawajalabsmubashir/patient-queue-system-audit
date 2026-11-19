import { GlobalSearch } from "@/components/final-operations";
import { ClinicSwitcher, useClinicContext } from "@/providers/clinic-provider";
import { ProtectedRoute } from "@/components/protected-route";
import { useAuth } from "@/providers/auth-provider";
import { logout } from "@/services/auth";
import { runAction } from "@/services/queue";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { History, LayoutGrid, ListOrdered, Monitor, Settings, Users, Menu, LogOut } from "lucide-react";
import { Logo, LiveDot } from "@/components/qc";
import { useQueue } from "@/lib/queue-store";
import { cn } from "@/lib/utils";
import { Notifications, QueueBoundary } from "@/components/queue-feedback";
import { prefetchClinicalData } from "@/components/clinical";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/admin")({ component: AdminLayout });
const nav = [
  { to: "/admin", label: "Home", icon: LayoutGrid, exact: true },
  { to: "/admin/appointments", label: "Appointments", icon: History },
  { to: "/admin/live-queue", label: "Live Queue", icon: ListOrdered },
  { to: "/admin/patients", label: "Patients", icon: Users },
  { to: "/admin/medicine-library", label: "Medicine Library", icon: ListOrdered },
  { to: "/admin/clinics", label: "Clinics", icon: LayoutGrid },
  { to: "/admin/doctor-schedule", label: "Doctor Schedule", icon: History },
  { to: "/admin/staff", label: "Staff", icon: Users },
  { to: "/admin/billing", label: "Billing", icon: ListOrdered },
  { to: "/admin/reports", label: "Reports", icon: Settings },
] as const;

function prefetchAdminRoute(to: string, selected: string) {
  const clinic = encodeURIComponent(selected);
  switch (to) {
    case "/admin":
      prefetchClinicalData(`/admin/today?clinicId=${clinic}`);
      break;
    case "/admin/appointments":
      prefetchClinicalData(`/admin/appointment-flow?clinicId=${clinic}`);
      break;
    case "/admin/patients":
      prefetchClinicalData(`/admin/conditions?clinicId=${clinic}`);
      prefetchClinicalData(`/admin/patients/search?q=&clinicId=${clinic}&conditionId=&clinical=`);
      break;
    case "/admin/medicine-library":
      if (selected !== "all") prefetchClinicalData(`/admin/medicine-library?clinicId=${clinic}`);
      break;
    case "/admin/clinics":
      prefetchClinicalData("/admin/clinics");
      break;
    case "/admin/doctor-schedule":
      if (selected !== "all") prefetchClinicalData(`/admin/doctor-availability?clinicId=${clinic}`);
      break;
    case "/admin/staff":
      prefetchClinicalData("/admin/staff");
      break;
    case "/admin/billing":
      prefetchClinicalData(`/billing/invoices?clinicId=${clinic}`);
      break;
  }
}

function AdminNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const { selected } = useClinicContext();
  return (
    <nav className="mt-8 space-y-1">
      {nav.map((n) => (
        <Link
          key={n.to}
          to={n.to}
          onClick={onNavigate}
          onMouseEnter={() => prefetchAdminRoute(n.to, selected)}
          onFocus={() => prefetchAdminRoute(n.to, selected)}
          activeOptions={{ exact: "exact" in n }}
          className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/75 transition hover:bg-sidebar-accent"
          activeProps={{
            className: "!bg-sidebar-accent !text-sidebar-accent-foreground font-medium",
          }}
        >
          <n.icon className="size-4" />
          {n.label}
        </Link>
      ))}
      {selected !== "all" && (
        <a
          href={`/public-display?clinicId=${encodeURIComponent(selected === "all" ? "northstar" : selected)}`}
          target="_blank"
          onClick={onNavigate}
          className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/75 hover:bg-sidebar-accent"
        >
          <Monitor className="size-4" />
          Public display
        </a>
      )}
    </nav>
  );
}
function AdminLayout() {
  return (
    <ProtectedRoute role="admin">
      <AdminLayoutContent />
    </ProtectedRoute>
  );
}
function AdminLayoutContent() {
  const { profile } = useAuth();
  const { selected } = useClinicContext();
  const initials =
    profile?.fullName
      .split(/\s+/)
      .map((n) => n[0])
      .slice(0, 2)
      .join("") ?? "";
  const { open, clinic, queueDate } = useQueue();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const date = new Date(`${queueDate}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen overflow-y-auto w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 lg:flex">
        <Logo className="px-2" />
        <AdminNavigation />
        <button
          type="button"
          aria-label="Sign out"
          onClick={() => setConfirmLogout(true)}
          className="mt-auto flex items-center gap-3 rounded-lg p-2 text-left hover:bg-sidebar-accent"
        >
          <div className="grid size-8 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-accent-foreground">
            {initials}
          </div>
          <div className="min-w-0 flex-1 text-sm leading-tight">
            <div className="truncate font-medium">{profile?.fullName}</div>
            <div className="text-xs text-muted-foreground">Doctor / Administrator</div>
          </div>
        </button>
      </aside>
      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side="left" className="w-72 bg-sidebar">
          <SheetHeader>
            <SheetTitle>
              <Logo />
            </SheetTitle>
            <SheetDescription>Clinic staff navigation</SheetDescription>
          </SheetHeader>
          <AdminNavigation onNavigate={() => setMenu(false)} />
          <button
            type="button"
            className="mt-8 block w-full break-words [overflow-wrap:anywhere] rounded-lg px-3 py-3 text-left text-sm hover:bg-sidebar-accent"
            onClick={() => {
              setMenu(false);
              setConfirmLogout(true);
            }}
          >
            {profile?.fullName} · Sign out
          </button>
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur md:gap-4 md:px-8">
          <button
            aria-label="Open navigation"
            onClick={() => setMenu(true)}
            className="grid size-11 shrink-0 place-items-center rounded-lg hover:bg-muted lg:hidden"
          >
            <Menu className="size-5" />
          </button>
          <Logo className="[&>span]:hidden sm:[&>span]:inline lg:hidden" />
          <div className="hidden text-sm lg:block">
            <span className="font-medium">{selected === "all" ? "All Clinics" : clinic.name}</span>
            <span className="ml-3 text-muted-foreground">{date}</span>
          </div>
          <div className="min-w-0 max-w-40">
            <ClinicSwitcher all />
          </div>
          <span
            className={cn(
              "ml-auto hidden sm:inline-flex shrink-0 items-center gap-2 rounded-full px-2 py-1 text-xs font-medium sm:px-3",
              open ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
            )}
          >
            {open ? <LiveDot /> : <span className="size-2 rounded-full bg-current" />}
            {open ? "Queue open" : "Queue closed"}
          </span>
          <GlobalSearch />
          <Notifications role="admin" />
          <button
            type="button"
            aria-label="Logout"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium hover:bg-muted"
            onClick={() => setConfirmLogout(true)}
          >
            <LogOut className="size-4" />
            <span>Logout</span>
          </button>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1240px] flex-1 px-5 py-8 md:px-8 md:py-10"
        >
          {!["/admin/queue", "/admin/live-queue", "/admin/history"].includes(pathname) ? (
            <Outlet />
          ) : (
            <QueueBoundary kind={pathname === "/admin" || pathname === "/admin/" ? "hero" : "list"}>
              {selected === "all" && ["/admin/queue", "/admin/live-queue"].includes(pathname) ? (
                <p className="surface p-6">Choose a clinic above to manage its queue.</p>
              ) : (
                <Outlet />
              )}
            </QueueBoundary>
          )}
        </main>
      </div>
      <AlertDialog open={confirmLogout} onOpenChange={setConfirmLogout}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              Any unsaved changes in an open form will be lost. You will need to sign in again to access the admin dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmLogout(false);
                void runAction(logout, "Signed out.");
              }}
            >
              Yes, Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
