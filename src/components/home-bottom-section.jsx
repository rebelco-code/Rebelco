import Footer from "./footer";
import { Link } from "react-router-dom";
import {
  contactActions,
  homeCollections,
  homeIntro,
} from "../data/home-content";

export default function HomeBottomSection() {
  return (
    <section className="relative bg-[#0f0f10] px-4 py-14 text-[#f3f3f3] sm:px-6 sm:py-16 lg:px-12 lg:py-20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#0f0f10]/0 via-[#0f0f10]/78 to-[#0f0f10] sm:h-20 lg:h-24" />
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 pt-6 sm:pt-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14 lg:pt-10">
          <div>
            <p
              className="text-sm uppercase tracking-[0.32em] text-white/55"
              style={{ fontFamily: '"Cinzel", Georgia, serif' }}
            >
              {homeIntro.eyebrow}
            </p>
            <h2
              className="mt-4 max-w-3xl text-3xl leading-[0.98] sm:text-5xl lg:text-6xl"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              {homeIntro.title}
            </h2>
            <p
              className="mt-5 max-w-3xl text-base leading-7 text-white/72 sm:text-lg sm:leading-8"
              style={{ fontFamily: '"Alegreya", Georgia, serif' }}
            >
              {homeIntro.body}
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <Link
                to="/products-company-2"
                className="group overflow-hidden border border-[#d4b483]/45 bg-[linear-gradient(135deg,#25190d_0%,#141416_55%,#101011_100%)] px-6 py-6 transition hover:border-[#e8c89c]/70 sm:col-span-2 sm:px-7 sm:py-7"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div
                      className="inline-flex border border-[#d4b483]/55 bg-black/35 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-[#f3dfbd]"
                      style={{ fontFamily: '"Cinzel", Georgia, serif' }}
                    >
                      Featured Catalogue
                    </div>
                    <div
                      className="mt-3 text-xs uppercase tracking-[0.24em] text-[#dbc7a7]"
                      style={{ fontFamily: '"Cinzel", Georgia, serif' }}
                    >
                      Rebelco x PET
                    </div>
                    <div
                      className="mt-2 text-3xl leading-none text-white sm:text-4xl"
                      style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                    >
                      PET Products
                    </div>
                  </div>
                  <span
                    className="inline-flex h-10 items-center border border-[#d4b483]/55 bg-black px-4 text-xs uppercase tracking-[0.22em] text-[#f3dfbd] transition group-hover:border-[#e8c89c] group-hover:text-white"
                    style={{ fontFamily: '"Cinzel", Georgia, serif' }}
                  >
                    Open PET Page
                  </span>
                </div>
                <p
                  className="mt-4 max-w-3xl text-base leading-7 text-white/82"
                  style={{ fontFamily: '"Alegreya", Georgia, serif' }}
                >
                  Give this section priority: treats, beef hooves, bones, and chew-focused stock all live here.
                </p>
              </Link>

              <Link
                to="/products"
                className="border border-white/12 bg-[#171718] px-5 py-4 transition hover:border-white/40 hover:bg-[#1c1c1d]"
              >
                <div
                  className="text-xs uppercase tracking-[0.24em] text-white/55"
                  style={{ fontFamily: '"Cinzel", Georgia, serif' }}
                >
                  Rebelco
                </div>
                <div
                  className="mt-2 text-xl text-white"
                  style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                >
                  Standard Products
                </div>
                <p
                  className="mt-2 text-sm leading-6 text-white/70"
                  style={{ fontFamily: '"Alegreya", Georgia, serif' }}
                >
                  Soaps, creams, and the main Rebelco catalogue.
                </p>
              </Link>

              <div className="border border-white/10 bg-[#121214] px-5 py-4">
                <div
                  className="text-xs uppercase tracking-[0.24em] text-white/45"
                  style={{ fontFamily: '"Cinzel", Georgia, serif' }}
                >
                  Navigation Tip
                </div>
                <p
                  className="mt-2 text-sm leading-6 text-white/70"
                  style={{ fontFamily: '"Alegreya", Georgia, serif' }}
                >
                  If you are shopping for PET items, use the featured PET Products block first.
                </p>
              </div>
            </div>
          </div>

          <div className="border border-white/12 bg-[#171718] p-5 sm:p-8">
            <p
              className="text-sm uppercase tracking-[0.3em] text-white/55"
              style={{ fontFamily: '"Cinzel", Georgia, serif' }}
            >
              Quick Contact
            </p>
            <h3
              className="mt-3 text-2xl text-white sm:text-4xl"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              Catalogue browsing should feel simple.
            </h3>
            <p
              className="mt-4 text-base leading-7 text-white/72 sm:text-lg sm:leading-8"
              style={{ fontFamily: '"Alegreya", Georgia, serif' }}
            >
              Use WhatsApp for quick catalogue access, call for direct help, or
              email when you need a more detailed order or custom request.
            </p>

            <div className="mt-6 grid gap-3">
              {contactActions.map((action) => (
                <a
                  key={action.label}
                  href={action.href}
                  className="border border-white/12 bg-[#101011] px-5 py-4 transition hover:border-white/40 hover:bg-[#181819]"
                >
                  <div
                    className="text-sm uppercase tracking-[0.2em] text-white"
                    style={{ fontFamily: '"Cinzel", Georgia, serif' }}
                  >
                    {action.label}
                  </div>
                  <div
                    className="mt-2 text-base leading-7 text-white/68"
                    style={{ fontFamily: '"Alegreya", Georgia, serif' }}
                  >
                    {action.description}
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {homeCollections.map((collection) => (
            <article
              key={collection.id}
              className="border border-white/12 bg-[#171718] p-5 sm:p-6"
            >
              <p
                className="text-xs uppercase tracking-[0.28em] text-white/55"
                style={{ fontFamily: '"Cinzel", Georgia, serif' }}
              >
                {collection.subtitle}
              </p>
              <h3
                className="mt-3 text-2xl leading-none text-white sm:text-3xl"
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
              >
                {collection.title}
              </h3>
              <p
                className="mt-4 text-base leading-7 text-white/72"
                style={{ fontFamily: '"Alegreya", Georgia, serif' }}
              >
                {collection.description}
              </p>

              <ul
                className="mt-5 space-y-3 text-base leading-7 text-white/82"
                style={{ fontFamily: '"Alegreya", Georgia, serif' }}
              >
                {collection.highlights.map((highlight) => (
                  <li key={highlight} className="border-t border-white/10 pt-3">
                    {highlight}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mt-14">
          <Footer />
        </div>
      </div>
    </section>
  );
}
