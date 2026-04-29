import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { HttpError } from "./errors.js";

const CATALOG_PATH = "products/catalog.json";
const IMAGE_PREFIX = "products/images";
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_CATALOG_WRITE_RETRIES = 4;
const WRITE_RETRY_BASE_DELAY_MS = 120;

export { MAX_IMAGE_SIZE_BYTES };

function getBlobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();

  if (!token) {
    throw new HttpError(500, "Vercel Blob read-write token is not configured.");
  }

  return token;
}

function ensureBlobConfigured() {
  getBlobToken();
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

function getPrivateImageUrl(pathname) {
  if (!pathname) {
    return "";
  }

  return `/api/blob/image?pathname=${encodeURIComponent(pathname)}`;
}

function wait(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function isWriteConflict(error) {
  if (error instanceof BlobPreconditionFailedError) {
    return true;
  }

  const statusCode = Number(error?.statusCode || error?.status);
  return statusCode === 412;
}

function normalizeProduct(product) {
  const imagePathnames = Array.isArray(product.imagePathnames)
    ? product.imagePathnames.map(String).filter(Boolean)
    : [];

  if (!imagePathnames.length && product.imagePathname) {
    imagePathnames.push(String(product.imagePathname));
  }

  const rawImageUrls = Array.isArray(product.imageUrls)
    ? product.imageUrls.map(String).filter(Boolean)
    : [];

  if (!rawImageUrls.length && product.imageUrl) {
    rawImageUrls.push(String(product.imageUrl));
  }

  const imageUrls = imagePathnames.length
    ? imagePathnames.map(getPrivateImageUrl)
    : rawImageUrls;

  return {
    id: String(product.id || ""),
    title: String(product.title || ""),
    description: String(product.description || ""),
    category: String(product.category || ""),
    price: Number(product.price || 0),
    weight: String(product.weight || ""),
    stockAmount: Number(product.stockAmount || 0),
    imageUrl: imageUrls[0] || "",
    imageUrls,
    imagePathname: imagePathnames[0] || "",
    imagePathnames,
    createdAt: String(product.createdAt || ""),
    updatedAt: String(product.updatedAt || ""),
  };
}

function validateProductInput(fields, images) {
  const title = cleanText(fields.title, 120);
  const description = cleanText(fields.description, 1000);
  const category = cleanText(fields.category, 80);
  const weight = cleanText(fields.weight, 60);
  const price = parsePrice(fields.price);
  const stockAmount = parseStockAmount(fields.stockAmount);

  if (!title) {
    throw new HttpError(400, "Product title is required.");
  }

  if (!description) {
    throw new HttpError(400, "Product description is required.");
  }

  if (!category) {
    throw new HttpError(400, "Product category is required.");
  }

  if (!weight) {
    throw new HttpError(400, "Product weight is required.");
  }

  if (!Array.isArray(images) || images.length === 0) {
    throw new HttpError(400, "At least one product image is required.");
  }

  images.forEach((image) => {
    if (!image?.buffer?.length) {
      throw new HttpError(400, "Product image is required.");
    }

    if (image.buffer.length > MAX_IMAGE_SIZE_BYTES) {
      throw new HttpError(413, "Each product image must be 4 MB or smaller.");
    }

    if (!ALLOWED_IMAGE_TYPES.has(image.mimeType)) {
      throw new HttpError(400, "Product images must be JPG, PNG, or WebP.");
    }
  });

  return {
    title,
    description,
    category,
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

async function readCatalogSnapshot() {
  const token = getBlobToken();
  const result = await get(CATALOG_PATH, {
    access: "private",
    token,
    useCache: false,
  });

  if (!result) {
    return {
      etag: "",
      products: [],
    };
  }

  if (result.statusCode !== 200 || !result.stream) {
    throw new HttpError(502, "Product catalog could not be read from Blob.");
  }

  const rawCatalog = await new Response(result.stream).text();
  let parsedCatalog = {};

  if (rawCatalog.trim()) {
    try {
      parsedCatalog = JSON.parse(rawCatalog);
    } catch {
      throw new HttpError(502, "Product catalog is invalid.");
    }
  }

  const products = Array.isArray(parsedCatalog.products) ? parsedCatalog.products : [];

  return {
    etag: String(result.blob?.etag || ""),
    products: products.map(normalizeProduct).filter((product) => product.id && product.title),
  };
}

export async function readProducts() {
  ensureBlobConfigured();
  const snapshot = await readCatalogSnapshot();
  return snapshot.products;
}

export async function writeProducts(products, options = {}) {
  const token = getBlobToken();

  const catalog = {
    updatedAt: new Date().toISOString(),
    products: products.map(normalizeProduct),
  };

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

  await put(CATALOG_PATH, JSON.stringify(catalog, null, 2), {
    ...writeOptions,
  });

  return catalog.products;
}

async function mutateProductsWithRetry(mutationHandler) {
  let attempt = 0;

  while (attempt <= MAX_CATALOG_WRITE_RETRIES) {
    const snapshot = await readCatalogSnapshot();
    const mutationResult = mutationHandler(snapshot.products);

    try {
      const persistedProducts = await writeProducts(mutationResult.products, {
        ifMatch: snapshot.etag || undefined,
      });

      return {
        ...mutationResult,
        products: persistedProducts,
      };
    } catch (error) {
      if (!isWriteConflict(error) || attempt === MAX_CATALOG_WRITE_RETRIES) {
        throw error;
      }

      attempt += 1;
      await wait(WRITE_RETRY_BASE_DELAY_MS * attempt);
    }
  }

  throw new HttpError(409, "Catalog update conflict. Please try again.");
}

export async function createProduct(fields, images) {
  const token = getBlobToken();

  const productInput = validateProductInput(fields, images);
  const now = new Date().toISOString();
  const id = `${slugify(productInput.title)}-${Date.now()}`;

  const uploadedImages = await Promise.all(
    images.map(async (image, index) => {
      const imagePathname = `${IMAGE_PREFIX}/${id}-${index + 1}.${getImageExtension(image)}`;

      return put(imagePathname, image.buffer, {
        access: "private",
        addRandomSuffix: true,
        contentType: image.mimeType,
        token,
      });
    }),
  );

  const imageUrls = uploadedImages.map((blob) => blob.url);
  const imagePathnames = uploadedImages.map((blob) => blob.pathname);

  const product = {
    id,
    ...productInput,
    imageUrl: imageUrls[0],
    imageUrls,
    imagePathname: imagePathnames[0],
    imagePathnames,
    createdAt: now,
    updatedAt: now,
  };

  await mutateProductsWithRetry((products) => ({
    product: normalizeProduct(product),
    products: [product, ...products],
  }));

  return normalizeProduct(product);
}

export async function deleteProduct(productId) {
  const id = String(productId || "").trim();

  if (!id) {
    throw new HttpError(400, "Product ID is required.");
  }

  const result = await mutateProductsWithRetry((products) => {
    const existingProduct = products.find((product) => product.id === id);

    if (!existingProduct) {
      throw new HttpError(404, "Product was not found.");
    }

    return {
      deletedProduct: existingProduct,
      products: products.filter((product) => product.id !== id),
    };
  });

  return {
    deletedProduct: result.deletedProduct,
    products: result.products,
  };
}

export async function setProductOutOfStock(productId) {
  const id = String(productId || "").trim();

  if (!id) {
    throw new HttpError(400, "Product ID is required.");
  }

  const now = new Date().toISOString();
  const result = await mutateProductsWithRetry((products) => {
    let updatedProduct = null;

    const updatedProducts = products.map((product) => {
      if (product.id !== id) {
        return product;
      }

      updatedProduct = normalizeProduct({
        ...product,
        stockAmount: 0,
        updatedAt: now,
      });

      return updatedProduct;
    });

    if (!updatedProduct) {
      throw new HttpError(404, "Product was not found.");
    }

    return {
      product: updatedProduct,
      products: updatedProducts,
    };
  });

  return {
    product: result.product,
    products: result.products,
  };
}
