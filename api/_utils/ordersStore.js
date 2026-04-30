import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { HttpError } from "./errors.js";

const ORDERS_PATH = "products/orders.json";
const MAX_LOCATION_TEXT_LENGTH = 320;
const MAX_MAP_LOCATION_LENGTH = 400;
const MAX_PUDO_CODE_LENGTH = 40;
const MAX_PUDO_NAME_LENGTH = 120;
const MAX_PUDO_ADDRESS_LENGTH = 240;
const MAX_ORDER_GROUP_ID_LENGTH = 64;
const MAX_ORDERS_WRITE_RETRIES = 8;
const WRITE_RETRY_BASE_DELAY_MS = 120;

function getBlobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();

  if (!token) {
    throw new HttpError(500, "Vercel Blob read-write token is not configured.");
  }

  return token;
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function parseQuantity(value) {
  const quantity = Number.parseInt(String(value || ""), 10);

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new HttpError(400, "Enter a valid quantity.");
  }

  return quantity;
}

function cleanMapLocation(value) {
  return cleanText(value, MAX_MAP_LOCATION_LENGTH);
}

function wait(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function stringifyErrorField(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isWriteConflict(error) {
  if (error instanceof BlobPreconditionFailedError) {
    return true;
  }

  const statusCode = Number(error?.statusCode || error?.status || error?.response?.status);

  if (statusCode === 412) {
    return true;
  }

  const errorName = stringifyErrorField(error?.name);
  const errorCode = stringifyErrorField(error?.code);
  const errorMessage = stringifyErrorField(error?.message);
  const hintText = `${errorName} ${errorCode} ${errorMessage}`;

  if (hintText.includes("blobpreconditionfailederror")) {
    return true;
  }

  if (hintText.includes("precondition failed") || hintText.includes("etag mismatch")) {
    return true;
  }

  if (error?.cause && error !== error.cause) {
    return isWriteConflict(error.cause);
  }

  return false;
}

function buildLegacyCoordinateLocation(order) {
  const latitude = Number.parseFloat(String(order.locationLatitude || "").trim());
  const longitude = Number.parseFloat(String(order.locationLongitude || "").trim());

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return "";
  }

  return `${Math.round(latitude * 1_000_000) / 1_000_000}, ${
    Math.round(longitude * 1_000_000) / 1_000_000
  }`;
}

function normalizeImageUrls(input) {
  const imageUrls = Array.isArray(input.imageUrls) ? input.imageUrls : [];
  const normalized = imageUrls.map(String).filter(Boolean);

  if (!normalized.length && input.imageUrl) {
    normalized.push(String(input.imageUrl));
  }

  return normalized;
}

function normalizeOrder(order) {
  const imageUrls = normalizeImageUrls(order);
  const quantity = Number.parseInt(String(order.quantity || ""), 10);
  const googleMapsLocation =
    cleanMapLocation(order.googleMapsLocation) || buildLegacyCoordinateLocation(order);

  return {
    id: String(order.id || ""),
    orderGroupId: cleanText(order.orderGroupId, MAX_ORDER_GROUP_ID_LENGTH),
    productId: String(order.productId || ""),
    productTitle: String(order.productTitle || ""),
    productDescription: String(order.productDescription || ""),
    productCategory: String(order.productCategory || ""),
    productWeight: String(order.productWeight || ""),
    productPrice: Number(order.productPrice || 0),
    imageUrl: imageUrls[0] || "",
    imageUrls,
    quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : 1,
    locationText: cleanText(order.locationText, MAX_LOCATION_TEXT_LENGTH),
    googleMapsLocation,
    pudoLockerCode: cleanText(order.pudoLockerCode, MAX_PUDO_CODE_LENGTH),
    pudoLockerName: cleanText(order.pudoLockerName, MAX_PUDO_NAME_LENGTH),
    pudoLockerAddress: cleanText(order.pudoLockerAddress, MAX_PUDO_ADDRESS_LENGTH),
    proofOfPaymentReceived: Boolean(order.proofOfPaymentReceived),
    deliveryOrganized: Boolean(order.deliveryOrganized),
    createdAt: String(order.createdAt || ""),
    updatedAt: String(order.updatedAt || ""),
  };
}

async function readOrdersSnapshot() {
  const token = getBlobToken();
  const result = await get(ORDERS_PATH, {
    access: "private",
    token,
    useCache: false,
  });

  if (!result) {
    return {
      etag: "",
      orders: [],
    };
  }

  if (result.statusCode !== 200 || !result.stream) {
    throw new HttpError(502, "Order catalog could not be read from Blob.");
  }

  const rawCatalog = await new Response(result.stream).text();
  let parsedCatalog = {};

  if (rawCatalog.trim()) {
    try {
      parsedCatalog = JSON.parse(rawCatalog);
    } catch {
      throw new HttpError(502, "Order catalog is invalid.");
    }
  }

  const orders = Array.isArray(parsedCatalog.orders) ? parsedCatalog.orders : [];

  return {
    etag: String(result.blob?.etag || ""),
    orders: orders.map(normalizeOrder).filter((order) => order.id && order.productId),
  };
}

export async function readOrders() {
  getBlobToken();
  const snapshot = await readOrdersSnapshot();
  return snapshot.orders;
}

export async function writeOrders(orders, options = {}) {
  const token = getBlobToken();
  const normalizedOrders = orders.map(normalizeOrder);

  const writeOptions = {
    access: "private",
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: "application/json",
    token,
  };

  if (options.ifMatch) {
    writeOptions.ifMatch = options.ifMatch;
  }

  await put(
    ORDERS_PATH,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        orders: normalizedOrders,
      },
      null,
      2,
    ),
    {
      ...writeOptions,
    },
  );

  return normalizedOrders;
}

