import { HttpError, toErrorResponse } from "./errors.js";

export function sendJson(response, statusCode, body, headers = {}) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");

  Object.entries(headers).forEach(([key, value]) => {
    response.setHeader(key, value);
  });

  response.end(JSON.stringify(body));
}

export function sendError(response, error) {
  const { statusCode, body } = toErrorResponse(error);
  sendJson(response, statusCode, body);
}

export function requireMethod(request, response, allowedMethods) {
  if (allowedMethods.includes(request.method)) {
    return;
  }

  response.setHeader("Allow", allowedMethods.join(", "));
  throw new HttpError(405, "Method not allowed.");
}

export function readJsonBody(request, maxBytes = 1_000_000) {
  if (request.body && typeof request.body === "object") {
    return Promise.resolve(request.body);
  }

  if (typeof request.body === "string") {
    return Promise.resolve(JSON.parse(request.body || "{}"));
  }

  return new Promise((resolve, reject) => {
    let rawBody = "";

    request.on("data", (chunk) => {
      rawBody += chunk;

      if (Buffer.byteLength(rawBody) > maxBytes) {
        reject(new HttpError(413, "Request body is too large."));
        request.destroy();
      }
    });

    request.on("end", () => {
      try {
        resolve(rawBody ? JSON.parse(rawBody) : {});
      } catch {
        reject(new HttpError(400, "Invalid JSON body."));
      }
    });

    request.on("error", reject);
  });
}
