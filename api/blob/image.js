import { list } from "@vercel/blob";
import { HttpError } from "../_utils/errors.js";
import { requireMethod, sendError } from "../_utils/http.js";

function getBlobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();

  if (!token) {
    throw new HttpError(500, "Vercel Blob read-write token is not configured.");
  }

  return token;
}

function isAllowedImagePathname(pathname) {
  return String(pathname || "").startsWith("products/images/");
}

async function findBlobByPathname(pathname) {
  const token = getBlobToken();

  const { blobs } = await list({
    prefix: pathname,
    limit: 10,
    token,
  });

  return blobs.find((blob) => blob.pathname === pathname);
}

export default async function handler(request, response) {
  try {
    requireMethod(request, response, ["GET"]);

    const requestUrl = new URL(request.url, `https://${request.headers.host || "localhost"}`);
    const pathname = requestUrl.searchParams.get("pathname");

    if (!pathname) {
      throw new HttpError(400, "Blob pathname is required.");
    }

    if (!isAllowedImagePathname(pathname)) {
      throw new HttpError(403, "This image path is not allowed.");
    }

    const blob = await findBlobByPathname(pathname);

    if (!blob) {
      throw new HttpError(404, "Image was not found.");
    }

    const blobResponse = await fetch(blob.downloadUrl || blob.url, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${getBlobToken()}`,
      },
    });

    if (!blobResponse.ok) {
      throw new HttpError(502, "Image could not be read from Blob.");
    }

    const arrayBuffer = await blobResponse.arrayBuffer();

    response.setHeader("Content-Type", blob.contentType || "image/jpeg");
    response.setHeader("Cache-Control", "public, max-age=300");
    response.status(200).send(Buffer.from(arrayBuffer));
  } catch (error) {
    sendError(response, error);
  }
}