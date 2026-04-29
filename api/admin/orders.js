import { requireAdminSession } from "../_utils/adminAuth.js";
import { requireMethod, readJsonBody, sendError, sendJson } from "../_utils/http.js";
import {
  readOrders,
  updateOrderDeliveryOrganized,
  updateOrderProofOfPayment,
} from "../_utils/ordersStore.js";

function getOrderId(request) {
  const requestUrl = new URL(request.url, `https://${request.headers.host || "localhost"}`);
  return requestUrl.searchParams.get("id");
}

function isBlobEtagConflict(error) {
  const statusCode = Number(error?.statusCode || error?.status || error?.response?.status);

  if (statusCode === 409 || statusCode === 412) {
    return true;
  }

  const errorText = `${error?.name || ""} ${error?.code || ""} ${error?.message || ""}`
    .trim()
    .toLowerCase();

  return (
    errorText.includes("blobpreconditionfailederror") ||
    errorText.includes("precondition failed") ||
    errorText.includes("etag mismatch")
  );
}

export default async function handler(request, response) {
  try {
    requireMethod(request, response, ["GET", "PATCH"]);
    requireAdminSession(request);
    response.setHeader("Cache-Control", "no-store");

    if (request.method === "GET") {
      let orders = [];

      try {
        orders = await readOrders();
      } catch (error) {
        if (!isBlobEtagConflict(error)) {
          throw error;
        }

        orders = await readOrders();
      }

      sendJson(response, 200, { orders });
      return;
    }

    const body = await readJsonBody(request);
    const orderId = body.id || getOrderId(request);
    const action = String(body.action || "").trim().toLowerCase();
    let result;

    if (action === "set-delivery-organized") {
      const deliveryOrganized =
        body.deliveryOrganized ?? body.isDeliveryOrganized ?? body.deliveryReady;
      result = await updateOrderDeliveryOrganized(orderId, deliveryOrganized);
    } else {
      const proofOfPaymentReceived =
        body.proofOfPaymentReceived ?? body.hasProofOfPayment ?? body.proofReceived;
      result = await updateOrderProofOfPayment(orderId, proofOfPaymentReceived);
    }

    sendJson(response, 200, result);
  } catch (error) {
    sendError(response, error);
  }
}
