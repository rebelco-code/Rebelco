import { list, put } from "@vercel/blob";
import { HttpError } from "./errors.js";

const ORDERS_PATH = "products/orders.json";
const MAX_LOCATION_TEXT_LENGTH = 320;
const MAX_MAP_LOCATION_LENGTH = 400;

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
    proofOfPaymentReceived: Boolean(order.proofOfPaymentReceived),
    createdAt: String(order.createdAt || ""),
    updatedAt: String(order.updatedAt || ""),
  };
}

async function getOrdersBlob() {
  const token = getBlobToken();
  const { blobs } = await list({
    prefix: ORDERS_PATH,
    limit: 10,
    token,
  });

  return blobs.find((blob) => blob.pathname === ORDERS_PATH);
}

async function fetchPrivateBlobJson(blob) {
  const token = getBlobToken();

  const response = await fetch(blob.downloadUrl || blob.url, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new HttpError(502, "Order catalog could not be read from Blob.");
  }

  return response.json();
}

export async function readOrders() {
  getBlobToken();

  const ordersBlob = await getOrdersBlob();

  if (!ordersBlob) {
    return [];
  }

  const orderCatalog = await fetchPrivateBlobJson(ordersBlob);
  const orders = Array.isArray(orderCatalog.orders) ? orderCatalog.orders : [];

  return orders.map(normalizeOrder).filter((order) => order.id && order.productId);
}

export async function writeOrders(orders) {
  const token = getBlobToken();
  const normalizedOrders = orders.map(normalizeOrder);

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
      access: "private",
      allowOverwrite: true,
      cacheControlMaxAge: 60,
      contentType: "application/json",
      token,
    },
  );

  return normalizedOrders;
}

function validateOrderInput(payload) {
  const quantity = parseQuantity(payload.quantity);
  const locationText = cleanText(payload.locationText, MAX_LOCATION_TEXT_LENGTH);
  const googleMapsLocation = cleanMapLocation(payload.googleMapsLocation);

  const hasTextLocation = Boolean(locationText);
  const hasMapLocation = Boolean(googleMapsLocation);

  if (!hasTextLocation && !hasMapLocation) {
    throw new HttpError(400, "Enter location text or a Google Maps location.");
  }

  return {
    quantity,
    locationText,
    googleMapsLocation,
  };
}

export async function createOrder(product, payload) {
  const productId = String(product?.id || "").trim();

  if (!productId) {
    throw new HttpError(400, "Product ID is required.");
  }

  const input = validateOrderInput(payload);
  const now = new Date().toISOString();

  const order = normalizeOrder({
    id: `order-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    productId,
    productTitle: product.title,
    productDescription: product.description,
    productCategory: product.category,
    productWeight: product.weight,
    productPrice: product.price,
    imageUrl: product.imageUrl,
    imageUrls: product.imageUrls,
    quantity: input.quantity,
    locationText: input.locationText,
    googleMapsLocation: input.googleMapsLocation,
    proofOfPaymentReceived: false,
    createdAt: now,
    updatedAt: now,
  });

  const orders = await readOrders();
  const updatedOrders = [order, ...orders];
  await writeOrders(updatedOrders);

  return {
    order,
    orders: updatedOrders,
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
  const orders = await readOrders();
  let updatedOrder = null;

  const updatedOrders = orders.map((order) => {
    if (order.id !== id) {
      return order;
    }

    updatedOrder = normalizeOrder({
      ...order,
      proofOfPaymentReceived: proofValue,
      updatedAt: now,
    });

    return updatedOrder;
  });

  if (!updatedOrder) {
    throw new HttpError(404, "Order was not found.");
  }

  await writeOrders(updatedOrders);

  return {
    order: updatedOrder,
    orders: updatedOrders,
  };
}
