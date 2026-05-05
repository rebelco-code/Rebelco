import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

const HomePage = lazy(() => import("./pages/home"));
const ContactPage = lazy(() => import("./pages/contact"));
const AboutPage = lazy(() => import("./pages/about"));
const ProductsPage = lazy(() => import("./pages/products"));
const CompanyTwoProductsPage = lazy(() =>
  import("./pages/products").then((module) => ({ default: module.CompanyTwoProductsPage })),
);
const AdminaPage = lazy(() => import("./pages/admina"));
const NotFoundPage = lazy(() => import("./pages/not-found"));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen bg-[#0f0f10]" />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products-company-2" element={<CompanyTwoProductsPage />} />
          <Route path="/admina" element={<AdminaPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
