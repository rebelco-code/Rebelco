import { list, put } from "@vercel/blob";
import { HttpError } from "./errors.js";

const CATALOG_PATH = "products/catalog.json";
const IMAGE_PREFIX = "products/images";
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export { MAX_IMAGE_SIZE_BYTES };

function ensureBlobConfigured() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new HttpError(500, "Vercel Blob read-write token is not configured.");
  }
}

function slugify(value) {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return slug || "product";
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function parsePrice(value) {
  const cleanedValue = String(value || "")
    .replace(/[^\d.,-]/g, "")
    .replace(",", ".");
  const price = Number.parseFloat(cleanedValue);

  if (!Number.isFinite(price) || price < 0) {
    throw new HttpError(400, "Enter a valid product price.");
  }

  return Math.round(price * 100) / 100;
}

function parseStockAmount(value) {
  const stockAmount = Number.parseInt(String(value || ""), 10);

  if (!Number.isInteger(stockAmount) || stockAmount < 0) {
    throw new HttpError(400, "Enter a valid stock amount.");
  }

  return stockAmount;
}

function normalizeProduct(product) {
  return {
    id: String(product.id || ""),
    title: String(product.title || ""),
    description: String(product.description || ""),
    price: Number(product.price || 0),
    weight: String(product.weight || ""),
    stockAmount: Number(product.stockAmount || 0),
    imageUrl: String(product.imageUrl || ""),
    imagePathname: String(product.imagePathname || ""),
    createdAt: String(product.createdAt || ""),
    updatedAt: String(product.updatedAt || ""),
  };
}

function validateProductInput(fields, image) {
  const title = cleanText(fields.title, 120);
  const description = cleanText(fields.description, 1000);
  const weight = cleanText(fields.weight, 60);
  const price = parsePrice(fields.price);
  const stockAmount = parseStockAmount(fields.stockAmount);

  if (!title) {
    throw new HttpError(400, "Product title is required.");
  }

  if (!description) {
    throw new HttpError(400, "Product description is required.");
  }

  if (!weight) {
    throw new HttpError(400, "Product weight is required.");
  }

  if (!image?.buffer?.length) {
    throw new HttpError(400, "Product image is required.");
  }

  if (image.buffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new HttpError(413, "Product image must be 4 MB or smaller.");
  }

  if (!ALLOWED_IMAGE_TYPES.has(image.mimeType)) {
    throw new HttpError(400, "Product image must be JPG, PNG, or WebP.");
  }

  return {
    title,
    description,
    price,
    weight,
    stockAmount,
  };
}

function getImageExtension(image) {
  if (image.mimeType === "image/png") {
    return "png";
  }

  if (image.mimeType === "image/webp") {
    return "webp";
  }

  return "jpg";
}

async function getCatalogBlob() {
  const { blobs } = await list({
    prefix: CATALOG_PATH,
    limit: 10,
  });

  return blobs.find((blob) => blob.pathname === CATALOG_PATH);
}

export async function readProducts() {
  ensureBlobConfigured();

  const catalogBlob = await getCatalogBlob();

  if (!catalogBlob) {
    return [];
  }

  const catalogResponse = await fetch(catalogBlob.url, { cache: "no-store" });

  if (!catalogResponse.ok) {
    throw new HttpError(502, "Product catalog could not be read from Blob.");
  }

  const catalog = await catalogResponse.json();
  const products = Array.isArray(catalog.products) ? catalog.products : [];

  return products.map(normalizeProduct).filter((product) => product.id && product.title);
}

export async function writeProducts(products) {
  ensureBlobConfigured();

  const catalog = {
    updatedAt: new Date().toISOString(),
    products: products.map(normalizeProduct),
  };

  await put(CATALOG_PATH, JSON.stringify(catalog, null, 2), {
    access: "public",
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: "application/json",
  });

  return catalog.products;
}

export async function createProduct(fields, image) {
  ensureBlobConfigured();

  const productInput = validateProductInput(fields, image);
  const now = new Date().toISOString();
  const id = `${slugify(productInput.title)}-${Date.now()}`;
  const imagePathname = `${IMAGE_PREFIX}/${id}.${getImageExtension(image)}`;
  const imageBlob = await put(imagePathname, image.buffer, {
    access: "public",
    addRandomSuffix: true,
    contentType: image.mimeType,
  });
  const product = {
    id,
    ...productInput,
    imageUrl: imageBlob.url,
    imagePathname: imageBlob.pathname,
    createdAt: now,
    updatedAt: now,
  };
  const products = await readProducts();
  const updatedProducts = [product, ...products];

  await writeProducts(updatedProducts);

  return normalizeProduct(product);
}
