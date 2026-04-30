import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { HttpError } from "./errors.js";

const CATALOG_PATH = "products/catalog.json";
const IMAGE_PREFIX = "products/images";
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_CATALOG_WRITE_RETRIES = 8;
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

function cleanList(value, maxItems = 20, maxItemLength = 60) {
  if (Array.isArray(value)) {
    return value
      .map((item) => cleanText(item, maxItemLength))
      .filter(Boolean)
      .slice(0, maxItems);
  }

  return String(value || "")
    .split(/[\n,]+/)
    .map((item) => cleanText(item, maxItemLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function parseBoolean(value) {
  return value === true || String(value || "").toLowerCase() === "true";
}

function parseMoney(value) {
  const money = Number.parseFloat(
    String(value || "")
      .replace(/[^\d.,-]/g, "")
      .replace(",", "."),
  );

  if (!Number.isFinite(money) || money < 0) {
    return null;
  }

  return Math.round(money * 100) / 100;
}

function normalizeSpecialOption(value = {}) {
  const enabled = parseBoolean(value.enabled);
  const label = cleanText(value.label || "Special", 80);
  const startDate = cleanText(value.startDate, 20);
  const endDate = cleanText(value.endDate, 20);
  const discountAmount = parseMoney(value.discountAmount);

  if (!enabled || !startDate || !endDate) {
    return {
      enabled: false,
      label: "",
      startDate: "",
      endDate: "",
      discountAmount: 0,
    };
  }

  const startTime = Date.parse(startDate);
  const endTime = Date.parse(endDate);

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    throw new HttpError(400, "Enter valid special option dates.");
  }

  if (startTime > endTime) {
    throw new HttpError(400, "Special option start date must be before the end date.");
  }

  if (discountAmount === null) {
    throw new HttpError(400, "Enter a valid special discount amount.");
  }

  return {
    enabled: true,
    label: label || "Special",
    startDate,
    endDate,
    discountAmount,
  };
}

function parsePrice(value) {
  const price = parseMoney(value);

  if (price === null) {
    throw new HttpError(400, "Enter a valid product price.");
  }

  return price;
}

function parseStockAmount(value) {
  const stockAmount = Number.parseInt(String(value || ""), 10);

  if (!Number.isInteger(stockAmount) || stockAmount < 0) {
    throw new HttpError(400, "Enter a valid stock amount.");
  }

  return stockAmount;
}

function parseMinimumOrderQuantity(value) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    return 1;
  }

  const minimumOrderQuantity = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(minimumOrderQuantity) || minimumOrderQuantity < 1) {
    throw new HttpError(400, "Enter a valid minimum order quantity.");
  }

  return minimumOrderQuantity;
}

function parseOrderItemQuantity(value) {
  const quantity = Number.parseInt(String(value || ""), 10);

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new HttpError(400, "Enter a valid quantity.");
  }

  return quantity;
}

function normalizeRequestedOrderItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(400, "Select at least one product before placing an order.");
  }

  const normalizedItems = [];
  const itemByProductId = new Map();

  items.forEach((item) => {
    const productId = String(item?.productId || "").trim();

    if (!productId) {
      throw new HttpError(400, "Product ID is required.");
    }

    const quantity = parseOrderItemQuantity(item?.quantity);
    const existingItem = itemByProductId.get(productId);

    if (existingItem) {
      existingItem.quantity += quantity;
      return;
    }

    const normalizedItem = {
      productId,
      quantity,
    };

    normalizedItems.push(normalizedItem);
    itemByProductId.set(productId, normalizedItem);
  });

  return normalizedItems;
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

  const minimumOrderQuantity = Number.parseInt(String(product.minimumOrderQuantity || ""), 10);

  return {
    id: String(product.id || ""),
    title: String(product.title || ""),
    description: String(product.description || ""),
    category: String(product.category || ""),
    price: Number(product.price || 0),
    weight: String(product.weight || ""),
    stockAmount: Number(product.stockAmount || 0),
    minimumOrderQuantity:
      Number.isInteger(minimumOrderQuantity) && minimumOrderQuantity > 0
        ? minimumOrderQuantity
        : 1,
    imageUrl: imageUrls[0] || "",
    imageUrls,
    imagePathname: imagePathnames[0] || "",
    imagePathnames,
    colors: cleanList(product.colors),
    scents: cleanList(product.scents),
    specialOption: normalizeSpecialOption(product.specialOption || {}),
    createdAt: String(product.createdAt || ""),
    updatedAt: String(product.updatedAt || ""),
  };
}

function validateProductFields(fields) {
  const title = cleanText(fields.title, 120);
  const description = cleanText(fields.description, 1000);
  const category = cleanText(fields.category, 80);
  const weight = cleanText(fields.weight, 60);
  const price = parsePrice(fields.price);
  const stockAmount = parseStockAmount(fields.stockAmount);
  const minimumOrderQuantity = parseMinimumOrderQuantity(fields.minimumOrderQuantity);
  const colors = cleanList(fields.colors);
  const scents = cleanList(fields.scents);
  const specialOption = normalizeSpecialOption({
    enabled: fields.specialOptionEnabled,
    label: fields.specialOptionLabel,
    startDate: fields.specialOptionStartDate,
    endDate: fields.specialOptionEndDate,
    discountAmount: fields.specialOptionDiscountAmount,
  });

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

  return {
    title,
    description,
    category,
    price,
    weight,
    stockAmount,
    minimumOrderQuantity,
    colors,
    scents,
    specialOption,
  };
}

