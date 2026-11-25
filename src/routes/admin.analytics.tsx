import { createFileRoute } from "@tanstack/react-router";
import { OperationalAnalytics } from "@/components/final-operations";

export const Route = createFileRoute("/admin/analytics")({
  component: () => <OperationalAnalytics />,
});