async function mutateOrdersWithRetry(mutationHandler) {
  let attempt = 0;

  while (attempt <= MAX_ORDERS_WRITE_RETRIES) {
    const snapshot = await readOrdersSnapshot();
    const mutationResult = mutationHandler(snapshot.orders);

    try {
      const persistedOrders = await writeOrders(mutationResult.orders, {
        ifMatch: snapshot.etag || undefined,
      });

      return {
        ...mutationResult,
        orders: persistedOrders,
      };
    } catch (error) {
      if (!isWriteConflict(error)) {
        throw error;
      }

      if (attempt === MAX_ORDERS_WRITE_RETRIES) {
        break;
      }

      attempt += 1;
      await wait(WRITE_RETRY_BASE_DELAY_MS * attempt + Math.floor(Math.random() * 80));
    }
  }

  const fallbackSnapshot = await readOrdersSnapshot();
  const fallbackMutationResult = mutationHandler(fallbackSnapshot.orders);
  const persistedOrders = await writeOrders(fallbackMutationResult.orders);

  return {
    ...fallbackMutationResult,
    orders: persistedOrders,
  };
}

function validateOrderInput(payload) {
  const locationText = cleanText(payload.locationText, MAX_LOCATION_TEXT_LENGTH);
  const googleMapsLocation = cleanMapLocation(payload.googleMapsLocation);

  const hasTextLocation = Boolean(locationText);
  const hasMapLocation = Boolean(googleMapsLocation);

  if (!hasTextLocation && !hasMapLocation) {
    throw new HttpError(400, "Enter location text or a Google Maps location.");
  }

  return {
    locationText,
    googleMapsLocation,
  };
}

