import { useEffect, useMemo, useRef, useState } from "react";
import Footer from "../components/footer";
import Navbar from "../components/navbar";
import { readJsonResponse } from "../lib/api";
import { formatPrice, formatStockAmount } from "../lib/formatters";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

function normalizeMinimumOrderQuantity(value) {
  const parsedQuantity = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1;
}

function buildInitialOrderForm(minimumOrderQuantity = 1) {
  return {
    quantity: String(normalizeMinimumOrderQuantity(minimumOrderQuantity)),
    locationText: "",
    googleMapsLocation: "",
    pudoLockerCode: "",
    pudoLockerName: "",
    pudoLockerAddress: "",
  };
}

function getProductImages(product) {
  if (Array.isArray(product.imageUrls) && product.imageUrls.length > 0) {
    return product.imageUrls;
  }

  if (product.imageUrl) {
    return [product.imageUrl];
  }

  return [];
}

function getProductList(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

function isSpecialOptionActive(product) {
  const specialOption = product?.specialOption;

  if (!specialOption?.enabled || !specialOption.startDate || !specialOption.endDate) {
    return false;
  }

  const now = new Date();
  const startDate = new Date(`${specialOption.startDate}T00:00:00`);
  const endDate = new Date(`${specialOption.endDate}T23:59:59`);

  return now >= startDate && now <= endDate;
}

function formatDisplayDate(value) {
  const timestamp = Date.parse(String(value || ""));

  if (!Number.isFinite(timestamp)) {
    return "";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
  }).format(new Date(timestamp));
}

function getSpecialPrice(product) {
  const price = Number(product?.price || 0);
  const discountAmount = Number(product?.specialOption?.discountAmount || 0);

  if (!isSpecialOptionActive(product) || discountAmount <= 0) {
    return null;
  }

  return Math.max(0, Math.round((price - discountAmount) * 100) / 100);
}

function isUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function buildGoogleMapsSearchUrl(value) {
  const trimmedValue = String(value || "").trim();

  if (!trimmedValue) {
    return "";
  }

  if (isUrl(trimmedValue)) {
    return trimmedValue;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmedValue)}`;
}

function parseLatLngText(value) {
  const match = String(value || "")
    .trim()
    .match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);

  if (!match) {
    return null;
  }

  const latitude = Number.parseFloat(match[1]);
  const longitude = Number.parseFloat(match[2]);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
}

function formatLatLng(latitude, longitude) {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

function shortenDescription(value, maxLength = 180) {
  const text = String(value || "").trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}...`;
}

