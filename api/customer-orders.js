import { HttpError } from "./_utils/errors.js";
import { requireMethod, sendError, sendJson } from "./_utils/http.js";
import { readCustomerOrderHistory, readCustomerOrderSummary } from "./_utils/ordersStore.js";

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

    if (!String(customerEmail || "").trim()) {
      throw new HttpError(400, "Customer email is required.");
    }

    if (String(customerOrderId || "").trim()) {
      const summary = await readCustomerOrderSummary(customerOrderId, customerEmail);
      sendJson(response, 200, {
        mode: "single",
        ...summary,
      });
      return;
    }

    const history = await readCustomerOrderHistory(customerEmail);
    sendJson(response, 200, {
      mode: "history",
      ...history,
    });
  } catch (error) {
    sendError(response, error);
  }
}
