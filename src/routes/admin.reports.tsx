import { createFileRoute } from "@tanstack/react-router";
import { OperationalAnalytics } from "@/components/final-operations";

export const Route = createFileRoute("/admin/reports")({
  component: () => <OperationalAnalytics reports />,
});
