import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/AuthForm";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — ReynaShows" },
      { name: "description", content: "Create a free ReynaShows account and start sharing your movies." },
      { property: "og:title", content: "Sign up — ReynaShows" },
      { property: "og:description", content: "Create a free ReynaShows account and start sharing your movies." },
    ],
  }),
  component: () => <AuthForm mode="signup" />,
});
