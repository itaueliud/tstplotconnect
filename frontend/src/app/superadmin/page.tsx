import type { Metadata } from "next";
import DashboardPortalClient from "@/components/dashboard/portal-client";

export const metadata: Metadata = {
  title: "Superadmin Dashboard | AfricaRentalGrid",
  description: "Superadmin dashboard for platform-wide administration and location metadata control.",
  alternates: { canonical: "/superadmin" },
  robots: { index: false, follow: false }
};

export default function SuperAdminPage() {
  return <DashboardPortalClient mode="superadmin" />;
}
