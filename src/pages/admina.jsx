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

  const outOfStockCount = useMemo(
    () => products.filter((product) => Number(product.stockAmount) <= 0).length,
    [products],
  );

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
      setMessage("Product added to the collection.");
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
      setMessage("Product marked as out of stock.");
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setProductActionStatus("");
    }
  }

  async function removeProduct(productId) {
    const confirmed = window.confirm("Remove this product from the collection?");

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
      setMessage("Product removed from the collection.");
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
    <div className="min-h-screen overflow-x-hidden bg-[#0d0d0b] text-[#f7f1e8]">
      <Navbar className="border-b border-[#d8c7a3]/10 bg-[#0d0d0b]/95 backdrop-blur" />

      <main className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <div className="mx-auto w-full max-w-7xl">
          <header className="relative w-full overflow-hidden rounded-[2rem] border border-[#d8c7a3]/15 bg-[radial-gradient(circle_at_top_left,_rgba(216,199,163,0.16),_transparent_34%),linear-gradient(135deg,_#191714,_#10100e)] p-6 shadow-2xl shadow-black/30 sm:p-8 lg:p-10">
            <div className="relative z-10 flex min-w-0 flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p
                  className="text-xs uppercase tracking-[0.55em] text-[#d8c7a3]/65"
                  style={{ fontFamily: '"Cinzel", Georgia, serif' }}
                >
                  Rebelco Apothecary
                </p>

                <h1
                  className="mt-4 max-w-3xl break-words text-5xl leading-[0.9] text-[#fff8ef] sm:text-6xl lg:text-7xl"
                  style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                >
                  Product Studio
                </h1>

                <p className="mt-5 max-w-2xl text-sm leading-7 text-[#f7f1e8]/62 sm:text-base">
                  Curate soaps, salves, balms, oils, and handcrafted body-care products
                  before they appear in the Rebelco storefront.
                </p>

                {admin ? (
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-[#d8c7a3]/10 bg-black/25 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-[#d8c7a3]/50">
                        Products
                      </p>
                      <p className="mt-2 text-2xl text-[#fff8ef]">{products.length}</p>
                    </div>

                    <div className="rounded-2xl border border-[#d8c7a3]/10 bg-black/25 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-[#d8c7a3]/50">
                        Categories
                      </p>
                      <p className="mt-2 text-2xl text-[#fff8ef]">{categories.length}</p>
                    </div>

                    <div className="rounded-2xl border border-[#d8c7a3]/10 bg-black/25 p-4">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-[#d8c7a3]/50">
                        Out of stock
                      </p>
                      <p className="mt-2 text-2xl text-[#fff8ef]">{outOfStockCount}</p>
                    </div>
                  </div>
                ) : null}
              </div>

              {admin ? (
                <div className="flex w-full min-w-0 flex-col gap-3 rounded-2xl border border-[#d8c7a3]/10 bg-black/35 p-4 sm:w-auto">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.28em] text-[#d8c7a3]/45">
                      Signed in
                    </p>
                    <div className="mt-1 min-w-0 truncate text-sm text-[#f7f1e8]/70">
                      {admin.email}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={signOut}
                    className="shrink-0 rounded-xl border border-[#d8c7a3]/20 bg-[#0b0b09] px-5 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-[#f7f1e8] transition hover:border-[#d8c7a3]/50 hover:bg-[#f7f1e8] hover:text-black"
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </header>

          {sessionStatus === "checking" ? (
            <section className="mt-6 rounded-3xl border border-[#d8c7a3]/10 bg-[#15130f] p-6 text-[#f7f1e8]/70">
              Checking admin session...
            </section>
          ) : null}

          {sessionStatus === "signed-out" ? (
            <section className="mt-6 w-full max-w-xl rounded-3xl border border-[#d8c7a3]/10 bg-[#15130f] p-6 shadow-2xl shadow-black/25 sm:p-8">
              <p className="text-xs uppercase tracking-[0.35em] text-[#d8c7a3]/50">
                Private access
              </p>

              <h2
                className="mt-3 text-4xl leading-none text-[#fff8ef]"
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
              >
                Admin Sign In
              </h2>

              <p className="mt-4 text-sm leading-7 text-[#f7f1e8]/55">
                Sign in to manage the Rebelco product collection.
              </p>

              <form className="mt-7 grid gap-5" onSubmit={submitLogin}>
                <label className="grid min-w-0 gap-2 text-sm text-[#f7f1e8]/72">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d8c7a3]/70">
                    Email
                  </span>

                  <input
                    name="email"
                    type="email"
                    value={loginForm.email}
                    onChange={updateLoginField}
                    required
                    autoComplete="username"
                    className="min-w-0 rounded-2xl border border-[#d8c7a3]/10 bg-black/60 px-4 py-4 text-base text-[#fff8ef] outline-none transition placeholder:text-[#f7f1e8]/25 focus:border-[#d8c7a3]/45"
                  />
                </label>

                <label className="grid min-w-0 gap-2 text-sm text-[#f7f1e8]/72">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d8c7a3]/70">
                    Password
                  </span>

                  <input
                    name="password"
                    type="password"
                    value={loginForm.password}
                    onChange={updateLoginField}
                    required
                    autoComplete="current-password"
                    className="min-w-0 rounded-2xl border border-[#d8c7a3]/10 bg-black/60 px-4 py-4 text-base text-[#fff8ef] outline-none transition placeholder:text-[#f7f1e8]/25 focus:border-[#d8c7a3]/45"
                  />
                </label>

                <button
                  type="submit"
                  disabled={loginStatus === "loading"}
                  className="rounded-2xl border border-[#d8c7a3] bg-[#f7f1e8] px-5 py-4 text-sm font-semibold uppercase tracking-[0.24em] text-black transition hover:bg-[#d8c7a3] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {loginStatus === "loading" ? "Signing in..." : "Sign in"}
                </button>
              </form>
            </section>
          ) : null}

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-300/25 bg-red-950/25 p-4 text-sm leading-6 text-red-100">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="mt-6 rounded-2xl border border-emerald-300/25 bg-emerald-950/20 p-4 text-sm leading-6 text-emerald-100">
              {message}
            </div>
          ) : null}

          {admin ? (
            <div className="mt-6 grid w-full min-w-0 gap-6 xl:grid-cols-[minmax(0,500px)_minmax(0,1fr)]">
              <section className="min-w-0 overflow-hidden rounded-[2rem] border border-[#d8c7a3]/10 bg-[#15130f] p-5 shadow-2xl shadow-black/25 sm:p-8">
                <div className="border-b border-[#d8c7a3]/10 pb-6">
                  <p className="text-xs uppercase tracking-[0.35em] text-[#d8c7a3]/50">
                    Create listing
                  </p>

                  <h2
                    className="mt-3 text-4xl leading-none text-[#fff8ef]"
                    style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                  >
                    Add Product
                  </h2>

                  <p className="mt-4 text-sm leading-7 text-[#f7f1e8]/50">
                    Add soaps, salves, balms, or care products with up to 6 product photos.
                  </p>
                </div>

                <form className="mt-6 grid min-w-0 gap-5" onSubmit={submitProduct}>
                  <label className="grid min-w-0 gap-2 text-sm text-[#f7f1e8]/72">
                    <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d8c7a3]/70">
                      Product name
                    </span>

                    <input
                      name="title"
                      value={form.title}
                      onChange={updateField}
                      required
                      placeholder="Lavender Tallow Soap"
                      className="min-w-0 rounded-2xl border border-[#d8c7a3]/10 bg-black/60 px-4 py-4 text-base text-[#fff8ef] outline-none transition placeholder:text-[#f7f1e8]/22 focus:border-[#d8c7a3]/45"
                    />
                  </label>

                  <label className="grid min-w-0 gap-2 text-sm text-[#f7f1e8]/72">
                    <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d8c7a3]/70">
                      Customer description
                    </span>

                    <textarea
                      name="description"
                      value={form.description}
                      onChange={updateField}
                      required
                      rows={5}
                      placeholder="A gentle, handcrafted bar made for daily cleansing and soft skin."
                      className="min-w-0 resize-none rounded-2xl border border-[#d8c7a3]/10 bg-black/60 px-4 py-4 text-base leading-7 text-[#fff8ef] outline-none transition placeholder:text-[#f7f1e8]/22 focus:border-[#d8c7a3]/45"
                    />
                  </label>

                  <label className="grid min-w-0 gap-2 text-sm text-[#f7f1e8]/72">
                    <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d8c7a3]/70">
                      Collection / category
                    </span>

                    <input
                      name="category"
                      value={form.category}
                      onChange={updateField}
                      required
                      placeholder="Soaps, Salves, Balms, Oils"
                      list="admin-product-categories"
                      className="min-w-0 rounded-2xl border border-[#d8c7a3]/10 bg-black/60 px-4 py-4 text-base text-[#fff8ef] outline-none transition placeholder:text-[#f7f1e8]/22 focus:border-[#d8c7a3]/45"
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
                            className="rounded-full border border-[#d8c7a3]/10 bg-[#d8c7a3]/5 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-[#d8c7a3]/65 transition hover:border-[#d8c7a3]/30 hover:text-[#fff8ef]"
                          >
                            {category}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </label>

                  <div className="grid min-w-0 gap-5 sm:grid-cols-3">
                    <label className="grid min-w-0 gap-2 text-sm text-[#f7f1e8]/72">
                      <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d8c7a3]/70">
                        Price
                      </span>

                      <input
                        name="price"
                        value={form.price}
                        onChange={updateField}
                        required
                        inputMode="decimal"
                        placeholder="85.00"
                        className="min-w-0 rounded-2xl border border-[#d8c7a3]/10 bg-black/60 px-4 py-4 text-base text-[#fff8ef] outline-none transition placeholder:text-[#f7f1e8]/22 focus:border-[#d8c7a3]/45"
                      />
                    </label>

                    <label className="grid min-w-0 gap-2 text-sm text-[#f7f1e8]/72">
                      <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d8c7a3]/70">
                        Size
                      </span>

                      <input
                        name="weight"
                        value={form.weight}
                        onChange={updateField}
                        required
                        placeholder="120g"
                        className="min-w-0 rounded-2xl border border-[#d8c7a3]/10 bg-black/60 px-4 py-4 text-base text-[#fff8ef] outline-none transition placeholder:text-[#f7f1e8]/22 focus:border-[#d8c7a3]/45"
                      />
                    </label>

                    <label className="grid min-w-0 gap-2 text-sm text-[#f7f1e8]/72">
                      <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d8c7a3]/70">
                        Stock
                      </span>

                      <input
                        name="stockAmount"
                        value={form.stockAmount}
                        onChange={updateField}
                        required
                        inputMode="numeric"
                        placeholder="12"
                        className="min-w-0 rounded-2xl border border-[#d8c7a3]/10 bg-black/60 px-4 py-4 text-base text-[#fff8ef] outline-none transition placeholder:text-[#f7f1e8]/22 focus:border-[#d8c7a3]/45"
                      />
                    </label>
                  </div>

                  <label className="grid min-w-0 gap-2 text-sm text-[#f7f1e8]/72">
                    <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d8c7a3]/70">
                      Product photos
                    </span>

                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      multiple
                      onChange={updateImage}
                      required
                      className="min-w-0 rounded-2xl border border-[#d8c7a3]/10 bg-black/60 px-4 py-3 text-sm text-[#f7f1e8] file:mr-4 file:rounded-xl file:border-0 file:bg-[#f7f1e8] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black"
                    />

                    <p className="text-xs leading-5 text-[#f7f1e8]/40">
                      Upload up to 6 images. Each image must be JPG, PNG, or WebP and 4 MB
                      or smaller.
                    </p>
                  </label>

                  {imagePreviews.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {imagePreviews.map((preview, index) => (
                        <div
                          key={preview}
                          className="overflow-hidden rounded-2xl border border-[#d8c7a3]/10 bg-black"
                        >
                          <img
                            src={preview}
                            alt={`Selected product preview ${index + 1}`}
                            className="aspect-square w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={formStatus === "saving"}
                    className="mt-2 rounded-2xl border border-[#d8c7a3] bg-[#f7f1e8] px-5 py-4 text-sm font-semibold uppercase tracking-[0.24em] text-black transition hover:bg-[#d8c7a3] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {formStatus === "saving" ? "Saving..." : "Add to collection"}
                  </button>
                </form>
              </section>

              <section className="min-w-0 overflow-hidden rounded-[2rem] border border-[#d8c7a3]/10 bg-[#15130f] p-5 shadow-2xl shadow-black/25 sm:p-8">
                <div className="flex min-w-0 flex-col gap-5 border-b border-[#d8c7a3]/10 pb-6">
                  <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.35em] text-[#d8c7a3]/50">
                        Storefront preview
                      </p>

                      <h2
                        className="mt-3 text-4xl leading-none text-[#fff8ef]"
                        style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                      >
                        Product Collection
                      </h2>

                      <p className="mt-4 text-sm leading-7 text-[#f7f1e8]/50">
                        Review how soaps, salves, and care products will feel to customers.
                      </p>
                    </div>

                    <div className="shrink-0 rounded-full border border-[#d8c7a3]/10 bg-black/45 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#d8c7a3]/60">
                      {filteredProducts.length} shown
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory("all")}
                      className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                        selectedCategory === "all"
                          ? "border-[#d8c7a3] bg-[#f7f1e8] text-black"
                          : "border-[#d8c7a3]/10 bg-black/45 text-[#f7f1e8]/55 hover:border-[#d8c7a3]/30 hover:text-[#fff8ef]"
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
                            ? "border-[#d8c7a3] bg-[#f7f1e8] text-black"
                            : "border-[#d8c7a3]/10 bg-black/45 text-[#f7f1e8]/55 hover:border-[#d8c7a3]/30 hover:text-[#fff8ef]"
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>

                {productsStatus === "loading" ? (
                  <div className="mt-6 rounded-2xl border border-[#d8c7a3]/10 bg-black/45 p-4 text-[#f7f1e8]/70">
                    Loading collection...
                  </div>
                ) : null}

                {filteredProducts.length > 0 ? (
                  <div className="mt-6 grid min-w-0 gap-5 sm:grid-cols-2 2xl:grid-cols-3">
                    {filteredProducts.map((product) => {
                      const isOutOfStock = Number(product.stockAmount) <= 0;
                      const isBusy = productActionStatus === product.id;
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
                          className="group min-w-0 overflow-hidden rounded-[1.5rem] border border-[#d8c7a3]/10 bg-[#0d0d0b] transition duration-300 hover:-translate-y-1 hover:border-[#d8c7a3]/30"
                        >
                          <div className="relative overflow-hidden bg-[#10100e]">
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
                              <div className="flex aspect-[4/5] w-full items-center justify-center bg-black text-sm text-[#f7f1e8]/35">
                                No image
                              </div>
                            )}

                            <div className="absolute left-3 top-3 rounded-full border border-[#d8c7a3]/20 bg-black/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f7f1e8]/80 backdrop-blur">
                              {isOutOfStock
                                ? "Out of stock"
                                : formatStockAmount(product.stockAmount)}
                            </div>

                            {productImages.length > 1 ? (
                              <div className="absolute right-3 top-3 rounded-full border border-[#d8c7a3]/20 bg-black/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f7f1e8]/80 backdrop-blur">
                                {productImages.length} photos
                              </div>
                            ) : null}

                            {product.category ? (
                              <div className="absolute bottom-3 left-3 max-w-[calc(100%-24px)] rounded-full border border-[#d8c7a3]/20 bg-black/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f7f1e8]/80 backdrop-blur">
                                <span className="block truncate">{product.category}</span>
                              </div>
                            ) : null}
                          </div>

                          {productImages.length > 1 ? (
                            <div className="grid grid-cols-4 gap-2 border-b border-[#d8c7a3]/10 p-3">
                              {productImages.slice(0, 4).map((imageUrl, index) => (
                                <img
                                  key={`${product.id}-${imageUrl}-${index}`}
                                  src={imageUrl}
                                  alt={`${product.title} thumbnail ${index + 1}`}
                                  className="aspect-square rounded-xl object-cover"
                                  loading="lazy"
                                />
                              ))}
                            </div>
                          ) : null}

                          <div className="min-w-0 p-4">
                            <div className="flex min-w-0 items-start justify-between gap-3">
                              <h3
                                className="min-w-0 break-words text-2xl leading-none text-[#fff8ef]"
                                style={{
                                  fontFamily: '"Cormorant Garamond", Georgia, serif',
                                }}
                              >
                                {product.title}
                              </h3>

                              <div className="shrink-0 rounded-full border border-[#d8c7a3]/15 px-3 py-1 text-sm text-[#f7f1e8]/80">
                                {formatPrice(product.price)}
                              </div>
                            </div>

                            <p className="mt-3 line-clamp-3 break-words text-sm leading-6 text-[#f7f1e8]/55">
                              {product.description}
                            </p>

                            <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2 border-t border-[#d8c7a3]/10 pt-4">
                              <span className="rounded-full bg-[#d8c7a3]/8 px-3 py-1 text-xs uppercase tracking-[0.18em] text-[#d8c7a3]/60">
                                {product.weight}
                              </span>

                              <button
                                type="button"
                                onClick={() => setOutOfStock(product.id)}
                                disabled={isBusy || isOutOfStock}
                                className="rounded-full border border-[#d8c7a3]/10 bg-[#d8c7a3]/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-[#f7f1e8]/55 transition hover:border-[#d8c7a3]/35 hover:text-[#fff8ef] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {isBusy ? "Saving..." : "Out of stock"}
                              </button>

                              <button
                                type="button"
                                onClick={() => removeProduct(product.id)}
                                disabled={isBusy}
                                className="rounded-full border border-red-300/20 bg-red-950/20 px-3 py-1 text-xs uppercase tracking-[0.16em] text-red-100/70 transition hover:border-red-300/50 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-40"
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

                {productsStatus === "ready" && filteredProducts.length === 0 ? (
                  <div className="mt-6 rounded-3xl border border-[#d8c7a3]/10 bg-black/45 p-6 text-sm leading-7 text-[#f7f1e8]/60">
                    {products.length === 0
                      ? "No products saved yet. Add your first soap, salve, or care product to begin building the collection."
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