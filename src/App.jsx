import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { trackMetaPageView } from "./lib/meta-pixel";

const HomePage = lazy(() => import("./pages/home"));
const ContactPage = lazy(() => import("./pages/contact"));
const AboutPage = lazy(() => import("./pages/about"));
const ProductsPage = lazy(() => import("./pages/products"));
const CompanyTwoProductsPage = lazy(() =>
  import("./pages/products").then((module) => ({ default: module.CompanyTwoProductsPage })),
);
const OrdersPage = lazy(() => import("./pages/orders"));
const PaymentSuccessPage = lazy(() => import("./pages/payment-success"));
const PaymentCancelPage = lazy(() => import("./pages/payment-cancel"));
const AdminaPage = lazy(() => import("./pages/admina"));
const NotFoundPage = lazy(() => import("./pages/not-found"));

function MetaPixelPageTracker() {
  const location = useLocation();

  useEffect(() => {
    trackMetaPageView();
  }, [location.pathname, location.search]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <MetaPixelPageTracker />
      <Suspense fallback={<div className="min-h-screen bg-white" />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products-company-2" element={<CompanyTwoProductsPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/payment/success" element={<PaymentSuccessPage />} />
          <Route path="/payment/cancel" element={<PaymentCancelPage />} />
          <Route path="/admina" element={<AdminaPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
