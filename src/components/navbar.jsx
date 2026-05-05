import { useState } from "react";
import { Link } from "react-router-dom";

const Navbar = ({ className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const navItems = [
    { label: "Home", href: "/" },
    { label: "Contact", href: "/contact" },
    { label: "About Us", href: "/about" },
    { label: "Products", href: "/products" },
    { label: "Dog Products", href: "/products-company-2" },
  ];
  const brandLogoSrc = "/rebel_tallow_transparent.png";

  return (
    <nav className={`relative z-50 text-[#f3e8d6] ${className}`}>
      <div className="flex items-center justify-between px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <Link to="/" onClick={() => setIsOpen(false)} className="block">
          <img
            src={brandLogoSrc}
            alt="Rebel Tallow Co. logo"
            className="h-10 w-auto max-w-[170px] object-contain sm:h-12 sm:max-w-[210px]"
          />
        </Link>

        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="flex h-11 w-11 items-center justify-center border border-white/12 bg-black/20 text-white md:hidden"
          aria-label="Toggle navigation"
          aria-expanded={isOpen}
        >
          <span className="text-lg">{isOpen ? "\u00D7" : "\u2261"}</span>
        </button>

        <ul
          className="hidden items-center gap-6 text-sm tracking-[0.16em] md:flex lg:gap-8 lg:text-base xl:gap-10 xl:text-lg"
          style={{
            fontFamily: '"Cinzel", Georgia, serif',
          }}
        >
          {navItems.map((item) => (
            <li key={item.label}>
              <Link to={item.href} onClick={() => setIsOpen(false)}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {isOpen ? (
        <div className="absolute inset-x-0 top-full z-50 border-t border-white/10 bg-[#0f0f10]/96 px-4 py-4 backdrop-blur md:hidden">
          <ul
            className="grid gap-2"
            style={{ fontFamily: '"Cinzel", Georgia, serif' }}
          >
            {navItems.map((item) => (
              <li key={item.label}>
                <Link
                  to={item.href}
                  onClick={() => setIsOpen(false)}
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
