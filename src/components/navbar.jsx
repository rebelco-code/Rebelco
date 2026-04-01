const Navbar = ({ className = "" }) => {
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
    <nav className={`text-[#f3e8d6] ${className}`}>
      <div className="flex items-center justify-between px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <div className="flex items-center">
          <img
            src={logoPlaceholder}
            alt="Placeholder Rebelco logo"
            className="h-10 w-10 sm:h-11 sm:w-11"
          />
        </div>

        <ul
          className="flex items-center gap-6 text-base tracking-[0.18em] sm:gap-8 sm:text-lg lg:gap-10 lg:text-xl"
          style={{
            fontFamily: '"Cinzel", Georgia, serif',
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
