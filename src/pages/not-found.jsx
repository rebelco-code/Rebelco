import { Link } from "react-router-dom";
import Footer from "../components/footer";
import Navbar from "../components/navbar";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#0f0f10] text-white">
      <Navbar className="border-b border-white/10 bg-[#0f0f10]/95 backdrop-blur" />

      <main className="px-4 py-12 sm:px-6 sm:py-16 lg:px-12 lg:py-20">
        <div className="mx-auto max-w-4xl border border-white/10 bg-[#151516] p-6 sm:p-10">
          <p
            className="text-sm uppercase tracking-[0.32em] text-white/55"
            style={{ fontFamily: '"Cinzel", Georgia, serif' }}
          >
            Page Not Found
          </p>
          <h1
            className="mt-4 text-4xl leading-[0.95] text-white sm:text-5xl lg:text-6xl"
            style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
          >
            This page does not exist.
          </h1>
          <p
            className="mt-5 max-w-2xl text-base leading-7 text-white/72 sm:text-lg sm:leading-8"
            style={{ fontFamily: '"Alegreya", Georgia, serif' }}
          >
            The link might be outdated, or the address may be incorrect. Return to the homepage
            to continue browsing.
          </p>

          <Link
            to="/"
            className="mt-8 inline-block border border-white/12 bg-black px-6 py-3 text-sm uppercase tracking-[0.18em] text-white transition hover:border-white/35 hover:bg-[#1a1a1b]"
            style={{ fontFamily: '"Cinzel", Georgia, serif' }}
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
