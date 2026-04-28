import { useEffect, useMemo, useState } from "react";
import Footer from "../components/footer";
import Navbar from "../components/navbar";
import { readJsonResponse } from "../lib/api";
import { formatPrice, formatStockAmount } from "../lib/formatters";

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [openCategories, setOpenCategories] = useState({});

  const categories = useMemo(() => {
    const categorySet = new Set();

    products.forEach((product) => {
      const category = String(product.category || "").trim();

      if (category) {
        categorySet.add(category);
      }
    });

    return Array.from(categorySet).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === "all") {
      return products;
    }

    return products.filter((product) => product.category === selectedCategory);
  }, [products, selectedCategory]);

  const groupedProducts = useMemo(() => {
    const groups = new Map();

    filteredProducts.forEach((product) => {
      const category =
        String(product.category || "Uncategorised").trim() || "Uncategorised";

      if (!groups.has(category)) {
        groups.set(category, []);
      }

      groups.get(category).push(product);
    });

    return Array.from(groups.entries()).map(([category, categoryProducts]) => ({
      category,
      products: categoryProducts,
    }));
  }, [filteredProducts]);

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      try {
        const response = await fetch("/api/products", {
          headers: { Accept: "application/json" },
        });

        const data = await readJsonResponse(
          response,
          "Product API is available through Vercel dev or a deployed Vercel site.",
        );

        if (isMounted) {
          setProducts(data.products || []);
          setStatus("ready");
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message);
          setStatus("error");
        }
      }
    }

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  function toggleCategory(category) {
    setOpenCategories((current) => ({
      ...current,
      [category]: current[category] === false,
    }));
  }

  return (
    <div className="min-h-screen bg-[#0f0f10] text-white">
      <Navbar className="border-b border-white/10 bg-[#0f0f10]/95 backdrop-blur" />

      <main className="px-4 py-10 sm:px-6 sm:py-14 lg:px-12 lg:py-18">
        <div className="mx-auto max-w-7xl">
          <section className="border border-white/10 bg-[#151516] p-5 sm:p-8 lg:p-10">
            <p
              className="text-sm uppercase tracking-[0.32em] text-white/55"
              style={{ fontFamily: '"Cinzel", Georgia, serif' }}
            >
              Rebelco Products
            </p>

            <h1
              className="mt-4 max-w-3xl text-4xl leading-[0.95] text-white sm:text-5xl lg:text-6xl"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              Current catalogue
            </h1>

            <p
              className="mt-5 max-w-2xl text-base leading-7 text-white/58"
              style={{ fontFamily: '"Alegreya", Georgia, serif' }}
            >
              Browse the Rebelco collection by category. Each collection is grouped together
              so soaps, salves, balms, and other products are easier to explore.
            </p>
          </section>

          {status === "loading" ? (
            <div className="mt-8 border border-white/10 bg-[#151516] p-6 text-white/70">
              Loading products...
            </div>
          ) : null}

          {status === "error" ? (
            <div className="mt-8 border border-red-400/30 bg-red-950/25 p-6 text-red-100">
              {error}
            </div>
          ) : null}

          {status === "ready" && products.length === 0 ? (
            <div className="mt-8 border border-white/10 bg-[#151516] p-6 text-white/70">
              No products have been added yet.
            </div>
          ) : null}

          {products.length > 0 ? (
            <section className="mt-8 border border-white/10 bg-[#151516] p-4 sm:p-5">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("all")}
                  className={`border px-4 py-2 text-xs uppercase tracking-[0.22em] transition ${
                    selectedCategory === "all"
                      ? "border-white bg-white text-black"
                      : "border-white/10 bg-black text-white/55 hover:border-white/30 hover:text-white"
                  }`}
                >
                  All
                </button>

                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={`border px-4 py-2 text-xs uppercase tracking-[0.22em] transition ${
                      selectedCategory === category
                        ? "border-white bg-white text-black"
                        : "border-white/10 bg-black text-white/55 hover:border-white/30 hover:text-white"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {status === "ready" && groupedProducts.length > 0 ? (
            <section className="mt-8 grid gap-8">
              {groupedProducts.map((group) => {
                const isOpen = openCategories[group.category] !== false;

                return (
                  <section
                    key={group.category}
                    className="overflow-hidden border border-white/10 bg-[#151516]"
                  >
                    <button
                      type="button"
                      onClick={() => toggleCategory(group.category)}
                      className="flex w-full items-center justify-between gap-5 border-b border-white/10 p-5 text-left transition hover:bg-white/[0.03] sm:p-6"
                    >
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.32em] text-white/40">
                          Collection
                        </p>

                        <h2
                          className="mt-2 break-words text-4xl leading-none text-white sm:text-5xl"
                          style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                        >
                          {group.category}
                        </h2>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <div className="border border-white/10 bg-black px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/50">
                          {group.products.length} items
                        </div>

                        <span className="flex h-9 w-9 items-center justify-center border border-white/10 bg-black text-2xl text-white/70">
                          {isOpen ? "−" : "+"}
                        </span>
                      </div>
                    </button>

                    {isOpen ? (
                      <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
                        {group.products.map((product) => {
                          const isOutOfStock = Number(product.stockAmount) <= 0;
                          const productImages =
                            Array.isArray(product.imageUrls) && product.imageUrls.length > 0
                              ? product.imageUrls
                              : product.imageUrl
                                ? [product.imageUrl]
                                : [];
                          const mainImage = productImages[0];

                          return (
                            <article
                              key={product.id}
                              className="overflow-hidden border border-white/10 bg-[#101011]"
                            >
                              <div className="relative aspect-[4/3] bg-black">
                                {mainImage ? (
                                  <img
                                    src={mainImage}
                                    alt={product.title}
                                    className={`h-full w-full object-cover ${
                                      isOutOfStock ? "opacity-45 grayscale" : ""
                                    }`}
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-sm text-white/35">
                                    No image
                                  </div>
                                )}

                                {isOutOfStock ? (
                                  <div className="absolute left-3 top-3 border border-white/15 bg-black/70 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/75 backdrop-blur">
                                    Out of stock
                                  </div>
                                ) : null}

                                {productImages.length > 1 ? (
                                  <div className="absolute right-3 top-3 border border-white/15 bg-black/70 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/75 backdrop-blur">
                                    {productImages.length} photos
                                  </div>
                                ) : null}
                              </div>

                              {productImages.length > 1 ? (
                                <div className="grid grid-cols-4 gap-2 border-b border-white/10 p-3">
                                  {productImages.slice(0, 4).map((imageUrl, index) => (
                                    <img
                                      key={`${product.id}-${imageUrl}-${index}`}
                                      src={imageUrl}
                                      alt={`${product.title} thumbnail ${index + 1}`}
                                      className="aspect-square object-cover"
                                      loading="lazy"
                                    />
                                  ))}
                                </div>
                              ) : null}

                              <div className="p-5 sm:p-6">
                                <div className="flex items-start justify-between gap-4">
                                  <h3
                                    className="min-w-0 break-words text-2xl leading-none text-white sm:text-3xl"
                                    style={{
                                      fontFamily: '"Cormorant Garamond", Georgia, serif',
                                    }}
                                  >
                                    {product.title}
                                  </h3>

                                  <div className="shrink-0 text-right">
                                    <div className="text-base text-white">
                                      {formatPrice(product.price)}
                                    </div>

                                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/50">
                                      {product.weight}
                                    </div>
                                  </div>
                                </div>

                                <p
                                  className="mt-4 text-base leading-7 text-white/72"
                                  style={{ fontFamily: '"Alegreya", Georgia, serif' }}
                                >
                                  {product.description}
                                </p>

                                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                                  <div className="text-sm uppercase tracking-[0.2em] text-white/60">
                                    {formatStockAmount(product.stockAmount)}
                                  </div>

                                  {product.category ? (
                                    <div className="border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/45">
                                      {product.category}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </section>
          ) : null}

          {status === "ready" && products.length > 0 && groupedProducts.length === 0 ? (
            <div className="mt-8 border border-white/10 bg-[#151516] p-6 text-white/70">
              No products match this category.
            </div>
          ) : null}

          <div className="mt-14">
            <Footer />
          </div>
        </div>
      </main>
    </div>
  );
}