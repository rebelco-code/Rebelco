import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

const Navbar = ({ className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navItems = [
    { label: "Home", href: "/" },
    { label: "Contact", href: "/contact" },
    { label: "About Us", href: "/about" },
    { label: "Products", href: "/products" },
  ];
  const logoPlaceholder =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
        <rect width="56" height="56" rx="8" fill="none" stroke="#8a8a8f" stroke-width="2"/>
        <path d="M16 37L28 19L40 37" fill="none" stroke="#8a8a8f" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  return (
    <nav className={`text-[#f3e8d6] ${className}`}>
      <div className="flex items-center justify-between px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <div className="flex items-center gap-3">
          <img
            src={logoPlaceholder}
            alt="Placeholder Rebelco logo"
            className="h-10 w-10 sm:h-11 sm:w-11"
          />
          <div
            className="text-sm uppercase tracking-[0.28em] text-white sm:text-base"
            style={{ fontFamily: '"Cinzel", Georgia, serif' }}
          >
            Rebelco
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="flex h-11 w-11 items-center justify-center border border-white/12 bg-black/20 text-white md:hidden"
          aria-label="Toggle navigation"
          aria-expanded={isOpen}
        >
          <span className="text-lg">{isOpen ? "×" : "≡"}</span>
        </button>

        <ul
          className="hidden items-center gap-6 text-sm tracking-[0.16em] md:flex lg:gap-8 lg:text-base xl:gap-10 xl:text-lg"
          style={{
            fontFamily: '"Cinzel", Georgia, serif',
          }}
        >
          {navItems.map((item) => (
            <li key={item.label}>
              <Link to={item.href}>{item.label}</Link>
            </li>
          ))}
        </ul>
      </div>

      {isOpen ? (
        <div className="border-t border-white/10 bg-[#0f0f10]/96 px-4 py-4 backdrop-blur md:hidden">
          <ul
            className="grid gap-2"
            style={{ fontFamily: '"Cinzel", Georgia, serif' }}
          >
            {navItems.map((item) => (
              <li key={item.label}>
                <Link
                  to={item.href}
                  className="block border border-white/10 bg-black/25 px-4 py-3 text-sm uppercase tracking-[0.2em] text-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </nav>
  );
};

export default Navbar;
