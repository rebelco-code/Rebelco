import { HttpError } from "./_utils/errors.js";
import { requireMethod, readJsonBody, sendError, sendJson } from "./_utils/http.js";
import {
  getCheckoutUnitPrice,
  getMatchingPromoCodeEntry,
  PRODUCT_COMPANY,
  readProducts,
  sanitizePromoCode,
} from "./_utils/productsStore.js";

function normalizeProductIds(value) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((productId) => String(productId || "").trim()).filter(Boolean)))
    : [];
}

export default async function handler(request, response) {
  try {
    requireMethod(request, response, ["POST"]);

    const body = await readJsonBody(request);
    const promoCode = sanitizePromoCode(body.promoCode);

    if (!promoCode) {
      throw new HttpError(400, "Promo code is required.");
    }

    const requestedCompanyKey = String(body.company || "")
      .trim()
      .toLowerCase();
    const companyKey =
      requestedCompanyKey === PRODUCT_COMPANY.COMPANY_TWO
        ? PRODUCT_COMPANY.COMPANY_TWO
        : PRODUCT_COMPANY.STANDARD;
    const relevantProductIds = normalizeProductIds([
      ...(Array.isArray(body.productIds) ? body.productIds : []),
      body.selectedProductId,
    ]);

    if (relevantProductIds.length === 0) {
      throw new HttpError(400, "Select at least one product before applying a promo code.");
    }

    const products = (await readProducts()).filter(
      (product) =>
        String(product.companyKey || PRODUCT_COMPANY.STANDARD) === companyKey &&
        relevantProductIds.includes(String(product.id || "").trim()),
    );

    const applicableProducts = products
      .filter((product) => Boolean(getMatchingPromoCodeEntry(product, promoCode)))
      .map((product) => ({
        productId: String(product.id || "").trim(),
        unitPrice: getCheckoutUnitPrice(product, promoCode),
      }));

    sendJson(
      response,
      200,
      {
        promoCode,
        valid: applicableProducts.length > 0,
        applicableProducts,
      },
      {
        "Cache-Control": "no-store",
      },
    );
  } catch (error) {
    sendError(response, error);
  }
}
