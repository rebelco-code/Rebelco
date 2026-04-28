import { requireAdminSession } from "../_utils/adminAuth.js";
import { requireMethod, readJsonBody, sendError, sendJson } from "../_utils/http.js";
import { readOrders, updateOrderProofOfPayment } from "../_utils/ordersStore.js";

function getOrderId(request) {
  const requestUrl = new URL(request.url, `https://${request.headers.host || "localhost"}`);
  return requestUrl.searchParams.get("id");
}

export default async function handler(request, response) {
  try {
    requireMethod(request, response, ["GET", "PATCH"]);
    requireAdminSession(request);

    if (request.method === "GET") {
      const orders = await readOrders();

      sendJson(response, 200, { orders });
      return;
    }

    const body = await readJsonBody(request);
    const orderId = body.id || getOrderId(request);
    const proofOfPaymentReceived =
      body.proofOfPaymentReceived ?? body.hasProofOfPayment ?? body.proofReceived;

    const result = await updateOrderProofOfPayment(orderId, proofOfPaymentReceived);

    sendJson(response, 200, result);
  } catch (error) {
    sendError(response, error);
  }
}