function getEffectiveProductPrice(product) {
  const specialPrice = getSpecialPrice(product);

  if (specialPrice !== null) {
    return Number(specialPrice || 0);
  }

  return Number(product?.price || 0);
}

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export default function ProductsPage() {
  const orderSectionRef = useRef(null);
  const pinMapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const mapMarkerRef = useRef(null);
  const pudoLookupRequestRef = useRef(0);
  const pudoLookupCoordsRef = useRef("");

  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [openCategories, setOpenCategories] = useState({});
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [orderForm, setOrderForm] = useState(() => buildInitialOrderForm());
  const [cartItems, setCartItems] = useState([]);
  const [orderStatus, setOrderStatus] = useState("idle");
  const [locationStatus, setLocationStatus] = useState("idle");
  const [pudoStatus, setPudoStatus] = useState("idle");
  const [pudoLockers, setPudoLockers] = useState([]);
  const [pudoMessage, setPudoMessage] = useState("");
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

  const selectedProductMinimumOrderQuantity = useMemo(
    () => normalizeMinimumOrderQuantity(selectedProduct?.minimumOrderQuantity),
    [selectedProduct],
  );

  const selectedProductImages = useMemo(
    () => (selectedProduct ? getProductImages(selectedProduct) : []),
    [selectedProduct],
  );

  const selectedProductColors = useMemo(
    () => (selectedProduct ? getProductList(selectedProduct.colors) : []),
    [selectedProduct],
  );

  const selectedProductScents = useMemo(
    () => (selectedProduct ? getProductList(selectedProduct.scents) : []),
    [selectedProduct],
  );

  const selectedProductHasSpecialOption = useMemo(
    () => (selectedProduct ? isSpecialOptionActive(selectedProduct) : false),
    [selectedProduct],
  );

  const selectedProductSpecialPrice = useMemo(
    () => (selectedProduct ? getSpecialPrice(selectedProduct) : null),
    [selectedProduct],
  );

  const cartLines = useMemo(() => {
    return cartItems
      .map((item) => {
        const product = products.find((currentProduct) => currentProduct.id === item.productId);

        if (!product) {
          return null;
        }

        return {
          ...item,
          product,
          unitPrice: getEffectiveProductPrice(product),
        };
      })
      .filter(Boolean);
  }, [cartItems, products]);

  const cartTotalQuantity = useMemo(
    () => cartLines.reduce((sum, line) => sum + Number(line.quantity || 0), 0),
    [cartLines],
  );

  const cartTotalPrice = useMemo(() => {
    const subtotal = cartLines.reduce(
      (sum, line) => sum + Number(line.unitPrice || 0) * Number(line.quantity || 0),
      0,
    );

    return Math.round(subtotal * 100) / 100;
  }, [cartLines]);

  const googleMapsSearchUrl = useMemo(
    () => buildGoogleMapsSearchUrl(orderForm.googleMapsLocation),
    [orderForm.googleMapsLocation],
  );

  const selectedPreviewImage =
    selectedProductImages[selectedImageIndex] || selectedProductImages[0] || "";

  const locationSearchUrl = useMemo(() => {
    const trimmedLocationText = orderForm.locationText.trim();

    if (!trimmedLocationText) {
      return "";
    }

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmedLocationText)}`;
  }, [orderForm.locationText]);

  useEffect(() => {
    if (!selectedProductId) {
      return;
    }

    setOrderForm((currentForm) => {
      const currentQuantity = Number.parseInt(String(currentForm.quantity || ""), 10);

      if (
        Number.isInteger(currentQuantity) &&
        currentQuantity >= selectedProductMinimumOrderQuantity
      ) {
        return currentForm;
      }

      return {
        ...currentForm,
        quantity: String(selectedProductMinimumOrderQuantity),
      };
    });
  }, [selectedProductId, selectedProductMinimumOrderQuantity]);

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

  useEffect(() => {
    if (!selectedProduct || !pinMapRef.current || mapInstanceRef.current) {
      return undefined;
    }

    const initialCenter = [-26.2041, 28.0473];
    const mapInstance = L.map(pinMapRef.current, {
      center: initialCenter,
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapInstance);

    window.setTimeout(() => {
      mapInstance.invalidateSize();
    }, 0);

    mapInstance.on("click", (event) => {
      const { lat, lng } = event.latlng;
      const formattedValue = formatLatLng(lat, lng);

      if (mapMarkerRef.current) {
        mapMarkerRef.current.setLatLng([lat, lng]);
      } else {
        mapMarkerRef.current = L.marker([lat, lng]).addTo(mapInstance);
      }

      setOrderForm((currentForm) => ({
        ...currentForm,
        googleMapsLocation: formattedValue,
        pudoLockerCode: "",
        pudoLockerName: "",
        pudoLockerAddress: "",
      }));

      setPudoLockers([]);
      setPudoMessage("");
      setPudoStatus("idle");
      setOrderError("");
      setOrderMessage("");

      lookupAndSelectClosestPudo(lat, lng);
    });

    mapInstanceRef.current = mapInstance;

    return () => {
      mapInstance.off();
      mapInstance.remove();
      mapInstanceRef.current = null;
      mapMarkerRef.current = null;
    };
  }, [selectedProduct]);

  useEffect(() => {
    const mapInstance = mapInstanceRef.current;

    if (!mapInstance) {
      return;
    }

    const parsedLatLng = parseLatLngText(orderForm.googleMapsLocation);

    if (!parsedLatLng) {
      return;
    }

    const { latitude, longitude } = parsedLatLng;

    if (mapMarkerRef.current) {
      mapMarkerRef.current.setLatLng([latitude, longitude]);
    } else {
      mapMarkerRef.current = L.marker([latitude, longitude]).addTo(mapInstance);
    }

    mapInstance.setView([latitude, longitude], Math.max(mapInstance.getZoom(), 14));
  }, [orderForm.googleMapsLocation]);

  useEffect(() => {
    if (!selectedProduct) {
      return;
    }

    const parsedLatLng = parseLatLngText(orderForm.googleMapsLocation);

    if (!parsedLatLng) {
      pudoLookupCoordsRef.current = "";
      return;
    }

    const lookupKey = `${parsedLatLng.latitude.toFixed(6)},${parsedLatLng.longitude.toFixed(6)}`;

    if (lookupKey === pudoLookupCoordsRef.current) {
      return;
    }

    pudoLookupCoordsRef.current = lookupKey;

    const timeoutId = window.setTimeout(() => {
      lookupAndSelectClosestPudo(parsedLatLng.latitude, parsedLatLng.longitude);
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [orderForm.googleMapsLocation, selectedProduct]);

  function toggleCategory(category) {
    setOpenCategories((current) => ({
      ...current,
      [category]: current[category] === false,
    }));
  }

  function selectProductForOrder(productId) {
    const product = products.find((item) => item.id === productId);
    const minimumOrderQuantity = normalizeMinimumOrderQuantity(product?.minimumOrderQuantity);

    setSelectedProductId(productId);
    setSelectedImageIndex(0);
    setOrderForm((currentForm) => ({
      ...currentForm,
      quantity: String(minimumOrderQuantity),
    }));
    setOrderError("");
    setOrderMessage("");

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
      ...(name === "googleMapsLocation"
        ? {
            pudoLockerCode: "",
            pudoLockerName: "",
            pudoLockerAddress: "",
          }
        : {}),
    }));

    if (name === "googleMapsLocation") {
      setPudoLockers([]);
      setPudoMessage("");
      setPudoStatus("idle");
    }
  }

  function useCurrentLocation() {
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
          googleMapsLocation: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          pudoLockerCode: "",
          pudoLockerName: "",
          pudoLockerAddress: "",
        }));

        setPudoLockers([]);
        setPudoMessage("");
        setPudoStatus("idle");
        setLocationStatus("idle");

        lookupAndSelectClosestPudo(latitude, longitude);
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

  async function lookupAndSelectClosestPudo(latitude, longitude) {
    const requestId = Date.now();
    pudoLookupRequestRef.current = requestId;
    setPudoStatus("loading");
    setPudoMessage("");
    setPudoLockers([]);
    setOrderError("");
    setOrderMessage("");

    try {
      const queryParams = new URLSearchParams({
        lat: String(latitude),
        lng: String(longitude),
        limit: "5",
      });

      const response = await fetch(`/api/pudo-lockers?${queryParams.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const data = await readJsonResponse(response, "Could not load nearby PUDO lockers.");
      const lockers = Array.isArray(data.lockers) ? data.lockers : [];

      if (pudoLookupRequestRef.current !== requestId) {
        return;
      }

      setPudoLockers(lockers);
      setPudoMessage(
        data.message ||
          (lockers.length ? "Closest PUDO selected automatically." : "No nearby PUDO lockers found."),
      );
      setPudoStatus("ready");

      if (lockers.length > 0) {
        const closestLocker = lockers[0];

        setOrderForm((currentForm) => ({
          ...currentForm,
          pudoLockerCode: String(closestLocker.code || ""),
          pudoLockerName: String(closestLocker.name || ""),
          pudoLockerAddress: String(closestLocker.address || ""),
        }));
      } else {
        setOrderForm((currentForm) => ({
          ...currentForm,
          pudoLockerCode: "",
          pudoLockerName: "",
          pudoLockerAddress: "",
        }));
      }
    } catch (lookupError) {
      if (pudoLookupRequestRef.current !== requestId) {
        return;
      }

      setPudoStatus("error");
      setPudoMessage("");
      setOrderError(lookupError.message);
    }
  }

  function selectPudoLocker(locker) {
    setOrderForm((currentForm) => ({
      ...currentForm,
      pudoLockerCode: String(locker.code || ""),
      pudoLockerName: String(locker.name || ""),
      pudoLockerAddress: String(locker.address || ""),
    }));

    setOrderError("");
    setOrderMessage("");
  }

  function addSelectedProductToCart() {
    if (!selectedProduct) {
      setOrderError("Please select a product first.");
      return;
    }

    const parsedQuantity = Number.parseInt(String(orderForm.quantity || ""), 10);
    const minimumOrderQuantity = normalizeMinimumOrderQuantity(
      selectedProduct.minimumOrderQuantity,
    );

    if (!Number.isInteger(parsedQuantity) || parsedQuantity < minimumOrderQuantity) {
      setOrderError(
        `Minimum order quantity for ${selectedProduct.title} is ${minimumOrderQuantity}.`,
      );
      return;
    }

    if (parsedQuantity > Number(selectedProduct.stockAmount || 0)) {
      setOrderError("Requested quantity is higher than available stock.");
      return;
    }

    setCartItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.productId === selectedProduct.id);

      if (!existingItem) {
        return [
          ...currentItems,
          {
            productId: selectedProduct.id,
            quantity: parsedQuantity,
          },
        ];
      }

      const combinedQuantity = existingItem.quantity + parsedQuantity;

      if (combinedQuantity > Number(selectedProduct.stockAmount || 0)) {
        setOrderError(
          `Cart quantity for ${selectedProduct.title} cannot exceed available stock.`,
        );
        return currentItems;
      }

      return currentItems.map((item) =>
        item.productId === selectedProduct.id
          ? {
              ...item,
              quantity: combinedQuantity,
            }
          : item,
      );
    });

    setOrderError("");
    setOrderMessage(`${selectedProduct.title} added to cart.`);
  }

  function updateCartItemQuantity(productId, quantity) {
    const product = products.find((currentProduct) => currentProduct.id === productId);

    if (!product) {
      return;
    }

    const minimumOrderQuantity = normalizeMinimumOrderQuantity(product.minimumOrderQuantity);
    const nextQuantity = Number.parseInt(String(quantity || ""), 10);

    if (!Number.isInteger(nextQuantity)) {
      return;
    }

    if (nextQuantity < minimumOrderQuantity) {
      setOrderError(
        `Minimum order quantity for ${product.title} is ${minimumOrderQuantity}.`,
      );
      return;
    }

    if (nextQuantity > Number(product.stockAmount || 0)) {
      setOrderError(`Maximum stock for ${product.title} is ${product.stockAmount}.`);
      return;
    }

    setCartItems((currentItems) =>
      currentItems.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity: nextQuantity,
            }
          : item,
      ),
    );
    setOrderError("");
  }

  function removeCartItem(productId) {
    setCartItems((currentItems) => currentItems.filter((item) => item.productId !== productId));
  }

  function clearCart() {
    setCartItems([]);
  }

  async function submitOrder(event) {
    event.preventDefault();

    if (cartItems.length === 0) {
      setOrderError("Your cart is empty. Add at least one product before checkout.");
      return;
    }

    if (!orderForm.pudoLockerCode) {
      setOrderError("Please choose the closest PUDO locker before placing your order.");
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
          items: cartItems,
          locationText: orderForm.locationText,
          googleMapsLocation: orderForm.googleMapsLocation,
          pudoLockerCode: orderForm.pudoLockerCode,
          pudoLockerName: orderForm.pudoLockerName,
          pudoLockerAddress: orderForm.pudoLockerAddress,
        }),
      });

      const data = await readJsonResponse(response, "Could not place order.");
      setOrderMessage(
        `${
          data.message || "Order placed successfully."
        } Please send proof of payment so we can organize delivery.`,
      );
      setOrderForm(buildInitialOrderForm(selectedProductMinimumOrderQuantity));
      clearCart();
      setPudoLockers([]);
      setPudoMessage("");
      setPudoStatus("idle");
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
              <div className="flex flex-wrap items-center justify-between gap-3">
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

                {cartTotalQuantity > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      orderSectionRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }}
                    className="border border-emerald-300/40 bg-emerald-950/35 px-4 py-2 text-xs uppercase tracking-[0.22em] text-emerald-100 transition hover:border-emerald-200/70 hover:bg-emerald-900/50"
                  >
                    View Cart ({cartTotalQuantity})
                  </button>
                ) : null}
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
                          const colors = getProductList(product.colors);
                          const scents = getProductList(product.scents);
                          const hasSpecialOption = isSpecialOptionActive(product);
                          const specialPrice = getSpecialPrice(product);

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

                                {hasSpecialOption ? (
                                  <div className="absolute left-3 bottom-3 border border-amber-300/40 bg-amber-950/80 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-amber-100 backdrop-blur">
                                    {product.specialOption.label || "Special"}
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
                                    {specialPrice !== null ? (
                                      <>
                                        <div className="text-base text-amber-100">
                                          {formatPrice(specialPrice)}
                                        </div>
                                        <div className="text-xs text-white/35 line-through">
                                          {formatPrice(product.price)}
                                        </div>
                                      </>
                                    ) : (
                                      <div className="text-base text-white">
                                        {formatPrice(product.price)}
                                      </div>
                                    )}

                                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/50">
                                      {product.weight}
                                    </div>
                                  </div>
                                </div>

                                <p
                                  className="mt-4 text-base leading-7 text-white/72"
                                  style={{ fontFamily: '"Alegreya", Georgia, serif' }}
                                >
                                  {shortenDescription(product.description)}
                                </p>

                                {colors.length > 0 || scents.length > 0 ? (
                                  <div className="mt-5 grid gap-3">
                                    {colors.length > 0 ? (
                                      <div>
                                        <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">
                                          Colors
                                        </div>

                                        <div className="mt-2 flex flex-wrap gap-2">
                                          {colors.map((color) => (
                                            <span
                                              key={`${product.id}-color-${color}`}
                                              className="border border-white/10 bg-black px-3 py-1 text-xs text-white/65"
                                            >
                                              {color}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    ) : null}

                                    {scents.length > 0 ? (
                                      <div>
                                        <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">
                                          Scents
                                        </div>

                                        <div className="mt-2 flex flex-wrap gap-2">
                                          {scents.map((scent) => (
                                            <span
                                              key={`${product.id}-scent-${scent}`}
                                              className="border border-white/10 bg-black px-3 py-1 text-xs text-white/65"
                                            >
                                              {scent}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}

                                {hasSpecialOption ? (
                                  <div className="mt-5 border border-amber-300/25 bg-amber-950/20 p-3 text-sm leading-6 text-amber-100">
                                    <strong className="block text-xs uppercase tracking-[0.2em]">
                                      {product.specialOption.label || "Special Option"}
                                    </strong>
                                    <span className="mt-1 block text-amber-100/75">
                                      Available from {formatDisplayDate(product.specialOption.startDate)} to{" "}
                                      {formatDisplayDate(product.specialOption.endDate)}.
                                    </span>
                                    {Number(product.specialOption.discountAmount) > 0 ? (
                                      <span className="mt-1 block font-semibold text-amber-100">
                                        Save {formatPrice(product.specialOption.discountAmount)}
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}

                                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                                  <div className="grid gap-1">
                                    <div className="text-sm uppercase tracking-[0.2em] text-white/60">
                                      {formatStockAmount(product.stockAmount)}
                                    </div>
                                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">
                                      Min buy {normalizeMinimumOrderQuantity(product.minimumOrderQuantity)}
                                    </div>
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
                                  className="mt-4 w-full border border-white/12 bg-black px-4 py-3 text-xs uppercase tracking-[0.2em] text-white transition hover:border-white/35 hover:bg-[#1a1a1b] disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                  {isOutOfStock ? "Out of stock" : "Add to cart"}
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

          {selectedProduct ? (
            <section
              ref={orderSectionRef}
              className="mt-8 border border-white/10 bg-[#151516] p-5 sm:p-6"
            >
              <div className="border-b border-white/10 pb-5">
                <p
                  className="text-sm uppercase tracking-[0.32em] text-white/55"
                  style={{ fontFamily: '"Cinzel", Georgia, serif' }}
                >
                  Place Order
                </p>

                <h2
                  className="mt-3 text-3xl leading-none text-white sm:text-4xl"
                  style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                >
                  {selectedProduct.title}
                </h2>

                <p
                  className="mt-4 max-w-2xl text-base leading-7 text-white/58"
                  style={{ fontFamily: '"Alegreya", Georgia, serif' }}
                >
                  Add products to cart, confirm delivery location, then place the order. Proof of
                  payment must be sent before we organize delivery.
                </p>
              </div>

              {orderError ? (
                <div className="mt-5 border border-red-400/30 bg-red-950/25 p-4 text-red-100">
                  {orderError}
                </div>
              ) : null}

              {orderMessage ? (
                <div className="mt-5 border border-emerald-400/30 bg-emerald-950/25 p-4 text-emerald-100">
                  {orderMessage}
                </div>
              ) : null}

              <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="border border-white/10 bg-[#101011] p-4">
                  <div className="relative aspect-[4/3] bg-black">
                    {selectedPreviewImage ? (
                      <img
                        src={selectedPreviewImage}
                        alt={`${selectedProduct.title} preview`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-white/35">
                        No image
                      </div>
                    )}

                    {selectedProductHasSpecialOption ? (
                      <div className="absolute left-3 bottom-3 border border-amber-300/40 bg-amber-950/80 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-amber-100 backdrop-blur">
                        {selectedProduct.specialOption.label || "Special"}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 border-t border-white/10 pt-4 text-sm uppercase tracking-[0.2em] text-white/60">
                    {selectedProductSpecialPrice !== null ? (
                      <>
                        <span className="text-amber-100">
                          {formatPrice(selectedProductSpecialPrice)}
                        </span>{" "}
                        <span className="text-white/35 line-through">
                          {formatPrice(selectedProduct.price)}
                        </span>
                      </>
                    ) : (
                      formatPrice(selectedProduct.price)
                    )}{" "}
                    • {selectedProduct.weight} • {selectedProduct.category || "Uncategorised"}
                  </div>

                  <p
                    className="mt-3 text-base leading-7 text-white/72"
                    style={{ fontFamily: '"Alegreya", Georgia, serif' }}
                  >
                    {selectedProduct.description}
                  </p>

                  {selectedProductColors.length > 0 || selectedProductScents.length > 0 ? (
                    <div className="mt-4 grid gap-3 border-t border-white/10 pt-4">
                      {selectedProductColors.length > 0 ? (
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">
                            Colors
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            {selectedProductColors.map((color) => (
                              <span
                                key={`selected-color-${color}`}
                                className="border border-white/10 bg-black px-3 py-1 text-xs text-white/65"
                              >
                                {color}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {selectedProductScents.length > 0 ? (
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">
                            Scents
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            {selectedProductScents.map((scent) => (
                              <span
                                key={`selected-scent-${scent}`}
                                className="border border-white/10 bg-black px-3 py-1 text-xs text-white/65"
                              >
                                {scent}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {selectedProductHasSpecialOption ? (
                    <div className="mt-4 border border-amber-300/25 bg-amber-950/20 p-3 text-sm leading-6 text-amber-100">
                      <strong className="block text-xs uppercase tracking-[0.2em]">
                        {selectedProduct.specialOption.label || "Special Option"}
                      </strong>
                      <span className="mt-1 block text-amber-100/75">
                        Available from {formatDisplayDate(selectedProduct.specialOption.startDate)} to{" "}
                        {formatDisplayDate(selectedProduct.specialOption.endDate)}.
                      </span>
                      {Number(selectedProduct.specialOption.discountAmount) > 0 ? (
                        <span className="mt-1 block font-semibold text-amber-100">
                          Save {formatPrice(selectedProduct.specialOption.discountAmount)}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <form
                  className="grid gap-4 border border-white/10 bg-[#101011] p-4"
                  onSubmit={submitOrder}
                >
                  <label className="grid gap-2 text-sm text-white/70">
                    <span className="text-xs uppercase tracking-[0.2em] text-white/50">
                      Amount / Quantity
                    </span>
                    <input
                      type="number"
                      name="quantity"
                      min={selectedProductMinimumOrderQuantity}
                      step="1"
                      value={orderForm.quantity}
                      onChange={updateOrderField}
                      required
                      className="border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-white/45"
                    />
                    <span className="text-xs text-white/50">
                      Minimum for this product: {selectedProductMinimumOrderQuantity}
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={addSelectedProductToCart}
                    disabled={!selectedProduct || orderStatus === "saving"}
                    className="border border-white/10 bg-black px-4 py-3 text-xs uppercase tracking-[0.2em] text-white transition hover:border-white/35 hover:bg-[#1a1a1b] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add Selected Product To Cart
                  </button>

                  <div className="rounded-xl border border-white/10 bg-black p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                          Basket
                        </div>
                        <div className="mt-1 text-sm text-white/70">
                          {cartTotalQuantity} item{cartTotalQuantity === 1 ? "" : "s"} selected
                        </div>
                      </div>
                      {cartItems.length > 0 ? (
                        <button
                          type="button"
                          onClick={clearCart}
                          className="text-[10px] uppercase tracking-[0.18em] text-white/65 underline-offset-4 hover:text-white hover:underline"
                        >
                          Clear basket
                        </button>
                      ) : null}
                    </div>

                    {cartLines.length === 0 ? (
                      <p className="mt-3 text-sm text-white/55">Your basket is empty.</p>
                    ) : (
                      <div className="mt-3 grid gap-3">
                        {cartLines.map((line) => {
                          const minQty = normalizeMinimumOrderQuantity(
                            line.product.minimumOrderQuantity,
                          );
                          const maxQty = Math.max(minQty, Number(line.product.stockAmount || 0));

                          return (
                            <div
                              key={`cart-${line.productId}`}
                              className="grid gap-2 rounded-lg border border-white/10 bg-[#101011] p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-white">
                                    {line.product.title}
                                  </div>
                                  <div className="text-xs text-white/55">
                                    {formatPrice(line.unitPrice)} each
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeCartItem(line.productId)}
                                  className="text-[10px] uppercase tracking-[0.16em] text-red-200/80 underline-offset-4 hover:text-red-100 hover:underline"
                                >
                                  Remove
                                </button>
                              </div>

                              <div className="flex items-center gap-3">
                                <input
                                  type="number"
                                  min={minQty}
                                  max={maxQty}
                                  step="1"
                                  value={line.quantity}
                                  onChange={(event) =>
                                    updateCartItemQuantity(line.productId, event.target.value)
                                  }
                                  className="w-24 rounded-md border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-white/45"
                                />
                                <span className="text-xs text-white/50">
                                  Line total: {formatPrice(line.unitPrice * line.quantity)}
                                </span>
                              </div>
                            </div>
                          );
                        })}

                        <div className="rounded-lg border border-emerald-300/30 bg-emerald-950/20 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-emerald-100/80">
                            <span>{cartTotalQuantity} item{cartTotalQuantity === 1 ? "" : "s"}</span>
                            <span className="text-lg font-semibold text-emerald-100">
                              Total: {formatPrice(cartTotalPrice)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 rounded-xl border border-[#d8d8d8] bg-[#f7f7f7] p-4 text-sm leading-6 text-[#111111]">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#333333]">
                        Payment Details
                      </div>
                      <div className="mt-2">
                        <strong>Bank:</strong> Capitec
                        <br />
                        <strong>Account holder:</strong> Mrs CM Badenhorst
                        <br />
                        <strong>Account type:</strong> Savings account
                        <br />
                        <strong>Account number:</strong> 1989018740
                        <br />
                        <strong>Branch code:</strong> 470010
                        <br />
                        <strong>Reference:</strong> Your name / order number
                      </div>
                    </div>

                    <div className="mt-3 rounded-lg border border-amber-300/30 bg-amber-950/20 p-3 text-xs leading-5 text-amber-100">
                      Send proof of payment to the email linked to this website after payment.
                      Delivery is arranged once proof is received.
                    </div>
                  </div>

                  <label className="grid gap-2 text-sm text-white/70">
                    <span className="text-xs uppercase tracking-[0.2em] text-white/50">
                      Location Text
                    </span>
                    <textarea
                      name="locationText"
                      value={orderForm.locationText}
                      onChange={updateOrderField}
                      rows={4}
                      placeholder="Street address, suburb, city, delivery note"
                      className="resize-none border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-white/45"
                    />
                  </label>

                  <label className="grid gap-2 text-sm text-white/70">
                    <span className="text-xs uppercase tracking-[0.2em] text-white/50">
                      Customer Coordinates
                    </span>
                    <input
                      type="text"
                      name="googleMapsLocation"
                      value={orderForm.googleMapsLocation}
                      onChange={updateOrderField}
                      placeholder="Click the map or use current location"
                      className="border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-white/45"
                    />
                  </label>

                  <div className="grid gap-2 text-sm text-white/70">
                    <span className="text-xs uppercase tracking-[0.2em] text-white/50">
                      Pin Your Location
                    </span>

                    <div
                      ref={pinMapRef}
                      className="h-64 w-full border border-white/10 bg-black"
                    />

                    <p className="text-xs leading-5 text-white/45">
                      Tap/click the map to drop a pin. PUDO lockers will be sorted from closest to furthest.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={useCurrentLocation}
                      disabled={locationStatus === "locating"}
                      className="border border-white/10 bg-black px-4 py-3 text-xs uppercase tracking-[0.2em] text-white transition hover:border-white/35 hover:bg-[#1a1a1b] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {locationStatus === "locating" ? "Locating..." : "Use My Current Location"}
                    </button>

                    {googleMapsSearchUrl ? (
                      <a
                        href={googleMapsSearchUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs uppercase tracking-[0.2em] text-white/60 underline-offset-4 hover:text-white hover:underline"
                      >
                        Open Location
                      </a>
                    ) : null}

                    {locationSearchUrl ? (
                      <a
                        href={locationSearchUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs uppercase tracking-[0.2em] text-white/60 underline-offset-4 hover:text-white hover:underline"
                      >
                        Search Text Location
                      </a>
                    ) : null}
                  </div>

                  {pudoStatus === "loading" ? (
                    <div className="border border-white/10 bg-black p-4 text-sm text-white/60">
                      Finding closest PUDO locker...
                    </div>
                  ) : null}

                  {pudoMessage ? (
                    <div className="border border-white/10 bg-black p-4 text-sm text-white/60">
                      {pudoMessage}
                    </div>
                  ) : null}

                  {pudoLockers.length > 0 ? (
                    <div className="grid gap-3">
                      <span className="text-xs uppercase tracking-[0.2em] text-white/50">
                        Choose PUDO Locker
                      </span>

                      {pudoLockers.map((locker) => {
                        const isSelected = orderForm.pudoLockerCode === locker.code;

                        return (
                          <button
                            key={`${locker.code}-${locker.latitude}-${locker.longitude}`}
                            type="button"
                            onClick={() => selectPudoLocker(locker)}
                            className={`border p-4 text-left text-sm transition ${
                              isSelected
                                ? "border-white bg-white text-black"
                                : "border-white/10 bg-black text-white/70 hover:border-white/35"
                            }`}
                          >
                            <strong className="block">{locker.name}</strong>

                            {locker.address ? (
                              <span className="mt-1 block">{locker.address}</span>
                            ) : null}

                            {locker.distanceKm !== null ? (
                              <span className="mt-2 block text-xs uppercase tracking-[0.18em] opacity-70">
                                {locker.distanceKm} km away
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  {orderForm.pudoLockerCode ? (
                    <div className="border border-emerald-400/30 bg-emerald-950/25 p-4 text-sm text-emerald-100">
                      Selected PUDO: {orderForm.pudoLockerName}
                    </div>
                  ) : null}

                  <div className="border border-amber-300/30 bg-amber-950/20 p-4 text-sm text-amber-100">
                    Important: send your proof of payment after placing the order. Delivery is
                    only organized once payment proof has been received and confirmed.
                  </div>

                  <button
                    type="submit"
                    disabled={orderStatus === "saving"}
                    className="border border-white bg-white px-6 py-4 text-center text-sm uppercase tracking-[0.2em] text-black transition hover:bg-[#d9d9d9] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {orderStatus === "saving" ? "Placing Order..." : "Place Cart Order"}
                  </button>
                </form>
              </div>
            </section>
          ) : null}

          {cartTotalQuantity > 0 ? (
            <button
              type="button"
              onClick={() => {
                orderSectionRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }}
              className="fixed bottom-5 right-5 z-40 border border-emerald-300/50 bg-emerald-950/90 px-4 py-3 text-xs uppercase tracking-[0.2em] text-emerald-100 shadow-lg shadow-black/40 transition hover:border-emerald-200 hover:bg-emerald-900"
            >
              View Cart ({cartTotalQuantity})
            </button>
          ) : null}

          <div className="mt-14">
            <Footer />
          </div>
        </div>
      </main>
    </div>
  );
}
