import Busboy from "busboy";
import { requireAdminSession } from "../_utils/adminAuth.js";
import { HttpError } from "../_utils/errors.js";
import { requireMethod, sendError, sendJson } from "../_utils/http.js";
import {
  createProduct,
  MAX_IMAGE_SIZE_BYTES,
  readProducts,
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
        fields: 8,
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

export default async function handler(request, response) {
  try {
    requireMethod(request, response, ["GET", "POST"]);
    requireAdminSession(request);

    if (request.method === "GET") {
      const products = await readProducts();
      sendJson(response, 200, { products });
      return;
    }

    const { fields, image } = await parseMultipartForm(request);
    const product = await createProduct(fields, image);
    const products = await readProducts();

    sendJson(response, 201, { product, products });
  } catch (error) {
    sendError(response, error);
  }
}
