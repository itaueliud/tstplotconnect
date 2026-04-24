import type { Metadata } from "next";
import DashboardPortalClient from "@/components/dashboard/portal-client";

export const metadata: Metadata = {
  title: "Admin Dashboard | AfricaRentalGrid",
  description: "Admin dashboard for listings, users, payments, and activation management.",
  alternates: { canonical: "/admin" },
  robots: { index: false, follow: false }
};

export default function AdminPage() {
  return <DashboardPortalClient mode="admin" />;
}
