import { useCallback, useEffect, useRef, useState } from "react";
import Navbar from "../components/navbar";
import { readJsonResponse } from "../lib/api";
import { formatPrice, formatStockAmount } from "../lib/formatters";

const initialForm = {
  title: "",
  description: "",
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
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [sessionStatus, setSessionStatus] = useState("checking");
  const [productsStatus, setProductsStatus] = useState("idle");
  const [formStatus, setFormStatus] = useState("idle");
  const [loginStatus, setLoginStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

  function updateImage(event) {
    const file = event.target.files?.[0] || null;
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : "");
  }

  function resetForm() {
    setForm(initialForm);
    setImageFile(null);
    setImagePreview("");

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
      formData.append("price", form.price);
      formData.append("weight", form.weight);
      formData.append("stockAmount", form.stockAmount);

      if (imageFile) {
        formData.append("image", imageFile);
      }

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
    <div className="min-h-screen bg-[#0f0f10] text-white">
      <Navbar className="border-b border-white/10 bg-[#0f0f10]/95 backdrop-blur" />

      <main className="px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <header className="flex flex-col gap-5 border border-white/10 bg-[#151516] p-5 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p
                className="text-sm uppercase tracking-[0.32em] text-white/55"
                style={{ fontFamily: '"Cinzel", Georgia, serif' }}
              >
                Rebelco
              </p>

              <h1
                className="mt-3 text-4xl leading-none text-white sm:text-5xl"
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
              >
                Product Admin
              </h1>
            </div>

            {admin ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="text-sm text-white/65">{admin.email}</div>

                <button
                  type="button"
                  onClick={signOut}
                  className="border border-white/12 bg-black px-4 py-3 text-sm uppercase tracking-[0.18em] text-white transition hover:border-white/35"
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </header>

          {sessionStatus === "checking" ? (
            <section className="mt-6 border border-white/10 bg-[#151516] p-6 text-white/70">
              Checking admin session...
            </section>
          ) : null}

          {sessionStatus === "signed-out" ? (
            <section className="mt-6 max-w-xl border border-white/10 bg-[#151516] p-5 sm:p-8">
              <h2
                className="text-3xl leading-none text-white"
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
              >
                Admin Sign In
              </h2>

              <form className="mt-6 grid gap-5" onSubmit={submitLogin}>
                <label className="grid gap-2 text-sm text-white/72">
                  <span className="uppercase tracking-[0.18em]">Email</span>

                  <input
                    name="email"
                    type="email"
                    value={loginForm.email}
                    onChange={updateLoginField}
                    required
                    autoComplete="username"
                    className="border border-white/12 bg-black px-4 py-3 text-base text-white outline-none transition focus:border-white/45"
                  />
                </label>

                <label className="grid gap-2 text-sm text-white/72">
                  <span className="uppercase tracking-[0.18em]">Password</span>

                  <input
                    name="password"
                    type="password"
                    value={loginForm.password}
                    onChange={updateLoginField}
                    required
                    autoComplete="current-password"
                    className="border border-white/12 bg-black px-4 py-3 text-base text-white outline-none transition focus:border-white/45"
                  />
                </label>

                <button
                  type="submit"
                  disabled={loginStatus === "loading"}
                  className="border border-white bg-white px-5 py-4 text-sm uppercase tracking-[0.2em] text-black transition hover:bg-[#d9d9d9] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {loginStatus === "loading" ? "Signing in..." : "Sign in"}
                </button>
              </form>
            </section>
          ) : null}

          {error ? (
            <div className="mt-6 border border-red-400/30 bg-red-950/25 p-4 text-red-100">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="mt-6 border border-emerald-400/30 bg-emerald-950/25 p-4 text-emerald-100">
              {message}
            </div>
          ) : null}

          {admin ? (
            <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <section className="border border-white/10 bg-[#151516] p-5 sm:p-6">
                <h2
                  className="text-3xl leading-none text-white"
                  style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                >
                  Add Product
                </h2>

                <form className="mt-6 grid gap-5" onSubmit={submitProduct}>
                  <label className="grid gap-2 text-sm text-white/72">
                    <span className="uppercase tracking-[0.18em]">Title</span>

                    <input
                      name="title"
                      value={form.title}
                      onChange={updateField}
                      required
                      className="border border-white/12 bg-black px-4 py-3 text-base text-white outline-none transition focus:border-white/45"
                    />
                  </label>

                  <label className="grid gap-2 text-sm text-white/72">
                    <span className="uppercase tracking-[0.18em]">Description</span>

                    <textarea
                      name="description"
                      value={form.description}
                      onChange={updateField}
                      required
                      rows={5}
                      className="resize-none border border-white/12 bg-black px-4 py-3 text-base leading-7 text-white outline-none transition focus:border-white/45"
                    />
                  </label>

                  <div className="grid gap-5 sm:grid-cols-3">
                    <label className="grid gap-2 text-sm text-white/72">
                      <span className="uppercase tracking-[0.18em]">Price</span>

                      <input
                        name="price"
                        value={form.price}
                        onChange={updateField}
                        required
                        inputMode="decimal"
                        className="border border-white/12 bg-black px-4 py-3 text-base text-white outline-none transition focus:border-white/45"
                      />
                    </label>

                    <label className="grid gap-2 text-sm text-white/72">
                      <span className="uppercase tracking-[0.18em]">Weight</span>

                      <input
                        name="weight"
                        value={form.weight}
                        onChange={updateField}
                        required
                        className="border border-white/12 bg-black px-4 py-3 text-base text-white outline-none transition focus:border-white/45"
                      />
                    </label>

                    <label className="grid gap-2 text-sm text-white/72">
                      <span className="uppercase tracking-[0.18em]">Stock</span>

                      <input
                        name="stockAmount"
                        value={form.stockAmount}
                        onChange={updateField}
                        required
                        inputMode="numeric"
                        className="border border-white/12 bg-black px-4 py-3 text-base text-white outline-none transition focus:border-white/45"
                      />
                    </label>
                  </div>

                  <label className="grid gap-2 text-sm text-white/72">
                    <span className="uppercase tracking-[0.18em]">Image</span>

                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={updateImage}
                      required
                      className="border border-white/12 bg-black px-4 py-3 text-base text-white file:mr-4 file:border-0 file:bg-white file:px-4 file:py-2 file:text-black"
                    />
                  </label>

                  {imagePreview ? (
                    <div className="aspect-[4/3] overflow-hidden border border-white/10 bg-black">
                      <img
                        src={imagePreview}
                        alt="Selected product preview"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={formStatus === "saving"}
                    className="border border-white bg-white px-5 py-4 text-sm uppercase tracking-[0.2em] text-black transition hover:bg-[#d9d9d9] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {formStatus === "saving" ? "Saving..." : "Save Product"}
                  </button>
                </form>
              </section>

              <section className="border border-white/10 bg-[#151516] p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <h2
                    className="text-3xl leading-none text-white"
                    style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                  >
                    Inventory
                  </h2>

                  <div className="text-sm uppercase tracking-[0.2em] text-white/50">
                    {products.length} products
                  </div>
                </div>

                {productsStatus === "loading" ? (
                  <div className="mt-6 border border-white/10 bg-black p-4 text-white/70">
                    Loading inventory...
                  </div>
                ) : null}

                {products.length > 0 ? (
                  <div className="mt-6 grid gap-4">
                    {products.map((product) => (
                      <article
                        key={product.id}
                        className="grid gap-4 border border-white/10 bg-black p-4 sm:grid-cols-[120px_1fr]"
                      >
                        <div className="aspect-square overflow-hidden bg-[#151516]">
                          <img
                            src={product.imageUrl}
                            alt={product.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <h3
                              className="text-2xl leading-none text-white"
                              style={{
                                fontFamily: '"Cormorant Garamond", Georgia, serif',
                              }}
                            >
                              {product.title}
                            </h3>

                            <div className="text-sm text-white/70">
                              {formatPrice(product.price)}
                            </div>
                          </div>

                          <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/62">
                            {product.description}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-white/48">
                            <span>{product.weight}</span>
                            <span>{formatStockAmount(product.stockAmount)}</span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}

                {productsStatus === "ready" && products.length === 0 ? (
                  <div className="mt-6 border border-white/10 bg-black p-4 text-white/70">
                    No products saved yet.
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