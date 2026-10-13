import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/AuthForm";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — ReynaShows" },
      { name: "description", content: "Log in to ReynaShows to like, upload and share movies." },
      { property: "og:title", content: "Log in — ReynaShows" },
      { property: "og:description", content: "Log in to ReynaShows to like, upload and share movies." },
    ],
  }),
  component: () => <AuthForm mode="login" />,
});
