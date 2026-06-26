import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/area")({
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
});
