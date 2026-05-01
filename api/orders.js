import { HttpError } from "./_utils/errors.js";
import { requireMethod, readJsonBody, sendError, sendJson } from "./_utils/http.js";
import { createOrders } from "./_utils/ordersStore.js";
import {
  reserveStockForOrderItems,
  restoreStockForOrderItems,
} from "./_utils/productsStore.js";

const DEFAULT_WHATSAPP_ORDER_PHONE = "27636936204";

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

function sanitizeWhatsappPhone(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

function getWhatsappOrderPhone() {
  const configuredPhone =
    process.env.WHATSAPP_ORDER_PHONE ||
    process.env.WHATSAPP_CATALOGUE_PHONE ||
    process.env.WHATSAPP_PHONE ||
    DEFAULT_WHATSAPP_ORDER_PHONE;

  return sanitizeWhatsappPhone(configuredPhone);
}

function formatRandAmount(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return "R0.00";
  }

  return `R${amount.toFixed(2)}`;
}

function buildWhatsappOrderText(createdOrders, payload, orderGroupId) {
  const orders = Array.isArray(createdOrders) ? createdOrders : [];
  const totalUnits = orders.reduce((sum, order) => {
    const quantity = Number.parseInt(String(order?.quantity || "0"), 10);
    return sum + (Number.isInteger(quantity) && quantity > 0 ? quantity : 0);
  }, 0);

  const estimatedTotal = orders.reduce((sum, order) => {
    const quantity = Number.parseInt(String(order?.quantity || "0"), 10);
    const unitPrice = Number(order?.productPrice || 0);

    if (!Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(unitPrice)) {
      return sum;
    }

    return sum + quantity * unitPrice;
  }, 0);

  const itemLines = orders.map((order, index) => {
    const title = String(order?.productTitle || "Product");
    const quantity = Number.parseInt(String(order?.quantity || "1"), 10);
    const normalizedQuantity = Number.isInteger(quantity) && quantity > 0 ? quantity : 1;
    return `${index + 1}. ${title} x${normalizedQuantity}`;
  });

  const locationText = String(payload?.locationText || "").trim();
  const googleMapsLocation = String(payload?.googleMapsLocation || "").trim();
  const pudoLockerName = String(payload?.pudoLockerName || "").trim();
  const pudoLockerCode = String(payload?.pudoLockerCode || "").trim();
  const pudoLockerAddress = String(payload?.pudoLockerAddress || "").trim();

  const lines = [
    "Hi Rebelco, I have placed an order on the website.",
    `Order reference: ${String(orderGroupId || "").trim() || "n/a"}`,
    "",
    "Order items:",
    ...(itemLines.length > 0 ? itemLines : ["- No items listed"]),
    "",
    `Total units: ${totalUnits}`,
    `Estimated total: ${formatRandAmount(estimatedTotal)}`,
  ];

  if (pudoLockerName || pudoLockerCode) {
    lines.push("", `PUDO locker: ${pudoLockerName || "n/a"} (${pudoLockerCode || "n/a"})`);
  }

  if (pudoLockerAddress) {
    lines.push(`PUDO address: ${pudoLockerAddress}`);
  }

  if (locationText) {
    lines.push(`Location note: ${locationText}`);
  }

  if (googleMapsLocation) {
    lines.push(`Google Maps location: ${googleMapsLocation}`);
  }

  lines.push("", "Please confirm and share payment instructions.");

  return lines.join("\n").trim();
}

function buildWhatsappOrderHref(createdOrders, payload, orderGroupId) {
  const phone = getWhatsappOrderPhone();

  if (!phone) {
    return "";
  }

  const message = buildWhatsappOrderText(createdOrders, payload, orderGroupId);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
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
    const orderGroupId = String(result?.orderGroupId || "").trim();
    const whatsappOrderHref = buildWhatsappOrderHref(createdOrders, body, orderGroupId);

    sendJson(response, 201, {
      order: createdOrders[0] || null,
      orders: createdOrders,
      orderGroupId,
      whatsappOrderHref,
      message:
        createdOrders.length > 1
          ? `Order placed for ${createdOrders.length} products.`
          : "Order placed successfully.",
    });
  } catch (error) {
    sendError(response, error);
  }
}
