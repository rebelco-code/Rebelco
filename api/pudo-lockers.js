import { HttpError } from "./_utils/errors.js";
import { requireMethod, sendError, sendJson } from "./_utils/http.js";
import { findNearbyPudoLockers, parsePudoQueryParams } from "./_utils/pudoLockers.js";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const CACHE_TTL_MS = 90_000;
const MAX_CACHE_ENTRIES = 160;

const rateLimitStore =
  globalThis.__rebelcoPudoRateLimitStore ||
  (globalThis.__rebelcoPudoRateLimitStore = new Map());
const cacheStore =
  globalThis.__rebelcoPudoCacheStore || (globalThis.__rebelcoPudoCacheStore = new Map());

function getClientKey(request) {
  const forwardedFor = String(request.headers["x-forwarded-for"] || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)[0];
  const remoteAddress =
    forwardedFor ||
    String(request.headers["x-real-ip"] || "").trim() ||
    String(request.socket?.remoteAddress || "").trim() ||
    "unknown";
  const userAgent = String(request.headers["user-agent"] || "").trim().slice(0, 120);

  return `${remoteAddress}|${userAgent}`;
}

function enforceRateLimit(request) {
  const now = Date.now();

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.delete(key);
    }
  }

  const clientKey = getClientKey(request);
  const existingEntry = rateLimitStore.get(clientKey);

  if (!existingEntry || now - existingEntry.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(clientKey, {
      count: 1,
      windowStartedAt: now,
    });
    return;
  }

  if (existingEntry.count >= RATE_LIMIT_MAX_REQUESTS) {
    throw new HttpError(429, "Too many lookup requests. Please wait a moment and retry.");
  }

  existingEntry.count += 1;
}

function buildCacheKey(context) {
  const lat = Number(context.lat).toFixed(3);
  const lng = Number(context.lng).toFixed(3);
  const limit = Number(context.limit);

  return `${lat}|${lng}|${limit}`;
}

function readCachedResult(context) {
  const cacheKey = buildCacheKey(context);
  const now = Date.now();

  const cachedEntry = cacheStore.get(cacheKey);

  if (!cachedEntry) {
    return null;
  }

  if (now - cachedEntry.cachedAt > CACHE_TTL_MS) {
    cacheStore.delete(cacheKey);
    return null;
  }

  return cachedEntry.value;
}

function writeCachedResult(context, result) {
  const cacheKey = buildCacheKey(context);

  if (cacheStore.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cacheStore.keys().next().value;

    if (oldestKey) {
      cacheStore.delete(oldestKey);
    }
  }

  cacheStore.set(cacheKey, {
    cachedAt: Date.now(),
    value: result,
  });
}

export default async function handler(request, response) {
  try {
    requireMethod(request, response, ["GET"]);
    response.setHeader("Cache-Control", "no-store");
    enforceRateLimit(request);

    const context = parsePudoQueryParams(request);
    const cachedResult = readCachedResult(context);

    if (cachedResult) {
      sendJson(response, 200, cachedResult);
      return;
    }

    const result = await findNearbyPudoLockers(context);
    writeCachedResult(context, result);

    sendJson(response, 200, result);
  } catch (error) {
    sendError(response, error);
  }
}
