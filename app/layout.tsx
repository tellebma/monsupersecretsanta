import type { Metadata } from "next";
import type { ReactNode } from "react";
import { UsageAnalytics } from "./analytics";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Mon Super Secret Santa", template: "%s · Mon Super Secret Santa" },
  description: "Organisez vos Secret Santa et partagez une seule liste de cadeaux entre tous vos groupes.",
  referrer: "strict-origin",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="fr"><body>{children}{process.env.VERCEL_ENV === "production" && <UsageAnalytics />}</body></html>;
}
