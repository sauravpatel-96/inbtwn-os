import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "INBTWN OS — Catering operations" },
      { name: "description", content: "The operating system for a professional catering business: enquiries, events, clients and more." },
      { property: "og:title", content: "INBTWN OS — Catering operations" },
      { property: "og:description", content: "Enquiries, events and clients for professional caterers." },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/today" });
  },
  component: () => null,
});
