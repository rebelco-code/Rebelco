import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "../components/navbar";
import { readJsonResponse } from "../lib/api";
import { formatPrice, formatStockAmount } from "../lib/formatters";

const initialForm = {
  title: "",
  description: "",
  category: "",
  price: "",
  weight: "",
  stockAmount: "",
  minimumOrderQuantity: "1",
  colors: "",
  scents: "",
  specialOptionEnabled: false,
  specialOptionLabel: "Special",
  specialOptionStartDate: "",
  specialOptionEndDate: "",
  specialOptionDiscountAmount: "",
};

const initialLoginForm = {
  email: "",
  password: "",
};

const RETRYABLE_STATUS_CODES = new Set([409, 429, 500, 502, 503, 504]);
const MAX_ACTION_RETRIES = 2;
const MAX_PRODUCT_IMAGES = 6;
const MAX_PRODUCT_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function wait(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function formatFileSize(sizeInBytes) {
  const bytes = Number(sizeInBytes || 0);

  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${bytes} B`;
}

async function fetchJsonWithRetry(url, options, fallbackMessage, maxRetries = MAX_ACTION_RETRIES) {
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const response = await fetch(url, options);
      const shouldRetryResponse =
        !response.ok &&
        RETRYABLE_STATUS_CODES.has(response.status) &&
        attempt < maxRetries;

      if (shouldRetryResponse) {
        attempt += 1;
        await wait(150 * attempt);
        continue;
      }

      return await readJsonResponse(response, fallbackMessage);
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      attempt += 1;
      await wait(150 * attempt);
    }
  }

  throw new Error(fallbackMessage || "Request failed.");
}

function formatDateTime(value) {
  const timestamp = Date.parse(String(value || ""));

  if (!Number.isFinite(timestamp)) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function buildGoogleMapsUrl(locationValue) {
  const trimmedLocation = String(locationValue || "").trim();

  if (!trimmedLocation) {
    return "";
  }

  try {
    const parsedUrl = new URL(trimmedLocation);

    if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
      return parsedUrl.toString();
    }
  } catch {
    // no-op
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmedLocation)}`;
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

function getProductList(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

function getProductImages(product) {
  const imageUrls = Array.isArray(product?.imageUrls)
    ? product.imageUrls.map((url) => String(url || "").trim()).filter(Boolean)
    : [];
  const imagePathnames = Array.isArray(product?.imagePathnames)
    ? product.imagePathnames.map((pathname) => String(pathname || "").trim()).filter(Boolean)
    : [];

  if (!imageUrls.length && product?.imageUrl) {
    imageUrls.push(String(product.imageUrl).trim());
  }

  if (!imagePathnames.length && product?.imagePathname) {
    imagePathnames.push(String(product.imagePathname).trim());
  }

  return imageUrls.map((url, index) => ({
    key: `${imagePathnames[index] || url || `image-${index}`}-${index}`,
    url,
    pathname: imagePathnames[index] || "",
  }));
}

function serializeProductList(value) {
  return getProductList(value).join(", ");
}

function buildProductFieldsPayload(form) {
  return {
    title: form.title,
    description: form.description,
    category: form.category,
    price: form.price,
    weight: form.weight,
    stockAmount: form.stockAmount,
    minimumOrderQuantity: form.minimumOrderQuantity,
    colors: form.colors,
    scents: form.scents,
    specialOptionEnabled: String(form.specialOptionEnabled),
    specialOptionLabel: form.specialOptionLabel,
    specialOptionStartDate: form.specialOptionStartDate,
    specialOptionEndDate: form.specialOptionEndDate,
    specialOptionDiscountAmount: form.specialOptionDiscountAmount,
  };
}

function buildFormFromProduct(product) {
  const specialOption = product?.specialOption || {};
  const specialOptionEnabled = Boolean(specialOption.enabled);

  return {
    title: String(product?.title || ""),
    description: String(product?.description || ""),
    category: String(product?.category || ""),
    price: String(product?.price ?? ""),
    weight: String(product?.weight || ""),
    stockAmount: String(product?.stockAmount ?? ""),
    minimumOrderQuantity: String(Math.max(1, Number(product?.minimumOrderQuantity) || 1)),
    colors: serializeProductList(product?.colors),
    scents: serializeProductList(product?.scents),
    specialOptionEnabled,
    specialOptionLabel: String(specialOption.label || "Special"),
    specialOptionStartDate: specialOptionEnabled ? String(specialOption.startDate || "") : "",
    specialOptionEndDate: specialOptionEnabled ? String(specialOption.endDate || "") : "",
    specialOptionDiscountAmount: specialOptionEnabled
      ? String(specialOption.discountAmount ?? "")
      : "",
  };
}

export default function AdminaPage() {
  const imageInputRef = useRef(null);

  const [admin, setAdmin] = useState(null);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [editingExistingImages, setEditingExistingImages] = useState([]);
  const [editingHasUntrackedImages, setEditingHasUntrackedImages] = useState(false);
  const [sessionStatus, setSessionStatus] = useState("checking");
  const [productsStatus, setProductsStatus] = useState("idle");
  const [orders, setOrders] = useState([]);
  const [ordersStatus, setOrdersStatus] = useState("idle");
  const [editingProductId, setEditingProductId] = useState("");
  const [formStatus, setFormStatus] = useState("idle");
  const [loginStatus, setLoginStatus] = useState("idle");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [openCategories, setOpenCategories] = useState({});
  const [productActionStatus, setProductActionStatus] = useState("");
  const [stockUpdateByProduct, setStockUpdateByProduct] = useState({});
  const [orderActionStatus, setOrderActionStatus] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isImageDropActive, setIsImageDropActive] = useState(false);
  const [pudoLookupByOrder, setPudoLookupByOrder] = useState({});

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

  const colorOptions = useMemo(() => {
    const colorSet = new Set();

    products.forEach((product) => {
      getProductList(product.colors).forEach((color) => {
        if (color) {
          colorSet.add(color);
        }
      });
    });

    return Array.from(colorSet).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const scentOptions = useMemo(() => {
    const scentSet = new Set();

    products.forEach((product) => {
      getProductList(product.scents).forEach((scent) => {
        if (scent) {
          scentSet.add(scent);
        }
      });
    });

    return Array.from(scentSet).sort((a, b) => a.localeCompare(b));
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
      const category = String(product.category || "Uncategorised").trim() || "Uncategorised";

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

  const isEditingProduct = Boolean(editingProductId);
  const canEditExistingImages = isEditingProduct && !editingHasUntrackedImages;
  const totalSelectedImageCount = editingExistingImages.length + imageFiles.length;

  const loadProducts = useCallback(async () => {
    setProductsStatus("loading");

    try {
      const response = await fetch("/api/admin/products", {
        headers: { Accept: "application/json" },
        credentials: "include",
        cache: "no-store",
      });

      const data = await readJsonResponse(
        response,
        "Admin API is available through Vercel dev or a deployed Vercel site.",
      );

      setProducts(data.products || []);
      setProductsStatus("ready");
    } catch (loadError) {
      setError(loadError.message);
      setProductsStatus("error");
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setOrdersStatus("loading");

    try {
      const response = await fetch("/api/admin/orders", {
        headers: { Accept: "application/json" },
        credentials: "include",
        cache: "no-store",
      });

      const data = await readJsonResponse(
        response,
        "Orders API is available through Vercel dev or a deployed Vercel site.",
      );

      setOrders(data.orders || []);
      setPudoLookupByOrder({});
      setOrdersStatus("ready");
    } catch (loadError) {
      setError(loadError.message);
      setOrdersStatus("error");
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        const response = await fetch("/api/admin/session", {
          headers: { Accept: "application/json" },
          credentials: "include",
        });

        const data = await readJsonResponse(response, "Admin session API is unavailable.");

        if (data.admin && isMounted) {
          setAdmin(data.admin);
          setSessionStatus("signed-in");
          loadProducts();
          loadOrders();
          return;
        }

        if (isMounted) {
          setSessionStatus("signed-out");
        }
      } catch {
        if (isMounted) {
          setSessionStatus("signed-out");
        }
      }
    }

    checkSession();

    return () => {
      isMounted = false;
    };
  }, [loadOrders, loadProducts]);

  useEffect(() => {
    return () => {
      imagePreviews.forEach((preview) => URL.revokeObjectURL(preview));
    };
  }, [imagePreviews]);

  function updateLoginField(event) {
    const { name, value } = event.target;

    setLoginForm((currentLoginForm) => ({
      ...currentLoginForm,
      [name]: value,
    }));
  }

  async function submitLogin(event) {
    event.preventDefault();

    setError("");
    setMessage("");
    setLoginStatus("loading");

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(loginForm),
      });

      const data = await readJsonResponse(
        response,
        "Admin API is available through Vercel dev or a deployed Vercel site.",
      );

      setAdmin(data.admin);
      setSessionStatus("signed-in");
      setLoginStatus("idle");
      setLoginForm(initialLoginForm);
      loadProducts();
      loadOrders();
    } catch (loginError) {
      setError(loginError.message);
      setLoginStatus("idle");
    }
  }

  function updateField(event) {
    const { name, value, type, checked } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function selectExistingCategory(category) {
    setForm((currentForm) => ({
      ...currentForm,
      category,
    }));
  }

  function appendListValue(fieldName, value) {
    const cleanValue = String(value || "").trim();

    if (!cleanValue) {
      return;
    }

    setForm((currentForm) => {
      const currentItems = String(currentForm[fieldName] || "")
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean);

      const alreadyExists = currentItems.some(
        (item) => item.toLowerCase() === cleanValue.toLowerCase(),
      );

      if (alreadyExists) {
        return currentForm;
      }

      return {
        ...currentForm,
        [fieldName]: [...currentItems, cleanValue].join(", "),
      };
    });
  }

  function selectExistingColor(color) {
    appendListValue("colors", color);
  }

  function selectExistingScent(scent) {
    appendListValue("scents", scent);
  }

  function toggleCategory(category) {
    setOpenCategories((current) => ({
      ...current,
      [category]: current[category] === false,
    }));
  }

  function setSelectedImages(nextFiles) {
    const maxSelectable = Math.max(0, MAX_PRODUCT_IMAGES - editingExistingImages.length);
    const limitedFiles = nextFiles.slice(0, maxSelectable);

    setImageFiles(limitedFiles);
    setImagePreviews((currentPreviews) => {
      currentPreviews.forEach((preview) => URL.revokeObjectURL(preview));
      return limitedFiles.map((file) => URL.createObjectURL(file));
    });
  }

  function addImages(incomingFiles) {
    if (!incomingFiles.length) {
      return;
    }

    let invalidTypeCount = 0;
    let tooLargeCount = 0;
    let duplicateCount = 0;
    let overflowCount = 0;
    const existingCount = editingExistingImages.length;
    const nextSelectedFiles = [...imageFiles];

    incomingFiles.forEach((file) => {
      if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
        invalidTypeCount += 1;
        return;
      }

      if (file.size > MAX_PRODUCT_IMAGE_SIZE_BYTES) {
        tooLargeCount += 1;
        return;
      }

      const alreadySelected = nextSelectedFiles.some(
        (currentFile) =>
          currentFile.name === file.name &&
          currentFile.size === file.size &&
          currentFile.lastModified === file.lastModified,
      );

      if (alreadySelected) {
        duplicateCount += 1;
        return;
      }

      if (nextSelectedFiles.length + existingCount >= MAX_PRODUCT_IMAGES) {
        overflowCount += 1;
        return;
      }

      nextSelectedFiles.push(file);
    });

    setSelectedImages(nextSelectedFiles);

    const skippedMessages = [];

    if (invalidTypeCount > 0) {
      skippedMessages.push(`${invalidTypeCount} invalid type`);
    }

    if (tooLargeCount > 0) {
      skippedMessages.push(`${tooLargeCount} too large`);
    }

    if (duplicateCount > 0) {
      skippedMessages.push(`${duplicateCount} duplicate`);
    }

    if (overflowCount > 0) {
      skippedMessages.push(`${overflowCount} over limit`);
    }

    if (skippedMessages.length > 0) {
      setError(`Some files were skipped: ${skippedMessages.join(", ")}.`);
      return;
    }

    setError("");
  }

  function updateImage(event) {
    const files = Array.from(event.target.files || []);
    addImages(files);

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  function openImagePicker() {
    imageInputRef.current?.click();
  }

  function clearSelectedImages() {
    setSelectedImages([]);
    setIsImageDropActive(false);

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  function removeSelectedImage(indexToRemove) {
    const remainingFiles = imageFiles.filter((_, index) => index !== indexToRemove);
    setSelectedImages(remainingFiles);
  }

  function removeEditingExistingImage(keyToRemove) {
    setEditingExistingImages((currentImages) =>
      currentImages.filter((image) => image.key !== keyToRemove),
    );
  }

  function handleImageDrop(event) {
    event.preventDefault();
    setIsImageDropActive(false);

    const droppedFiles = Array.from(event.dataTransfer?.files || []);
    addImages(droppedFiles);
  }

  function handleImageDragOver(event) {
    event.preventDefault();
    setIsImageDropActive(true);
  }

  function handleImageDragLeave(event) {
    event.preventDefault();
    setIsImageDropActive(false);
  }

  function resetForm() {
    setEditingProductId("");
    setEditingExistingImages([]);
    setEditingHasUntrackedImages(false);
    setForm(initialForm);
    clearSelectedImages();
  }

  function startEditingProduct(product) {
    if (!product?.id) {
      return;
    }

    setEditingProductId(product.id);
    setForm(buildFormFromProduct(product));
    const existingImages = getProductImages(product).slice(0, MAX_PRODUCT_IMAGES);
    setEditingExistingImages(existingImages);
    setEditingHasUntrackedImages(existingImages.some((image) => !image.pathname));
    clearSelectedImages();
    setError("");
    setMessage(`Editing "${product.title}". Save changes to update this product.`);

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function cancelEditingProduct() {
    resetForm();
    setError("");
    setMessage("Edit cancelled.");
  }

  async function submitProduct(event) {
    event.preventDefault();

    if (!isEditingProduct && imageFiles.length === 0) {
      setError("Add at least one product image before saving.");
      return;
    }

    if (isEditingProduct && totalSelectedImageCount === 0) {
      setError("Keep at least one product image or add a new one before saving.");
      return;
    }

    setError("");
    setMessage("");
    setFormStatus("saving");

    try {
      const fieldsPayload = buildProductFieldsPayload(form);

      if (isEditingProduct) {
        const formData = new FormData();

        formData.append("id", editingProductId);
        formData.append("action", "update-product-details");
        Object.entries(fieldsPayload).forEach(([name, value]) => {
          formData.append(name, value);
        });

        if (canEditExistingImages) {
          formData.append(
            "existingImagePathnames",
            JSON.stringify(
              editingExistingImages
                .map((image) => String(image.pathname || "").trim())
                .filter(Boolean),
            ),
          );
        }

        imageFiles.forEach((file) => {
          formData.append("images", file);
        });

        const response = await fetch("/api/admin/products", {
          method: "PATCH",
          body: formData,
          credentials: "include",
        });

        const data = await readJsonResponse(
          response,
          "Product could not be updated.",
        );

        setProducts(data.products || []);
        const updatedTitle = String(data.product?.title || form.title || "Product");
        resetForm();
        setMessage(`"${updatedTitle}" updated.`);
      } else {
        const formData = new FormData();

        Object.entries(fieldsPayload).forEach(([name, value]) => {
          formData.append(name, value);
        });

        imageFiles.forEach((file) => {
          formData.append("images", file);
        });

        const response = await fetch("/api/admin/products", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        const data = await readJsonResponse(
          response,
          "Admin API is available through Vercel dev or a deployed Vercel site.",
        );

        setProducts(data.products || []);
        resetForm();
        setMessage("Product saved.");
      }
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setFormStatus("idle");
    }
  }

  async function setOutOfStock(productId) {
    if (productActionStatus) {
      return;
    }

    setError("");
    setMessage("");
    setProductActionStatus(productId);

    try {
      const data = await fetchJsonWithRetry(
        `/api/admin/products?id=${encodeURIComponent(productId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({
            id: productId,
            action: "set-out-of-stock",
          }),
        },
        "Product could not be updated.",
      );

      setProducts(data.products || []);
      setMessage("Product set out of stock.");
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setProductActionStatus("");
    }
  }

  async function removeProduct(productId) {
    if (productActionStatus) {
      return;
    }

    const confirmed = window.confirm("Remove this product from the catalog?");

    if (!confirmed) {
      return;
    }

    setError("");
    setMessage("");
    setProductActionStatus(productId);

    try {
      const data = await fetchJsonWithRetry(
        `/api/admin/products?id=${encodeURIComponent(productId)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({ id: productId }),
        },
        "Product could not be removed.",
      );

      setProducts(data.products || []);
      setMessage("Product removed.");
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setProductActionStatus("");
    }
  }

  function updateStockInput(productId, value) {
    setStockUpdateByProduct((current) => ({
      ...current,
      [productId]: value,
    }));
  }

  async function updateProductStockAmount(productId) {
    if (productActionStatus) {
      return;
    }

    const enteredValue = stockUpdateByProduct[productId];
    const stockAmount = String(enteredValue ?? "").trim();

    if (!stockAmount) {
      setError("Enter a stock amount before saving.");
      return;
    }

    setError("");
    setMessage("");
    setProductActionStatus(productId);

    try {
      const data = await fetchJsonWithRetry(
        `/api/admin/products?id=${encodeURIComponent(productId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({
            id: productId,
            action: "set-stock-amount",
            stockAmount,
          }),
        },
        "Product stock could not be updated.",
      );

      setProducts(data.products || []);
      setStockUpdateByProduct((current) => {
        const next = { ...current };
        delete next[productId];
        return next;
      });
      setMessage("Product stock updated.");
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setProductActionStatus("");
    }
  }

  async function setProofOfPaymentReceived(orderId, proofOfPaymentReceived) {
    if (orderActionStatus) {
      return;
    }

    setError("");
    setMessage("");
    setOrderActionStatus(orderId);

    try {
      const data = await fetchJsonWithRetry(
        `/api/admin/orders?id=${encodeURIComponent(orderId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({
            id: orderId,
            proofOfPaymentReceived,
          }),
        },
        "Order could not be updated.",
      );

      setOrders(data.orders || []);
      setMessage("Order payment proof status updated.");
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setOrderActionStatus("");
    }
  }

  async function setDeliveryOrganized(orderId, deliveryOrganized) {
    if (orderActionStatus) {
      return;
    }

    setError("");
    setMessage("");
    setOrderActionStatus(orderId);

    try {
      const data = await fetchJsonWithRetry(
        `/api/admin/orders?id=${encodeURIComponent(orderId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({
            id: orderId,
            action: "set-delivery-organized",
            deliveryOrganized,
          }),
        },
        "Order could not be updated.",
      );

      setOrders(data.orders || []);
      setMessage("Order delivery status updated.");
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setOrderActionStatus("");
    }
  }

  async function lookupPudoLockers(order) {
    const orderId = String(order?.id || "").trim();

    if (!orderId) {
      return;
    }

    const parsedLatLng = parseLatLngText(order.googleMapsLocation);
    if (!parsedLatLng) {
      setPudoLookupByOrder((current) => ({
        ...current,
        [orderId]: {
          status: "error",
          provider: "",
          lockers: [],
          message:
            "Order is missing usable coordinates. Save a map pin (lat,lng) on the order before running PUDO lookup.",
        },
      }));
      return;
    }

    const queryParams = new URLSearchParams({
      lat: String(parsedLatLng.latitude),
      lng: String(parsedLatLng.longitude),
      limit: "4",
    });

    setPudoLookupByOrder((current) => ({
      ...current,
      [orderId]: {
        status: "loading",
        provider: "",
        lockers: [],
        message: "",
      },
    }));

    try {
      const response = await fetch(`/api/admin/pudo-lockers?${queryParams.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "include",
        cache: "no-store",
      });
      const data = await readJsonResponse(
        response,
        "Could not load PUDO locker information right now.",
      );

      setPudoLookupByOrder((current) => ({
        ...current,
        [orderId]: {
          status: "ready",
          provider: String(data.provider || ""),
          lockers: Array.isArray(data.lockers) ? data.lockers : [],
          message: String(data.message || ""),
        },
      }));
    } catch (lookupError) {
      setPudoLookupByOrder((current) => ({
        ...current,
        [orderId]: {
          status: "error",
          provider: "",
          lockers: [],
          message: lookupError.message,
        },
      }));
    }
  }

  async function signOut() {
    await fetch("/api/admin/session", {
      method: "DELETE",
      credentials: "include",
    });

    setAdmin(null);
    setProducts([]);
    setOrders([]);
    setPudoLookupByOrder({});
    setSessionStatus("signed-out");
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0f0f10] text-white">
      <Navbar className="border-b border-white/10 bg-[#0f0f10]/95 backdrop-blur" />

      <main className="w-full px-2 py-4 sm:px-4 sm:py-6 md:px-6 lg:px-8 xl:px-10">
        <div className="w-full">
          <header className="w-full overflow-hidden rounded-2xl border border-white/10 bg-[#151516] p-4 shadow-2xl shadow-black/20 sm:p-5 lg:p-6">
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p
                  className="break-words text-[10px] uppercase tracking-[0.35em] text-white/45 sm:text-xs sm:tracking-[0.45em]"
                  style={{ fontFamily: '"Cinzel", Georgia, serif' }}
                >
                  Rebelco
                </p>

                <h1
                  className="mt-2 break-words text-4xl leading-none text-white sm:text-5xl lg:text-6xl"
                  style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                >
                  Product Admin
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
                  Add products, manage specials, upload photos, and review orders.
                </p>
              </div>

              {admin ? (
                <div className="flex w-full min-w-0 flex-col gap-2 rounded-xl border border-white/10 bg-black/35 p-3 sm:w-auto sm:min-w-[260px]">
                  <div className="min-w-0 truncate text-sm text-white/65">{admin.email}</div>

                  <button
                    type="button"
                    onClick={signOut}
                    className="w-full shrink-0 rounded-lg border border-white/15 bg-black px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white/35 hover:bg-white hover:text-black"
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </header>

          {sessionStatus === "checking" ? (
            <section className="mt-4 rounded-2xl border border-white/10 bg-[#151516] p-4 text-white/70">
              Checking admin session...
            </section>
          ) : null}

          {sessionStatus === "signed-out" ? (
            <section className="mx-auto mt-5 w-full max-w-md rounded-2xl border border-white/10 bg-[#151516] p-4 shadow-2xl shadow-black/20 sm:max-w-xl sm:p-6">
              <h2
                className="text-3xl leading-none text-white sm:text-4xl"
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
              >
                Admin Sign In
              </h2>

              <p className="mt-2 text-sm leading-6 text-white/55">
                Sign in with your admin email and password to manage products.
              </p>

              <form className="mt-5 grid gap-4" onSubmit={submitLogin}>
                <label className="grid min-w-0 gap-1.5 text-sm text-white/72">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                    Email
                  </span>

                  <input
                    name="email"
                    type="email"
                    value={loginForm.email}
                    onChange={updateLoginField}
                    required
                    autoComplete="username"
                    className="min-w-0 rounded-xl border border-white/10 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-white/25 focus:border-white/45"
                  />
                </label>

                <label className="grid min-w-0 gap-1.5 text-sm text-white/72">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                    Password
                  </span>

                  <input
                    name="password"
                    type="password"
                    value={loginForm.password}
                    onChange={updateLoginField}
                    required
                    autoComplete="current-password"
                    className="min-w-0 rounded-xl border border-white/10 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-white/25 focus:border-white/45"
                  />
                </label>

                <button
                  type="submit"
                  disabled={loginStatus === "loading"}
                  className="w-full rounded-xl border border-white bg-white px-5 py-3.5 text-sm font-semibold uppercase tracking-[0.2em] text-black transition hover:bg-[#d9d9d9] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {loginStatus === "loading" ? "Signing in..." : "Sign in"}
                </button>
              </form>
            </section>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-xl border border-red-400/30 bg-red-950/25 p-3 text-sm leading-6 text-red-100">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-950/25 p-3 text-sm leading-6 text-emerald-100">
              {message}
            </div>
          ) : null}

          {admin ? (
            <>
              <div className="mt-5 grid w-full min-w-0 gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
                <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#151516] p-4 shadow-2xl shadow-black/20">
                  <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                    <div>
                      <h2
                        className="text-3xl leading-none text-white sm:text-4xl"
                        style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                      >
                        {isEditingProduct ? "Edit Product" : "Add Product"}
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-white/50">
                        {isEditingProduct
                          ? "Update product details and save changes."
                          : "Compact product creation with options and special discounts."}
                      </p>
                    </div>

                    {isEditingProduct ? (
                      <button
                        type="button"
                        onClick={cancelEditingProduct}
                        className="rounded-full border border-red-300/30 bg-red-950/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-red-100/80 transition hover:border-red-200/50 hover:text-red-100"
                      >
                        Cancel Edit
                      </button>
                    ) : null}
                  </div>

                  <form className="mt-5 grid min-w-0 gap-4" onSubmit={submitProduct}>
                    <section className="min-w-0 rounded-2xl border border-white/10 bg-black/25 p-4">
                      <div className="mb-4">
                        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                          Product Info
                        </h3>
                        <p className="mt-1 text-xs text-white/38">
                          Name, description, and collection.
                        </p>
                      </div>

                      <div className="grid min-w-0 gap-3">
                        <label className="grid min-w-0 gap-1.5 text-sm text-white/72">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                            Title
                          </span>
                          <input
                            name="title"
                            value={form.title}
                            onChange={updateField}
                            required
                            placeholder="Product name"
                            className="w-full min-w-0 rounded-xl border border-white/10 bg-black px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/45"
                          />
                        </label>

                        <label className="grid min-w-0 gap-1.5 text-sm text-white/72">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                            Description
                          </span>
                          <textarea
                            name="description"
                            value={form.description}
                            onChange={updateField}
                            required
                            rows={3}
                            placeholder="Short product description"
                            className="w-full min-w-0 resize-none rounded-xl border border-white/10 bg-black px-3.5 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/25 focus:border-white/45"
                          />
                        </label>

                        <label className="grid min-w-0 gap-1.5 text-sm text-white/72">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                            Category
                          </span>
                          <input
                            name="category"
                            value={form.category}
                            onChange={updateField}
                            required
                            placeholder="Example: Soaps, Salves, Balms"
                            list="admin-product-categories"
                            className="w-full min-w-0 rounded-xl border border-white/10 bg-black px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/45"
                          />

                          <datalist id="admin-product-categories">
                            {categories.map((category) => (
                              <option key={category} value={category} />
                            ))}
                          </datalist>

                          {categories.length > 0 ? (
                            <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
                              {categories.map((category) => (
                                <button
                                  key={category}
                                  type="button"
                                  onClick={() => selectExistingCategory(category)}
                                  className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/52 transition hover:border-white/25 hover:text-white"
                                >
                                  {category}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </label>
                      </div>
                    </section>

                    <section className="min-w-0 rounded-2xl border border-white/10 bg-black/25 p-4">
                      <div className="mb-4">
                        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                          Price, Stock & Options
                        </h3>
                        <p className="mt-1 text-xs text-white/38">
                          Add pricing, stock, colors, and scents.
                        </p>
                      </div>

                      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <label className="grid min-w-0 gap-1.5 text-sm text-white/72">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                            Price
                          </span>
                          <input
                            name="price"
                            value={form.price}
                            onChange={updateField}
                            required
                            inputMode="decimal"
                            placeholder="85.00"
                            className="w-full min-w-0 rounded-xl border border-white/10 bg-black px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/45"
                          />
                        </label>

                        <label className="grid min-w-0 gap-1.5 text-sm text-white/72">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                            Weight
                          </span>
                          <input
                            name="weight"
                            value={form.weight}
                            onChange={updateField}
                            required
                            placeholder="120g"
                            className="w-full min-w-0 rounded-xl border border-white/10 bg-black px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/45"
                          />
                        </label>

                        <label className="grid min-w-0 gap-1.5 text-sm text-white/72">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                            Stock
                          </span>
                          <input
                            name="stockAmount"
                            value={form.stockAmount}
                            onChange={updateField}
                            required
                            inputMode="numeric"
                            placeholder="12"
                            className="w-full min-w-0 rounded-xl border border-white/10 bg-black px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/45"
                          />
                        </label>

                        <label className="grid min-w-0 gap-1.5 text-sm text-white/72">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                            Minimum buy
                          </span>
                          <input
                            type="number"
                            name="minimumOrderQuantity"
                            min="1"
                            step="1"
                            value={form.minimumOrderQuantity}
                            onChange={updateField}
                            required
                            inputMode="numeric"
                            placeholder="1"
                            className="w-full min-w-0 rounded-xl border border-white/10 bg-black px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/45"
                          />
                        </label>
                      </div>

                      <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">
                        <label className="grid min-w-0 gap-1.5 text-sm text-white/72">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                            Colors
                          </span>
                          <input
                            name="colors"
                            value={form.colors}
                            onChange={updateField}
                            placeholder="Red, Blue, Natural"
                            list="admin-product-colors"
                            className="w-full min-w-0 rounded-xl border border-white/10 bg-black px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/45"
                          />

                          <datalist id="admin-product-colors">
                            {colorOptions.map((color) => (
                              <option key={color} value={color} />
                            ))}
                          </datalist>

                          {colorOptions.length > 0 ? (
                            <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
                              {colorOptions.map((color) => (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() => selectExistingColor(color)}
                                  className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/52 transition hover:border-white/25 hover:text-white"
                                >
                                  {color}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </label>

                        <label className="grid min-w-0 gap-1.5 text-sm text-white/72">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                            Scents
                          </span>
                          <input
                            name="scents"
                            value={form.scents}
                            onChange={updateField}
                            placeholder="Lavender, Vanilla, Unscented"
                            list="admin-product-scents"
                            className="w-full min-w-0 rounded-xl border border-white/10 bg-black px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/45"
                          />

                          <datalist id="admin-product-scents">
                            {scentOptions.map((scent) => (
                              <option key={scent} value={scent} />
                            ))}
                          </datalist>

                          {scentOptions.length > 0 ? (
                            <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
                              {scentOptions.map((scent) => (
                                <button
                                  key={scent}
                                  type="button"
                                  onClick={() => selectExistingScent(scent)}
                                  className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/52 transition hover:border-white/25 hover:text-white"
                                >
                                  {scent}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </label>
                      </div>
                    </section>

                    <section className="min-w-0 rounded-2xl border border-amber-300/15 bg-amber-950/10 p-4">
                      <div className="mb-4 flex min-w-0 items-center justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-100/80">
                            Special
                          </h3>
                          <p className="mt-1 text-xs text-amber-100/45">
                            Optional discount shown only during selected dates.
                          </p>
                        </div>

                        <label className="flex shrink-0 items-center gap-2 rounded-full border border-amber-300/20 bg-black/40 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-amber-100/75">
                          <input
                            type="checkbox"
                            name="specialOptionEnabled"
                            checked={form.specialOptionEnabled}
                            onChange={updateField}
                            className="h-3.5 w-3.5 accent-amber-200"
                          />
                          Enable
                        </label>
                      </div>

                      {form.specialOptionEnabled ? (
                        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                          <label className="grid min-w-0 gap-1.5 text-sm text-white/72">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/60">
                              Label
                            </span>
                            <input
                              name="specialOptionLabel"
                              value={form.specialOptionLabel}
                              onChange={updateField}
                              placeholder="Special"
                              className="w-full min-w-0 rounded-xl border border-amber-300/15 bg-black px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-amber-200/45"
                            />
                          </label>

                          <label className="grid min-w-0 gap-1.5 text-sm text-white/72">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/60">
                              Discount
                            </span>
                            <input
                              name="specialOptionDiscountAmount"
                              value={form.specialOptionDiscountAmount}
                              onChange={updateField}
                              required={form.specialOptionEnabled}
                              inputMode="decimal"
                              placeholder="15.00"
                              className="w-full min-w-0 rounded-xl border border-amber-300/15 bg-black px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-amber-200/45"
                            />
                          </label>

                          <label className="grid min-w-0 gap-1.5 text-sm text-white/72">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/60">
                              Start Date
                            </span>
                            <input
                              type="date"
                              name="specialOptionStartDate"
                              value={form.specialOptionStartDate}
                              onChange={updateField}
                              required={form.specialOptionEnabled}
                              className="w-full min-w-0 rounded-xl border border-amber-300/15 bg-black px-3.5 py-3 text-sm text-white outline-none transition focus:border-amber-200/45"
                            />
                          </label>

                          <label className="grid min-w-0 gap-1.5 text-sm text-white/72">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/60">
                              End Date
                            </span>
                            <input
                              type="date"
                              name="specialOptionEndDate"
                              value={form.specialOptionEndDate}
                              onChange={updateField}
                              required={form.specialOptionEnabled}
                              className="w-full min-w-0 rounded-xl border border-amber-300/15 bg-black px-3.5 py-3 text-sm text-white outline-none transition focus:border-amber-200/45"
                            />
                          </label>
                        </div>
                      ) : null}
                    </section>

                    <section className="min-w-0 rounded-2xl border border-white/10 bg-black/25 p-4">
                      <div className="mb-4">
                        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                          Images
                        </h3>
                        <p className="mt-1 text-xs text-white/38">
                          {isEditingProduct
                            ? "Manage existing images and add more (up to 6 total)."
                            : `Upload up to ${MAX_PRODUCT_IMAGES}. First image is the main image.`}
                        </p>
                        {isEditingProduct && !canEditExistingImages ? (
                          <p className="mt-2 text-xs text-amber-100/70">
                            This product has legacy image references. You can add images, but existing
                            image removal is disabled for safety.
                          </p>
                        ) : null}
                      </div>

                      <label className="grid min-w-0 gap-2 text-sm text-white/72">
                        <span className="sr-only">Images</span>

                        <input
                          ref={imageInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          multiple
                          onChange={updateImage}
                          className="sr-only"
                        />

                        <button
                          type="button"
                          onClick={openImagePicker}
                          onDrop={handleImageDrop}
                          onDragOver={handleImageDragOver}
                          onDragLeave={handleImageDragLeave}
                          className={`rounded-2xl border border-dashed px-4 py-6 text-left transition ${
                            isImageDropActive
                              ? "border-white/55 bg-white/10"
                              : "border-white/20 bg-black hover:border-white/40 hover:bg-[#161618]"
                          }`}
                        >
                          <div className="pointer-events-none flex flex-col items-center gap-1.5 text-center">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/5 text-lg text-white/80">
                              +
                            </div>
                            <div className="text-xs uppercase tracking-[0.16em] text-white/75">
                              Drop images here
                            </div>
                            <p className="text-xs text-white/45">
                              or click to browse · JPG, PNG, WebP · 4 MB each
                            </p>
                          </div>
                        </button>

                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-[10px] uppercase tracking-[0.16em] text-white/52">
                          <span>
                            {totalSelectedImageCount} / {MAX_PRODUCT_IMAGES} selected
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={openImagePicker}
                              className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] text-white/70 transition hover:border-white/35 hover:text-white"
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={clearSelectedImages}
                              disabled={imageFiles.length === 0}
                              className="rounded-full border border-red-400/25 bg-red-950/25 px-2.5 py-1 text-[10px] text-red-100/80 transition hover:border-red-300/45 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              Clear New
                            </button>
                          </div>
                        </div>
                      </label>

                      {editingExistingImages.length > 0 ? (
                        <div className="mt-3">
                          <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/50">
                            Existing Images ({editingExistingImages.length})
                          </div>
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                            {editingExistingImages.map((image, index) => (
                              <article
                                key={image.key}
                                className="overflow-hidden rounded-xl border border-white/12 bg-[#111112] p-1.5"
                              >
                                <div className="group relative aspect-square overflow-hidden rounded-lg border border-white/15 bg-black">
                                  <img
                                    src={image.url}
                                    alt={`Existing product preview ${index + 1}`}
                                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                  />
                                  <div className="absolute left-1.5 top-1.5 rounded-full border border-white/20 bg-black/70 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-white/70 backdrop-blur">
                                    {index + 1}
                                  </div>
                                  {canEditExistingImages ? (
                                    <button
                                      type="button"
                                      onClick={() => removeEditingExistingImage(image.key)}
                                      className="absolute right-1.5 top-1.5 rounded-full border border-red-300/35 bg-red-950/70 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-red-100 transition hover:border-red-200/60 hover:bg-red-900/80"
                                    >
                                      X
                                    </button>
                                  ) : null}
                                </div>
                                <div className="mt-1 truncate text-[10px] text-white/45">
                                  {image.pathname ? "Tracked image" : "Legacy image"}
                                </div>
                              </article>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {imageFiles.length > 0 ? (
                        <div className="mt-3">
                          <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/50">
                            New Images ({imageFiles.length})
                          </div>
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {imageFiles.map((file, index) => (
                            <article
                              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                              className="overflow-hidden rounded-xl border border-white/12 bg-[#111112] p-1.5"
                            >
                              <div className="group relative aspect-square overflow-hidden rounded-lg border border-white/15 bg-black">
                                <img
                                  src={imagePreviews[index]}
                                  alt={`Selected product preview ${index + 1}`}
                                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                />
                                <div className="absolute left-1.5 top-1.5 rounded-full border border-white/20 bg-black/70 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-white/70 backdrop-blur">
                                  {editingExistingImages.length + index + 1}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeSelectedImage(index)}
                                  className="absolute right-1.5 top-1.5 rounded-full border border-red-300/35 bg-red-950/70 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-red-100 transition hover:border-red-200/60 hover:bg-red-900/80"
                                >
                                  X
                                </button>
                              </div>
                              <div className="mt-1 truncate text-[10px] text-white/60" title={file.name}>
                                {file.name}
                              </div>
                              <div className="text-[9px] uppercase tracking-[0.12em] text-white/35">
                                {formatFileSize(file.size)}
                              </div>
                            </article>
                          ))}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-xs text-white/45">
                          {editingExistingImages.length > 0
                            ? "No new images selected."
                            : "No images selected yet."}
                        </div>
                      )}
                    </section>

                    <div className="sticky bottom-3 z-10 rounded-2xl border border-white/10 bg-[#151516]/95 p-2.5 shadow-2xl shadow-black/40 backdrop-blur">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <button
                          type="submit"
                          disabled={formStatus === "saving"}
                          className="w-full rounded-xl border border-white bg-white px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-black transition hover:bg-[#d9d9d9] disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          {formStatus === "saving"
                            ? isEditingProduct
                              ? "Saving Changes..."
                              : "Saving Product..."
                            : isEditingProduct
                              ? "Save Changes"
                              : "Save Product"}
                        </button>

                        {isEditingProduct ? (
                          <button
                            type="button"
                            onClick={cancelEditingProduct}
                            disabled={formStatus === "saving"}
                            className="w-full rounded-xl border border-white/15 bg-black px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition hover:border-white/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
                          >
                            Cancel Edit
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </form>
                </section>

                <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#151516] p-4 shadow-2xl shadow-black/20 sm:p-5">
                  <div className="flex min-w-0 flex-col gap-3 border-b border-white/10 pb-4">
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div className="min-w-0">
                        <h2
                          className="text-3xl leading-none text-white sm:text-4xl"
                          style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                        >
                          Product Preview
                        </h2>

                        <p className="mt-2 text-sm leading-6 text-white/50">
                          Products are grouped by category.
                        </p>
                      </div>

                      <div className="shrink-0 self-start rounded-full border border-white/10 bg-black px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/55 sm:self-auto">
                        {filteredProducts.length} shown
                      </div>
                    </div>

                    <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
                      <button
                        type="button"
                        onClick={() => setSelectedCategory("all")}
                        className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition ${
                          selectedCategory === "all"
                            ? "border-white bg-white text-black"
                            : "border-white/10 bg-black text-white/55 hover:border-white/25 hover:text-white"
                        }`}
                      >
                        All
                      </button>

                      {categories.map((category) => (
                        <button
                          key={category}
                          type="button"
                          onClick={() => setSelectedCategory(category)}
                          className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition ${
                            selectedCategory === category
                              ? "border-white bg-white text-black"
                              : "border-white/10 bg-black text-white/55 hover:border-white/25 hover:text-white"
                          }`}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>

                  {productsStatus === "loading" ? (
                    <div className="mt-4 rounded-xl border border-white/10 bg-black p-3 text-sm text-white/70">
                      Loading products...
                    </div>
                  ) : null}

                  {groupedProducts.length > 0 ? (
                    <div className="mt-4 grid gap-4">
                      {groupedProducts.map((group) => {
                        const isOpen = openCategories[group.category] !== false;

                        return (
                          <section
                            key={group.category}
                            className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30"
                          >
                            <button
                              type="button"
                              onClick={() => toggleCategory(group.category)}
                              className="flex w-full flex-col gap-3 p-3 text-left transition hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="min-w-0">
                                <h3
                                  className="break-words text-3xl leading-none text-white"
                                  style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                                >
                                  {group.category}
                                </h3>

                                <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/35">
                                  {isOpen ? "Click to collapse" : "Click to expand"}
                                </p>
                              </div>

                              <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
                                <div className="rounded-full border border-white/10 bg-black px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-white/50">
                                  {group.products.length} items
                                </div>

                                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xl text-white/70">
                                  {isOpen ? "−" : "+"}
                                </span>
                              </div>
                            </button>

                            {isOpen ? (
                              <div className="grid min-w-0 gap-3 border-t border-white/10 p-3 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
                                {group.products.map((product) => {
                                  const isOutOfStock = Number(product.stockAmount) <= 0;
                                  const isBusy = Boolean(productActionStatus);
                                  const isCurrentBusy = productActionStatus === product.id;
                                  const stockDraftValue = String(
                                    stockUpdateByProduct[product.id] ??
                                      Math.max(0, Number(product.stockAmount) || 0),
                                  );
                                  const colors = getProductList(product.colors);
                                  const scents = getProductList(product.scents);
                                  const discountAmount = Number(
                                    product.specialOption?.discountAmount || 0,
                                  );
                                  const productImages =
                                    Array.isArray(product.imageUrls) &&
                                    product.imageUrls.length > 0
                                      ? product.imageUrls
                                      : product.imageUrl
                                        ? [product.imageUrl]
                                        : [];
                                  const mainImage = productImages[0];

                                  return (
                                    <article
                                      key={product.id}
                                      className="group min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-black transition duration-300 hover:-translate-y-1 hover:border-white/25"
                                    >
                                      <div className="relative overflow-hidden bg-[#101010]">
                                        {mainImage ? (
                                          <img
                                            src={mainImage}
                                            alt={product.title}
                                            className={`aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-105 ${
                                              isOutOfStock ? "opacity-45 grayscale" : ""
                                            }`}
                                            loading="lazy"
                                          />
                                        ) : (
                                          <div className="flex aspect-[4/5] w-full items-center justify-center bg-black text-sm text-white/35">
                                            No image
                                          </div>
                                        )}

                                        <div className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/70 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/75 backdrop-blur">
                                          {isOutOfStock
                                            ? "Out of stock"
                                            : formatStockAmount(product.stockAmount)}
                                        </div>

                                        <div className="absolute left-3 top-10 rounded-full border border-white/15 bg-black/70 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/75 backdrop-blur">
                                          Min buy {Math.max(1, Number(product.minimumOrderQuantity) || 1)}
                                        </div>

                                        {productImages.length > 1 ? (
                                          <div className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/70 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/75 backdrop-blur">
                                            {productImages.length} photos
                                          </div>
                                        ) : null}

                                        {product.specialOption?.enabled ? (
                                          <div className="absolute bottom-3 left-3 max-w-[calc(100%-24px)] rounded-full border border-amber-300/25 bg-amber-950/80 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-100 backdrop-blur">
                                            <span className="block truncate">
                                              {product.specialOption.label || "Special"}
                                              {discountAmount > 0
                                                ? ` · Save ${formatPrice(discountAmount)}`
                                                : ""}
                                            </span>
                                          </div>
                                        ) : product.category ? (
                                          <div className="absolute bottom-3 left-3 max-w-[calc(100%-24px)] rounded-full border border-white/15 bg-black/70 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/75 backdrop-blur">
                                            <span className="block truncate">
                                              {product.category}
                                            </span>
                                          </div>
                                        ) : null}
                                      </div>

                                      <div className="min-w-0 p-3">
                                        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                          <h3
                                            className="min-w-0 break-words text-2xl leading-none text-white"
                                            style={{
                                              fontFamily: '"Cormorant Garamond", Georgia, serif',
                                            }}
                                          >
                                            {product.title}
                                          </h3>

                                          <div className="shrink-0 self-start rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/80 sm:self-auto">
                                            {formatPrice(product.price)}
                                          </div>
                                        </div>

                                        <p className="mt-2 line-clamp-2 break-words text-xs leading-5 text-white/55">
                                          {product.description}
                                        </p>

                                        {colors.length > 0 ? (
                                          <div className="mt-2">
                                            <div className="text-[9px] uppercase tracking-[0.16em] text-white/35">
                                              Colors
                                            </div>
                                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                              {colors.map((color) => (
                                                <span
                                                  key={`${product.id}-admin-color-${color}`}
                                                  className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/55"
                                                >
                                                  {color}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        ) : null}

                                        {scents.length > 0 ? (
                                          <div className="mt-2">
                                            <div className="text-[9px] uppercase tracking-[0.16em] text-white/35">
                                              Scents
                                            </div>
                                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                              {scents.map((scent) => (
                                                <span
                                                  key={`${product.id}-admin-scent-${scent}`}
                                                  className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/55"
                                                >
                                                  {scent}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        ) : null}

                                        {product.specialOption?.enabled ? (
                                          <div className="mt-2 rounded-xl border border-amber-300/25 bg-amber-950/20 p-2 text-[10px] leading-4 text-amber-100">
                                            <div className="font-semibold uppercase tracking-[0.16em]">
                                              {product.specialOption.label || "Special Option"}
                                            </div>
                                            <div className="mt-1 text-amber-100/70">
                                              {product.specialOption.startDate} to{" "}
                                              {product.specialOption.endDate}
                                            </div>
                                            {discountAmount > 0 ? (
                                              <div className="mt-1 font-semibold text-amber-100">
                                                Save {formatPrice(discountAmount)}
                                              </div>
                                            ) : null}
                                          </div>
                                        ) : null}

                                        <div className="mt-3 grid gap-2 border-t border-white/10 pt-3">
                                          <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">
                                            Update Stock
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <input
                                              type="number"
                                              min="0"
                                              step="1"
                                              value={stockDraftValue}
                                              onChange={(event) =>
                                                updateStockInput(product.id, event.target.value)
                                              }
                                              disabled={isBusy}
                                              className="w-24 rounded-full border border-white/10 bg-black px-3 py-1.5 text-xs text-white outline-none transition focus:border-white/45 disabled:cursor-not-allowed disabled:opacity-50"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => updateProductStockAmount(product.id)}
                                              disabled={isBusy}
                                              className="rounded-full border border-emerald-300/25 bg-emerald-950/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-emerald-100/80 transition hover:border-emerald-200/55 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                              {isCurrentBusy ? "Saving..." : "Save stock"}
                                            </button>
                                          </div>
                                        </div>

                                        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-1.5 border-t border-white/10 pt-3">
                                          <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-white/50">
                                            {product.weight}
                                          </span>

                                          <button
                                            type="button"
                                            onClick={() => startEditingProduct(product)}
                                            disabled={isBusy}
                                            className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-40 ${
                                              editingProductId === product.id
                                                ? "border-white bg-white text-black"
                                                : "border-white/10 bg-white/5 text-white/65 hover:border-white/35 hover:text-white"
                                            }`}
                                          >
                                            {editingProductId === product.id ? "Editing" : "Edit"}
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => setOutOfStock(product.id)}
                                            disabled={isBusy || isOutOfStock}
                                            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/55 transition hover:border-amber-200/50 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                                          >
                                            {isCurrentBusy ? "Saving..." : "Out of stock"}
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => removeProduct(product.id)}
                                            disabled={isBusy}
                                            className="rounded-full border border-red-400/20 bg-red-950/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-red-100/75 transition hover:border-red-300/50 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                                          >
                                            Remove
                                          </button>
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
                    </div>
                  ) : null}

                  {productsStatus === "ready" && groupedProducts.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black p-4 text-sm leading-6 text-white/65">
                      {products.length === 0
                        ? "No products saved yet. Once you add a product, it will appear here."
                        : "No products match this category filter."}
                    </div>
                  ) : null}
                </section>
              </div>

              <section className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#151516] shadow-2xl shadow-black/20">
                <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2
                      className="text-3xl leading-none text-white sm:text-4xl"
                      style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                    >
                      Orders
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-white/50">
                      Customer orders with quantity, location, proof-of-payment, and delivery
                      organization status.
                    </p>
                  </div>

                  <div className="self-start rounded-full border border-white/10 bg-black px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/55 sm:self-auto">
                    {orders.length} total
                  </div>
                </div>

                {ordersStatus === "loading" ? (
                  <div className="p-5 text-sm text-white/70">Loading orders...</div>
                ) : null}

                {ordersStatus === "ready" && orders.length === 0 ? (
                  <div className="p-5 text-sm text-white/65">
                    No orders yet. New orders from the product page will appear here.
                  </div>
                ) : null}

                {orders.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1380px] text-left text-sm text-white/80">
                      <thead className="bg-black/40 text-xs uppercase tracking-[0.16em] text-white/50">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Placed</th>
                          <th className="px-4 py-3 font-semibold">Product</th>
                          <th className="px-4 py-3 font-semibold">Price</th>
                          <th className="px-4 py-3 font-semibold">Quantity</th>
                          <th className="px-4 py-3 font-semibold">Location (Text)</th>
                          <th className="px-4 py-3 font-semibold">Google Maps Location</th>
                          <th className="px-4 py-3 font-semibold">PUDO Lockers</th>
                          <th className="px-4 py-3 font-semibold">Payment & Delivery</th>
                        </tr>
                      </thead>

                      <tbody>
                        {orders.map((order) => {
                          const googleMapsUrl = buildGoogleMapsUrl(order.googleMapsLocation);
                          const isBusy = Boolean(orderActionStatus);
                          const isCurrentBusy = orderActionStatus === order.id;
                          const pudoLookupState = pudoLookupByOrder[order.id] || {};
                          const pudoStatus = pudoLookupState.status || "idle";
                          const pudoLockers = Array.isArray(pudoLookupState.lockers)
                            ? pudoLookupState.lockers
                            : [];
                          const pudoProvider = String(pudoLookupState.provider || "");
                          const showPudoProvider =
                            pudoStatus === "ready" &&
                            pudoProvider &&
                            pudoProvider !== "none" &&
                            pudoProvider !== "unavailable";
                          const hasLookupInput = Boolean(parseLatLngText(order.googleMapsLocation));
                          const selectedLockerCode = String(order.pudoLockerCode || "").trim();
                          const selectedLockerName = String(order.pudoLockerName || "").trim();
                          const selectedLockerAddress = String(order.pudoLockerAddress || "").trim();
                          const hasSelectedLocker = Boolean(
                            selectedLockerCode || selectedLockerName || selectedLockerAddress,
                          );
                          const selectedLockerMapsLabel =
                            selectedLockerAddress || selectedLockerName || selectedLockerCode;
                          const selectedLockerMapsUrl = selectedLockerMapsLabel
                            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedLockerMapsLabel)}`
                            : "";

                          return (
                            <tr key={order.id} className="border-t border-white/10 align-top">
                              <td className="px-4 py-4 text-xs text-white/60">
                                {formatDateTime(order.createdAt)}
                              </td>

                              <td className="px-4 py-4">
                                <div className="font-semibold text-white">{order.productTitle}</div>
                                <div className="mt-1 text-xs text-white/55">
                                  {order.productCategory || "Uncategorised"}
                                </div>
                              </td>

                              <td className="px-4 py-4">{formatPrice(order.productPrice)}</td>

                              <td className="px-4 py-4">
                                <span className="rounded-full border border-white/10 bg-black px-3 py-1 text-xs uppercase tracking-[0.16em] text-white/70">
                                  {order.quantity}
                                </span>
                              </td>

                              <td className="px-4 py-4 text-sm leading-6 text-white/70">
                                {order.locationText || "Not provided"}
                              </td>

                              <td className="px-4 py-4 text-xs text-white/65">
                                {googleMapsUrl ? (
                                  <a
                                    href={googleMapsUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline-offset-4 hover:text-white hover:underline"
                                  >
                                    {order.googleMapsLocation}
                                  </a>
                                ) : (
                                  "Not provided"
                                )}
                              </td>

                              <td className="px-4 py-4">
                                <div className="min-w-[240px]">
                                  {hasSelectedLocker ? (
                                    <div className="rounded-lg border border-emerald-400/25 bg-emerald-950/15 p-2 text-xs">
                                      <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-100/75">
                                        Customer Selected Locker
                                      </div>
                                      <div className="mt-1 font-semibold text-emerald-100">
                                        {selectedLockerName || selectedLockerCode || "Locker selected"}
                                      </div>
                                      <div className="mt-1 text-emerald-100/70">
                                        {[selectedLockerCode, selectedLockerAddress]
                                          .filter(Boolean)
                                          .join(" - ") || "Address unavailable"}
                                      </div>
                                      {selectedLockerMapsUrl ? (
                                        <a
                                          href={selectedLockerMapsUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="mt-2 inline-block text-[10px] uppercase tracking-[0.14em] text-emerald-100/75 underline-offset-4 hover:text-emerald-100 hover:underline"
                                        >
                                          Open selected locker
                                        </a>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <div className="rounded-lg border border-amber-300/25 bg-amber-950/15 p-2 text-xs text-amber-100/80">
                                      Customer did not save a specific locker selection.
                                    </div>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => lookupPudoLockers(order)}
                                    disabled={pudoStatus === "loading" || !hasLookupInput}
                                    className="mt-2 rounded-full border border-white/15 bg-black px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-white/75 transition hover:border-white/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    {pudoStatus === "loading"
                                      ? "Loading..."
                                      : hasSelectedLocker
                                        ? "Find Alternative Nearby Lockers"
                                        : "Find Nearby PUDO Lockers"}
                                  </button>

                                  {!hasLookupInput ? (
                                    <div className="mt-2 text-xs text-white/50">
                                      No order coordinates available for lookup.
                                    </div>
                                  ) : null}

                                  {showPudoProvider ? (
                                    <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-white/45">
                                      Source: {pudoProvider}
                                    </div>
                                  ) : null}

                                  {pudoStatus === "error" ? (
                                    <div className="mt-2 text-xs leading-5 text-red-200/85">
                                      {pudoLookupState.message || "Could not load lockers."}
                                    </div>
                                  ) : null}

                                  {pudoStatus === "ready" && pudoLockers.length === 0 ? (
                                    <div className="mt-2 text-xs text-white/55">
                                      {pudoLookupState.message || "No nearby lockers found."}
                                    </div>
                                  ) : null}

                                  {pudoLockers.length > 0 ? (
                                    <div className="mt-2 grid gap-2">
                                      {pudoLockers.map((locker, index) => {
                                        const lockerName = locker.name || locker.code || "Locker";
                                        const mapsLabel = locker.address || lockerName;
                                        const lockerMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsLabel)}`;

                                        return (
                                          <div
                                            key={`${order.id}-${locker.code || lockerName}-${index}`}
                                            className="rounded-lg border border-white/10 bg-black/40 p-2 text-xs"
                                          >
                                            <div className="font-semibold text-white">
                                              {lockerName}
                                            </div>
                                            <div className="mt-1 text-white/60">
                                              {[locker.code, locker.address]
                                                .filter(Boolean)
                                                .join(" - ") || "Address unavailable"}
                                            </div>
                                            <div className="mt-1 text-white/45">
                                              {[locker.town, locker.postalCode]
                                                .filter(Boolean)
                                                .join(" - ")}
                                            </div>
                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                              {Number.isFinite(locker.distanceKm) ? (
                                                <span className="rounded-full border border-white/15 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white/65">
                                                  {locker.distanceKm.toFixed(2)} km
                                                </span>
                                              ) : null}
                                              <a
                                                href={lockerMapsUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-[10px] uppercase tracking-[0.14em] text-white/70 underline-offset-4 hover:text-white hover:underline"
                                              >
                                                Open on map
                                              </a>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                              </td>

                              <td className="px-4 py-4">
                                <div className="min-w-[220px] space-y-2">
                                  <div className="rounded-lg border border-white/10 bg-black/40 p-2 text-xs">
                                    <label className="flex items-center gap-3 uppercase tracking-[0.14em] text-white/70">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(order.proofOfPaymentReceived)}
                                        onChange={(event) =>
                                          setProofOfPaymentReceived(order.id, event.target.checked)
                                        }
                                        disabled={isBusy}
                                        className="h-4 w-4 cursor-pointer rounded border border-white/20 bg-black"
                                      />
                                      <span>
                                        {isCurrentBusy
                                          ? "Saving..."
                                          : order.proofOfPaymentReceived
                                            ? "Proof received"
                                            : "Awaiting proof"}
                                      </span>
                                    </label>
                                  </div>

                                  <div className="rounded-lg border border-white/10 bg-black/40 p-2 text-xs">
                                    <label className="flex items-center gap-3 uppercase tracking-[0.14em] text-white/70">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(order.deliveryOrganized)}
                                        onChange={(event) =>
                                          setDeliveryOrganized(order.id, event.target.checked)
                                        }
                                        disabled={isBusy || !order.proofOfPaymentReceived}
                                        className="h-4 w-4 cursor-pointer rounded border border-white/20 bg-black"
                                      />
                                      <span>
                                        {isCurrentBusy
                                          ? "Saving..."
                                          : order.deliveryOrganized
                                            ? "Delivery organized"
                                            : order.proofOfPaymentReceived
                                              ? "Ready to organize"
                                              : "Locked until proof"}
                                      </span>
                                    </label>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </section>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
