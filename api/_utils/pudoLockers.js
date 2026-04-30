import { HttpError } from "./errors.js";

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 12;
const REQUEST_TIMEOUT_MS = 3_500;
const MAX_PROVIDER_ATTEMPTS = 5;
const MAX_PROVIDER_LOOKUP_MS = 12_000;
const DEFAULT_PUDO_API_BASE_URL = "https://api-sandbox.pudo.co.za";

function cleanText(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

function getPudoApiBaseUrl() {
  const configuredBaseUrl = String(process.env.PUDO_API_BASE_URL || "").trim();
  const baseUrl = configuredBaseUrl || DEFAULT_PUDO_API_BASE_URL;
  return baseUrl.replace(/\/+$/, "");
}

function getLockerDataUrls(apiBaseUrl) {
  const cleanedBaseUrl = apiBaseUrl.replace(/\/+$/, "");
  const urls = [];

  if (cleanedBaseUrl.endsWith("/api/v1")) {
    urls.push(`${cleanedBaseUrl}/lockers-data`);
  } else {
    urls.push(`${cleanedBaseUrl}/api/v1/lockers-data`);
    urls.push(`${cleanedBaseUrl}/lockers-data`);
  }

  return Array.from(new Set(urls));
}

function parseNumber(value, min, max, fieldName) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number.parseFloat(String(value));

  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, `Invalid ${fieldName}.`);
  }

  if (parsed < min || parsed > max) {
    throw new HttpError(400, `${fieldName} is out of range.`);
  }

  return parsed;
}

function parseLimit(value) {
  if (value === null || value === undefined || value === "") return DEFAULT_LIMIT;

  const parsed = Number.parseInt(String(value), 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new HttpError(400, "Invalid limit value.");
  }

  return Math.min(parsed, MAX_LIMIT);
}

export function parsePudoQueryParams(request) {
  const requestUrl = new URL(request.url, `https://${request.headers.host || "localhost"}`);

  const lat = parseNumber(requestUrl.searchParams.get("lat"), -90, 90, "latitude");
  const lng = parseNumber(requestUrl.searchParams.get("lng"), -180, 180, "longitude");
  const limit = parseLimit(requestUrl.searchParams.get("limit"));

  if ((lat === null) !== (lng === null)) {
    throw new HttpError(400, "Latitude and longitude must both be provided.");
  }

  if (lat === null || lng === null) {
    throw new HttpError(400, "Customer coordinates are required.");
  }

  return { lat, lng, limit };
}

function parseJsonSafe(rawValue) {
  if (!rawValue) return null;

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

function extractArrayFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.lockers)) return payload.lockers;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.pickup_points)) return payload.pickup_points;
  if (Array.isArray(payload?.pickupPoints)) return payload.pickupPoints;

  return null;
}

function describePayloadShape(payload) {
  if (payload === null) return "null";
  if (Array.isArray(payload)) return `array(length=${payload.length})`;

  if (typeof payload === "object") {
    return `object(keys=${Object.keys(payload).slice(0, 20).join(",")})`;
  }

  return typeof payload;
}

