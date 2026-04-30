import {
  clearAdminSessionCookie,
  createAdminSessionCookie,
  readAdminSession,
  verifyAdminLogin,
} from "../_utils/adminAuth.js";
import { HttpError } from "../_utils/errors.js";
import { requireMethod, readJsonBody, sendError, sendJson } from "../_utils/http.js";

const LOGIN_WINDOW_MS = 60_000;
const LOGIN_MAX_ATTEMPTS = 8;

const loginAttemptStore =
  globalThis.__rebelcoAdminLoginAttemptStore ||
  (globalThis.__rebelcoAdminLoginAttemptStore = new Map());

function getClientKey(request) {
  const forwardedFor = String(request.headers["x-forwarded-for"] || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)[0];

  return (
    forwardedFor ||
    String(request.headers["x-real-ip"] || "").trim() ||
    String(request.socket?.remoteAddress || "").trim() ||
    "unknown"
  );
}

function clearExpiredLoginAttempts(now) {
  for (const [key, entry] of loginAttemptStore.entries()) {
    if (now - entry.windowStartedAt >= LOGIN_WINDOW_MS) {
      loginAttemptStore.delete(key);
    }
  }
}

function enforceLoginRateLimit(request) {
  const now = Date.now();
  clearExpiredLoginAttempts(now);

  const clientKey = getClientKey(request);
  const existingEntry = loginAttemptStore.get(clientKey);

  if (!existingEntry || now - existingEntry.windowStartedAt >= LOGIN_WINDOW_MS) {
    loginAttemptStore.set(clientKey, { count: 1, windowStartedAt: now });
    return;
  }

  if (existingEntry.count >= LOGIN_MAX_ATTEMPTS) {
    throw new HttpError(429, "Too many sign-in attempts. Please wait and try again.");
  }

  existingEntry.count += 1;
}

export default async function handler(request, response) {
  try {
    requireMethod(request, response, ["GET", "POST", "DELETE"]);

    if (request.method === "GET") {
      const admin = readAdminSession(request);

      if (!admin) {
        sendJson(response, 401, { admin: null });
        return;
      }

      sendJson(response, 200, { admin });
      return;
    }

    if (request.method === "DELETE") {
      response.setHeader("Set-Cookie", clearAdminSessionCookie());
      sendJson(response, 200, { ok: true });
      return;
    }

    enforceLoginRateLimit(request);
    const body = await readJsonBody(request);
    const admin = verifyAdminLogin(body.email, body.password);
    loginAttemptStore.delete(getClientKey(request));

    response.setHeader("Set-Cookie", createAdminSessionCookie(admin));
    sendJson(response, 200, { admin });
  } catch (error) {
    sendError(response, error);
  }
}
