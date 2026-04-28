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
};

const initialLoginForm = {
  email: "",
  password: "",
};

export default function AdminaPage() {
  const imageInputRef = useRef(null);

  const [admin, setAdmin] = useState(null);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [sessionStatus, setSessionStatus] = useState("checking");
  const [productsStatus, setProductsStatus] = useState("idle");
  const [formStatus, setFormStatus] = useState("idle");
  const [loginStatus, setLoginStatus] = useState("idle");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [openCategories, setOpenCategories] = useState({});
  const [productActionStatus, setProductActionStatus] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

  const loadProducts = useCallback(async () => {
    setProductsStatus("loading");

    try {
      const response = await fetch("/api/admin/products", {
        headers: { Accept: "application/json" },
        credentials: "include",
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
  }, [loadProducts]);

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
    } catch (loginError) {
      setError(loginError.message);
      setLoginStatus("idle");
    }
  }

  function updateField(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function useExistingCategory(category) {
    setForm((currentForm) => ({
      ...currentForm,
      category,
    }));
  }

  function toggleCategory(category) {
    setOpenCategories((current) => ({
      ...current,
      [category]: current[category] === false,
    }));
  }

  function updateImage(event) {
    const files = Array.from(event.target.files || []).slice(0, 6);

    imagePreviews.forEach((preview) => URL.revokeObjectURL(preview));

    setImageFiles(files);
    setImagePreviews(files.map((file) => URL.createObjectURL(file)));
  }

  function resetForm() {
    imagePreviews.forEach((preview) => URL.revokeObjectURL(preview));

    setForm(initialForm);
    setImageFiles([]);
    setImagePreviews([]);

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  async function submitProduct(event) {
    event.preventDefault();

    setError("");
    setMessage("");
    setFormStatus("saving");

    try {
      const formData = new FormData();

      formData.append("title", form.title);
      formData.append("description", form.description);
      formData.append("category", form.category);
      formData.append("price", form.price);
      formData.append("weight", form.weight);
      formData.append("stockAmount", form.stockAmount);

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
      setFormStatus("idle");
    } catch (saveError) {
      setError(saveError.message);
      setFormStatus("idle");
    }
  }

  async function setOutOfStock(productId) {
    setError("");
    setMessage("");
    setProductActionStatus(productId);

    try {
      const response = await fetch("/api/admin/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: productId,
          action: "set-out-of-stock",
        }),
      });

      const data = await readJsonResponse(response, "Product could not be updated.");

      setProducts(data.products || []);
      setMessage("Product set out of stock.");
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setProductActionStatus("");
    }
  }

  async function removeProduct(productId) {
    const confirmed = window.confirm("Remove this product from the catalog?");

    if (!confirmed) {
      return;
    }

    setError("");
    setMessage("");
    setProductActionStatus(productId);

    try {
      const response = await fetch("/api/admin/products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: productId }),
      });

      const data = await readJsonResponse(response, "Product could not be removed.");

      setProducts(data.products || []);
      setMessage("Product removed.");
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setProductActionStatus("");
    }
  }

  async function signOut() {
    await fetch("/api/admin/session", {
      method: "DELETE",
      credentials: "include",
    });

    setAdmin(null);
    setProducts([]);
    setSessionStatus("signed-out");
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0f0f10] text-white">
      <Navbar className="border-b border-white/10 bg-[#0f0f10]/95 backdrop-blur" />

      <main className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <div className="mx-auto w-full max-w-7xl">
          <header className="w-full overflow-hidden rounded-2xl border border-white/10 bg-[#151516] p-5 shadow-2xl shadow-black/20 sm:p-8">
            <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p
                  className="text-xs uppercase tracking-[0.45em] text-white/45"
                  style={{ fontFamily: '"Cinzel", Georgia, serif' }}
                >
                  Rebelco
                </p>

                <h1
                  className="mt-3 break-words text-4xl leading-none text-white sm:text-5xl lg:text-6xl"
                  style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                >
                  Product Admin
                </h1>

                <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55">
                  Add products, upload multiple photos, manage stock, remove old items, and
                  organise the catalog by category.
                </p>
              </div>

              {admin ? (
                <div className="flex w-full min-w-0 flex-col gap-3 rounded-xl border border-white/10 bg-black/35 p-4 sm:w-auto sm:flex-row sm:items-center">
                  <div className="min-w-0 truncate text-sm text-white/65">{admin.email}</div>

                  <button
                    type="button"
                    onClick={signOut}
                    className="shrink-0 rounded-lg border border-white/15 bg-black px-5 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:border-white/35 hover:bg-white hover:text-black"
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </header>

          {sessionStatus === "checking" ? (
            <section className="mt-6 rounded-2xl border border-white/10 bg-[#151516] p-6 text-white/70">
              Checking admin session...
            </section>
          ) : null}

          {sessionStatus === "signed-out" ? (
            <section className="mt-6 w-full max-w-xl rounded-2xl border border-white/10 bg-[#151516] p-5 shadow-2xl shadow-black/20 sm:p-8">
              <h2
                className="text-3xl leading-none text-white"
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
              >
                Admin Sign In
              </h2>

              <p className="mt-3 text-sm leading-6 text-white/55">
                Sign in with your admin email and password to manage products.
              </p>

              <form className="mt-6 grid gap-5" onSubmit={submitLogin}>
                <label className="grid min-w-0 gap-2 text-sm text-white/72">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em]">
                    Email
                  </span>

                  <input
                    name="email"
                    type="email"
                    value={loginForm.email}
                    onChange={updateLoginField}
                    required
                    autoComplete="username"
                    className="min-w-0 rounded-xl border border-white/10 bg-black px-4 py-3.5 text-base text-white outline-none transition placeholder:text-white/25 focus:border-white/45"
                  />
                </label>

                <label className="grid min-w-0 gap-2 text-sm text-white/72">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em]">
                    Password
                  </span>

                  <input
                    name="password"
                    type="password"
                    value={loginForm.password}
                    onChange={updateLoginField}
                    required
                    autoComplete="current-password"
                    className="min-w-0 rounded-xl border border-white/10 bg-black px-4 py-3.5 text-base text-white outline-none transition placeholder:text-white/25 focus:border-white/45"
                  />
                </label>

                <button
                  type="submit"
                  disabled={loginStatus === "loading"}
                  className="rounded-xl border border-white bg-white px-5 py-4 text-sm font-semibold uppercase tracking-[0.22em] text-black transition hover:bg-[#d9d9d9] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {loginStatus === "loading" ? "Signing in..." : "Sign in"}
                </button>
              </form>
            </section>
          ) : null}

          {error ? (
            <div className="mt-6 rounded-xl border border-red-400/30 bg-red-950/25 p-4 text-sm leading-6 text-red-100">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="mt-6 rounded-xl border border-emerald-400/30 bg-emerald-950/25 p-4 text-sm leading-6 text-emerald-100">
              {message}
            </div>
          ) : null}

          {admin ? (
            <div className="mt-6 grid w-full min-w-0 gap-6 xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
              <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#151516] p-5 shadow-2xl shadow-black/20 sm:p-8">
                <div className="border-b border-white/10 pb-5">
                  <h2
                    className="text-3xl leading-none text-white"
                    style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                  >
                    Add Product
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-white/50">
                    Add product details, choose a category, and upload up to 6 product
                    photos.
                  </p>
                </div>

                <form className="mt-6 grid min-w-0 gap-5" onSubmit={submitProduct}>
                  <label className="grid min-w-0 gap-2 text-sm text-white/72">
                    <span className="text-xs font-semibold uppercase tracking-[0.22em]">
                      Title
                    </span>

                    <input
                      name="title"
                      value={form.title}
                      onChange={updateField}
                      required
                      placeholder="Product name"
                      className="min-w-0 rounded-xl border border-white/10 bg-black px-4 py-3.5 text-base text-white outline-none transition placeholder:text-white/25 focus:border-white/45"
                    />
                  </label>

                  <label className="grid min-w-0 gap-2 text-sm text-white/72">
                    <span className="text-xs font-semibold uppercase tracking-[0.22em]">
                      Description
                    </span>

                    <textarea
                      name="description"
                      value={form.description}
                      onChange={updateField}
                      required
                      rows={5}
                      placeholder="Short product description"
                      className="min-w-0 resize-none rounded-xl border border-white/10 bg-black px-4 py-3.5 text-base leading-7 text-white outline-none transition placeholder:text-white/25 focus:border-white/45"
                    />
                  </label>

                  <label className="grid min-w-0 gap-2 text-sm text-white/72">
                    <span className="text-xs font-semibold uppercase tracking-[0.22em]">
                      Category
                    </span>

                    <input
                      name="category"
                      value={form.category}
                      onChange={updateField}
                      required
                      placeholder="Example: Soaps, Salves, Balms"
                      list="admin-product-categories"
                      className="min-w-0 rounded-xl border border-white/10 bg-black px-4 py-3.5 text-base text-white outline-none transition placeholder:text-white/25 focus:border-white/45"
                    />

                    <datalist id="admin-product-categories">
                      {categories.map((category) => (
                        <option key={category} value={category} />
                      ))}
                    </datalist>

                    {categories.length > 0 ? (
                      <div className="flex min-w-0 flex-wrap gap-2 pt-1">
                        {categories.map((category) => (
                          <button
                            key={category}
                            type="button"
                            onClick={() => useExistingCategory(category)}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-white/55 transition hover:border-white/25 hover:text-white"
                          >
                            {category}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </label>

                  <div className="grid min-w-0 gap-5 sm:grid-cols-3">
                    <label className="grid min-w-0 gap-2 text-sm text-white/72">
                      <span className="text-xs font-semibold uppercase tracking-[0.22em]">
                        Price
                      </span>

                      <input
                        name="price"
                        value={form.price}
                        onChange={updateField}
                        required
                        inputMode="decimal"
                        placeholder="85.00"
                        className="min-w-0 rounded-xl border border-white/10 bg-black px-4 py-3.5 text-base text-white outline-none transition placeholder:text-white/25 focus:border-white/45"
                      />
                    </label>

                    <label className="grid min-w-0 gap-2 text-sm text-white/72">
                      <span className="text-xs font-semibold uppercase tracking-[0.22em]">
                        Weight
                      </span>

                      <input
                        name="weight"
                        value={form.weight}
                        onChange={updateField}
                        required
                        placeholder="120g"
                        className="min-w-0 rounded-xl border border-white/10 bg-black px-4 py-3.5 text-base text-white outline-none transition placeholder:text-white/25 focus:border-white/45"
                      />
                    </label>

                    <label className="grid min-w-0 gap-2 text-sm text-white/72">
                      <span className="text-xs font-semibold uppercase tracking-[0.22em]">
                        Stock
                      </span>

                      <input
                        name="stockAmount"
                        value={form.stockAmount}
                        onChange={updateField}
                        required
                        inputMode="numeric"
                        placeholder="12"
                        className="min-w-0 rounded-xl border border-white/10 bg-black px-4 py-3.5 text-base text-white outline-none transition placeholder:text-white/25 focus:border-white/45"
                      />
                    </label>
                  </div>

                  <label className="grid min-w-0 gap-2 text-sm text-white/72">
                    <span className="text-xs font-semibold uppercase tracking-[0.22em]">
                      Images
                    </span>

                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      multiple
                      onChange={updateImage}
                      required
                      className="min-w-0 rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black"
                    />

                    <p className="text-xs leading-5 text-white/40">
                      Upload up to 6 images. Each image must be JPG, PNG, or WebP and 4 MB
                      or smaller.
                    </p>
                  </label>

                  {imagePreviews.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {imagePreviews.map((preview, index) => (
                        <div
                          key={preview}
                          className="aspect-square overflow-hidden rounded-xl border border-white/10 bg-black"
                        >
                          <img
                            src={preview}
                            alt={`Selected product preview ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={formStatus === "saving"}
                    className="mt-2 rounded-xl border border-white bg-white px-5 py-4 text-sm font-semibold uppercase tracking-[0.22em] text-black transition hover:bg-[#d9d9d9] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {formStatus === "saving" ? "Saving..." : "Save Product"}
                  </button>
                </form>
              </section>

              <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#151516] p-5 shadow-2xl shadow-black/20 sm:p-8">
                <div className="flex min-w-0 flex-col gap-4 border-b border-white/10 pb-5">
                  <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                      <h2
                        className="text-3xl leading-none text-white"
                        style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                      >
                        Product Preview
                      </h2>

                      <p className="mt-3 text-sm leading-6 text-white/50">
                        Products are grouped by category. Click a category to expand or
                        collapse its products.
                      </p>
                    </div>

                    <div className="shrink-0 rounded-full border border-white/10 bg-black px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
                      {filteredProducts.length} shown
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory("all")}
                      className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
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
                        className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
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
                  <div className="mt-6 rounded-xl border border-white/10 bg-black p-4 text-white/70">
                    Loading products...
                  </div>
                ) : null}

                {groupedProducts.length > 0 ? (
                  <div className="mt-6 grid gap-5">
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
                            className="flex w-full items-center justify-between gap-4 p-4 text-left transition hover:bg-white/[0.03]"
                          >
                            <div className="min-w-0">
                              <h3
                                className="break-words text-3xl leading-none text-white"
                                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                              >
                                {group.category}
                              </h3>

                              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/35">
                                {isOpen ? "Click to collapse" : "Click to expand"}
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-3">
                              <div className="rounded-full border border-white/10 bg-black px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/50">
                                {group.products.length} items
                              </div>

                              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xl text-white/70">
                                {isOpen ? "−" : "+"}
                              </span>
                            </div>
                          </button>

                          {isOpen ? (
                            <div className="grid min-w-0 gap-5 border-t border-white/10 p-4 sm:grid-cols-2 2xl:grid-cols-3">
                              {group.products.map((product) => {
                                const isOutOfStock = Number(product.stockAmount) <= 0;
                                const isBusy = productActionStatus === product.id;
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

                                      <div className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/75 backdrop-blur">
                                        {isOutOfStock
                                          ? "Out of stock"
                                          : formatStockAmount(product.stockAmount)}
                                      </div>

                                      {productImages.length > 1 ? (
                                        <div className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/75 backdrop-blur">
                                          {productImages.length} photos
                                        </div>
                                      ) : null}

                                      {product.category ? (
                                        <div className="absolute bottom-3 left-3 max-w-[calc(100%-24px)] rounded-full border border-white/15 bg-black/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/75 backdrop-blur">
                                          <span className="block truncate">
                                            {product.category}
                                          </span>
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
                                            className="aspect-square rounded-lg object-cover"
                                            loading="lazy"
                                          />
                                        ))}
                                      </div>
                                    ) : null}

                                    <div className="min-w-0 p-4">
                                      <div className="flex min-w-0 items-start justify-between gap-3">
                                        <h3
                                          className="min-w-0 break-words text-2xl leading-none text-white"
                                          style={{
                                            fontFamily: '"Cormorant Garamond", Georgia, serif',
                                          }}
                                        >
                                          {product.title}
                                        </h3>

                                        <div className="shrink-0 rounded-full border border-white/10 px-3 py-1 text-sm text-white/80">
                                          {formatPrice(product.price)}
                                        </div>
                                      </div>

                                      <p className="mt-3 line-clamp-3 break-words text-sm leading-6 text-white/55">
                                        {product.description}
                                      </p>

                                      <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2 border-t border-white/10 pt-4">
                                        <span className="rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/50">
                                          {product.weight}
                                        </span>

                                        <button
                                          type="button"
                                          onClick={() => setOutOfStock(product.id)}
                                          disabled={isBusy || isOutOfStock}
                                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-white/55 transition hover:border-amber-200/50 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                          {isBusy ? "Saving..." : "Out of stock"}
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => removeProduct(product.id)}
                                          disabled={isBusy}
                                          className="rounded-full border border-red-400/20 bg-red-950/20 px-3 py-1 text-xs uppercase tracking-[0.16em] text-red-100/75 transition hover:border-red-300/50 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-40"
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
                  <div className="mt-6 rounded-2xl border border-white/10 bg-black p-6 text-sm leading-6 text-white/65">
                    {products.length === 0
                      ? "No products saved yet. Once you add a product, it will appear here."
                      : "No products match this category filter."}
                  </div>
                ) : null}
              </section>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}