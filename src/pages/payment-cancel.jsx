import { Link, useSearchParams } from "react-router-dom";

import Footer from "../components/footer";
import Navbar from "../components/navbar";

export default function PaymentCancelPage() {
  const [searchParams] = useSearchParams();
  const orderReference = searchParams.get("m_payment_id") || "";

  return (
    <div className="theme-page theme-shell">
      <Navbar className="border-b border-[var(--theme-border)] bg-white/95 backdrop-blur" />

      <main className="px-4 py-10 sm:px-6 sm:py-14 lg:px-12 lg:py-18">
        <div className="mx-auto max-w-4xl">
          <section className="theme-card p-6 sm:p-8">
            <p className="theme-kicker text-sm">Payment Cancelled</p>
            <h1 className="theme-title mt-4 text-4xl leading-[0.95] sm:text-5xl">
              The PayFast checkout was cancelled before payment completed.
            </h1>
            <p
              className="theme-copy mt-5 max-w-2xl text-base leading-7"
              style={{ fontFamily: '"Manrope", sans-serif' }}
            >
              No payment was confirmed. You can return to the catalogue and start checkout again
              when you&apos;re ready.
            </p>

            {orderReference ? (
              <div className="mt-6 rounded-2xl border border-[var(--theme-border)] bg-white/80 p-4 text-sm text-[var(--theme-text)]">
                Order reference: {orderReference}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/products"
                className="theme-button rounded-full px-5 py-3 text-xs uppercase tracking-[0.2em]"
              >
                Try Checkout Again
              </Link>
              <Link
                to="/contact"
                className="theme-button-secondary rounded-full px-5 py-3 text-xs uppercase tracking-[0.2em]"
              >
                Need Help?
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
