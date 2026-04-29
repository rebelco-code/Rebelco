import { Link } from "react-router-dom";
import Navbar from "../components/navbar";
import Footer from "../components/footer";
import {
  aboutPageContent,
  contactLinks,
  homeCollections,
} from "../data/home-content";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0f0f10] text-white">
      <Navbar className="border-b border-white/10 bg-[#0f0f10]/95 backdrop-blur" />

      <main className="px-4 py-10 sm:px-6 sm:py-14 lg:px-12 lg:py-18">
        <div className="mx-auto max-w-7xl">
          <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
            <div className="border border-white/10 bg-[#151516] p-5 sm:p-8 lg:p-12">
              <p
                className="text-sm uppercase tracking-[0.32em] text-white/55"
                style={{ fontFamily: '"Cinzel", Georgia, serif' }}
              >
                {aboutPageContent.eyebrow}
              </p>
              <h1
                className="mt-4 max-w-4xl text-4xl leading-[0.95] text-white sm:text-5xl lg:text-7xl"
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
              >
                {aboutPageContent.title}
              </h1>
              <p
                className="mt-6 max-w-3xl text-base leading-7 text-white/72 sm:text-lg sm:leading-8 lg:text-xl"
                style={{ fontFamily: '"Alegreya", Georgia, serif' }}
              >
                {aboutPageContent.intro}
              </p>
            </div>

            <div className="border border-white/10 bg-black p-5 sm:p-8 lg:p-10">
              <p
                className="text-sm uppercase tracking-[0.32em] text-white/55"
                style={{ fontFamily: '"Cinzel", Georgia, serif' }}
              >
                The Range
              </p>
              <div className="mt-6 grid gap-4">
                {homeCollections.slice(0, 4).map((collection) => (
                  <div key={collection.id} className="border border-white/10 px-4 py-4 sm:px-5">
                    <h2
                      className="text-xl text-white sm:text-2xl"
                      style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                    >
                      {collection.title}
                    </h2>
                    <p
                      className="mt-2 text-base leading-7 text-white/68"
                      style={{ fontFamily: '"Alegreya", Georgia, serif' }}
                    >
                      {collection.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-10 grid gap-5 lg:grid-cols-2">
            {aboutPageContent.story.map((paragraph) => (
              <article
                key={paragraph}
                className="border border-white/10 bg-[#151516] p-5 sm:p-8 lg:p-9"
              >
                <p
                  className="text-base leading-7 text-white/74 sm:text-lg sm:leading-8"
                  style={{ fontFamily: '"Alegreya", Georgia, serif' }}
                >
                  {paragraph}
                </p>
              </article>
            ))}
          </section>

          <section className="mt-10 border border-white/10 bg-[#151516] p-5 sm:p-8 lg:p-10">
            <p
              className="text-sm uppercase tracking-[0.3em] text-white/55"
              style={{ fontFamily: '"Cinzel", Georgia, serif' }}
            >
              What Defines It
            </p>
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              {aboutPageContent.principles.map((principle) => (
                <div key={principle.title} className="border border-white/10 bg-black p-6">
                  <h2
                  className="text-2xl text-white sm:text-3xl"
                    style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                  >
                    {principle.title}
                  </h2>
                  <p
                    className="mt-3 text-base leading-7 text-white/70"
                    style={{ fontFamily: '"Alegreya", Georgia, serif' }}
                  >
                    {principle.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="border border-white/10 bg-[#151516] p-5 sm:p-8 lg:p-10">
              <p
                className="text-sm uppercase tracking-[0.3em] text-white/55"
                style={{ fontFamily: '"Cinzel", Georgia, serif' }}
              >
                Final Thought
              </p>
              <h2
                className="mt-4 text-3xl text-white sm:text-4xl lg:text-5xl"
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
              >
                {aboutPageContent.closingTitle}
              </h2>
              <p
                className="mt-4 max-w-3xl text-base leading-7 text-white/72 sm:text-lg sm:leading-8"
                style={{ fontFamily: '"Alegreya", Georgia, serif' }}
              >
                {aboutPageContent.closingBody}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:self-stretch">
              <a
                href={contactLinks.phoneHref}
                className="border border-white/12 bg-black px-6 py-4 text-center text-white transition hover:border-white/35 hover:bg-[#1a1a1b] sm:px-8 sm:py-5"
                style={{ fontFamily: '"Cinzel", Georgia, serif' }}
              >
                Call Rebelco
              </a>
              <Link
                to="/contact"
                className="border border-white/12 bg-black px-6 py-4 text-center text-white transition hover:border-white/35 hover:bg-[#1a1a1b] sm:px-8 sm:py-5"
                style={{ fontFamily: '"Cinzel", Georgia, serif' }}
              >
                Contact Page
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
