import { GlobalSearch } from "@/components/final-operations";
import { ClinicSwitcher, useClinicContext } from "@/providers/clinic-provider";
import { ProtectedRoute } from "@/components/protected-route";
import { useAuth } from "@/providers/auth-provider";
import { logout } from "@/services/auth";
import { runAction } from "@/services/queue";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { History, LayoutGrid, ListOrdered, Monitor, Settings, Users, Menu, LogOut, ShieldCheck } from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    <div className="flex min-h-screen w-full max-w-full overflow-x-clip">
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
        <header className="sticky top-0 z-20 flex h-16 w-full max-w-full items-center justify-between gap-2 border-b border-border bg-background/85 px-3 backdrop-blur sm:px-4 md:gap-4 md:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
              className="grid size-10 shrink-0 place-items-center rounded-lg hover:bg-muted sm:size-11 lg:hidden"
            >
              <Menu className="size-5" />
            </button>
            <Logo className="shrink-0 [&>span]:hidden sm:[&>span]:inline lg:hidden" />
            <div className="hidden min-w-0 shrink-0 text-sm lg:block">
              <span className="font-medium">{selected === "all" ? "All Clinics" : clinic.name}</span>
              <span className="ml-3 text-muted-foreground">{date}</span>
            </div>
            <div className="min-w-0 flex-1 max-w-[10.5rem] sm:max-w-[13rem]">
              <ClinicSwitcher all />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            <span
              className={cn(
                "hidden md:inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
                open ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
              )}
            >
              {open ? <LiveDot /> : <span className="size-2 rounded-full bg-current" />}
              {open ? "Queue open" : "Queue closed"}
            </span>
            <GlobalSearch />
            <Notifications role="admin" />
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Profile menu"
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {initials || "AD"}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-xl p-1.5">
                <DropdownMenuLabel className="px-2.5 py-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {profile?.fullName || "Administrator"}
                  </p>
                  {profile?.email && (
                    <p className="truncate text-xs font-normal text-muted-foreground">
                      {profile.email}
                    </p>
                  )}
                  <p className="mt-0.5 text-[11px] font-normal text-muted-foreground">
                    Doctor / Administrator
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
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
                  onSelect={() => setConfirmLogout(true)}
                  className="cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full min-w-0 max-w-[1240px] flex-1 px-4 py-6 sm:px-5 sm:py-8 md:px-8 md:py-10"
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
