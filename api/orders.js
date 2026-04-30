import { HttpError } from "./_utils/errors.js";
import { requireMethod, readJsonBody, sendError, sendJson } from "./_utils/http.js";
import { createOrders } from "./_utils/ordersStore.js";
import {
  reserveStockForOrderItems,
  restoreStockForOrderItems,
} from "./_utils/productsStore.js";

function parseRequestedQuantity(value) {
  const quantity = Number.parseInt(String(value || ""), 10);

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new HttpError(400, "Enter a valid quantity.");
  }

  return quantity;
}

function normalizeOrderItems(itemPayloads) {
  if (!Array.isArray(itemPayloads) || itemPayloads.length === 0) {
    throw new HttpError(400, "Select at least one product before placing an order.");
  }

  const aggregatedItems = [];
  const itemByProductId = new Map();

  itemPayloads.forEach((item) => {
    const productId = String(item?.productId || "").trim();

    if (!productId) {
      throw new HttpError(400, "Product ID is required.");
    }

    const quantity = parseRequestedQuantity(item?.quantity);
    const existingItem = itemByProductId.get(productId);

    if (existingItem) {
      existingItem.quantity += quantity;
      return;
    }

    const normalizedItem = { productId, quantity };
    aggregatedItems.push(normalizedItem);
    itemByProductId.set(productId, normalizedItem);
  });

  return aggregatedItems;
}

export default async function handler(request, response) {
  try {
    requireMethod(request, response, ["POST"]);

    const body = await readJsonBody(request);
    const rawItemPayloads = Array.isArray(body.items)
      ? body.items
      : [
          {
            productId: body.productId,
            quantity: body.quantity,
          },
        ];
    const orderItems = normalizeOrderItems(rawItemPayloads);

    const reservation = await reserveStockForOrderItems(orderItems);
    let result;

    try {
      result = await createOrders(reservation.items, body);
    } catch (orderError) {
      try {
        await restoreStockForOrderItems(orderItems);
      } catch (rollbackError) {
        console.error("Order stock rollback failed after order write error.", {
          orderError,
          rollbackError,
          orderItems,
        });

        throw new HttpError(
          500,
          "Order failed and stock rollback could not be completed automatically.",
        );
      }

      throw orderError;
    }

    const createdOrders = Array.isArray(result.createdOrders) ? result.createdOrders : [];

    sendJson(response, 201, {
      order: createdOrders[0] || null,
      orders: createdOrders,
      message:
        createdOrders.length > 1
          ? `Order placed for ${createdOrders.length} products.`
          : "Order placed successfully.",
    });
  } catch (error) {
    sendError(response, error);
  }
}
