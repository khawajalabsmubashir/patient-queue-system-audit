import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { routeTree } from "@/routeTree.gen";
describe("App routing", () => {
  it.each([
    "/",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/complete-profile",
    "/patient/dashboard",
    "/patient/get-token",
    "/patient/history",
    "/patient/profile",
    "/admin/patient-record/patient-id",
    "/admin/visits/visit-id",
    "/admin",
    "/admin/live-queue",
    "/admin/history",
    "/admin/patients",
    "/admin/settings",
    "/admin/clinics",
    "/admin/appointments",
    "/admin/staff",
    "/admin/billing",
    "/admin/documents",
    "/admin/activity",
    "/admin/follow-ups",
    "/admin/analytics",
    "/admin/reports",
    "/admin/branding",
    "/admin/account",
    "/admin/data-management",
    "/account",
    "/staff",
    "/patient/appointments",
    "/patient/documents",
    "/patient/billing",
    "/public-display",
    "/patient/join-queue",
    "/admin/queue",
  ])("registers %s as a page rather than not found", (path) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes(path);
    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
    expect(matches.at(-1)?.pathname.replace(/\/$/, "")).toBe(path.replace(/\/$/, ""));
  });

  it.each([
    "/patient/live-queue",
    "/patient/queue",
    "/patient/prescriptions",
    "/patient/prescription/visit-id",
    "/patient/visits",
    "/patient/visit/visit-id",
  ])("does not register removed patient page %s", (path) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes(path);
    expect(matches.at(-1)?.pathname.replace(/\/$/, "")).not.toBe(path.replace(/\/$/, ""));
  });
});
