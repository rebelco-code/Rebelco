import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Footer from "../components/footer";
import Navbar from "../components/navbar";
import { readJsonResponse } from "../lib/api";
import { formatPrice, formatStockAmount } from "../lib/formatters";

const PRODUCTS_PAGE_VARIANTS = {
  rebelco: {
    companyKey: "rebelco",
    eyebrow: "Rebelco Products",
    heading: "Current catalogue",
    description:
      "Browse the Rebelco collection by category. Each collection is grouped together so soaps, salves, balms, and other products are easier to explore.",
    emptyProductsMessage: "No products have been added yet.",
  },
  "company-2": {
    companyKey: "company-2",
    eyebrow: "Rebelco x PET",
    heading: "PET treats, bones, and chew catalogue",
    description:
      "Browse PET-focused products by category, including treats, chew options, and related items.",
    emptyProductsMessage: "No PET products have been added yet.",
  },
};
const DEFAULT_PRODUCTS_PAGE_VARIANT_KEY = "rebelco";

function normalizeMinimumOrderQuantity(value) {
  const parsedQuantity = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1;
}

function buildInitialOrderForm(minimumOrderQuantity = 1) {
  return {
    quantity: String(normalizeMinimumOrderQuantity(minimumOrderQuantity)),
    customerEmail: "",
    locationText: "",
    googleMapsLocation: "",
    pudoLockerCode: "",
    pudoLockerName: "",
    pudoLockerAddress: "",
  };
}

function buildOrdersHistoryHref(customerEmail) {
  const normalizedCustomerEmail = String(customerEmail || "").trim();

  if (!normalizedCustomerEmail) {
    return "/orders";
  }

  return `/orders?customerEmail=${encodeURIComponent(normalizedCustomerEmail)}`;
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

function cleanPromoCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-_]/g, "")
    .slice(0, 40);
}

function getPricingDetails(product) {
  const basePrice = Number(product?.price || 0);
  const specialPrice = getSpecialPrice(product);
  const effectivePrice = Number(product?.effectivePrice);
  const displayPrice = Number.isFinite(effectivePrice)
    ? effectivePrice
    : specialPrice !== null
      ? specialPrice
      : basePrice;

  return {
    basePrice,
    specialPrice,
    displayPrice,
    hasDiscount: displayPrice < basePrice,
  };
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
  return getPricingDetails(product).displayPrice;
}

function getCheckoutPriceForProduct(product, appliedPromoPricesByProductId) {
  const pricing = getPricingDetails(product);
  const appliedPromoPrice = Number(
    appliedPromoPricesByProductId?.[String(product?.id || "").trim()],
  );
  const candidatePrices = [pricing.displayPrice];

  if (Number.isFinite(appliedPromoPrice) && appliedPromoPrice >= 0) {
    candidatePrices.push(appliedPromoPrice);
  }

  return Math.round(Math.min(...candidatePrices) * 100) / 100;
}

function safeTime(value) {
  const parsedTime = Date.parse(String(value || ""));
  return Number.isFinite(parsedTime) ? parsedTime : 0;
}

function postFormToUrl(action, fields) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  form.style.display = "none";

  Object.entries(fields || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = String(value);
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}

let leafletAssetsPromise;

async function loadLeafletAssets() {
  if (!leafletAssetsPromise) {
    leafletAssetsPromise = Promise.all([
      import("leaflet"),
      import("leaflet/dist/leaflet.css"),
      import("leaflet/dist/images/marker-icon-2x.png"),
      import("leaflet/dist/images/marker-icon.png"),
      import("leaflet/dist/images/marker-shadow.png"),
    ]).then(([leafletModule, , markerIcon2xModule, markerIconModule, markerShadowModule]) => {
      const Leaflet = leafletModule.default;

      Leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: markerIcon2xModule.default,
        iconUrl: markerIconModule.default,
        shadowUrl: markerShadowModule.default,
      });

      return Leaflet;
    });
  }

  return leafletAssetsPromise;
}

