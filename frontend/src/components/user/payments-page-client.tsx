"use client";

import { useEffect, useMemo, useState } from "react";
import AuthenticatedUserShell from "./authenticated-user-shell";
import { readUserSession } from "./user-session";
import { apiRequest } from "@/lib/api";

type PaymentRow = {
  id: string;
  amount?: number;
  status?: string;
  mpesaReceipt?: string;
  timestamp?: string;
  activatedAt?: string | null;
  expiresAt?: string | null;
  validationError?: string | null;
  validationWarning?: string | null;
};

type UserStatus = {
  active?: boolean;
  remainingHours?: number;
  remainingMinutes?: number;
  expiresAt?: string | null;
};

function fmtDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

function countdown(status: UserStatus | null): string {
  if (!status?.active) return "Inactive";
  return `${Math.max(0, Number(status.remainingHours ?? 0))}h ${Math.max(0, Number(status.remainingMinutes ?? 0))}m remaining`;
}

export default function PaymentsPageClient() {
  const [token, setToken] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const successful = useMemo(
    () => payments.filter((payment) => String(payment.status || "").toLowerCase() === "completed"),
    [payments]
  );
  const unsuccessful = useMemo(
    () => payments.filter((payment) => String(payment.status || "").toLowerCase() !== "completed"),
    [payments]
  );

  async function loadAll(authToken: string) {
    setLoading(true);
    try {
      const [paymentRows, currentStatus] = await Promise.all([
        apiRequest<PaymentRow[]>("/api/user/payments", { token: authToken }),
        apiRequest<UserStatus>("/api/user/status", { token: authToken })
      ]);
      setPayments(Array.isArray(paymentRows) ? paymentRows : []);
      setStatus(currentStatus || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load payment history.");
    } finally {
      setLoading(false);
    }
  }

  async function deletePayment(paymentId: string) {
    if (!token) return;
    setBusyId(paymentId);
    setError("");
    try {
      const data = await apiRequest<{ message?: string }>(`/api/user/payments/${paymentId}`, {
        method: "DELETE",
        token
      });
      await loadAll(token);
      setMessage(data?.message || "Payment deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete payment.");
    } finally {
      setBusyId("");
    }
  }

  useEffect(() => {
    const session = readUserSession();
    if (session?.token) {
      setToken(session.token);
      loadAll(session.token);
    } else {
      setLoading(false);
    }
    setSessionReady(true);
  }, []);

  useEffect(() => {
    if (!message && !error) return;
    const timeout = window.setTimeout(() => {
      setMessage("");
      setError("");
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, [message, error]);

  return (
    <AuthenticatedUserShell active="payments">
      {(message || error) && (
        <div className={`portal-toast ${error ? "is-error" : "is-success"}`}>
          {error || message}
        </div>
      )}

      <section className="portal-hero portal-hero-surface reveal-card">
        <div className="portal-hero-copy">
          <span className="pill">Payments</span>
          <h1 style={{ margin: 0, fontSize: "2.1rem", fontWeight: 800, color: "#0f172a" }}>Your payment history</h1>
          <p style={{ margin: "0.7rem 0 0.5rem", color: "#334155", fontSize: "1.04rem" }}>
            Review completed and unsuccessful payments, see activation windows, and remove payment records you no longer want to keep.
          </p>
        </div>
        <div className="portal-hero-overview">
          <article className="portal-overview-card">
            <span>Total payments</span>
            <strong>{payments.length}</strong>
          </article>
          <article className="portal-overview-card">
            <span>Successful</span>
            <strong>{successful.length}</strong>
          </article>
          <article className="portal-overview-card">
            <span>Unsuccessful</span>
            <strong>{unsuccessful.length}</strong>
          </article>
          <article className="portal-overview-card">
            <span>Activation</span>
            <strong>{countdown(status)}</strong>
          </article>
        </div>
      </section>

      {!sessionReady && (
        <section className="card portal-session-loading reveal-card">
          <span className="pill">Loading</span>
          <h2 style={{ margin: "0.65rem 0 0.35rem", color: "#0f172a" }}>Restoring your payments</h2>
          <p className="meta" style={{ margin: 0 }}>Checking your saved session before loading payment history.</p>
        </section>
      )}

      {sessionReady && !token && (
        <section className="card reveal-card">
          <p className="meta" style={{ margin: 0 }}>Login from the user page to view payment history.</p>
        </section>
      )}

      {sessionReady && token && (
        <>
          <section className="card portal-listings-card reveal-card">
            <div className="portal-filter-header">
              <div>
                <span className="pill">Successful payments</span>
                <h2 style={{ margin: "0.55rem 0 0.25rem" }}>Completed activations</h2>
              </div>
            </div>
            {loading && <p className="meta">Loading payments...</p>}
            {!loading && successful.length === 0 && <p className="meta">No successful payments yet.</p>}
            {!loading && successful.length > 0 && (
              <div className="portal-payment-grid">
                {successful.map((payment) => (
                  <article key={payment.id} className="card portal-payment-card">
                    <div className="portal-payment-head">
                      <span className="portal-status-pill is-active">Successful</span>
                      <button className="btn btn-secondary" onClick={() => deletePayment(payment.id)} disabled={busyId === payment.id}>
                        {busyId === payment.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                    <strong className="portal-payment-amount">KES {Number(payment.amount || 0).toLocaleString()}</strong>
                    <div className="portal-payment-meta">
                      <span>Receipt: {payment.mpesaReceipt || "-"}</span>
                      <span>Paid: {fmtDate(payment.timestamp)}</span>
                      <span>Activated: {fmtDate(payment.activatedAt)}</span>
                      <span>Expires: {fmtDate(payment.expiresAt)}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="card portal-listings-card reveal-card">
            <div className="portal-filter-header">
              <div>
                <span className="pill">Unsuccessful payments</span>
                <h2 style={{ margin: "0.55rem 0 0.25rem" }}>Failed or incomplete attempts</h2>
              </div>
            </div>
            {loading && <p className="meta">Loading payments...</p>}
            {!loading && unsuccessful.length === 0 && <p className="meta">No unsuccessful payments.</p>}
            {!loading && unsuccessful.length > 0 && (
              <div className="portal-payment-grid">
                {unsuccessful.map((payment) => (
                  <article key={payment.id} className="card portal-payment-card">
                    <div className="portal-payment-head">
                      <span className="portal-status-pill is-inactive">{payment.status || "Failed"}</span>
                      <button className="btn btn-secondary" onClick={() => deletePayment(payment.id)} disabled={busyId === payment.id}>
                        {busyId === payment.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                    <strong className="portal-payment-amount">KES {Number(payment.amount || 0).toLocaleString()}</strong>
                    <div className="portal-payment-meta">
                      <span>Receipt: {payment.mpesaReceipt || "-"}</span>
                      <span>Attempted: {fmtDate(payment.timestamp)}</span>
                      <span>Activation: {fmtDate(payment.activatedAt)}</span>
                      <span>Expires: {fmtDate(payment.expiresAt)}</span>
                      {payment.validationError && <span>Error: {payment.validationError}</span>}
                      {payment.validationWarning && <span>Warning: {payment.validationWarning}</span>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </AuthenticatedUserShell>
  );
}
