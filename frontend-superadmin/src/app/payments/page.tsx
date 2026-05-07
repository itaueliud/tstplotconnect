import type { Metadata } from "next";
import PaymentsPageClient from "@/components/user/payments-page-client";

export const metadata: Metadata = {
  title: "Payments | TST PlotConnect",
  description: "Review successful and unsuccessful TST PlotConnect payments, activations, and payment history."
};

export default function PaymentsPage() {
  return <PaymentsPageClient />;
}
