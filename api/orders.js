import { HttpError } from "./_utils/errors.js";
import { requireMethod, readJsonBody, sendError, sendJson } from "./_utils/http.js";
import { createOrder } from "./_utils/ordersStore.js";
import { readProducts } from "./_utils/productsStore.js";

function findProduct(products, productId) {
  return products.find((product) => product.id === productId) || null;
}

export default async function handler(request, response) {
  try {
    requireMethod(request, response, ["POST"]);

    const body = await readJsonBody(request);
    const productId = String(body.productId || "").trim();

    if (!productId) {
      throw new HttpError(400, "Product ID is required.");
    }

    const products = await readProducts();
    const product = findProduct(products, productId);

    if (!product) {
      throw new HttpError(404, "Product was not found.");
    }

    if (Number(product.stockAmount) <= 0) {
      throw new HttpError(400, "This product is currently out of stock.");
    }

    const requestedQuantity = Number.parseInt(String(body.quantity || ""), 10);

    if (
      Number.isInteger(requestedQuantity) &&
      requestedQuantity > Number(product.stockAmount || 0)
    ) {
      throw new HttpError(400, "Requested quantity is higher than available stock.");
    }

    const result = await createOrder(product, body);

    sendJson(response, 201, {
      order: result.order,
      message: "Order placed successfully.",
    });
  } catch (error) {
    sendError(response, error);
  }
}
