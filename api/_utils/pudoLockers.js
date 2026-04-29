import { HttpError } from "./errors.js";

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 12;
const REQUEST_TIMEOUT_MS = 12_000;

function cleanText(value, maxLength = 200) {
  return String(value || "").trim().slice(0, maxLength);
}

function parseNumber(value, min, max, fieldName) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

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
  if (value === null || value === undefined || value === "") {
    return DEFAULT_LIMIT;
  }

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
  if (!rawValue) {
    return null;
  }

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

async function fetchJsonAttempt(url, headers = {}) {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...headers,
      },
      signal: abortController.signal,
    });

    const rawBody = await response.text();
    const parsedBody = parseJsonSafe(rawBody);
    const arrayPayload = extractArrayFromPayload(parsedBody);

    return {
      ok: response.ok,
      status: response.status,
      url,
      parsedBody,
      arrayPayload,
      bodyPreview: cleanText(rawBody, 220),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url,
      parsedBody: null,
      arrayPayload: null,
      bodyPreview: cleanText(error?.message || "Network request failed.", 220),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchPudoLockers() {
  const apiKey = String(process.env.PUDO_API_KEY || "").trim();

  const attempts = [
    {
      label: "www-api-lockers-data-no-auth",
      url: "https://www.api-pudo.co.za/api/lockers-data",
      headers: {},
    },
    {
      label: "root-api-lockers-data-no-auth",
      url: "https://api-pudo.co.za/api/lockers-data",
      headers: {},
    },
    {
      label: "www-v1-lockers-data-no-auth",
      url: "https://www.api-pudo.co.za/api/v1/lockers-data",
      headers: {},
    },
    {
      label: "root-v1-lockers-data-no-auth",
      url: "https://api-pudo.co.za/api/v1/lockers-data",
      headers: {},
    },
    {
      label: "www-api-lockers-data-api-key",
      url: "https://www.api-pudo.co.za/api/lockers-data",
      headers: apiKey ? { "api-key": apiKey } : {},
    },
    {
      label: "root-api-lockers-data-api-key",
      url: "https://api-pudo.co.za/api/lockers-data",
      headers: apiKey ? { "api-key": apiKey } : {},
    },
    {
      label: "www-api-lockers-data-x-api-key",
      url: "https://www.api-pudo.co.za/api/lockers-data",
      headers: apiKey ? { "x-api-key": apiKey } : {},
    },
    {
      label: "www-api-lockers-data-bearer",
      url: "https://www.api-pudo.co.za/api/lockers-data",
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    },
    {
      label: "www-api-lockers-data-query-api-key",
      url: apiKey
        ? `https://www.api-pudo.co.za/api/lockers-data?api_key=${encodeURIComponent(apiKey)}`
        : "https://www.api-pudo.co.za/api/lockers-data",
      headers: {},
    },
  ];

  const diagnostics = [];

  for (const attempt of attempts) {
    const result = await fetchJsonAttempt(attempt.url, attempt.headers);

    if (result.ok && Array.isArray(result.arrayPayload)) {
      return {
        lockers: result.arrayPayload,
        diagnostics,
      };
    }

    diagnostics.push(
      `${attempt.label}: HTTP ${result.status}; body: ${result.bodyPreview || "empty"}`,
    );
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

  const lockers = result.lockers
    .map((locker) => normalizeLocker(locker, context))
    .filter(Boolean)
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