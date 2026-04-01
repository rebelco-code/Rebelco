export const contactLinks = {
  phoneDisplay: "+27 63 693 6204",
  phoneHref: "tel:+27636936204",
  email: "rebeldisruption@gmail.com",
  emailHref: "mailto:rebeldisruption@gmail.com",
  facebookHref: "https://www.facebook.com/share/18JxVQu4KQ/",
  whatsappCatalogueHref: "https://wa.me/c/27636936204",
};

export const contactActions = [
  {
    id: "whatsapp",
    label: "WhatsApp Catalogue",
    description: "Browse the catalogue or start a product enquiry on WhatsApp.",
    href: contactLinks.whatsappCatalogueHref,
  },
  {
    id: "facebook",
    label: "Facebook",
    description: "See updates, posts, and community-facing Rebelco activity.",
    href: contactLinks.facebookHref,
  },
  {
    id: "email",
    label: "Email",
    description: contactLinks.email,
    href: contactLinks.emailHref,
  },
  {
    id: "call",
    label: "Call",
    description: contactLinks.phoneDisplay,
    href: contactLinks.phoneHref,
  },
];

export const contactPageContent = {
  eyebrow: "Contact Rebelco",
  title: "Reach out the way that feels easiest.",
  body:
    "Whether you want to place an order, ask about availability, browse the catalogue, or get help choosing the right product, Rebelco can be reached directly through call, WhatsApp, email, or Facebook.",
  guidance: [
    "Call for immediate help with orders or product questions.",
    "Use WhatsApp to browse the catalogue and continue the conversation in one place.",
    "Email for custom requests, gifting enquiries, or anything that needs more detail.",
  ],
};

export const aboutPageContent = {
  eyebrow: "About Rebelco",
  title: "Grounded products with a handmade point of view.",
  intro:
    "Rebelco is built around practical, small-batch products that feel honest in the hand and useful in daily life. The catalogue moves across grooming, soaps, creams, home goods, candles, and gift-ready pieces, but the underlying idea stays the same: make things that feel considered, straightforward, and worth returning to.",
  story: [
    "What stands out in the catalogue is its range. It is not only about one hero item or one category. There are shaving products, bath bars, creams, lip balm, household washing staples, natural candles, and custom gift pieces. That makes Rebelco feel less like a narrow product line and more like a carefully built lifestyle range.",
    "The appeal is in the balance between rustic character and practical usefulness. The names, textures, and formats feel handmade, but the products are still easy to understand and easy to use. It is a catalogue with personality, without becoming too precious or too complicated.",
  ],
  principles: [
    {
      title: "Small-batch by nature",
      body:
        "The range reads as carefully made rather than mass-produced, which gives the brand a more personal and believable identity.",
    },
    {
      title: "Useful before flashy",
      body:
        "From washing bars to beard care and cream variants, the products are shaped around regular use and practical value.",
    },
    {
      title: "Broad but coherent",
      body:
        "Even with multiple categories, the catalogue still feels connected by a handmade, grounded, giftable point of view.",
    },
  ],
  closingTitle: "A catalogue meant to feel personal.",
  closingBody:
    "The best version of Rebelco is not overly polished or overly formal. It should feel direct, tactile, and quietly premium, with enough warmth to feel personal and enough structure to feel trustworthy.",
};

export const heroSlides = [
  {
    id: "contact",
    eyebrow: "Direct Contact",
    heading: "Talk To Rebelco Directly",
    body:
      "Call us for orders, gifting enquiries, and quick product guidance. Whether you are choosing a shampoo bar, a beard care item, or a custom soap order, you can speak to someone directly instead of guessing your way through the catalogue.",
    ctaLabel: "Call",
    ctaHref: contactLinks.phoneHref,
  },
  {
    id: "grooming",
    eyebrow: "Men's Products",
    heading: "Small-Batch Grooming With Character",
    body:
      "The catalogue includes shaving tallow whip bars, grit soaps, beard care essentials, and shaving brushes. It is a practical line built around texture, clean finish, and everyday use rather than novelty.",
  },
  {
    id: "soaps",
    eyebrow: "Bath Soaps & Salts",
    heading: "Daily Bars, Fresh Scents, Honest Ingredients",
    body:
      "From shampoo bars to Rainforrest Herbs, Citrus Bar, Ocean Fresh, Charcoal & Tumeric, Oats & Honey, Rooibos & Tea Tree, and more, the soaps range leans into natural ingredients and solid everyday staples.",
  },
  {
    id: "creams",
    eyebrow: "Creams & Lip Balm",
    heading: "Creams And Balms Built For Daily Ritual",
    body:
      "Face and body creams like Black Ice, Black Cherry Blossom, and Lavender sit alongside a honey lip balm, giving the range a softer skincare side that complements the stronger soap and grooming products.",
  },
  {
    id: "home",
    eyebrow: "Kitchen, Candles & Gifts",
    heading: "Home Goods, Utility Bars, And Thoughtful Gifts",
    body:
      "The catalogue also reaches into eco-friendly dish wash, washing bars, tallow oil, natural candles, tree scents, hotel soaps, and custom shrink-wrapped gift pieces, making the range broader than skincare alone.",
  },
];

export const homeCollections = [
  {
    id: "mens-products",
    title: "Men's Products",
    subtitle: "Practical grooming",
    description:
      "Built around shaving, beard care, and tactile grooming staples for an everyday routine.",
    highlights: [
      "Shaving Tallow Whip Bar",
      "Grotman Tou and Grotman Tou-Drank",
      "Shaving Brush",
    ],
  },
  {
    id: "bath-soaps",
    title: "Bath Soaps & Salts",
    subtitle: "Core soap range",
    description:
      "The deepest category in the CSV, covering shampoo bars and a wide spread of scented soap bars.",
    highlights: [
      "Shampoo Bar",
      "Rainforrest Herbs and Citrus Bar",
      "Charcoal & Tumeric, Rooibos & Tea Tree",
    ],
  },
  {
    id: "creams",
    title: "Creams & Lip Balm",
    subtitle: "Softer skincare",
    description:
      "A smaller but important skincare group with cream variants and a honey lip balm.",
    highlights: [
      "Black Ice",
      "Black Cherry Blossom",
      "Lavender and Honey Lip Balm",
    ],
  },
  {
    id: "home-living",
    title: "Kitchen & Candles",
    subtitle: "Useful home staples",
    description:
      "Cleaning and household goods make the catalogue feel grounded and more versatile.",
    highlights: [
      "Dish Whip Eco-Friendly Wash",
      "Washing Bar and Boerseep Vlekke",
      "Tallow Oil and Natural Candles",
    ],
  },
  {
    id: "gifts",
    title: "Gifts & Custom Orders",
    subtitle: "Made to share",
    description:
      "Giftable ranges and custom small-format soaps widen the catalogue beyond single-item purchases.",
    highlights: [
      "Tree Scents",
      "Hotel Soap Colour Sets",
      "Custom shrink-wrapped soap orders",
    ],
  },
];

export const homeIntro = {
  eyebrow: "From The Catalogue",
  title: "A broader range than one quick glance suggests.",
  body:
    "The CSV shows Rebelco as more than a soap brand. It spans grooming, shampoo and bath bars, creams, lip balm, kitchen utility products, candles, and gift-friendly custom work. The homepage should reflect that wider catalogue clearly and cleanly.",
};
