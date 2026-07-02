import { Link } from "react-router-dom";
import { homeHero } from "../data/home-content";
import heroImage from "../assets/wallpaper/home/gallery/ChatGPT Image Apr 1, 2026, 02_40_47 PM.webp";

export default function Gallery() {
  return (
    <section className="bg-white px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden bg-[#f5f2eb]">
          <div className="aspect-[16/7] min-h-[360px] w-full bg-[#f5f2eb]">
            <img
              src={heroImage}
              alt="Rebelco hero"
              className="h-full w-full object-cover"
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

          <div className="absolute inset-x-0 bottom-0">
            <div className="mx-auto max-w-3xl px-4 pb-6 sm:px-6 sm:pb-8 lg:px-10 lg:pb-10">
              <div className="bg-[rgba(24,24,24,0.86)] px-6 py-6 text-center text-white sm:px-8 sm:py-8">
                <h1
                  className="text-3xl leading-tight sm:text-4xl lg:text-5xl"
                  style={{ fontFamily: '"Outfit", "Manrope", sans-serif', fontWeight: 300, letterSpacing: "-0.03em" }}
                >
                  {homeHero.title}
                </h1>

                <div className="mt-5">
                  <Link
                    to={homeHero.ctaHref}
                    className="inline-flex border border-white bg-black px-6 py-3 text-sm font-semibold uppercase leading-none tracking-[0.16em] text-white transition hover:bg-white hover:text-black"
                  >
                    {homeHero.ctaLabel}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
