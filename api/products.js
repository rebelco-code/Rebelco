import { PRODUCT_COMPANY, readProducts } from "./_utils/productsStore.js";
import { requireMethod, sendError, sendJson } from "./_utils/http.js";

function sanitizePublicProduct(product) {
  const nextProduct = { ...product };

  delete nextProduct.promoCodes;
  delete nextProduct.activePromoCode;
  delete nextProduct.promoPrice;

  return nextProduct;
}

export default async function handler(request, response) {
  try {
    requireMethod(request, response, ["GET"]);

    const requestUrl = new URL(request.url, `https://${request.headers.host || "localhost"}`);
    const requestedCompanyKey = String(requestUrl.searchParams.get("company") || "")
      .trim()
      .toLowerCase();
    const companyKey =
      requestedCompanyKey === PRODUCT_COMPANY.COMPANY_TWO
        ? PRODUCT_COMPANY.COMPANY_TWO
        : PRODUCT_COMPANY.STANDARD;
    const products = (await readProducts())
      .filter((product) => String(product.companyKey || PRODUCT_COMPANY.STANDARD) === companyKey)
      .map(sanitizePublicProduct);

    sendJson(
      response,
      200,
      { products, companyKey },
      {
        "Cache-Control": "no-store",
      },
    );
  } catch (error) {
    sendError(response, error);
  }
}