async function fetchJsonAttempt(attempt) {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, REQUEST_TIMEOUT_MS);

  const startedAt = Date.now();

  try {
    const response = await fetch(attempt.url, {
      method: attempt.method || "GET",
      headers: {
        Accept: "application/json",
        ...attempt.headers,
      },
      signal: abortController.signal,
    });

    const rawBody = await response.text();
    const parsedBody = parseJsonSafe(rawBody);
    const arrayPayload = extractArrayFromPayload(parsedBody);

    return {
      label: attempt.label,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      durationMs: Date.now() - startedAt,
      url: attempt.url.replace(/([?&](api_key|token|key)=)[^&]+/gi, "$1***"),
      requestHeaders: Object.keys(attempt.headers || {}),
      responseContentType: response.headers.get("content-type") || "",
      responseServer: response.headers.get("server") || "",
      responseWwwAuthenticate: response.headers.get("www-authenticate") || "",
      responseAllowedMethods: response.headers.get("allow") || "",
      parsedShape: describePayloadShape(parsedBody),
      arrayLength: Array.isArray(arrayPayload) ? arrayPayload.length : null,
      bodyPreview: cleanText(rawBody, 500),
      arrayPayload,
    };
  } catch (error) {
    const errorSummary = error?.cause?.message
      ? `${error?.message || "Network request failed."} | ${error.cause.message}`
      : error?.message || "Network request failed.";

    return {
      label: attempt.label,
      ok: false,
      status: 0,
      statusText: "",
      durationMs: Date.now() - startedAt,
      url: attempt.url.replace(/([?&](api_key|token|key)=)[^&]+/gi, "$1***"),
      requestHeaders: Object.keys(attempt.headers || {}),
      responseContentType: "",
      responseServer: "",
      responseWwwAuthenticate: "",
      responseAllowedMethods: "",
      parsedShape: "error",
      arrayLength: null,
      bodyPreview: cleanText(errorSummary, 500),
      arrayPayload: null,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchPudoLockers() {
  const apiKey = String(process.env.PUDO_API_KEY || "").trim();
  const bearerToken = String(process.env.PUDO_BEARER_TOKEN || process.env.PUDO_API_TOKEN || "").trim();
  const apiBaseUrl = getPudoApiBaseUrl();
  const lockerDataUrls = getLockerDataUrls(apiBaseUrl);

  const attempts = lockerDataUrls.flatMap((lockerDataUrl) => [
    ...(bearerToken
      ? [
          {
            label: "lockers-auth-bearer-token",
            url: lockerDataUrl,
            headers: { Authorization: `Bearer ${bearerToken}` },
          },
          {
            label: "lockers-query-token",
            url: `${lockerDataUrl}?token=${encodeURIComponent(bearerToken)}`,
            headers: {},
          },
        ]
      : []),
    ...(apiKey
      ? [
          {
            label: "lockers-header-api-key",
            url: lockerDataUrl,
            headers: { "api-key": apiKey },
          },
          {
            label: "lockers-header-x-api-key",
            url: lockerDataUrl,
            headers: { "x-api-key": apiKey },
          },
          {
            label: "lockers-header-x-pudo-key",
            url: lockerDataUrl,
            headers: { "x-pudo-key": apiKey },
          },
          {
            label: "lockers-query-api-key",
            url: `${lockerDataUrl}?api_key=${encodeURIComponent(apiKey)}`,
            headers: {},
          },
        ]
      : []),
    {
      label: "lockers-no-auth",
      url: lockerDataUrl,
      headers: {},
    },
  ]);

  const diagnostics = [];
  const startedAt = Date.now();
  let executedAttempts = 0;

  for (const attempt of attempts) {
    if (executedAttempts >= MAX_PROVIDER_ATTEMPTS) {
      diagnostics.push({
        label: "attempt-limit-hit",
        status: 0,
        statusText: "",
        durationMs: Date.now() - startedAt,
        url: "",
        requestHeaders: [],
        responseContentType: "",
        responseServer: "",
        responseWwwAuthenticate: "",
        responseAllowedMethods: "",
        parsedShape: "skipped",
        arrayLength: null,
        bodyPreview: `Stopped after ${MAX_PROVIDER_ATTEMPTS} attempts.`,
      });
      break;
    }

    if (Date.now() - startedAt >= MAX_PROVIDER_LOOKUP_MS) {
      diagnostics.push({
        label: "time-budget-hit",
        status: 0,
        statusText: "",
        durationMs: Date.now() - startedAt,
        url: "",
        requestHeaders: [],
        responseContentType: "",
        responseServer: "",
        responseWwwAuthenticate: "",
        responseAllowedMethods: "",
        parsedShape: "skipped",
        arrayLength: null,
        bodyPreview: `Stopped after ${MAX_PROVIDER_LOOKUP_MS}ms total lookup time.`,
      });
      break;
    }

    executedAttempts += 1;
    const result = await fetchJsonAttempt(attempt);

    diagnostics.push({
      label: result.label,
      status: result.status,
      statusText: result.statusText,
      durationMs: result.durationMs,
      url: result.url,
      requestHeaders: result.requestHeaders,
      responseContentType: result.responseContentType,
      responseServer: result.responseServer,
      responseWwwAuthenticate: result.responseWwwAuthenticate,
      responseAllowedMethods: result.responseAllowedMethods,
      parsedShape: result.parsedShape,
      arrayLength: result.arrayLength,
      bodyPreview: result.bodyPreview,
    });

    if (result.ok && Array.isArray(result.arrayPayload)) {
      console.warn("[pudo-lockers] successful provider attempt", {
        label: result.label,
        arrayLength: result.arrayPayload.length,
      });

      return {
        lockers: result.arrayPayload,
        diagnostics,
      };
    }
  }

  return {
    lockers: [],
    diagnostics,
  };
}

function pickNumber(...values) {
  for (const value of values) {
    const parsed = Number.parseFloat(String(value ?? ""));

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function distanceKm(originLat, originLng, targetLat, targetLng) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRad(targetLat - originLat);
  const deltaLng = toRad(targetLng - originLng);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRad(originLat)) *
      Math.cos(toRad(targetLat)) *
      Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeLocker(rawLocker, context) {
  const latitude = pickNumber(
    rawLocker?.latitude,
    rawLocker?.lat,
    rawLocker?.location?.lat,
    rawLocker?.coordinates?.lat,
  );

  const longitude = pickNumber(
    rawLocker?.longitude,
    rawLocker?.lng,
    rawLocker?.location?.lng,
    rawLocker?.coordinates?.lng,
  );

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const distance = distanceKm(context.lat, context.lng, latitude, longitude);

  return {
    code: cleanText(rawLocker?.code || rawLocker?.terminal_id || rawLocker?.id, 40),
    name: cleanText(rawLocker?.name || rawLocker?.display_name || "PUDO Locker", 120),
    address: cleanText(rawLocker?.address || rawLocker?.full_address || "", 240),
    town: cleanText(rawLocker?.place?.town || rawLocker?.town || rawLocker?.city || "", 80),
    postalCode: cleanText(rawLocker?.place?.postalCode || rawLocker?.postal_code || "", 20),
    type: cleanText(rawLocker?.type?.name || rawLocker?.type || "Locker", 40),
    latitude,
    longitude,
    distanceKm: Number(distance.toFixed(2)),
  };
}

export async function findNearbyPudoLockers(context) {
  const result = await fetchPudoLockers();

  if (!result.lockers.length) {
    console.warn("[pudo-lockers] failed to fetch lockers", result.diagnostics);

    return {
      provider: "api-pudo",
      lockers: [],
      message:
        "Could not fetch PUDO lockers from the provider. Check Vercel logs for [pudo-lockers] diagnostics.",
    };
  }

  const normalizedLockers = result.lockers
    .map((locker) => normalizeLocker(locker, context))
    .filter(Boolean);

  if (!normalizedLockers.length) {
    console.warn("[pudo-lockers] fetched lockers but none normalized", {
      rawCount: result.lockers.length,
      sample: result.lockers.slice(0, 3),
    });
  }

  const lockers = normalizedLockers
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, context.limit);

  return {
    provider: "api-pudo",
    lockers,
    message: lockers.length
      ? ""
      : "PUDO lockers were fetched, but none had usable latitude/longitude coordinates.",
  };
}

export async function runPudoHealthCheck() {
  const result = await fetchPudoLockers();
  const ok = Array.isArray(result.lockers) && result.lockers.length > 0;

  return {
    provider: "api-pudo",
    ok,
    lockerCount: ok ? result.lockers.length : 0,
    diagnostics: result.diagnostics,
    message: ok
      ? "PUDO provider reachable and locker data returned."
      : "PUDO provider check failed. Review diagnostics for the failing attempt details.",
  };
}
