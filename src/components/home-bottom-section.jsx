import Footer from "./footer";
import {
  contactLinks,
  homeCollections,
  homeIntro,
} from "../data/home-content";

const contactActions = [
  {
    label: "WhatsApp Catalogue",
    description: "Browse the catalogue or start a product enquiry on WhatsApp.",
    href: contactLinks.whatsappCatalogueHref,
  },
  {
    label: "Facebook",
    description: "See updates, posts, and community-facing Rebelco activity.",
    href: contactLinks.facebookHref,
  },
  {
    label: "Email",
    description: contactLinks.email,
    href: contactLinks.emailHref,
  },
  {
    label: "Call",
    description: contactLinks.phoneDisplay,
    href: contactLinks.phoneHref,
  },
];

export default function HomeBottomSection() {
  return (
    <section className="bg-[#0f0f10] px-5 py-16 text-[#f3f3f3] sm:px-8 lg:px-12 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <div>
            <p
              className="text-sm uppercase tracking-[0.32em] text-white/55"
              style={{ fontFamily: '"Cinzel", Georgia, serif' }}
            >
              {homeIntro.eyebrow}
            </p>
            <h2
              className="mt-4 max-w-3xl text-4xl leading-[0.95] sm:text-5xl lg:text-6xl"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              {homeIntro.title}
            </h2>
            <p
              className="mt-5 max-w-3xl text-lg leading-8 text-white/72"
              style={{ fontFamily: '"Alegreya", Georgia, serif' }}
            >
              {homeIntro.body}
            </p>
          </div>

          <div className="border border-white/12 bg-[#171718] p-6 sm:p-8">
            <p
              className="text-sm uppercase tracking-[0.3em] text-white/55"
              style={{ fontFamily: '"Cinzel", Georgia, serif' }}
            >
              Quick Contact
            </p>
            <h3
              className="mt-3 text-3xl text-white sm:text-4xl"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              Catalogue browsing should feel simple.
            </h3>
            <p
              className="mt-4 text-lg leading-8 text-white/72"
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

        <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          {homeCollections.map((collection) => (
            <article
              key={collection.id}
              className="border border-white/12 bg-[#171718] p-6"
            >
              <p
                className="text-xs uppercase tracking-[0.28em] text-white/55"
                style={{ fontFamily: '"Cinzel", Georgia, serif' }}
              >
                {collection.subtitle}
              </p>
              <h3
                className="mt-3 text-3xl leading-none text-white"
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
