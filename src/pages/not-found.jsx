import { Link } from "react-router-dom";
import Footer from "../components/footer";
import Navbar from "../components/navbar";

export default function NotFoundPage() {
  return (
    <div className="theme-page theme-shell">
      <Navbar className="border-b border-[var(--theme-border)] bg-white/95 backdrop-blur" />

      <main className="px-4 py-12 sm:px-6 sm:py-16 lg:px-12 lg:py-20">
        <div className="theme-card mx-auto max-w-4xl p-6 sm:p-10">
          <p className="theme-kicker text-sm">Page Not Found</p>
          <h1 className="theme-title mt-4 text-4xl leading-[0.95] sm:text-5xl lg:text-6xl">This page does not exist.</h1>
          <p className="theme-copy mt-5 max-w-2xl text-base leading-7 sm:text-lg sm:leading-8">
            The link might be outdated, or the address may be incorrect. Return to the homepage
            to continue browsing.
          </p>

          <Link
            to="/"
            className="theme-button mt-8 inline-block rounded-full px-6 py-3 text-sm uppercase tracking-[0.18em]"
          >
            Back To Home
          </Link>
        </div>

        <div className="mx-auto mt-14 max-w-7xl">
          <Footer />
        </div>
      </main>
    </div>
  );
}
