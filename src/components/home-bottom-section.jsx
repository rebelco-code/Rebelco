import Footer from "./footer";
import { homeFeatureSections } from "../data/home-content";

export default function HomeBottomSection() {
  return (
    <section className="bg-white px-4 pb-16 pt-6 text-black sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-16">
        {homeFeatureSections.map((section) => (
          <section key={section.id} className="space-y-8">
            <div className="mx-auto max-w-4xl text-center">
              <h2
                className="text-3xl leading-tight sm:text-4xl lg:text-5xl"
                style={{ fontFamily: '"Outfit", "Manrope", sans-serif', fontWeight: 300, letterSpacing: "-0.03em" }}
              >
                {section.title}
              </h2>
              <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-black/72 sm:text-lg">
                {section.description}
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {section.items.map((item) => (
                <a
                  key={item.title}
                  href={item.href}
                  className="group border border-black/10 bg-white transition hover:shadow-[0_14px_34px_rgba(0,0,0,0.08)]"
                >
                  <div className="aspect-[4/3] bg-[linear-gradient(135deg,#fafaf8_0%,#ecece7_100%)]" />
                  <div className="p-5">
                    <h3
                      className="text-2xl leading-tight"
                      style={{ fontFamily: '"Outfit", "Manrope", sans-serif', fontWeight: 300, letterSpacing: "-0.03em" }}
                    >
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-black/68">{item.body}</p>
                    <div className="mt-5 text-sm font-semibold uppercase tracking-[0.14em] text-black transition group-hover:opacity-65">
                      {item.linkLabel}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        ))}

        <div className="border border-black/10 bg-[linear-gradient(180deg,#fcfcfa_0%,#f2f2ed_100%)] px-6 py-10 text-center sm:px-10">
          <h2
            className="text-3xl sm:text-4xl"
            style={{ fontFamily: '"Outfit", "Manrope", sans-serif', fontWeight: 300, letterSpacing: "-0.03em" }}
          >
            Handmade, useful, and built for repeat orders.
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-black/70 sm:text-lg">
            The homepage should feel easy to browse and product-first. Customers should see the
            range quickly, understand what Rebelco sells, and get to the right catalogue path
            without having to decode the site.
          </p>
        </div>

        <Footer />
      </div>
    </section>
  );
}
