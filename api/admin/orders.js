import { requireAdminSession } from "../_utils/adminAuth.js";
import { HttpError } from "../_utils/errors.js";
import { requireMethod, readJsonBody, sendError, sendJson } from "../_utils/http.js";
import {
  removeOrderGroup,
  readOrders,
  updateOrderGroupDeliveryOrganized,
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
    const orderGroupId = body.orderGroupId || body.groupId || getOrderId(request);
    const action = String(body.action || "").trim().toLowerCase();

    if (action === "set-delivery-organized") {
      const deliveryOrganized =
        body.deliveryOrganized ?? body.isDeliveryOrganized ?? body.deliveryReady;
      const result = await updateOrderGroupDeliveryOrganized(orderGroupId, deliveryOrganized);

      sendJson(response, 200, result);
      return;
    }

    if (action === "remove-order-group") {
      const result = await removeOrderGroup(orderGroupId, {
        restoreStock: body.restoreStock !== false,
      });

      sendJson(response, 200, result);
      return;
    }

    if (action === "remove-order-groups") {
      const orderGroupIds = Array.isArray(body.orderGroupIds)
        ? body.orderGroupIds.map((value) => String(value || "").trim()).filter(Boolean)
        : [];

      if (orderGroupIds.length === 0) {
        throw new HttpError(400, "Select at least one order group to remove.");
      }

      let latestResult = { orders: [] };

      for (const currentOrderGroupId of orderGroupIds) {
        latestResult = await removeOrderGroup(currentOrderGroupId, {
          restoreStock: body.restoreStock !== false,
        });
      }

      sendJson(response, 200, latestResult);
      return;
    }

    throw new HttpError(
      400,
      "Only delivery organization updates and order removal are supported from admin.",
    );
  } catch (error) {
    sendError(response, error);
  }
}
