import { contactLinks } from "../data/home-content";

const footerLinks = [
  { label: "Facebook", href: contactLinks.facebookHref },
  { label: "WhatsApp Catalogue", href: contactLinks.whatsappCatalogueHref },
  { label: contactLinks.phoneDisplay, href: contactLinks.phoneHref },
  { label: contactLinks.email, href: contactLinks.emailHref },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/10 pt-8 text-white/74">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p
            className="text-sm uppercase tracking-[0.32em] text-white/55"
            style={{ fontFamily: '"Cinzel", Georgia, serif' }}
          >
            Rebelco
          </p>
          <h2
            className="mt-3 text-3xl text-white sm:text-4xl"
            style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
          >
            Made to be useful, giftable, and easy to come back to.
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {footerLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="border border-white/12 bg-[#101011] px-5 py-4 text-sm text-white/80 transition hover:border-white/40 hover:bg-[#181819]"
              style={{ fontFamily: '"Alegreya", Georgia, serif' }}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>

      <div
        className="mt-8 flex flex-col gap-2 border-t border-white/10 pt-5 text-sm text-white/55 sm:flex-row sm:items-center sm:justify-between"
        style={{ fontFamily: '"Alegreya", Georgia, serif' }}
      >
        <p>Small-batch grooming, soaps, creams, home goods, and gift-friendly essentials.</p>
        <p>Rebelco</p>
      </div>
    </footer>
  );
}