function validateProductInput(fields, images) {
  const productFields = validateProductFields(fields);

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

  return productFields;
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
      if (!isWriteConflict(error)) {
        throw error;
      }

      if (attempt === MAX_CATALOG_WRITE_RETRIES) {
        break;
      }

      attempt += 1;
      await wait(WRITE_RETRY_BASE_DELAY_MS * attempt + Math.floor(Math.random() * 80));
    }
  }

  const fallbackSnapshot = await readCatalogSnapshot();
  const fallbackMutationResult = mutationHandler(fallbackSnapshot.products);
  const persistedProducts = await writeProducts(fallbackMutationResult.products);

  return {
    ...fallbackMutationResult,
    products: persistedProducts,
  };
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

export async function updateProductStock(productId, stockAmountValue) {
  const id = String(productId || "").trim();

  if (!id) {
    throw new HttpError(400, "Product ID is required.");
  }

  const stockAmount = parseStockAmount(stockAmountValue);
  const now = new Date().toISOString();
  const result = await mutateProductsWithRetry((products) => {
    let updatedProduct = null;

    const updatedProducts = products.map((product) => {
      if (product.id !== id) {
        return product;
      }

      updatedProduct = normalizeProduct({
        ...product,
        stockAmount,
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

export async function updateProductDetails(productId, fields) {
  const id = String(productId || "").trim();

  if (!id) {
    throw new HttpError(400, "Product ID is required.");
  }

  const productFields = validateProductFields(fields || {});
  const now = new Date().toISOString();
  const result = await mutateProductsWithRetry((products) => {
    let updatedProduct = null;

    const updatedProducts = products.map((product) => {
      if (product.id !== id) {
        return product;
      }

      updatedProduct = normalizeProduct({
        ...product,
        ...productFields,
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

export async function reserveStockForOrderItems(items) {
  const requestedItems = normalizeRequestedOrderItems(items);
  const now = new Date().toISOString();

  const result = await mutateProductsWithRetry((products) => {
    const productsById = new Map(products.map((product) => [product.id, product]));
    const reservedItems = requestedItems.map((requestedItem) => {
      const product = productsById.get(requestedItem.productId);

      if (!product) {
        throw new HttpError(404, "Product was not found.");
      }

      const stockAmount = Number(product.stockAmount || 0);
      const minimumOrderQuantity = parseMinimumOrderQuantity(product.minimumOrderQuantity);

      if (stockAmount <= 0) {
        throw new HttpError(400, `"${product.title}" is currently out of stock.`);
      }

      if (requestedItem.quantity < minimumOrderQuantity) {
        throw new HttpError(
          400,
          `Minimum order quantity for "${product.title}" is ${minimumOrderQuantity}.`,
        );
      }

      if (requestedItem.quantity > stockAmount) {
        throw new HttpError(400, `Requested quantity for "${product.title}" is higher than stock.`);
      }

      return {
        product: normalizeProduct(product),
        quantity: requestedItem.quantity,
      };
    });

    const quantityByProductId = new Map(
      reservedItems.map((item) => [item.product.id, item.quantity]),
    );

    const updatedProducts = products.map((product) => {
      const reservedQuantity = quantityByProductId.get(product.id);

      if (!reservedQuantity) {
        return product;
      }

      return normalizeProduct({
        ...product,
        stockAmount: Number(product.stockAmount || 0) - reservedQuantity,
        updatedAt: now,
      });
    });

    return {
      reservedItems,
      products: updatedProducts,
    };
  });

  return {
    items: result.reservedItems,
    products: result.products,
  };
}

export async function restoreStockForOrderItems(items) {
  const requestedItems = normalizeRequestedOrderItems(items);
  const now = new Date().toISOString();

  const result = await mutateProductsWithRetry((products) => {
    const productsById = new Map(products.map((product) => [product.id, product]));

    requestedItems.forEach((requestedItem) => {
      if (!productsById.has(requestedItem.productId)) {
        throw new HttpError(
          409,
          `Rollback failed: product "${requestedItem.productId}" is missing from the catalog.`,
        );
      }
    });

    const quantityByProductId = new Map(
      requestedItems.map((requestedItem) => [requestedItem.productId, requestedItem.quantity]),
    );

    const updatedProducts = products.map((product) => {
      const quantityToRestore = quantityByProductId.get(product.id);

      if (!quantityToRestore) {
        return product;
      }

      return normalizeProduct({
        ...product,
        stockAmount: Number(product.stockAmount || 0) + quantityToRestore,
        updatedAt: now,
      });
    });

    return {
      products: updatedProducts,
    };
  });

  return {
    products: result.products,
  };
}
