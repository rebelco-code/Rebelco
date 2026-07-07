import { HttpError } from "../_utils/errors.js";
import {
  buildPayfastFormPayload,
  buildPayfastMerchantPayload,
  getPayfastConfig,
  normalizeAmount,
} from "../_utils/payfast.js";
import { requireMethod, readJsonBody, sendError, sendJson } from "../_utils/http.js";
import { createOrders } from "../_utils/ordersStore.js";
import {
  getCheckoutUnitPrice,
  reserveStockForOrderItems,
  restoreStockForOrderItems,
  sanitizePromoCode,
} from "../_utils/productsStore.js";

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

function buildItemDescription(createdOrders) {
  const lines = createdOrders.map((order) => {
    const title = String(order?.productTitle || "Product").trim();
    const quantity = Number.parseInt(String(order?.quantity || "1"), 10);
    const normalizedQuantity = Number.isInteger(quantity) && quantity > 0 ? quantity : 1;
    return `${title} x${normalizedQuantity}`;
  });

  return lines.join(", ").slice(0, 255);
}

function calculateOrderTotal(createdOrders) {
  return createdOrders.reduce((sum, order) => {
    const quantity = Number.parseInt(String(order?.quantity || "0"), 10);
    const unitPrice = Number(order?.productPrice || 0);

    if (!Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(unitPrice)) {
      return sum;
    }

    return sum + quantity * unitPrice;
  }, 0);
}

function calculateReservedItemsTotal(items) {
  return items.reduce((sum, item) => {
    const quantity = Number.parseInt(String(item?.quantity || "0"), 10);
    const explicitUnitPrice = Number(item?.unitPrice);
    const unitPrice = Number.isFinite(explicitUnitPrice)
      ? explicitUnitPrice
      : Number(item?.product?.effectivePrice ?? item?.product?.price ?? 0);

    if (!Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(unitPrice)) {
      return sum;
    }

    return sum + quantity * unitPrice;
  }, 0);
}

export default async function handler(request, response) {
  try {
    requireMethod(request, response, ["POST"]);
    const payfastConfig = getPayfastConfig();
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
    const promoCode = sanitizePromoCode(body.promoCode);

    const reservation = await reserveStockForOrderItems(orderItems);
    const pricedReservationItems = reservation.items.map((item) => ({
      ...item,
      unitPrice: getCheckoutUnitPrice(item.product, promoCode),
    }));
    const reservedAmount = calculateReservedItemsTotal(pricedReservationItems);
    let createdOrderResult;

    try {
      createdOrderResult = await createOrders(pricedReservationItems, {
        ...body,
        promoCode,
        paymentMethod: "payfast",
        paymentProvider: "payfast",
        paymentStatus: "pending",
        paymentAmount: reservedAmount,
      });
    } catch (orderError) {
      try {
        await restoreStockForOrderItems(orderItems);
      } catch (rollbackError) {
        console.error("PayFast order stock rollback failed after order write error.", {
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

    const createdOrders = Array.isArray(createdOrderResult.createdOrders)
      ? createdOrderResult.createdOrders
      : [];
    const orderGroupId = String(createdOrderResult.orderGroupId || "").trim();
    const customerOrderId = String(createdOrderResult.customerOrderId || "").trim();
    const amount = calculateOrderTotal(createdOrders);

    if (!orderGroupId || !customerOrderId || createdOrders.length === 0 || amount <= 0) {
      throw new HttpError(500, "PayFast payment could not be created for this order.");
    }

    const payfastFields = buildPayfastMerchantPayload({
      name_first: String(body.customerFirstName || "").trim(),
      name_last: String(body.customerLastName || "").trim(),
      email_address: String(body.customerEmail || "").trim(),
      m_payment_id: orderGroupId,
      amount: normalizeAmount(amount),
      item_name: `Rebelco order ${orderGroupId}`.slice(0, 100),
      item_description: buildItemDescription(createdOrders),
      custom_str1: orderGroupId,
      custom_str2: String(body.pudoLockerCode || "").trim(),
      custom_str3: customerOrderId,
    });
    const signedFields = buildPayfastFormPayload(payfastFields, payfastConfig.passphrase);

    sendJson(response, 200, {
      orderGroupId,
      customerOrderId,
      paymentUrl: payfastConfig.processUrl,
      fields: signedFields,
      amount: normalizeAmount(amount),
      message: "Redirecting to PayFast.",
    });
  } catch (error) {
    sendError(response, error);
  }
}