function ProductsPageBase({ pageVariantKey = DEFAULT_PRODUCTS_PAGE_VARIANT_KEY }) {
  const pageVariant =
    PRODUCTS_PAGE_VARIANTS[pageVariantKey] ||
    PRODUCTS_PAGE_VARIANTS[DEFAULT_PRODUCTS_PAGE_VARIANT_KEY];
  const companyKey = pageVariant.companyKey;
  const orderSectionRef = useRef(null);
  const pinMapRef = useRef(null);
  const leafletRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const mapMarkerRef = useRef(null);
  const pudoLookupRequestRef = useRef(0);
  const pudoLookupCoordsRef = useRef("");

  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("latest");
  const [openCategories, setOpenCategories] = useState({});
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [orderForm, setOrderForm] = useState(() => buildInitialOrderForm());
  const [cartItems, setCartItems] = useState([]);
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromoCode, setAppliedPromoCode] = useState("");
  const [appliedPromoPricesByProductId, setAppliedPromoPricesByProductId] = useState({});
  const [isTrolleyOpen, setIsTrolleyOpen] = useState(false);
  const [orderStatus, setOrderStatus] = useState("idle");
  const [locationStatus, setLocationStatus] = useState("idle");
  const [pudoStatus, setPudoStatus] = useState("idle");
  const [pudoLockers, setPudoLockers] = useState([]);
  const [pudoMessage, setPudoMessage] = useState("");
  const [orderMessage, setOrderMessage] = useState("");
  const [orderError, setOrderError] = useState("");
  const [mapStatus, setMapStatus] = useState("idle");

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
    const query = searchQuery.trim().toLowerCase();

    const filtered = products.filter((product) => {
      if (selectedCategory !== "all" && product.category !== selectedCategory) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchableText = [
        product.title,
        product.description,
        product.category,
        product.weight,
        ...(Array.isArray(product.colors) ? product.colors : []),
        ...(Array.isArray(product.scents) ? product.scents : []),
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      return searchableText.includes(query);
    });

    const sorted = [...filtered];

    if (sortBy === "price-asc") {
      sorted.sort((a, b) => getEffectiveProductPrice(a) - getEffectiveProductPrice(b));
      return sorted;
    }

    if (sortBy === "price-desc") {
      sorted.sort((a, b) => getEffectiveProductPrice(b) - getEffectiveProductPrice(a));
      return sorted;
    }

    if (sortBy === "name-asc") {
      sorted.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
      return sorted;
    }

    sorted.sort((a, b) => safeTime(b.createdAt) - safeTime(a.createdAt));
    return sorted;
  }, [products, searchQuery, selectedCategory, sortBy]);

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

  const normalizedPromoCodeInput = useMemo(() => cleanPromoCode(promoCodeInput), [promoCodeInput]);

  const selectedProductHasAppliedPromo = useMemo(
    () => Boolean(appliedPromoPricesByProductId[String(selectedProduct?.id || "").trim()]),
    [appliedPromoPricesByProductId, selectedProduct],
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
          appliedPromo: Boolean(appliedPromoPricesByProductId[String(product.id || "").trim()]),
          baseUnitPrice: getEffectiveProductPrice(product),
          unitPrice: getCheckoutPriceForProduct(product, appliedPromoPricesByProductId),
        };
      })
      .filter(Boolean);
  }, [appliedPromoPricesByProductId, cartItems, products]);

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

  const appliedPromoSavings = useMemo(() => {
    return (
      Math.round(
        cartLines.reduce((sum, line) => {
          const baseUnitPrice = Number(line.baseUnitPrice || 0);
          const discountedUnitPrice = Number(line.unitPrice || 0);
          const quantity = Number(line.quantity || 0);

          if (
            !Number.isFinite(baseUnitPrice) ||
            !Number.isFinite(discountedUnitPrice) ||
            !Number.isFinite(quantity) ||
            quantity < 1
          ) {
            return sum;
          }

          return sum + Math.max(0, baseUnitPrice - discountedUnitPrice) * quantity;
        }, 0) * 100,
      ) / 100
    );
  }, [cartLines]);

  const canSubmitOrder =
    cartItems.length > 0 &&
    Boolean(orderForm.pudoLockerCode) &&
    Boolean(String(orderForm.customerEmail || "").trim());

  const submitOrderLabel = useMemo(() => {
    if (orderStatus === "saving") {
      return "Redirecting To PayFast...";
    }

    if (cartItems.length === 0) {
      return "Add Products To Cart First";
    }

    if (!orderForm.pudoLockerCode) {
      return "Select Delivery Locker First";
    }

    if (!String(orderForm.customerEmail || "").trim()) {
      return "Add Email First";
    }

    return "Pay With PayFast";
  }, [cartItems.length, orderForm.customerEmail, orderForm.pudoLockerCode, orderStatus]);

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
    if (selectedImageIndex < selectedProductImages.length) {
      return;
    }

    setSelectedImageIndex(0);
  }, [selectedImageIndex, selectedProductImages.length]);

  useEffect(() => {
    if (!appliedPromoCode) {
      return;
    }

    const hasEligibleProduct = cartLines.some((line) => line.appliedPromo);
    const selectedProductStillMatches = selectedProductHasAppliedPromo;

    if (!hasEligibleProduct && !selectedProductStillMatches) {
      setAppliedPromoCode("");
      setAppliedPromoPricesByProductId({});
      setOrderMessage("Promo code removed because it no longer applies to the cart.");
    }
  }, [appliedPromoCode, cartLines, selectedProductHasAppliedPromo]);

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      try {
        const queryParams = new URLSearchParams({ company: companyKey });
        const response = await fetch(`/api/products?${queryParams.toString()}`, {
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
  }, [companyKey]);

  useEffect(() => {
    if (!selectedProduct || !pinMapRef.current || mapInstanceRef.current) {
      return undefined;
    }

    let isCancelled = false;

    setMapStatus("loading");

    loadLeafletAssets()
      .then((Leaflet) => {
        if (isCancelled || !pinMapRef.current || mapInstanceRef.current) {
          return;
        }

        leafletRef.current = Leaflet;

        const initialCenter = [-26.2041, 28.0473];
        const mapInstance = Leaflet.map(pinMapRef.current, {
          center: initialCenter,
          zoom: 12,
          zoomControl: true,
        });

        Leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
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
            mapMarkerRef.current = Leaflet.marker([lat, lng]).addTo(mapInstance);
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
        setMapStatus("ready");
      })
      .catch(() => {
        if (!isCancelled) {
          setMapStatus("error");
          setOrderError("The location map could not load. You can still enter coordinates manually.");
        }
      });

    return () => {
      isCancelled = true;
      const mapInstance = mapInstanceRef.current;

      if (mapInstance) {
        mapInstance.off();
        mapInstance.remove();
      }

      mapInstanceRef.current = null;
      mapMarkerRef.current = null;
    };
  }, [selectedProduct]);

  useEffect(() => {
    const mapInstance = mapInstanceRef.current;

    if (!mapInstance) {
      return;
    }

    const Leaflet = leafletRef.current;

    if (!Leaflet) {
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
      mapMarkerRef.current = Leaflet.marker([latitude, longitude]).addTo(mapInstance);
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
    const requestId = pudoLookupRequestRef.current + 1;
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

  async function applyPromoCode() {
    if (!normalizedPromoCodeInput) {
      setOrderError("Enter a promo code first.");
      setOrderMessage("");
      return;
    }

    try {
      const response = await fetch("/api/promo-code-validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          promoCode: normalizedPromoCodeInput,
          company: companyKey,
          productIds: cartItems.map((item) => item.productId),
          selectedProductId: selectedProduct?.id || "",
        }),
      });
      const data = await readJsonResponse(response, "Could not validate promo code.");
      const applicableProducts = Array.isArray(data.applicableProducts)
        ? data.applicableProducts
        : [];

      if (!data.valid || applicableProducts.length === 0) {
        setAppliedPromoCode("");
        setAppliedPromoPricesByProductId({});
        setOrderError("That promo code does not apply to the current cart.");
        setOrderMessage("");
        return;
      }

      const nextPromoPricesByProductId = Object.fromEntries(
        applicableProducts.map((product) => [
          String(product.productId || "").trim(),
          Number(product.unitPrice || 0),
        ]),
      );
      const hasCartDiscount = applicableProducts.some((product) =>
        cartItems.some((item) => item.productId === product.productId),
      );

      setAppliedPromoCode(cleanPromoCode(data.promoCode || normalizedPromoCodeInput));
      setAppliedPromoPricesByProductId(nextPromoPricesByProductId);
      setPromoCodeInput(cleanPromoCode(data.promoCode || normalizedPromoCodeInput));
      setOrderError("");
      setOrderMessage(
        hasCartDiscount
          ? `Promo code ${normalizedPromoCodeInput} applied.`
          : `Promo code ${normalizedPromoCodeInput} saved and will apply when this product is added to the cart.`,
      );
    } catch (applyError) {
      setAppliedPromoCode("");
      setAppliedPromoPricesByProductId({});
      setOrderError(applyError.message);
      setOrderMessage("");
    }
  }

  function removePromoCode() {
    setAppliedPromoCode("");
    setAppliedPromoPricesByProductId({});
    setPromoCodeInput("");
    setOrderError("");
    setOrderMessage("Promo code removed.");
  }

  function openBasket() {
    if (!selectedProduct && products.length > 0) {
      selectProductForOrder(products[0].id);
      return;
    }

    orderSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function toggleTrolley() {
    setIsTrolleyOpen((current) => !current);
  }

  function openBasketFromTrolley() {
    setIsTrolleyOpen(false);
    openBasket();
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

    if (!String(orderForm.customerEmail || "").trim()) {
      setOrderError("Please enter the customer email before placing your order.");
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
          promoCode: appliedPromoCode,
          customerEmail: orderForm.customerEmail,
          locationText: orderForm.locationText,
          googleMapsLocation: orderForm.googleMapsLocation,
          pudoLockerCode: orderForm.pudoLockerCode,
          pudoLockerName: orderForm.pudoLockerName,
          pudoLockerAddress: orderForm.pudoLockerAddress,
        }),
      });

      const data = await readJsonResponse(response, "Could not start checkout.");
      const paymentUrl = String(data.paymentUrl || "").trim();
      const fields = data.fields && typeof data.fields === "object" ? data.fields : null;

      if (!paymentUrl || !fields) {
        throw new Error("PayFast checkout response was incomplete.");
      }

      setOrderMessage("Redirecting to PayFast...");
      postFormToUrl(paymentUrl, fields);
    } catch (submitError) {
      setOrderError(submitError.message);
    } finally {
      setOrderStatus("idle");
    }
  }

  return (
    <div className="theme-page theme-shell">
      <Navbar className="border-b border-[var(--theme-border)] bg-white/95 backdrop-blur" />

      <main className="px-4 py-10 sm:px-6 sm:py-14 lg:px-12 lg:py-18">
        <div className="mx-auto max-w-7xl">
          <section className="theme-card p-5 sm:p-8 lg:p-10">
            <p className="theme-kicker text-sm">{pageVariant.eyebrow}</p>

            <h1
              className="theme-title mt-4 max-w-3xl text-4xl leading-[0.95] sm:text-5xl lg:text-6xl"
            >
              {pageVariant.heading}
            </h1>

            <p
              className="theme-copy mt-5 max-w-2xl text-base leading-7"
              style={{ fontFamily: '"Manrope", sans-serif' }}
            >
              {pageVariant.description}
            </p>
          </section>

          {status === "loading" ? (
            <div className="theme-card theme-copy mt-8 p-6">
              Loading products...
            </div>
          ) : null}

          {status === "error" ? (
            <div className="mt-8 border border-red-400/30 bg-red-950/25 p-6 text-red-100">
              {error}
            </div>
          ) : null}

          {status === "ready" && products.length === 0 ? (
            <div className="theme-card theme-copy mt-8 p-6">
              {pageVariant.emptyProductsMessage}
            </div>
          ) : null}

          {products.length > 0 ? (
            <section className="theme-card mt-8 p-4 sm:p-5">
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="theme-kicker text-xs">
                    Showing {filteredProducts.length} of {products.length} products
                  </div>

                  {cartTotalQuantity > 0 ? (
                    <button
                      type="button"
                      onClick={openBasket}
                      className="theme-button rounded-full px-4 py-2 text-xs uppercase tracking-[0.22em]"
                    >
                      View Cart ({cartTotalQuantity})
                    </button>
                  ) : null}
                </div>

                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by product name, description, category, scent, or color"
                    className="theme-input w-full px-4 py-3 text-sm transition"
                  />

                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value)}
                    className="theme-input w-full px-4 py-3 text-sm transition"
                  >
                    <option value="latest">Sort: Latest</option>
                    <option value="name-asc">Sort: Name A-Z</option>
                    <option value="price-asc">Sort: Price Low-High</option>
                    <option value="price-desc">Sort: Price High-Low</option>
                  </select>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("all")}
                    className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.22em] transition ${
                      selectedCategory === "all"
                        ? "border-[var(--theme-accent-strong)] bg-[var(--theme-accent-strong)] text-white"
                        : "border-[var(--theme-border)] bg-white/70 text-[var(--theme-text-soft)] hover:border-[var(--theme-border-strong)] hover:text-[var(--theme-text)]"
                    }`}
                  >
                    All
                  </button>

                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setSelectedCategory(category)}
                      className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.22em] transition ${
                        selectedCategory === category
                          ? "border-[var(--theme-accent-strong)] bg-[var(--theme-accent-strong)] text-white"
                          : "border-[var(--theme-border)] bg-white/70 text-[var(--theme-text-soft)] hover:border-[var(--theme-border-strong)] hover:text-[var(--theme-text)]"
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
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
                    className="theme-card overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleCategory(group.category)}
                      className="flex w-full items-center justify-between gap-5 border-b border-[var(--theme-border)] p-5 text-left transition hover:bg-white/60 sm:p-6"
                    >
                      <div className="min-w-0">
                        <p className="theme-kicker text-xs opacity-80">
                          Collection
                        </p>

                        <h2
                          className="theme-title mt-2 break-words text-4xl leading-none sm:text-5xl"
                        >
                          {group.category}
                        </h2>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <div className="rounded-full border border-[var(--theme-border)] bg-white/80 px-3 py-1 text-xs uppercase tracking-[0.18em] text-[var(--theme-text-soft)]">
                          {group.products.length} items
                        </div>

                        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--theme-border)] bg-white/80 text-2xl text-[var(--theme-text-soft)]">
                          {isOpen ? "−" : "+"}
                        </span>
                      </div>
                    </button>

                    {isOpen ? (
                      <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
                        {group.products.map((product) => {
                          const isOutOfStock = Number(product.stockAmount) <= 0;
                          const isSelectedProduct = selectedProductId === product.id;
                          const productImages = getProductImages(product);
                          const mainImage = productImages[0];
                          const colors = getProductList(product.colors);
                          const scents = getProductList(product.scents);
                          const pricing = getPricingDetails(product);
                          const hasSpecialOption = isSpecialOptionActive(product);

                          return (
                            <article
                              key={product.id}
                              className={`products-display-surface overflow-hidden border bg-[rgba(255,250,242,0.92)] transition ${
                                isSelectedProduct
                                  ? "border-[var(--theme-border-strong)] shadow-[0_0_0_1px_rgba(182,152,98,0.25)]"
                                  : "border-[var(--theme-border)]"
                              }`}
                            >
                              <div className="relative aspect-[4/3] bg-[var(--theme-surface-strong)]">
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
                                  <div className="flex h-full w-full items-center justify-center text-sm text-[var(--theme-text-soft)]">
                                    No image
                                  </div>
                                )}

                                {isOutOfStock ? (
                                  <div className="absolute left-3 top-3 rounded-full border border-[var(--theme-border)] bg-[rgba(255,250,242,0.88)] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[var(--theme-text)] backdrop-blur">
                                    Out of stock
                                  </div>
                                ) : null}

                                {hasSpecialOption ? (
                                  <div className="absolute left-3 bottom-3 border border-amber-300/40 bg-amber-950/80 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-amber-100 backdrop-blur">
                                    {product.specialOption.label || "Special"}
                                  </div>
                                ) : null}

                                {productImages.length > 1 ? (
                                  <div className="absolute right-3 top-3 rounded-full border border-[var(--theme-border)] bg-[rgba(255,250,242,0.88)] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-black backdrop-blur">
                                    {productImages.length} photos
                                  </div>
                                ) : null}
                              </div>

                              {productImages.length > 1 ? (
                                <div className="border-b border-[var(--theme-border)] p-3">
                                  <div className="flex gap-2 overflow-x-auto pb-1">
                                    {productImages.map((imageUrl, index) => (
                                      <img
                                        key={`${product.id}-${imageUrl}-${index}`}
                                        src={imageUrl}
                                        alt={`${product.title} thumbnail ${index + 1}`}
                                        className="h-16 w-16 shrink-0 rounded-xl border border-[var(--theme-border)] object-cover"
                                        loading="lazy"
                                      />
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              <div className="p-5 sm:p-6">
                                <div className="flex items-start justify-between gap-4">
                                  <h3
                                    className="theme-title min-w-0 break-words text-2xl leading-none sm:text-3xl"
                                  >
                                    {product.title}
                                  </h3>

                                  <div className="shrink-0 text-right">
                                    {pricing.hasDiscount ? (
                                      <>
                                        <div className="text-base text-amber-100">
                                          {formatPrice(pricing.displayPrice)}
                                        </div>
                                        <div className="text-xs text-[var(--theme-text-soft)] line-through opacity-80">
                                          {formatPrice(pricing.basePrice)}
                                        </div>
                                      </>
                                    ) : (
                                      <div className="text-base text-[var(--theme-text)]">
                                        {formatPrice(pricing.basePrice)}
                                      </div>
                                    )}

                                    <div className="theme-kicker mt-1 text-xs opacity-80">
                                      {product.weight}
                                    </div>
                                  </div>
                                </div>

                                <p
                                  className="theme-copy mt-4 text-base leading-7"
                                  style={{ fontFamily: '"Manrope", sans-serif' }}
                                >
                                  {shortenDescription(product.description)}
                                </p>

                                {colors.length > 0 || scents.length > 0 ? (
                                  <div className="mt-5 grid gap-3">
                                    {colors.length > 0 ? (
                                      <div>
                                        <div className="theme-kicker text-[10px] opacity-80">
                                          Colors
                                        </div>

                                        <div className="mt-2 flex flex-wrap gap-2">
                                          {colors.map((color) => (
                                            <span
                                              key={`${product.id}-color-${color}`}
                                              className="rounded-full border border-[var(--theme-border)] bg-white/80 px-3 py-1 text-xs text-[var(--theme-text-soft)]"
                                            >
                                              {color}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    ) : null}

                                    {scents.length > 0 ? (
                                      <div>
                                        <div className="theme-kicker text-[10px] opacity-80">
                                          Scents
                                        </div>

                                        <div className="mt-2 flex flex-wrap gap-2">
                                          {scents.map((scent) => (
                                            <span
                                              key={`${product.id}-scent-${scent}`}
                                              className="rounded-full border border-[var(--theme-border)] bg-white/80 px-3 py-1 text-xs text-[var(--theme-text-soft)]"
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

                                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--theme-border)] pt-4">
                                  <div className="grid gap-1">
                                    <div className="theme-kicker text-sm opacity-80">
                                      {formatStockAmount(product.stockAmount)}
                                    </div>
                                    <div className="theme-kicker text-[10px] opacity-70">
                                      Min buy {normalizeMinimumOrderQuantity(product.minimumOrderQuantity)}
                                    </div>
                                  </div>

                                  {product.category ? (
                                    <div className="rounded-full border border-[var(--theme-border)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-[var(--theme-text-soft)]">
                                      {product.category}
                                    </div>
                                  ) : null}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => selectProductForOrder(product.id)}
                                  disabled={isOutOfStock}
                                  className="theme-button mt-4 w-full rounded-full px-4 py-3 text-xs uppercase tracking-[0.2em] disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                  {isOutOfStock
                                    ? "Out of stock"
                                    : isSelectedProduct
                                      ? "Selected For Cart"
                                      : "Select Product"}
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
            <div className="theme-card theme-copy mt-8 p-6 text-sm">
              No products match your current search/filter. Try clearing the search or switching
              category.
            </div>
          ) : null}

          {selectedProduct ? (
            <section
              ref={orderSectionRef}
              className="theme-card mt-8 p-5 sm:p-6"
            >
              <div className="border-b border-[var(--theme-border)] pb-5">
                <p className="theme-kicker text-sm">Place Order</p>

                <h2
                  className="theme-title mt-3 text-3xl leading-none sm:text-4xl"
                >
                  {selectedProduct.title}
                </h2>

                <p
                  className="theme-copy mt-4 max-w-2xl text-base leading-7"
                  style={{ fontFamily: '"Manrope", sans-serif' }}
                >
                  Add products to cart, confirm delivery location, then place the order. Payment
                  is handled on PayFast before we organize delivery.
                </p>
              </div>

              {orderError ? (
                <div className="mt-5 border border-red-400/30 bg-red-950/25 p-4 text-red-100">
                  {orderError}
                </div>
              ) : null}

              {orderMessage ? (
                <div className="mt-5 border border-emerald-400/30 bg-emerald-950/25 p-4 text-emerald-100">
                  <p>{orderMessage}</p>
                </div>
              ) : null}

              <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="theme-panel p-4">
                  <div className="relative aspect-[4/3] bg-[var(--theme-surface)]">
                    {selectedPreviewImage ? (
                      <img
                        src={selectedPreviewImage}
                        alt={`${selectedProduct.title} preview`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-[var(--theme-text-soft)]">
                        No image
                      </div>
                    )}

                    {selectedProductHasSpecialOption ? (
                      <div className="absolute left-3 bottom-3 border border-amber-300/40 bg-amber-950/80 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-amber-100 backdrop-blur">
                        {selectedProduct.specialOption.label || "Special"}
                      </div>
                    ) : null}

                  </div>

                  {selectedProductImages.length > 1 ? (
                    <div className="mt-3 border-t border-[var(--theme-border)] pt-3">
                      <div className="theme-kicker mb-2 text-[10px] opacity-70">
                        Scroll images
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {selectedProductImages.map((imageUrl, index) => (
                          <button
                            key={`selected-${selectedProduct.id}-${imageUrl}-${index}`}
                            type="button"
                            onClick={() => setSelectedImageIndex(index)}
                            className={`h-16 w-16 shrink-0 overflow-hidden border transition ${
                              selectedImageIndex === index
                                ? "border-[var(--theme-border-strong)]"
                                : "border-[var(--theme-border)] hover:border-[var(--theme-border-strong)]"
                            }`}
                            aria-label={`View image ${index + 1}`}
                          >
                            <img
                              src={imageUrl}
                              alt={`${selectedProduct.title} thumbnail ${index + 1}`}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="theme-kicker mt-4 border-t border-[var(--theme-border)] pt-4 text-sm opacity-80">
                    {Number(selectedProduct?.effectivePrice ?? selectedProduct?.price ?? 0) < Number(selectedProduct?.price ?? 0) ? (
                      <>
                        <span className="text-amber-100">
                          {formatPrice(selectedProduct?.effectivePrice)}
                        </span>{" "}
                        <span className="text-[var(--theme-text-soft)] line-through opacity-80">
                          {formatPrice(selectedProduct.price)}
                        </span>
                      </>
                    ) : (
                      formatPrice(selectedProduct.price)
                    )}{" "}
                    • {selectedProduct.weight} • {selectedProduct.category || "Uncategorised"}
                  </div>

                  <p className="theme-copy mt-3 text-base leading-7" style={{ fontFamily: '"Manrope", sans-serif' }}>
                    {selectedProduct.description}
                  </p>

                  {selectedProductColors.length > 0 || selectedProductScents.length > 0 ? (
                    <div className="mt-4 grid gap-3 border-t border-[var(--theme-border)] pt-4">
                      {selectedProductColors.length > 0 ? (
                        <div>
                          <div className="theme-kicker text-[10px] opacity-80">
                            Colors
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            {selectedProductColors.map((color) => (
                              <span
                                key={`selected-color-${color}`}
                                className="rounded-full border border-[var(--theme-border)] bg-white/80 px-3 py-1 text-xs text-[var(--theme-text-soft)]"
                              >
                                {color}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {selectedProductScents.length > 0 ? (
                        <div>
                          <div className="theme-kicker text-[10px] opacity-80">
                            Scents
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            {selectedProductScents.map((scent) => (
                              <span
                                key={`selected-scent-${scent}`}
                                className="rounded-full border border-[var(--theme-border)] bg-white/80 px-3 py-1 text-xs text-[var(--theme-text-soft)]"
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

                <form className="theme-panel grid gap-4 p-4" onSubmit={submitOrder}>
                  <div className="rounded-xl border border-[var(--theme-border)] bg-white/75 p-3 text-xs text-[var(--theme-text-soft)]">
                    <div className="theme-kicker text-xs text-[var(--theme-text)]">
                      Checkout Steps
                    </div>
                    <div className="mt-1.5 leading-5">
                      1. Set quantity and add product to cart.
                      <br />
                      2. Confirm location and auto-selected closest PUDO locker.
                      <br />
                      3. Continue to PayFast and complete payment.
                    </div>
                  </div>

                  <label className="theme-copy grid gap-2 text-sm">
                    <span className="theme-kicker text-xs opacity-80">
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
                      className="theme-input px-4 py-3 transition"
                    />
                    <span className="text-xs opacity-80">
                      Minimum for this product: {selectedProductMinimumOrderQuantity}
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={addSelectedProductToCart}
                    disabled={!selectedProduct || orderStatus === "saving"}
                    className="theme-button rounded-full px-4 py-3 text-xs uppercase tracking-[0.2em] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add Quantity To Cart
                  </button>

                  <div className="theme-copy text-xs">
                    Adds the selected product and quantity to your cart. You can adjust items in
                    the cart panel.
                  </div>

                  <div className="rounded-xl border border-[var(--theme-border)] bg-white/75 p-3 text-xs text-[var(--theme-text-soft)]">
                    Your cart stays in the trolley at the bottom right until you proceed to PayFast.
                  </div>

                  <div className="grid gap-3 rounded-xl border border-[var(--theme-border)] bg-white/75 p-3 text-sm text-[var(--theme-text-soft)]">
                    <div>
                      <div className="theme-kicker text-xs text-[var(--theme-text)]">Promo Code</div>
                      <div className="mt-1 text-xs leading-5">
                        Apply a valid code before checkout. The discounted amount is sent through to PayFast.
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        name="promoCode"
                        value={promoCodeInput}
                        onChange={(event) => setPromoCodeInput(cleanPromoCode(event.target.value))}
                        placeholder="Enter promo code"
                        className="theme-input min-w-0 flex-1 px-4 py-3 transition"
                      />
                      <button
                        type="button"
                        onClick={applyPromoCode}
                        disabled={!normalizedPromoCodeInput || orderStatus === "saving"}
                        className="theme-button-secondary rounded-full px-4 py-3 text-xs uppercase tracking-[0.2em] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Apply Code
                      </button>
                      {appliedPromoCode ? (
                        <button
                          type="button"
                          onClick={removePromoCode}
                          disabled={orderStatus === "saving"}
                          className="rounded-full border border-red-300/40 px-4 py-3 text-xs uppercase tracking-[0.2em] text-red-200 transition hover:border-red-200 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Remove Code
                        </button>
                      ) : null}
                    </div>

                    {appliedPromoCode ? (
                      <div className="rounded-xl border border-emerald-400/30 bg-emerald-950/25 p-3 text-xs leading-5 text-emerald-100">
                        Applied promo code: <strong>{appliedPromoCode}</strong>
                        {appliedPromoSavings > 0 ? ` • Savings ${formatPrice(appliedPromoSavings)}` : ""}
                        {appliedPromoSavings <= 0 && selectedProductHasAppliedPromo
                          ? " • It will apply once this product is added to the cart."
                          : ""}
                      </div>
                    ) : null}
                  </div>

                  <label className="theme-copy grid gap-2 text-sm">
                    <span className="theme-kicker text-xs opacity-80">
                      Customer Email
                    </span>
                    <input
                      type="email"
                      name="customerEmail"
                      value={orderForm.customerEmail}
                      onChange={updateOrderField}
                      placeholder="name@example.com"
                      required
                      className="theme-input px-4 py-3 transition"
                    />
                    <span className="text-xs opacity-80">
                      Required for payment reference and PayFast confirmation.
                    </span>
                  </label>

                  <div className="rounded-xl border border-[var(--theme-border)] bg-white/75 p-3 text-xs text-[var(--theme-text-soft)]">
                    <div className="theme-kicker text-xs text-[var(--theme-text)]">
                      Bought Here Before?
                    </div>
                    <div className="mt-1.5 leading-5">
                      Use your email to see previous orders, totals, and tracking without needing an order code.
                    </div>
                    <div className="mt-3">
                      <Link
                        to={buildOrdersHistoryHref(orderForm.customerEmail)}
                        className="theme-button inline-flex rounded-full px-4 py-3 text-xs uppercase tracking-[0.2em]"
                      >
                        View Previous Orders
                      </Link>
                    </div>
                  </div>

                  <label className="theme-copy grid gap-2 text-sm">
                    <span className="theme-kicker text-xs opacity-80">
                      Location Text
                    </span>
                    <textarea
                      name="locationText"
                      value={orderForm.locationText}
                      onChange={updateOrderField}
                      rows={4}
                      placeholder="Street address, suburb, city, delivery note"
                      className="theme-input resize-none px-4 py-3 transition"
                    />
                  </label>

                  <label className="theme-copy grid gap-2 text-sm">
                    <span className="theme-kicker text-xs opacity-80">
                      Customer Coordinates
                    </span>
                    <input
                      type="text"
                      name="googleMapsLocation"
                      value={orderForm.googleMapsLocation}
                      onChange={updateOrderField}
                      placeholder="Click the map or use current location"
                      className="theme-input px-4 py-3 transition"
                    />
                  </label>

                  <div className="theme-copy grid gap-2 text-sm">
                    <span className="theme-kicker text-xs opacity-80">
                      Pin Your Location
                    </span>

                    <div
                      ref={pinMapRef}
                      className="h-64 w-full border border-[var(--theme-border)] bg-white/75"
                    />

                    {mapStatus === "loading" ? (
                      <p className="text-xs leading-5 opacity-80">
                        Loading map...
                      </p>
                    ) : null}

                    {mapStatus === "error" ? (
                      <p className="text-xs leading-5 text-red-200">
                        Map unavailable right now. Enter coordinates manually to continue.
                      </p>
                    ) : null}

                    <p className="text-xs leading-5 opacity-80">
                      Tap/click the map to drop a pin. PUDO lockers will be sorted from closest to furthest.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={useCurrentLocation}
                      disabled={locationStatus === "locating"}
                      className="theme-button-secondary rounded-full px-4 py-3 text-xs uppercase tracking-[0.2em] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {locationStatus === "locating" ? "Locating..." : "Use My Current Location"}
                    </button>

                    {googleMapsSearchUrl ? (
                      <a
                        href={googleMapsSearchUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="theme-kicker text-xs underline-offset-4 hover:underline"
                      >
                        Open Location
                      </a>
                    ) : null}

                    {locationSearchUrl ? (
                      <a
                        href={locationSearchUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="theme-kicker text-xs underline-offset-4 hover:underline"
                      >
                        Search Text Location
                      </a>
                    ) : null}
                  </div>

                  {pudoStatus === "loading" ? (
                    <div className="rounded-xl border border-[var(--theme-border)] bg-white/75 p-4 text-sm text-[var(--theme-text-soft)]">
                      Finding closest PUDO locker...
                    </div>
                  ) : null}

                  {pudoMessage ? (
                    <div className="rounded-xl border border-[var(--theme-border)] bg-white/75 p-4 text-sm text-[var(--theme-text-soft)]">
                      {pudoMessage}
                    </div>
                  ) : null}

                  {pudoLockers.length > 0 ? (
                    <div className="grid gap-3">
                      <span className="theme-kicker text-xs opacity-80">
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
                                ? "border-[var(--theme-accent-strong)] bg-[var(--theme-accent-strong)] text-white"
                                : "border-[var(--theme-border)] bg-white/75 text-[var(--theme-text-soft)] hover:border-[var(--theme-border-strong)]"
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
                    Important: the final payment confirmation happens through PayFast&apos;s secure
                    ITN callback before delivery is organized.
                  </div>

                  <button
                    type="submit"
                    disabled={!canSubmitOrder || orderStatus === "saving"}
                    className="theme-button px-6 py-4 text-center text-sm uppercase tracking-[0.2em] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {submitOrderLabel}
                  </button>
                  {!canSubmitOrder ? (
                    <div className="theme-copy text-xs">
                      To place order: add at least one item to cart, enter an email, and confirm a delivery locker.
                    </div>
                  ) : null}
                </form>
              </div>
            </section>
          ) : null}

          <div className="fixed bottom-5 right-5 z-40">
            {isTrolleyOpen ? (
              <div className="theme-card mb-3 w-80 rounded-[24px] p-3 text-[var(--theme-text)] shadow-xl shadow-[rgba(93,78,48,0.18)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="theme-kicker text-xs opacity-80">Cart</span>
                  <span className="theme-copy text-xs">
                    {cartTotalQuantity} item{cartTotalQuantity === 1 ? "" : "s"}
                  </span>
                </div>

                {cartLines.length === 0 ? (
                  <p className="theme-copy mt-2 text-xs">Your cart is empty.</p>
                ) : (
                  <>
                    <div className="mt-2 grid max-h-52 gap-2 overflow-y-auto pr-1">
                      {cartLines.map((line) => (
                        <div
                          key={`trolley-${line.productId}`}
                          className="rounded-lg border border-[var(--theme-border)] bg-white/75 px-2.5 py-2 text-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-semibold text-[var(--theme-text)]">{line.product.title}</div>
                            <button
                              type="button"
                              onClick={() => removeCartItem(line.productId)}
                              className="text-[10px] uppercase tracking-[0.14em] text-red-200/80 underline-offset-4 hover:text-red-100 hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <input
                              type="number"
                              min={normalizeMinimumOrderQuantity(line.product.minimumOrderQuantity)}
                              max={Math.max(
                                normalizeMinimumOrderQuantity(line.product.minimumOrderQuantity),
                                Number(line.product.stockAmount || 0),
                              )}
                              step="1"
                              value={line.quantity}
                              onChange={(event) =>
                                updateCartItemQuantity(line.productId, event.target.value)
                              }
                              className="theme-input w-16 rounded px-2 py-1 text-xs transition"
                            />
                            <div className="theme-copy">
                              x {formatPrice(line.unitPrice)} = {formatPrice(line.unitPrice * line.quantity)}
                            </div>
                          </div>
                          {line.appliedPromo ? (
                            <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-emerald-900">
                              Promo {line.appliedPromo.code} applied
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 rounded-lg border border-[var(--theme-border)] bg-white/75 px-3 py-2 text-sm">
                      {appliedPromoCode ? (
                        <div className="theme-copy mb-2 flex items-center justify-between gap-3 border-b border-[var(--theme-border)] pb-2 text-xs">
                          <span>Promo {appliedPromoCode}</span>
                          <button
                            type="button"
                            onClick={removePromoCode}
                            className="uppercase tracking-[0.14em] text-red-200/80 underline-offset-4 hover:text-red-100 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      ) : null}
                      <div className="theme-copy flex items-center justify-between">
                        <span>Total</span>
                        <span className="font-semibold text-[var(--theme-text)]">{formatPrice(cartTotalPrice)}</span>
                      </div>
                      {appliedPromoCode && appliedPromoSavings > 0 ? (
                        <div className="theme-copy mt-2 flex items-center justify-between text-xs text-emerald-900">
                          <span>Savings</span>
                          <span>-{formatPrice(appliedPromoSavings)}</span>
                        </div>
                      ) : null}
                    </div>
                  </>
                )}

                <div className="mt-3 rounded-lg border border-amber-300/30 bg-amber-950/20 p-2.5 text-xs leading-5 text-amber-100">
                  PayFast will handle the payment step securely when you continue from checkout.
                </div>

                <Link
                  to={buildOrdersHistoryHref(orderForm.customerEmail)}
                  className="theme-button-secondary mt-3 block w-full rounded-lg px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.14em]"
                >
                  View Previous Orders
                </Link>

                <button type="button" onClick={openBasketFromTrolley} className="theme-button mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em]">
                  Open Cart & Checkout
                </button>
              </div>
            ) : null}

            <button
              type="button"
              onClick={toggleTrolley}
              aria-label="View cart"
              className="theme-button relative flex h-12 w-12 items-center justify-center rounded-full shadow-lg shadow-[rgba(93,78,48,0.18)]"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="9" cy="20" r="1.2" />
                <circle cx="17" cy="20" r="1.2" />
                <path d="M3 4h2l2.3 10.2a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L20 8H7" />
              </svg>
              <span className="absolute -right-1.5 -top-1.5 min-w-[1.25rem] rounded-full border border-[var(--theme-border)] bg-white px-1 py-0.5 text-center text-[10px] font-semibold leading-none text-[var(--theme-text)]">
                {cartTotalQuantity}
              </span>
            </button>
          </div>

          <div className="mt-14">
            <Footer />
          </div>
        </div>
      </main>
    </div>
  );
}

export function CompanyTwoProductsPage() {
  return <ProductsPageBase pageVariantKey="company-2" />;
}

export default function ProductsPage() {
  return <ProductsPageBase pageVariantKey="rebelco" />;
}
