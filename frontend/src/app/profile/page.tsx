import type { Metadata } from "next";
import ProfilePageClient from "@/components/user/profile-page-client";

export const metadata: Metadata = {
  title: "Profile | TST PlotConnect",
  description: "Manage your TST PlotConnect profile details, account information, and password."
};

export default function ProfilePage() {
  return <ProfilePageClient />;
}
