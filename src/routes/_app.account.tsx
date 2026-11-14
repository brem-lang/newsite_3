import { createFileRoute } from "@tanstack/react-router";
import Account from "@/pages/Account";

const title = "Your account | Mazad Atna";
const description =
  "Manage your Mazad Atna profile, contact details, address, verification status and password.";

export const Route = createFileRoute("/_app/account")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Account,
});
