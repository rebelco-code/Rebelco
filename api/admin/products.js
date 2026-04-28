import Busboy from "busboy";
import { requireAdminSession } from "../_utils/adminAuth.js";
import { HttpError } from "../_utils/errors.js";
import { requireMethod, readJsonBody, sendError, sendJson } from "../_utils/http.js";
import {
  createProduct,
  deleteProduct,
  MAX_IMAGE_SIZE_BYTES,
  readProducts,
  setProductOutOfStock,
} from "../_utils/productsStore.js";

function parseMultipartForm(request) {
  const contentType = request.headers["content-type"] || "";

  if (!contentType.includes("multipart/form-data")) {
    throw new HttpError(415, "Expected multipart form data.");
  }

  return new Promise((resolve, reject) => {
    const fields = {};
    let image = null;
    let imageTooLarge = false;

    const busboy = Busboy({
      headers: request.headers,
      limits: {
        fields: 10,
        files: 1,
        fileSize: MAX_IMAGE_SIZE_BYTES,
      },
    });

    busboy.on("field", (name, value) => {
      fields[name] = value;
    });

    busboy.on("file", (name, file, info) => {
      if (name !== "image") {
        file.resume();
        return;
      }

      const chunks = [];
      let size = 0;

      file.on("data", (chunk) => {
        size += chunk.length;
        chunks.push(chunk);
      });

      file.on("limit", () => {
        imageTooLarge = true;
        file.resume();
      });

      file.on("end", () => {
        if (!imageTooLarge && size > 0) {
          image = {
            buffer: Buffer.concat(chunks),
            filename: info.filename,
            mimeType: info.mimeType,
            size,
          };
        }
      });
    });

    busboy.on("error", reject);

    busboy.on("finish", () => {
      if (imageTooLarge) {
        reject(new HttpError(413, "Product image must be 4 MB or smaller."));
        return;
      }

      resolve({ fields, image });
    });

    request.pipe(busboy);
  });
}

function getProductId(request) {
  const requestUrl = new URL(request.url, `https://${request.headers.host || "localhost"}`);
  return requestUrl.searchParams.get("id");
}

export default async function handler(request, response) {
  try {
    requireMethod(request, response, ["GET", "POST", "PATCH", "DELETE"]);
    requireAdminSession(request);

    if (request.method === "GET") {
      const products = await readProducts();

      sendJson(response, 200, { products });
      return;
    }

    if (request.method === "POST") {
      const { fields, image } = await parseMultipartForm(request);
      const product = await createProduct(fields, image);
      const products = await readProducts();

      sendJson(response, 201, { product, products });
      return;
    }

    if (request.method === "PATCH") {
      const body = await readJsonBody(request);
      const productId = body.id || getProductId(request);

      if (body.action !== "set-out-of-stock") {
        throw new HttpError(400, "Unsupported product action.");
      }

      const result = await setProductOutOfStock(productId);

      sendJson(response, 200, result);
      return;
    }

    if (request.method === "DELETE") {
      const body = await readJsonBody(request).catch(() => ({}));
      const productId = body.id || getProductId(request);
      const result = await deleteProduct(productId);

      sendJson(response, 200, result);
    }
  } catch (error) {
    sendError(response, error);
  }
}