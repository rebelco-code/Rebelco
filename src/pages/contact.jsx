import Navbar from "../components/navbar";
import Footer from "../components/footer";
import {
  contactActions,
  contactPageContent,
  contactLinks,
} from "../data/home-content";

export default function ContactPage() {
  return (
    <div className="theme-page theme-shell">
      <Navbar className="border-b border-[var(--theme-border)] bg-white/95 backdrop-blur" />

      <main className="px-4 py-10 sm:px-6 sm:py-14 lg:px-12 lg:py-18">
        <div className="mx-auto max-w-7xl">
          <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
            <div className="theme-card p-5 sm:p-8 lg:p-10">
              <p className="theme-kicker text-sm">{contactPageContent.eyebrow}</p>
              <h1 className="theme-title mt-4 max-w-3xl text-4xl leading-[0.95] sm:text-5xl lg:text-6xl">{contactPageContent.title}</h1>
              <p className="theme-copy mt-5 max-w-2xl text-base leading-7 sm:text-lg sm:leading-8">{contactPageContent.body}</p>

              <div className="mt-8 grid gap-4">
                {contactPageContent.guidance.map((item) => (
                  <div
                    key={item}
                    className="theme-copy border-l border-[var(--theme-border-strong)] pl-4 text-sm leading-7 sm:text-base"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="theme-card p-5 sm:p-8 lg:p-10">
              <p className="theme-kicker text-sm">Direct Details</p>

              <div className="mt-6 grid gap-4">
                <div className="theme-panel px-5 py-5">
                  <div className="theme-kicker text-xs">Phone</div>
                  <a
                    href={contactLinks.phoneHref}
                    className="theme-title mt-2 block text-2xl transition hover:text-[var(--theme-accent-strong)]"
                  >
                    {contactLinks.phoneDisplay}
                  </a>
                </div>

                <div className="theme-panel px-5 py-5">
                  <div className="theme-kicker text-xs">Email</div>
                  <a
                    href={contactLinks.emailHref}
                    className="theme-title mt-2 block break-all text-lg transition hover:text-[var(--theme-accent-strong)] sm:text-2xl"
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
                className="theme-card p-6 transition hover:border-[var(--theme-border-strong)] hover:bg-white"
              >
                <div className="theme-kicker text-sm">{action.label}</div>
                <div className="theme-copy mt-3 text-base leading-7">{action.description}</div>
              </a>
            ))}
          </section>

          <section className="theme-card mt-10 p-5 sm:p-8 lg:p-10">
            <p className="theme-kicker text-sm">Best For</p>

            <div className="mt-5 grid gap-5 md:grid-cols-3">
              <div>
                <h2
                  className="theme-title text-2xl sm:text-3xl"
                >
                  Quick orders
                </h2>
                <p
                  className="theme-copy mt-3 text-base leading-7"
                >
                  Call or WhatsApp when you already know what you want and need
                  a fast response.
                </p>
              </div>

              <div>
                <h2
                  className="theme-title text-2xl sm:text-3xl"
                >
                  Catalogue browsing
                </h2>
                <p
                  className="theme-copy mt-3 text-base leading-7"
                >
                  WhatsApp is the easiest route if you want to browse, compare,
                  and ask as you go.
                </p>
              </div>

              <div>
                <h2
                  className="theme-title text-2xl sm:text-3xl"
                >
                  Custom requests
                </h2>
                <p
                  className="theme-copy mt-3 text-base leading-7"
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
