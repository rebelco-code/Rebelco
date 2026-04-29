import { HttpError } from "./_utils/errors.js";
import { requireMethod, readJsonBody, sendError, sendJson } from "./_utils/http.js";
import { createOrder } from "./_utils/ordersStore.js";
import { readProducts } from "./_utils/productsStore.js";

function findProduct(products, productId) {
  return products.find((product) => product.id === productId) || null;
}

function parseRequestedQuantity(value) {
  return Number.parseInt(String(value || ""), 10);
}

function ensureOrderQuantityAllowed(product, requestedQuantity) {
  const minimumOrderQuantity = Math.max(
    1,
    Number.parseInt(String(product.minimumOrderQuantity || ""), 10) || 1,
  );

  if (Number.isInteger(requestedQuantity) && requestedQuantity < minimumOrderQuantity) {
    throw new HttpError(
      400,
      `Minimum order quantity for "${product.title}" is ${minimumOrderQuantity}.`,
    );
  }

  if (Number.isInteger(requestedQuantity) && requestedQuantity > Number(product.stockAmount || 0)) {
    throw new HttpError(400, `Requested quantity for "${product.title}" is higher than stock.`);
  }
}

export default async function handler(request, response) {
  try {
    requireMethod(request, response, ["POST"]);

    const body = await readJsonBody(request);
    const products = await readProducts();
    const itemPayloads = Array.isArray(body.items)
      ? body.items
      : [
          {
            productId: body.productId,
            quantity: body.quantity,
          },
        ];

    if (!itemPayloads.length) {
      throw new HttpError(400, "Select at least one product before placing an order.");
    }

    const createdOrders = [];

    for (const item of itemPayloads) {
      const productId = String(item?.productId || "").trim();

      if (!productId) {
        throw new HttpError(400, "Product ID is required.");
      }

      const product = findProduct(products, productId);

      if (!product) {
        throw new HttpError(404, "Product was not found.");
      }

      if (Number(product.stockAmount) <= 0) {
        throw new HttpError(400, `"${product.title}" is currently out of stock.`);
      }

      const requestedQuantity = parseRequestedQuantity(item?.quantity);
      ensureOrderQuantityAllowed(product, requestedQuantity);

      const result = await createOrder(product, {
        ...body,
        quantity: requestedQuantity,
      });

      createdOrders.push(result.order);
    }

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
