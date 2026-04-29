import { HttpError } from "./_utils/errors.js";
import { requireMethod, sendError, sendJson } from "./_utils/http.js";

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 12;
const REQUEST_TIMEOUT_MS = 12_000;

function cleanText(value, maxLength = 200) {
  return String(value || "").trim().slice(0, maxLength);
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

function parseQueryParams(request) {
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
  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

async function fetchPudoLockers() {
  const urls = [
    "https://api-pudo.co.za/lockers-data",
    "https://www.api-pudo.co.za/lockers-data",
  ];

  const apiKey = String(process.env.PUDO_API_KEY || "").trim();

  for (const url of urls) {
    const attempts = [
      {
        url,
        headers: { Accept: "application/json" },
      },
      {
        url,
        headers: apiKey
          ? { Accept: "application/json", "api-key": apiKey }
          : { Accept: "application/json" },
      },
      {
        url: apiKey ? `${url}?api_key=${encodeURIComponent(apiKey)}` : url,
        headers: { Accept: "application/json" },
      },
    ];

    for (const attempt of attempts) {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(attempt.url, {
          method: "GET",
          headers: attempt.headers,
          signal: abortController.signal,
        });

        const rawBody = await response.text();
        const parsedBody = parseJsonSafe(rawBody);

        if (response.ok && Array.isArray(parsedBody)) {
          return parsedBody;
        }

        if (response.ok && Array.isArray(parsedBody?.data)) {
          return parsedBody.data;
        }
      } catch {
        // Try the next URL/auth mode.
      } finally {
        clearTimeout(timeoutId);
      }
    }
  }

  return [];
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
  const latitude = pickNumber(rawLocker?.latitude, rawLocker?.lat);
  const longitude = pickNumber(rawLocker?.longitude, rawLocker?.lng);

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

export default async function handler(request, response) {
  try {
    requireMethod(request, response, ["GET"]);
    response.setHeader("Cache-Control", "no-store");

    const context = parseQueryParams(request);
    const rawLockers = await fetchPudoLockers();

    const lockers = rawLockers
      .map((locker) => normalizeLocker(locker, context))
      .filter(Boolean)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, context.limit);

    sendJson(response, 200, {
      provider: "api-pudo",
      lockers,
      message: lockers.length ? "" : "No nearby PUDO lockers found.",
    });
  } catch (error) {
    sendError(response, error);
  }
}