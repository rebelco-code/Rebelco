import { contactLinks } from "../data/home-content";

const footerLinks = [
  { label: "Facebook", href: contactLinks.facebookHref },
  { label: "WhatsApp Catalogue", href: contactLinks.whatsappCatalogueHref },
  { label: contactLinks.phoneDisplay, href: contactLinks.phoneHref },
  { label: contactLinks.email, href: contactLinks.emailHref },
];

export default function Footer() {
  return (
    <footer className="border-t border-black/10 pt-10 text-black">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/55">Rebelco</p>
          <h2
            className="mt-3 text-3xl sm:text-4xl"
            style={{ fontFamily: '"Outfit", "Manrope", sans-serif', fontWeight: 300, letterSpacing: "-0.03em" }}
          >
            Made to be useful, giftable, and easy to come back to.
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {footerLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="border border-black/10 bg-white px-5 py-4 text-sm transition hover:bg-[#f7f4ee]"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-2 border-t border-black/10 pt-5 text-sm text-black/60 sm:flex-row sm:items-center sm:justify-between">
        <p>Small-batch grooming, soaps, creams, home goods, and gift-friendly essentials.</p>
        <p>Rebelco</p>
      </div>
    </footer>
  );
}
