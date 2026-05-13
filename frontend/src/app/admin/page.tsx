import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Superadmin Dashboard | tstplotconnect",
  description: "Superadmin dashboard for platform-wide administration and location metadata control.",
  alternates: { canonical: "/superadmin" },
  robots: { index: false, follow: false }
};

export default function AdminPage() {
  redirect("/superadmin");
}
