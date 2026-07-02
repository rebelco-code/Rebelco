import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import Footer from "../components/footer";
import Navbar from "../components/navbar";
import { readJsonResponse } from "../lib/api";

function getPaymentHeadline(paymentStatus) {
  if (paymentStatus === "complete") {
    return "Your payment was confirmed.";
  }

  if (paymentStatus === "failed") {
    return "The payment was not confirmed.";
  }

  if (paymentStatus === "cancelled") {
    return "The payment was cancelled.";
  }

  return "Your payment is being verified.";
}

function getPaymentMessage(paymentStatus) {
  if (paymentStatus === "complete") {
    return "PayFast confirmed the payment and the order is now in the paid queue for delivery handling.";
  }

  if (paymentStatus === "failed") {
    return "PayFast did not confirm this payment. You can return to the catalogue and start checkout again.";
  }

  if (paymentStatus === "cancelled") {
    return "The checkout was cancelled before payment completed. No delivery will be organized unless a new payment is completed.";
  }

  return "The browser redirect completed, but the final PayFast confirmation still happens on the secure server-to-server ITN callback.";
}

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get("pf_payment_id") || "";
  const orderReference = searchParams.get("m_payment_id") || "";
  const [status, setStatus] = useState(orderReference ? "loading" : "idle");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [customerOrderId, setCustomerOrderId] = useState("");
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    if (!orderReference) {
      return;
    }

    let isMounted = true;
    let timeoutId = 0;

    async function loadStatus() {
      try {
        const response = await fetch(
          `/api/payfast/status?orderGroupId=${encodeURIComponent(orderReference)}`,
          {
            headers: {
              Accept: "application/json",
            },
          },
        );
        const data = await readJsonResponse(response, "Could not load payment status.");

        if (!isMounted) {
          return;
        }

        setPaymentStatus(String(data.paymentStatus || "").trim().toLowerCase());
        setPaymentReference(String(data.paymentReference || "").trim());
        setCustomerOrderId(String(data.customerOrderId || "").trim());
        setStatus("ready");

        const nextStatus = String(data.paymentStatus || "").trim().toLowerCase();

        if (nextStatus && !["complete", "failed", "cancelled"].includes(nextStatus)) {
          timeoutId = window.setTimeout(loadStatus, 3000);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setStatusError(error.message);
        setStatus("error");
      }
    }

    loadStatus();

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [orderReference]);

  return (
    <div className="theme-page theme-shell">
      <Navbar className="border-b border-[var(--theme-border)] bg-white/95 backdrop-blur" />

      <main className="px-4 py-10 sm:px-6 sm:py-14 lg:px-12 lg:py-18">
        <div className="mx-auto max-w-4xl">
          <section className="theme-card p-6 sm:p-8">
            <p className="theme-kicker text-sm">Payment Received</p>
            <h1 className="theme-title mt-4 text-4xl leading-[0.95] sm:text-5xl">{getPaymentHeadline(paymentStatus)}</h1>
            <p
              className="theme-copy mt-5 max-w-2xl text-base leading-7"
              style={{ fontFamily: '"Manrope", sans-serif' }}
            >
              {getPaymentMessage(paymentStatus)}
            </p>

            {status === "loading" ? (
              <div className="mt-6 rounded-2xl border border-[var(--theme-border)] bg-white/80 p-4 text-sm text-[var(--theme-text)]">
                Checking PayFast payment status...
              </div>
            ) : null}

            {status === "error" ? (
              <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-950/20 p-4 text-sm text-red-100">
                {statusError || "Could not load payment status."}
              </div>
            ) : null}

            {orderReference || paymentId ? (
              <div className="mt-6 rounded-2xl border border-[var(--theme-border)] bg-white/80 p-4 text-sm text-[var(--theme-text)]">
                {orderReference ? <div>Order reference: {orderReference}</div> : null}
                {customerOrderId ? <div>Customer order ID: {customerOrderId}</div> : null}
                {paymentId || paymentReference ? (
                  <div>PayFast payment ID: {paymentReference || paymentId}</div>
                ) : null}
                {paymentStatus ? <div>Payment status: {paymentStatus}</div> : null}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              {customerOrderId ? (
                <Link
                  to={`/orders?order=${encodeURIComponent(customerOrderId)}`}
                  className="theme-button rounded-full px-5 py-3 text-xs uppercase tracking-[0.2em]"
                >
                  Track This Order
                </Link>
              ) : null}
              <Link
                to="/products"
                className="theme-button-secondary rounded-full px-5 py-3 text-xs uppercase tracking-[0.2em]"
              >
                Back To Products
              </Link>
              <Link
                to="/contact"
                className="theme-button-secondary rounded-full px-5 py-3 text-xs uppercase tracking-[0.2em]"
              >
                Contact Rebelco
              </Link>
            </div>
          </section>

          <div className="mt-14">
            <Footer />
          </div>
        </div>
      </main>
    </div>
  );
}
