import Navbar from "../components/navbar";
import Footer from "../components/footer";
import {
  contactActions,
  contactPageContent,
  contactLinks,
} from "../data/home-content";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#0f0f10] text-white">
      <Navbar className="border-b border-white/10 bg-[#0f0f10]/95 backdrop-blur" />

      <main className="px-4 py-10 sm:px-6 sm:py-14 lg:px-12 lg:py-18">
        <div className="mx-auto max-w-7xl">
          <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
            <div className="border border-white/10 bg-[#161617] p-5 sm:p-8 lg:p-10">
              <p
                className="text-sm uppercase tracking-[0.32em] text-white/55"
                style={{ fontFamily: '"Cinzel", Georgia, serif' }}
              >
                {contactPageContent.eyebrow}
              </p>
              <h1
                className="mt-4 max-w-3xl text-4xl leading-[0.95] text-white sm:text-5xl lg:text-6xl"
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
              >
                {contactPageContent.title}
              </h1>
              <p
                className="mt-5 max-w-2xl text-base leading-7 text-white/72 sm:text-lg sm:leading-8"
                style={{ fontFamily: '"Alegreya", Georgia, serif' }}
              >
                {contactPageContent.body}
              </p>

              <div className="mt-8 grid gap-4">
                {contactPageContent.guidance.map((item) => (
                  <div
                    key={item}
                    className="border-l border-white/20 pl-4 text-sm leading-7 text-white/76 sm:text-base"
                    style={{ fontFamily: '"Alegreya", Georgia, serif' }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-white/10 bg-[#121213] p-5 sm:p-8 lg:p-10">
              <p
                className="text-sm uppercase tracking-[0.32em] text-white/55"
                style={{ fontFamily: '"Cinzel", Georgia, serif' }}
              >
                Direct Details
              </p>

              <div className="mt-6 grid gap-4">
                <div className="border border-white/10 bg-black px-5 py-5">
                  <div
                    className="text-xs uppercase tracking-[0.24em] text-white/55"
                    style={{ fontFamily: '"Cinzel", Georgia, serif' }}
                  >
                    Phone
                  </div>
                  <a
                    href={contactLinks.phoneHref}
                    className="mt-2 block text-2xl text-white transition hover:text-white/75"
                    style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                  >
                    {contactLinks.phoneDisplay}
                  </a>
                </div>

                <div className="border border-white/10 bg-black px-5 py-5">
                  <div
                    className="text-xs uppercase tracking-[0.24em] text-white/55"
                    style={{ fontFamily: '"Cinzel", Georgia, serif' }}
                  >
                    Email
                  </div>
                  <a
                    href={contactLinks.emailHref}
                    className="mt-2 block break-all text-lg text-white transition hover:text-white/75 sm:text-2xl"
                    style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                  >
                    {contactLinks.email}
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {contactActions.map((action) => (
              <a
                key={action.id}
                href={action.href}
                className="border border-white/10 bg-[#161617] p-6 transition hover:border-white/35 hover:bg-[#1b1b1d]"
              >
                <div
                  className="text-sm uppercase tracking-[0.22em] text-white"
                  style={{ fontFamily: '"Cinzel", Georgia, serif' }}
                >
                  {action.label}
                </div>
                <div
                  className="mt-3 text-base leading-7 text-white/70"
                  style={{ fontFamily: '"Alegreya", Georgia, serif' }}
                >
                  {action.description}
                </div>
              </a>
            ))}
          </section>

          <section className="mt-10 border border-white/10 bg-[#161617] p-5 sm:p-8 lg:p-10">
            <p
              className="text-sm uppercase tracking-[0.3em] text-white/55"
              style={{ fontFamily: '"Cinzel", Georgia, serif' }}
            >
              Best For
            </p>

            <div className="mt-5 grid gap-5 md:grid-cols-3">
              <div>
                <h2
                  className="text-2xl text-white sm:text-3xl"
                  style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                >
                  Quick orders
                </h2>
                <p
                  className="mt-3 text-base leading-7 text-white/70"
                  style={{ fontFamily: '"Alegreya", Georgia, serif' }}
                >
                  Call or WhatsApp when you already know what you want and need
                  a fast response.
                </p>
              </div>

              <div>
                <h2
                  className="text-2xl text-white sm:text-3xl"
                  style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                >
                  Catalogue browsing
                </h2>
                <p
                  className="mt-3 text-base leading-7 text-white/70"
                  style={{ fontFamily: '"Alegreya", Georgia, serif' }}
                >
                  WhatsApp is the easiest route if you want to browse, compare,
                  and ask as you go.
                </p>
              </div>

              <div>
                <h2
                  className="text-2xl text-white sm:text-3xl"
                  style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                >
                  Custom requests
                </h2>
                <p
                  className="mt-3 text-base leading-7 text-white/70"
                  style={{ fontFamily: '"Alegreya", Georgia, serif' }}
                >
                  Email works best for gifting, custom batches, hotel soaps, or
                  requests that need a little more detail.
                </p>
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
