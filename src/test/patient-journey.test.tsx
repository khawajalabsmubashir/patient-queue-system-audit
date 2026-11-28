vi.mock("@/api/client", () => ({
  api: vi.fn(async (path: string) =>
    path === "/patient/summary"
      ? {
          appointment: null,
          visit: null,
          prescription: null,
          document: null,
          bills: { balance: 0 },
          followups: [],
          notifications: [],
        }
      : [],
  ),
}));
vi.mock("@/components/protected-route", () => ({
  ProtectedRoute: ({ children }: { children: import("react").ReactNode }) => children,
}));
vi.mock("@/services/auth", () => ({
  login: vi.fn(async (email: string) => ({
    role: email.startsWith("reception") ? "admin" : "patient",
  })),
  logout: vi.fn(async () => {}),
  resetPassword: vi.fn(async () => {}),
}));
import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { actions } from "@/test/fixtures/queue-store";
import { Route as LoginRoute } from "@/routes/login";
import { Route as PatientRoute } from "@/routes/patient";
import { Route as DashboardRoute } from "@/routes/patient.dashboard";
import { Join } from "@/routes/patient.join-queue";
import { Route as HistoryRoute } from "@/routes/patient.history";

beforeEach(() => {
  cleanup();
  actions.resetDemo();
});
afterEach(cleanup);
function renderPatientApp() {
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()({ component: Outlet });
  const login = createRoute({
    getParentRoute: () => root,
    path: "login",
    component: LoginRoute.options.component!,
  });
  const patient = createRoute({
    getParentRoute: () => root,
    path: "patient",
    component: PatientRoute.options.component!,
  });
  const dashboard = createRoute({
    getParentRoute: () => patient,
    path: "dashboard",
    component: DashboardRoute.options.component!,
  });
  const join = createRoute({ getParentRoute: () => patient, path: "get-token", component: Join });
    const history = createRoute({
    getParentRoute: () => patient,
    path: "history",
    component: HistoryRoute.options.component!,
  });
  const router = createRouter({
    routeTree: root.addChildren([login, patient.addChildren([dashboard, join, history])]),
    history: createMemoryHistory({ initialEntries: ["/login"] }),
    context: { queryClient: new QueryClient() },
  });
  render(<RouterProvider router={router} />);
  return router;
}
it("preserves login, anonymous appointment-token tracking, completion and history", async () => {
  const router = renderPatientApp();
  await screen.findByRole("heading", { name: "Welcome back" });
  fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
    target: { value: "zain@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "TestPassword123!" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await screen.findByRole("heading", { name: "Welcome, Zain" });
  expect(screen.getAllByText("~20 min").length).toBeGreaterThanOrEqual(1);
  expect(screen.queryByText("Sara Ali")).not.toBeInTheDocument();
  expect(screen.queryByText("Ahmed Khan")).not.toBeInTheDocument();
  act(() => actions.demo("almost"));
  expect(await screen.findByText(/2 patients ahead in queue/i)).toBeVisible();
  act(() => actions.call("A-024"));
  expect(await screen.findByText(/Your turn now/i)).toBeVisible();
  act(() => actions.markDone());
  expect(await screen.findByText("Visit completed.")).toBeVisible();
  await act(async () => {
    await router.navigate({ to: "/patient/history" });
  });
  await screen.findByRole("heading", { name: "Visit history" });
  expect(screen.getByText("Oct 5, 2026")).toBeInTheDocument();
  expect(screen.getByText("A-024")).toBeInTheDocument();
  await waitFor(() => expect(router.state.location.pathname).toBe("/patient/history"));
}, 15000);
it.each(["no-queue", "completed"] as const)(
  "dashboard preserves the original %s token state",
  async (scenario) => {
    actions.demo(scenario);
    const router = renderPatientApp();
    await act(async () => {
      await router.navigate({ to: "/patient/dashboard" });
    });
    await screen.findByRole("heading", { name: "Welcome, Zain" });
    expect(screen.queryByRole("button", { name: /Get.*token/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Get.*token/ })).toBeNull();
    if (scenario === "no-queue")
      expect(await screen.findByText(/No upcoming appointment token yet/i)).toBeInTheDocument();
    else expect(screen.getByText("Visit completed.")).toBeInTheDocument();
  },
);