function buildOrderRecord(product, payload, quantity, now, orderGroupId) {
  return normalizeOrder({
    id: `order-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    orderGroupId,
    productId: product.id,
    productTitle: product.title,
    productDescription: product.description,
    productCategory: product.category,
    productWeight: product.weight,
    productPrice: product.price,
    imageUrl: product.imageUrl,
    imageUrls: product.imageUrls,
    quantity,
    locationText: payload.locationText,
    googleMapsLocation: payload.googleMapsLocation,
    pudoLockerCode: payload.pudoLockerCode,
    pudoLockerName: payload.pudoLockerName,
    pudoLockerAddress: payload.pudoLockerAddress,
    proofOfPaymentReceived: false,
    deliveryOrganized: false,
    createdAt: now,
    updatedAt: now,
  });
}

export async function createOrders(orderItems, payload) {
  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    throw new HttpError(400, "Select at least one product before placing an order.");
  }

  const input = validateOrderInput(payload);
  const now = new Date().toISOString();
  const orderGroupId = `group-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const preparedOrders = orderItems.map((item) => {
    const product = item?.product;
    const productId = String(product?.id || "").trim();

    if (!productId) {
      throw new HttpError(400, "Product ID is required.");
    }

    const quantity = parseQuantity(item?.quantity);

    return buildOrderRecord(
      {
        ...product,
        id: productId,
      },
      {
        ...payload,
        ...input,
      },
      quantity,
      now,
      orderGroupId,
    );
  });

  const result = await mutateOrdersWithRetry((orders) => ({
    createdOrders: preparedOrders,
    orders: [...preparedOrders, ...orders],
  }));

  return {
    order: result.createdOrders[0] || null,
    createdOrders: result.createdOrders,
    orders: result.orders,
    orderGroupId,
  };
}

export async function createOrder(product, payload) {
  const productId = String(product?.id || "").trim();

  if (!productId) {
    throw new HttpError(400, "Product ID is required.");
  }

  const result = await createOrders(
    [
      {
        product: {
          ...product,
          id: productId,
        },
        quantity: payload.quantity,
      },
    ],
    payload,
  );

  return {
    order: result.order,
    orders: result.orders,
  };
}

function parseBoolean(value, fieldName) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new HttpError(400, `${fieldName} must be true or false.`);
}

export async function updateOrderProofOfPayment(orderId, proofOfPaymentReceived) {
  const id = String(orderId || "").trim();

  if (!id) {
    throw new HttpError(400, "Order ID is required.");
  }

  const proofValue = parseBoolean(proofOfPaymentReceived, "proofOfPaymentReceived");
  const now = new Date().toISOString();

  const result = await mutateOrdersWithRetry((orders) => {
    let updatedOrder = null;

    const updatedOrders = orders.map((order) => {
      if (order.id !== id) {
        return order;
      }

      updatedOrder = normalizeOrder({
        ...order,
        proofOfPaymentReceived: proofValue,
        deliveryOrganized: proofValue ? Boolean(order.deliveryOrganized) : false,
        updatedAt: now,
      });

      return updatedOrder;
    });

    if (!updatedOrder) {
      throw new HttpError(404, "Order was not found.");
    }

    return {
      order: updatedOrder,
      orders: updatedOrders,
    };
  });

  return {
    order: result.order,
    orders: result.orders,
  };
}

export async function updateOrderDeliveryOrganized(orderId, deliveryOrganized) {
  const id = String(orderId || "").trim();

  if (!id) {
    throw new HttpError(400, "Order ID is required.");
  }

  const deliveryValue = parseBoolean(deliveryOrganized, "deliveryOrganized");
  const now = new Date().toISOString();

  const result = await mutateOrdersWithRetry((orders) => {
    let updatedOrder = null;

    const updatedOrders = orders.map((order) => {
      if (order.id !== id) {
        return order;
      }

      if (deliveryValue && !order.proofOfPaymentReceived) {
        throw new HttpError(
          400,
          "Delivery can only be organized after proof of payment is received.",
        );
      }

      updatedOrder = normalizeOrder({
        ...order,
        deliveryOrganized: deliveryValue,
        updatedAt: now,
      });

      return updatedOrder;
    });

    if (!updatedOrder) {
      throw new HttpError(404, "Order was not found.");
    }

    return {
      order: updatedOrder,
      orders: updatedOrders,
    };
  });

  return {
    order: result.order,
    orders: result.orders,
  };
}

export async function removePaidOrders() {
  let attempt = 0;

  while (attempt <= MAX_ORDERS_WRITE_RETRIES) {
    const snapshot = await readOrdersSnapshot();
    const activeOrders = snapshot.orders.filter((order) => !order.proofOfPaymentReceived);
    const removedCount = snapshot.orders.length - activeOrders.length;

    if (removedCount === 0) {
      return {
        orders: snapshot.orders,
        removedCount: 0,
      };
    }

    try {
      const persistedOrders = await writeOrders(activeOrders, {
        ifMatch: snapshot.etag || undefined,
      });

      return {
        orders: persistedOrders,
        removedCount,
      };
    } catch (error) {
      if (!isWriteConflict(error)) {
        throw error;
      }

      if (attempt === MAX_ORDERS_WRITE_RETRIES) {
        break;
      }

      attempt += 1;
      await wait(WRITE_RETRY_BASE_DELAY_MS * attempt + Math.floor(Math.random() * 80));
    }
  }

  const fallbackSnapshot = await readOrdersSnapshot();
  const fallbackActiveOrders = fallbackSnapshot.orders.filter(
    (order) => !order.proofOfPaymentReceived,
  );
  const fallbackRemovedCount = fallbackSnapshot.orders.length - fallbackActiveOrders.length;

  if (fallbackRemovedCount === 0) {
    return {
      orders: fallbackSnapshot.orders,
      removedCount: 0,
    };
  }

  const persistedOrders = await writeOrders(fallbackActiveOrders);

  return {
    orders: persistedOrders,
    removedCount: fallbackRemovedCount,
  };
}
