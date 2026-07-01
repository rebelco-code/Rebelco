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
    <div className="theme-page theme-shell">
      <Navbar className="border-b border-[var(--theme-border)] bg-white/95 backdrop-blur" />

      <main className="px-4 py-10 sm:px-6 sm:py-14 lg:px-12 lg:py-18">
        <div className="mx-auto max-w-7xl">
          <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
            <div className="theme-card p-5 sm:p-8 lg:p-12">
              <p className="theme-kicker text-sm">{aboutPageContent.eyebrow}</p>
              <h1 className="theme-title mt-4 max-w-4xl text-4xl leading-[0.95] sm:text-5xl lg:text-7xl">{aboutPageContent.title}</h1>
              <p className="theme-copy mt-6 max-w-3xl text-base leading-7 sm:text-lg sm:leading-8 lg:text-xl">{aboutPageContent.intro}</p>
            </div>

            <div className="theme-card p-5 sm:p-8 lg:p-10">
              <p className="theme-kicker text-sm">The Range</p>
              <div className="mt-6 grid gap-4">
                {homeCollections.slice(0, 4).map((collection) => (
                  <div key={collection.id} className="theme-panel px-4 py-4 sm:px-5">
                    <h2 className="theme-title text-xl sm:text-2xl">{collection.title}</h2>
                    <p className="theme-copy mt-2 text-base leading-7">{collection.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-10 grid gap-5 lg:grid-cols-2">
            {aboutPageContent.story.map((paragraph) => (
              <article key={paragraph} className="theme-card p-5 sm:p-8 lg:p-9">
                <p className="theme-copy text-base leading-7 sm:text-lg sm:leading-8">{paragraph}</p>
              </article>
            ))}
          </section>

          <section className="theme-card mt-10 p-5 sm:p-8 lg:p-10">
            <p className="theme-kicker text-sm">What Defines It</p>
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              {aboutPageContent.principles.map((principle) => (
                <div key={principle.title} className="theme-panel p-6">
                  <h2 className="theme-title text-2xl sm:text-3xl">{principle.title}</h2>
                  <p className="theme-copy mt-3 text-base leading-7">{principle.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-10">
            <div className="theme-card p-5 sm:p-8 lg:p-10">
              <p className="theme-kicker text-sm">Final Thought</p>
              <h2 className="theme-title mt-4 text-3xl sm:text-4xl lg:text-5xl">{aboutPageContent.closingTitle}</h2>
              <p className="theme-copy mt-4 max-w-3xl text-base leading-7 sm:text-lg sm:leading-8">{aboutPageContent.closingBody}</p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href={contactLinks.phoneHref}
                  className="theme-button flex min-h-14 items-center justify-center rounded-full px-6 py-4 text-center text-sm uppercase tracking-[0.18em] sm:px-8"
                >
                  Call Rebelco
                </a>
                <Link
                  to="/contact"
                  className="theme-button-secondary flex min-h-14 items-center justify-center rounded-full px-6 py-4 text-center text-sm uppercase tracking-[0.18em] sm:px-8"
                >
                  Contact Page
                </Link>
              </div>
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
