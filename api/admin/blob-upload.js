import { handleUpload } from "@vercel/blob/client";
import { requireAdminSession } from "../_utils/adminAuth.js";
import { HttpError } from "../_utils/errors.js";
import { requireMethod, readJsonBody, sendError, sendJson } from "../_utils/http.js";
import {
  ALLOWED_IMAGE_TYPES,
  IMAGE_PREFIX,
  MAX_IMAGE_SIZE_BYTES,
} from "../_utils/productsStore.js";

const IMAGE_PATH_PATTERN = /^[a-z0-9][a-z0-9._/-]*$/i;

function isValidUploadPathname(pathname) {
  const value = String(pathname || "").trim();

  if (!value.startsWith(`${IMAGE_PREFIX}/`)) {
    return false;
  }

  if (!IMAGE_PATH_PATTERN.test(value)) {
    return false;
  }

  if (value.includes("..")) {
    return false;
  }

  return true;
}

export default async function handler(request, response) {
  try {
    requireMethod(request, response, ["POST"]);
    requireAdminSession(request);
    response.setHeader("Cache-Control", "no-store");

    const body = await readJsonBody(request);
    const result = await handleUpload({
      request,
      body,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (pathname) => {
        if (!isValidUploadPathname(pathname)) {
          throw new HttpError(400, "Invalid image upload request.");
        }

        return {
          allowedContentTypes: Array.from(ALLOWED_IMAGE_TYPES),
          maximumSizeInBytes: MAX_IMAGE_SIZE_BYTES,
          addRandomSuffix: true,
          cacheControlMaxAge: 60 * 60 * 24 * 30,
        };
      },
    });

    sendJson(response, 200, result);
  } catch (error) {
    sendError(response, error);
  }
}
