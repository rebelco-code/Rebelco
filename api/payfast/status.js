import { HttpError } from "../_utils/errors.js";
import { requireMethod, sendError, sendJson } from "../_utils/http.js";
import { readOrderGroupSummary } from "../_utils/ordersStore.js";

function getOrderGroupId(request) {
  const requestUrl = new URL(request.url, `https://${request.headers.host || "localhost"}`);
  return requestUrl.searchParams.get("orderGroupId") || requestUrl.searchParams.get("group");
}

export default async function handler(request, response) {
  try {
    requireMethod(request, response, ["GET"]);
    const orderGroupId = String(getOrderGroupId(request) || "").trim();

    if (!orderGroupId) {
      throw new HttpError(400, "Order group ID is required.");
    }

    const summary = await readOrderGroupSummary(orderGroupId);
    sendJson(response, 200, summary);
  } catch (error) {
    sendError(response, error);
  }
}
