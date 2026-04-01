import React from "react";
import "../fonts/arthurmorgancursivehandwriting-cufonfonts-webfont/style.css";

const Navbar = () => {
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

  return (
    <nav className="bg-[#1f2023] text-[#d4d4d8]">
      <div className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center">
          <img
            src={logoPlaceholder}
            alt="Placeholder Rebelco logo"
            className="h-12 w-12"
          />
        </div>

        <ul
          className="flex items-center gap-8 text-5xl"
          style={{
            fontFamily:
              '"Arthurmorgancursivehandwriting Regular", Georgia, serif',
          }}
        >
          {navItems.map((item) => (
            <li key={item.label}>
              <a href={item.href}>{item.label}</a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
