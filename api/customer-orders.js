import { HttpError } from "./_utils/errors.js";
import { requireMethod, sendError, sendJson } from "./_utils/http.js";
import { readCustomerOrderSummary } from "./_utils/ordersStore.js";

function getLookupParams(request) {
  const requestUrl = new URL(request.url, `https://${request.headers.host || "localhost"}`);

  return {
    customerOrderId:
      requestUrl.searchParams.get("customerOrderId") ||
      requestUrl.searchParams.get("orderId") ||
      requestUrl.searchParams.get("order"),
    customerEmail:
      requestUrl.searchParams.get("customerEmail") ||
      requestUrl.searchParams.get("email"),
  };
}

export default async function handler(request, response) {
  try {
    requireMethod(request, response, ["GET"]);

    const { customerOrderId, customerEmail } = getLookupParams(request);

    if (!String(customerOrderId || "").trim()) {
      throw new HttpError(400, "Customer order ID is required.");
    }

    if (!String(customerEmail || "").trim()) {
      throw new HttpError(400, "Customer email is required.");
    }

    const summary = await readCustomerOrderSummary(customerOrderId, customerEmail);
    sendJson(response, 200, summary);
  } catch (error) {
    sendError(response, error);
  }
}
