import { useState } from "react";
import { Link } from "react-router-dom";

const Navbar = ({ className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const navItems = [
    { label: "Home", href: "/" },
    { label: "Contact", href: "/contact" },
    { label: "About Us", href: "/about" },
    { label: "Products", href: "/products" },
  ];
  const brandLogoSrc = "/rebel_tallow_transparent.png";

  return (
    <nav className={`relative z-50 text-[#f3e8d6] ${className}`}>
      <div className="flex items-center justify-between px-4 py-1.5 sm:px-6 sm:py-2 lg:px-8">
        <Link to="/" onClick={() => setIsOpen(false)} className="block overflow-visible">
          <img
            src={brandLogoSrc}
            alt="Rebel Tallow Co. logo"
            className="-my-12 h-40 w-auto max-w-[680px] object-contain sm:-my-14 sm:h-48 sm:max-w-[840px]"
          />
        </Link>

        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="flex h-11 w-11 items-center justify-center border border-white/30 bg-black text-white md:hidden"
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
              <Link
                to={item.href}
                onClick={() => setIsOpen(false)}
                className="inline-flex h-10 w-[132px] items-center justify-center border border-white/25 bg-black px-3 text-center text-white transition hover:border-white/50 hover:bg-[#111]"
              >
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
