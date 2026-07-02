import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { contactLinks, homeAnnouncements } from "../data/home-content";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Catalog", href: "/products" },
  { label: "My Orders", href: "/orders" },
  { label: "Contact", href: "/contact" },
  { label: "About", href: "/about" },
];

export default function Navbar({ className = "", showAnnouncement = true }) {
  const [isOpen, setIsOpen] = useState(false);
  const [announcementIndex, setAnnouncementIndex] = useState(0);

  useEffect(() => {
    if (!showAnnouncement || homeAnnouncements.length <= 1) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setAnnouncementIndex((currentIndex) => (currentIndex + 1) % homeAnnouncements.length);
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [showAnnouncement]);

  return (
    <div className={className}>
      {showAnnouncement ? (
        <div className="bg-black px-4 py-2 text-center text-xs font-semibold tracking-[0.16em] text-white uppercase sm:text-sm">
          {homeAnnouncements[announcementIndex]}
        </div>
      ) : null}

      <nav className="border-b border-black/10 bg-white text-black">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" onClick={() => setIsOpen(false)} className="flex items-center gap-3">
            <div className="flex h-14 w-24 items-center justify-center overflow-hidden border border-black/10 bg-[#f7f4ee] sm:h-16 sm:w-28">
              <img
                src="/rebelco-logo-optimized.png"
                alt="Rebelco logo"
                className="h-full w-full object-cover opacity-90"
                width="256"
                height="171"
                decoding="async"
              />
            </div>
            <div className="hidden sm:block">
              <div
                className="text-2xl leading-none"
                style={{ fontFamily: '"Outfit", "Manrope", sans-serif', fontWeight: 300 }}
              >
                Rebelco
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-black/50">
                Handmade essentials
              </div>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            className="flex h-11 w-11 items-center justify-center border border-black/15 text-black lg:hidden"
            aria-label="Toggle navigation"
            aria-expanded={isOpen}
          >
            <span className="text-lg">{isOpen ? "\u00D7" : "\u2261"}</span>
          </button>

          <ul className="hidden items-center gap-8 text-sm lg:flex">
            {navItems.map((item) => (
              <li key={item.label}>
                <Link
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className="transition hover:opacity-65"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-4 text-sm lg:flex">
            <a href={contactLinks.whatsappCatalogueHref} className="transition hover:opacity-65">
              WhatsApp
            </a>
            <Link
              to="/products"
              className="nav-shop-button px-4 py-2"
            >
              Shop
            </Link>
          </div>
        </div>

        {isOpen ? (
          <div className="border-t border-black/10 bg-white px-4 py-4 lg:hidden">
            <ul className="grid gap-3 text-sm">
              {navItems.map((item) => (
                <li key={item.label}>
                  <Link
                    to={item.href}
                    onClick={() => setIsOpen(false)}
                    className="block border border-black/10 px-4 py-3"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href={contactLinks.whatsappCatalogueHref}
                  onClick={() => setIsOpen(false)}
                  className="block border border-black/10 px-4 py-3"
                >
                  WhatsApp
                </a>
              </li>
            </ul>
          </div>
        ) : null}
      </nav>
    </div>
  );
}
