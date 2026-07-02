import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import Footer from "../components/footer";
import Navbar from "../components/navbar";
import { readJsonResponse } from "../lib/api";
import { formatPrice } from "../lib/formatters";

function formatDateTime(value) {
  const timestamp = Date.parse(String(value || ""));

  if (!Number.isFinite(timestamp)) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function formatStatusLabel(value, fallback = "Pending") {
  const normalizedValue = String(value || "").trim().toLowerCase();

  if (!normalizedValue) {
    return fallback;
  }

  return normalizedValue.charAt(0).toUpperCase() + normalizedValue.slice(1);
}

function getStatusClasses(value) {
  const normalizedValue = String(value || "").trim().toLowerCase();

  if (normalizedValue === "complete" || normalizedValue === "delivered" || normalizedValue === "ready") {
    return "border-emerald-300/35 bg-emerald-950/15 text-emerald-100";
  }

  if (normalizedValue === "failed" || normalizedValue === "cancelled") {
    return "border-red-300/35 bg-red-950/15 text-red-100";
  }

  return "border-[var(--theme-border)] bg-white/80 text-[var(--theme-text)]";
}

const initialLookupForm = {
  customerOrderId: "",
  customerEmail: "",
};

export default function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [lookupForm, setLookupForm] = useState(() => ({
    customerOrderId: searchParams.get("order") || searchParams.get("customerOrderId") || "",
    customerEmail: searchParams.get("email") || searchParams.get("customerEmail") || "",
  }));
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function loadOrders(nextLookupForm) {
    const customerOrderId = String(nextLookupForm.customerOrderId || "").trim();
    const customerEmail = String(nextLookupForm.customerEmail || "").trim();

    if (!customerEmail) {
      setError("Enter the same email used at checkout.");
      setResult(null);
      return;
    }

    const queryParams = new URLSearchParams({
      customerEmail,
    });

    if (customerOrderId) {
      queryParams.set("customerOrderId", customerOrderId);
    }

    setStatus("loading");
    setError("");

    try {
      const response = await fetch(`/api/customer-orders?${queryParams.toString()}`, {
        headers: {
          Accept: "application/json",
        },
      });
      const data = await readJsonResponse(response, "Could not load your orders.");

      setResult(data);
      setStatus("ready");
      setSearchParams(queryParams);
    } catch (loadError) {
      setResult(null);
      setStatus("error");
      setError(loadError.message);
    }
  }

  function updateLookupField(event) {
    const { name, value } = event.target;

    setLookupForm((currentLookupForm) => ({
      ...currentLookupForm,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await loadOrders(lookupForm);
  }

  const isHistoryMode = result?.mode === "history";
  const summary = result?.mode === "single" ? result : null;
  const orderHistory = Array.isArray(result?.orders) ? result.orders : [];
  const orderLines = Array.isArray(summary?.orders) ? summary.orders : [];

  return (
    <div className="theme-page theme-shell">
      <Navbar className="border-b border-[var(--theme-border)] bg-white/95 backdrop-blur" />

      <main className="px-4 py-10 sm:px-6 sm:py-14 lg:px-12 lg:py-18">
        <div className="mx-auto max-w-6xl">
          <section className="theme-card p-6 sm:p-8">
            <p className="theme-kicker text-sm">Order Tracking</p>
            <h1 className="theme-title mt-4 text-4xl leading-[0.95] sm:text-5xl">
              View previous orders, totals, and tracking.
            </h1>
            <p
              className="theme-copy mt-5 max-w-3xl text-base leading-7"
              style={{ fontFamily: '"Manrope", sans-serif' }}
            >
              Enter the same email used at checkout to see all previous orders linked to that email.
              Add a customer order ID as well if you want to open one specific order directly.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 grid gap-4 sm:grid-cols-2">
              <label className="theme-copy grid gap-2 text-sm">
                <span className="theme-kicker text-xs opacity-80">Customer Order ID (Optional)</span>
                <input
                  type="text"
                  name="customerOrderId"
                  value={lookupForm.customerOrderId}
                  onChange={updateLookupField}
                  placeholder="RBL-XXXX-XXXX"
                  className="theme-input px-4 py-3 transition"
                />
              </label>

              <label className="theme-copy grid gap-2 text-sm">
                <span className="theme-kicker text-xs opacity-80">Customer Email</span>
                <input
                  type="email"
                  name="customerEmail"
                  value={lookupForm.customerEmail}
                  onChange={updateLookupField}
                  placeholder="name@example.com"
                  required
                  className="theme-input px-4 py-3 transition"
                />
              </label>

              <div className="sm:col-span-2 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="theme-button rounded-full px-5 py-3 text-xs uppercase tracking-[0.2em] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {status === "loading" ? "Loading..." : "Find My Orders"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLookupForm(initialLookupForm);
                    setResult(null);
                    setError("");
                    setStatus("idle");
                    setSearchParams(new URLSearchParams());
                  }}
                  className="theme-button-secondary rounded-full px-5 py-3 text-xs uppercase tracking-[0.2em]"
                >
                  Clear
                </button>
              </div>
            </form>

            {error ? (
              <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-950/20 p-4 text-sm text-red-100">
                {error}
              </div>
            ) : null}
          </section>

          {isHistoryMode ? (
            <section className="theme-card mt-8 p-6 sm:p-8">
              <div className="border-b border-[var(--theme-border)] pb-6">
                <p className="theme-kicker text-xs opacity-80">Order History</p>
                <h2 className="theme-title mt-2 text-3xl leading-none sm:text-4xl">
                  {result.customerEmail}
                </h2>
                <p
                  className="theme-copy mt-3 text-sm leading-6"
                  style={{ fontFamily: '"Manrope", sans-serif' }}
                >
                  {result.orderCount} order group{result.orderCount === 1 ? "" : "s"} found for this
                  email.
                </p>
              </div>

              <div className="mt-6 grid gap-4">
                {orderHistory.map((orderSummary) => (
                  <article key={orderSummary.orderGroupId} className="theme-panel p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="theme-kicker text-[10px] opacity-80">Customer Order ID</div>
                        <h3 className="theme-title mt-2 text-2xl leading-none">
                          {orderSummary.customerOrderId || "Order"}
                        </h3>
                        <div className="mt-3 text-sm text-[var(--theme-text)]">
                          Placed{" "}
                          {orderSummary.orders?.[0]?.createdAt
                            ? formatDateTime(orderSummary.orders[0].createdAt)
                            : "Unknown"}
                        </div>
                      </div>

                      <div className="grid gap-2 text-sm text-[var(--theme-text)]">
                        <div
                          className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em] ${getStatusClasses(orderSummary.paymentStatus)}`}
                        >
                          Payment: {formatStatusLabel(orderSummary.paymentStatus)}
                        </div>
                        <div
                          className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em] ${getStatusClasses(orderSummary.shipmentStatus)}`}
                        >
                          Tracking: {formatStatusLabel(orderSummary.shipmentStatus, "Not created")}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-4">
                      <div className="border border-[var(--theme-border)] bg-white/80 p-3 text-sm text-[var(--theme-text)]">
                        <div className="theme-kicker text-[10px] opacity-80">Items</div>
                        <div className="mt-2">{orderSummary.orderCount || 0}</div>
                      </div>
                      <div className="border border-[var(--theme-border)] bg-white/80 p-3 text-sm text-[var(--theme-text)]">
                        <div className="theme-kicker text-[10px] opacity-80">Quantity</div>
                        <div className="mt-2">{orderSummary.totalQuantity || 0}</div>
                      </div>
                      <div className="border border-[var(--theme-border)] bg-white/80 p-3 text-sm text-[var(--theme-text)]">
                        <div className="theme-kicker text-[10px] opacity-80">Total</div>
                        <div className="mt-2">{formatPrice(orderSummary.totalAmount || 0)}</div>
                      </div>
                      <div className="border border-[var(--theme-border)] bg-white/80 p-3 text-sm text-[var(--theme-text)]">
                        <div className="theme-kicker text-[10px] opacity-80">Tracking No</div>
                        <div className="mt-2 break-words">{orderSummary.trackingNumber || "Pending"}</div>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const nextLookupForm = {
                            customerOrderId: orderSummary.customerOrderId || "",
                            customerEmail: result.customerEmail || "",
                          };
                          setLookupForm(nextLookupForm);
                          void loadOrders(nextLookupForm);
                        }}
                        className="theme-button rounded-full px-5 py-3 text-xs uppercase tracking-[0.2em]"
                      >
                        Open This Order
                      </button>

                      {orderSummary.trackingUrl ? (
                        <a
                          href={orderSummary.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="theme-button-secondary rounded-full px-5 py-3 text-xs uppercase tracking-[0.2em]"
                        >
                          Open Tracking
                        </a>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {summary ? (
            <section className="theme-card mt-8 p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--theme-border)] pb-6">
                <div>
                  <p className="theme-kicker text-xs opacity-80">Customer Order</p>
                  <h2 className="theme-title mt-2 text-3xl leading-none sm:text-4xl">
                    {summary.customerOrderId || "Order found"}
                  </h2>
                  <p
                    className="theme-copy mt-3 text-sm leading-6"
                    style={{ fontFamily: '"Manrope", sans-serif' }}
                  >
                    Placed {orderLines[0]?.createdAt ? formatDateTime(orderLines[0].createdAt) : "Unknown"}.
                  </p>
                </div>

                <div className="grid gap-2 text-sm text-[var(--theme-text)]">
                  <div
                    className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em] ${getStatusClasses(summary.paymentStatus)}`}
                  >
                    Payment: {formatStatusLabel(summary.paymentStatus)}
                  </div>
                  <div
                    className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em] ${getStatusClasses(summary.shipmentStatus)}`}
                  >
                    Tracking: {formatStatusLabel(summary.shipmentStatus, "Not created")}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-4">
                <div className="theme-panel p-4">
                  <div className="theme-kicker text-[10px] opacity-80">Items</div>
                  <div className="mt-2 text-3xl text-[var(--theme-text)]">{summary.orderCount || 0}</div>
                </div>
                <div className="theme-panel p-4">
                  <div className="theme-kicker text-[10px] opacity-80">Total Quantity</div>
                  <div className="mt-2 text-3xl text-[var(--theme-text)]">{summary.totalQuantity || 0}</div>
                </div>
                <div className="theme-panel p-4">
                  <div className="theme-kicker text-[10px] opacity-80">Order Total</div>
                  <div className="mt-2 text-3xl text-[var(--theme-text)]">{formatPrice(summary.totalAmount || 0)}</div>
                </div>
                <div className="theme-panel p-4">
                  <div className="theme-kicker text-[10px] opacity-80">PayFast Ref</div>
                  <div className="mt-2 break-words text-sm text-[var(--theme-text)]">
                    {summary.paymentReference || "Pending"}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <div className="theme-panel p-4">
                  <div className="theme-kicker text-xs opacity-80">Ordered Items</div>
                  <div className="mt-4 grid gap-4">
                    {orderLines.map((order) => {
                      const lineTotal = Number(order.productPrice || 0) * Number(order.quantity || 0);

                      return (
                        <article key={order.id} className="border border-[var(--theme-border)] bg-white/80 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="theme-title text-2xl leading-none">{order.productTitle}</h3>
                              <div
                                className="theme-copy mt-2 text-xs uppercase tracking-[0.16em]"
                                style={{ fontFamily: '"Manrope", sans-serif' }}
                              >
                                {order.productCategory || "Uncategorised"}
                                {order.productWeight ? ` · ${order.productWeight}` : ""}
                              </div>
                            </div>
                            <div className="text-right text-sm text-[var(--theme-text)]">
                              <div>{formatPrice(order.productPrice)}</div>
                              <div className="mt-1 text-xs text-[var(--theme-text-soft)]">x {order.quantity}</div>
                              <div className="mt-2 font-semibold">{formatPrice(lineTotal)}</div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="theme-panel p-4">
                    <div className="theme-kicker text-xs opacity-80">Tracking</div>
                    <div className="mt-3 text-sm leading-6 text-[var(--theme-text)]">
                      <div>Status: {summary.shipmentStatus || "Not created yet"}</div>
                      <div>Shipment ID: {summary.shipmentId || "Pending"}</div>
                      <div>Parcel Ref: {summary.parcelReference || "Pending"}</div>
                      <div>Tracking No: {summary.trackingNumber || "Pending"}</div>
                    </div>

                    {summary.trackingUrl ? (
                      <a
                        href={summary.trackingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="theme-button mt-4 inline-flex rounded-full px-4 py-3 text-xs uppercase tracking-[0.2em]"
                      >
                        Open Tracking
                      </a>
                    ) : null}
                  </div>

                  <div className="theme-panel p-4">
                    <div className="theme-kicker text-xs opacity-80">Delivery</div>
                    <div className="mt-3 text-sm leading-6 text-[var(--theme-text)]">
                      <div>
                        Locker: {orderLines[0]?.pudoLockerName || orderLines[0]?.pudoLockerCode || "Not selected"}
                      </div>
                      <div className="mt-1">{orderLines[0]?.pudoLockerAddress || "No locker address saved."}</div>
                      <div className="mt-3">
                        {summary.deliveryOrganized
                          ? "Delivery has been marked ready for handling."
                          : "Delivery will only be organized after payment is confirmed."}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const nextLookupForm = {
                      customerOrderId: "",
                      customerEmail: lookupForm.customerEmail,
                    };
                    setLookupForm(nextLookupForm);
                    void loadOrders(nextLookupForm);
                  }}
                  className="theme-button-secondary rounded-full px-5 py-3 text-xs uppercase tracking-[0.2em]"
                >
                  View All Orders For This Email
                </button>
                <Link
                  to="/products"
                  className="theme-button rounded-full px-5 py-3 text-xs uppercase tracking-[0.2em]"
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
          ) : null}

          <div className="mt-14">
            <Footer />
          </div>
        </div>
      </main>
    </div>
  );
}
