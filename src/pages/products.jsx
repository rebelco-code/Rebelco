import { useEffect, useMemo, useRef, useState } from "react";
import Footer from "../components/footer";
import Navbar from "../components/navbar";
import { readJsonResponse } from "../lib/api";
import { formatPrice, formatStockAmount } from "../lib/formatters";

const initialOrderForm = {
  quantity: "1",
  locationText: "",
  locationLatitude: "",
  locationLongitude: "",
};

function getProductImages(product) {
  if (Array.isArray(product.imageUrls) && product.imageUrls.length > 0) {
    return product.imageUrls;
  }

  if (product.imageUrl) {
    return [product.imageUrl];
  }

  return [];
}

function parseCoordinate(value, min, max) {
  const parsedValue = Number.parseFloat(String(value || "").trim());

  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  if (parsedValue < min || parsedValue > max) {
    return null;
  }

  return parsedValue;
}

function buildMapEmbedUrl(latitude, longitude) {
  const zoomOffset = 0.01;
  const left = longitude - zoomOffset;
  const bottom = latitude - zoomOffset;
  const right = longitude + zoomOffset;
  const top = latitude + zoomOffset;
  const bbox = encodeURIComponent(`${left},${bottom},${right},${top}`);
  const marker = encodeURIComponent(`${latitude},${longitude}`);

  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`;
}

export default function ProductsPage() {
  const orderSectionRef = useRef(null);

  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [openCategories, setOpenCategories] = useState({});
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [orderForm, setOrderForm] = useState(initialOrderForm);
  const [orderStatus, setOrderStatus] = useState("idle");
  const [locationStatus, setLocationStatus] = useState("idle");
  const [orderMessage, setOrderMessage] = useState("");
  const [orderError, setOrderError] = useState("");

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

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) || null,
    [products, selectedProductId],
  );

  const selectedProductImages = useMemo(
    () => (selectedProduct ? getProductImages(selectedProduct) : []),
    [selectedProduct],
  );

  const parsedLatitude = useMemo(
    () => parseCoordinate(orderForm.locationLatitude, -90, 90),
    [orderForm.locationLatitude],
  );

  const parsedLongitude = useMemo(
    () => parseCoordinate(orderForm.locationLongitude, -180, 180),
    [orderForm.locationLongitude],
  );

  const mapEmbedUrl = useMemo(() => {
    if (parsedLatitude === null || parsedLongitude === null) {
      return "";
    }

    return buildMapEmbedUrl(parsedLatitude, parsedLongitude);
  }, [parsedLatitude, parsedLongitude]);

  const selectedPreviewImage =
    selectedProductImages[selectedImageIndex] || selectedProductImages[0] || "";

  const locationSearchUrl = useMemo(() => {
    const trimmedLocationText = orderForm.locationText.trim();

    if (!trimmedLocationText) {
      return "";
    }

    return `https://www.openstreetmap.org/search?query=${encodeURIComponent(trimmedLocationText)}`;
  }, [orderForm.locationText]);

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

  function selectProductForOrder(productId) {
    setSelectedProductId(productId);
    setSelectedImageIndex(0);
    setOrderForm(initialOrderForm);
    setOrderMessage("");
    setOrderError("");

    window.requestAnimationFrame(() => {
      orderSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function updateOrderField(event) {
    const { name, value } = event.target;

    setOrderForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function useCurrentLocation() {
    if (!navigator.geolocation) {
      setOrderError("Geolocation is not supported in this browser.");
      return;
    }

    setLocationStatus("locating");
    setOrderError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        setOrderForm((currentForm) => ({
          ...currentForm,
          locationLatitude: latitude.toFixed(6),
          locationLongitude: longitude.toFixed(6),
        }));
        setLocationStatus("idle");
      },
      (locationError) => {
        setLocationStatus("idle");
        setOrderError(locationError.message || "Could not read your current location.");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
      },
    );
  }

  async function submitOrder(event) {
    event.preventDefault();

    if (!selectedProduct) {
      setOrderError("Please select a product before placing an order.");
      return;
    }

    setOrderStatus("saving");
    setOrderError("");
    setOrderMessage("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          productId: selectedProduct.id,
          quantity: orderForm.quantity,
          locationText: orderForm.locationText,
          locationLatitude: orderForm.locationLatitude,
          locationLongitude: orderForm.locationLongitude,
        }),
      });

      const data = await readJsonResponse(response, "Could not place order.");

      setOrderMessage(data.message || "Order placed successfully.");
      setOrderForm(initialOrderForm);
      setSelectedImageIndex(0);
    } catch (submitError) {
      setOrderError(submitError.message);
    } finally {
      setOrderStatus("idle");
    }
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
                          const productImages = getProductImages(product);
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

                                <button
                                  type="button"
                                  onClick={() => selectProductForOrder(product.id)}
                                  disabled={isOutOfStock}
                                  className="mt-4 w-full border border-white/12 bg-black px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white/35 hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                  {isOutOfStock ? "Out of stock" : "Place Order"}
                                </button>
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

          {selectedProduct ? (
            <section
              ref={orderSectionRef}
              className="mt-10 border border-white/10 bg-[#151516] p-5 sm:p-6 lg:p-8"
            >
              <div className="border-b border-white/10 pb-5">
                <p className="text-xs uppercase tracking-[0.3em] text-white/45">Place Order</p>

                <h2
                  className="mt-3 text-3xl leading-none text-white sm:text-4xl"
                  style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                >
                  {selectedProduct.title}
                </h2>

                <p className="mt-4 max-w-3xl text-sm leading-7 text-white/60">
                  Review the product details, choose your quantity, then add your location
                  using text or map coordinates.
                </p>
              </div>

              {orderError ? (
                <div className="mt-5 border border-red-400/30 bg-red-950/25 p-4 text-sm text-red-100">
                  {orderError}
                </div>
              ) : null}

              {orderMessage ? (
                <div className="mt-5 border border-emerald-400/30 bg-emerald-950/25 p-4 text-sm text-emerald-100">
                  {orderMessage}
                </div>
              ) : null}

              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="border border-white/10 bg-black/30 p-4 sm:p-5">
                  <div className="aspect-[4/3] overflow-hidden border border-white/10 bg-black">
                    {selectedPreviewImage ? (
                      <img
                        src={selectedPreviewImage}
                        alt={`${selectedProduct.title} preview`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-white/40">
                        No image
                      </div>
                    )}
                  </div>

                  {selectedProductImages.length > 1 ? (
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {selectedProductImages.map((imageUrl, index) => (
                        <button
                          key={`${selectedProduct.id}-order-preview-${imageUrl}-${index}`}
                          type="button"
                          onClick={() => setSelectedImageIndex(index)}
                          className={`overflow-hidden border ${
                            selectedImageIndex === index
                              ? "border-white"
                              : "border-white/10 hover:border-white/30"
                          }`}
                        >
                          <img
                            src={imageUrl}
                            alt={`${selectedProduct.title} image ${index + 1}`}
                            className="aspect-square w-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-5 grid gap-3 text-sm text-white/70">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                      <span className="text-white/50">Price</span>
                      <span>{formatPrice(selectedProduct.price)}</span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                      <span className="text-white/50">Weight</span>
                      <span>{selectedProduct.weight}</span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                      <span className="text-white/50">Category</span>
                      <span>{selectedProduct.category || "Uncategorised"}</span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-white/50">Stock</span>
                      <span>{formatStockAmount(selectedProduct.stockAmount)}</span>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-7 text-white/65">
                    {selectedProduct.description}
                  </p>
                </div>

                <form className="grid gap-5 border border-white/10 bg-black/25 p-4 sm:p-5" onSubmit={submitOrder}>
                  <label className="grid gap-2 text-sm text-white/70">
                    <span className="text-xs uppercase tracking-[0.2em] text-white/45">
                      Quantity
                    </span>

                    <input
                      type="number"
                      name="quantity"
                      min="1"
                      value={orderForm.quantity}
                      onChange={updateOrderField}
                      required
                      className="rounded-lg border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-white/40"
                    />
                  </label>

                  <label className="grid gap-2 text-sm text-white/70">
                    <span className="text-xs uppercase tracking-[0.2em] text-white/45">
                      Location (Text)
                    </span>

                    <textarea
                      name="locationText"
                      value={orderForm.locationText}
                      onChange={updateOrderField}
                      rows={4}
                      placeholder="Street address, suburb, city, or delivery notes"
                      className="resize-none rounded-lg border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-white/40"
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm text-white/70">
                      <span className="text-xs uppercase tracking-[0.2em] text-white/45">
                        Latitude
                      </span>

                      <input
                        type="text"
                        name="locationLatitude"
                        value={orderForm.locationLatitude}
                        onChange={updateOrderField}
                        placeholder="-26.204103"
                        className="rounded-lg border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-white/40"
                      />
                    </label>

                    <label className="grid gap-2 text-sm text-white/70">
                      <span className="text-xs uppercase tracking-[0.2em] text-white/45">
                        Longitude
                      </span>

                      <input
                        type="text"
                        name="locationLongitude"
                        value={orderForm.locationLongitude}
                        onChange={updateOrderField}
                        placeholder="28.047305"
                        className="rounded-lg border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-white/40"
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={useCurrentLocation}
                      disabled={locationStatus === "locating"}
                      className="border border-white/10 bg-black px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white/35 hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {locationStatus === "locating" ? "Locating..." : "Use My Current Location"}
                    </button>

                    {locationSearchUrl ? (
                      <a
                        href={locationSearchUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs uppercase tracking-[0.2em] text-white/65 underline-offset-4 hover:text-white hover:underline"
                      >
                        Preview Text Location
                      </a>
                    ) : null}
                  </div>

                  {mapEmbedUrl ? (
                    <div className="border border-white/10 bg-black p-2">
                      <iframe
                        title="Selected map location"
                        src={mapEmbedUrl}
                        className="h-56 w-full border-0"
                        loading="lazy"
                      />

                      {parsedLatitude !== null && parsedLongitude !== null ? (
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${parsedLatitude}&mlon=${parsedLongitude}#map=15/${parsedLatitude}/${parsedLongitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-xs uppercase tracking-[0.18em] text-white/65 underline-offset-4 hover:text-white hover:underline"
                        >
                          Open Map In New Tab
                        </a>
                      ) : null}
                    </div>
                  ) : (
                    <div className="border border-white/10 bg-black/40 p-4 text-sm text-white/50">
                      Add both latitude and longitude to preview map location.
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={orderStatus === "saving"}
                    className="border border-white bg-white px-5 py-4 text-sm font-semibold uppercase tracking-[0.22em] text-black transition hover:bg-[#d9d9d9] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {orderStatus === "saving" ? "Placing Order..." : "Confirm Place Order"}
                  </button>
                </form>
              </div>
            </section>
          ) : null}

          <div className="mt-14">
            <Footer />
          </div>
        </div>
      </main>
    </div>
  );
}
