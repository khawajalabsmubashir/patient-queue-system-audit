import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AccountSettings } from "@/components/final-operations";
import { useAuth } from "@/providers/auth-provider";
import { ProtectedRoute } from "@/components/protected-route";
import { Logo } from "@/components/qc";

export const Route = createFileRoute("/account")({
  component: () => {
    const { profile } = useAuth();
    const backTo =
      profile?.role === "admin"
        ? "/admin"
        : profile?.role === "receptionist" || profile?.role === "nurse"
          ? "/staff"
          : "/patient/dashboard";
    return (
      <ProtectedRoute role={profile?.role ?? "patient"}>
        <div className="min-h-screen bg-background">
          <header className="border-b border-border bg-background/90 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-5">
              <Link to={backTo}>
                <Logo />
              </Link>
              <Link
                to={backTo}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                <ArrowLeft className="size-4" />
                Back to dashboard
              </Link>
            </div>
          </header>
          <main className="mx-auto max-w-3xl px-5 py-8">
            <AccountSettings />
          </main>
        </div>
      </ProtectedRoute>
    );
  },
});
