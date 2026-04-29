import { requireAdminSession } from "../_utils/adminAuth.js";
import { HttpError } from "../_utils/errors.js";
import { requireMethod, sendError, sendJson } from "../_utils/http.js";

const MAX_SEARCH_LENGTH = 120;
const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 12;
const REQUEST_TIMEOUT_MS = 12_000;

function getPudoApiKey() {
  const apiKey = String(process.env.PUDO_API_KEY || "").trim();

  if (!apiKey) {
    throw new HttpError(500, "PUDO API key is not configured.");
  }

  return apiKey;
}

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

function parseQueryParams(request) {
  const requestUrl = new URL(request.url, `https://${request.headers.host || "localhost"}`);
  const search = cleanText(requestUrl.searchParams.get("search"), MAX_SEARCH_LENGTH);
  const lat = parseNumber(requestUrl.searchParams.get("lat"), -90, 90, "latitude");
  const lng = parseNumber(requestUrl.searchParams.get("lng"), -180, 180, "longitude");
  const limit = parseLimit(requestUrl.searchParams.get("limit"));

  if ((lat === null) !== (lng === null)) {
    throw new HttpError(400, "Latitude and longitude must both be provided.");
  }

  return {
    search,
    lat,
    lng,
    limit,
  };
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

async function fetchJsonOrThrow(url, options) {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: abortController.signal,
    });
    const rawBody = await response.text();
    const parsedBody = parseJsonSafe(rawBody);

    if (!response.ok) {
      const remoteMessage =
        cleanText(
          parsedBody?.message || parsedBody?.error || parsedBody?.errors?.[0]?.message,
          200,
        ) || `HTTP ${response.status}`;
      throw new Error(remoteMessage);
    }

    if (parsedBody !== null) {
      return parsedBody;
    }

    throw new Error("Expected JSON response.");
  } finally {
    clearTimeout(timeoutId);
  }
}

function readArrayResponse(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.pickup_points)) {
    return payload.pickup_points;
  }

  if (Array.isArray(payload?.pickupPoints)) {
    return payload.pickupPoints;
  }

  if (Array.isArray(payload?.results)) {
    return payload.results;
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

function joinAddressParts(...values) {
  return values.map((value) => cleanText(value, 80)).filter(Boolean).join(", ");
}

function resolveAddress(rawLocker) {
  const plainAddress = cleanText(
    rawLocker?.address || rawLocker?.full_address || rawLocker?.formatted_address,
    240,
  );

  if (plainAddress) {
    return plainAddress;
  }

  if (rawLocker?.address && typeof rawLocker.address === "object") {
    const addressText = joinAddressParts(
      rawLocker.address.street_address,
      rawLocker.address.local_area,
      rawLocker.address.suburb,
      rawLocker.address.city,
      rawLocker.address.postal_code,
    );

    if (addressText) {
      return addressText;
    }
  }

  return joinAddressParts(
    rawLocker?.street_address,
    rawLocker?.local_area,
    rawLocker?.suburb,
    rawLocker?.city,
    rawLocker?.code,
  );
}

function distanceKm(originLat, originLng, targetLat, targetLng) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRad(targetLat - originLat);
  const deltaLng = toRad(targetLng - originLng);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRad(originLat)) *
      Math.cos(toRad(targetLat)) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

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

  const code = cleanText(
    rawLocker?.code || rawLocker?.terminal_id || rawLocker?.pickup_point_id || rawLocker?.id,
    40,
  );
  const name = cleanText(rawLocker?.name || rawLocker?.display_name || rawLocker?.title, 120);
  const address = resolveAddress(rawLocker);
  const town = cleanText(
    rawLocker?.place?.town || rawLocker?.city || rawLocker?.town || rawLocker?.local_area,
    80,
  );
  const postalCode = cleanText(rawLocker?.place?.postalCode || rawLocker?.postal_code, 20);
  const type = cleanText(rawLocker?.type?.name || rawLocker?.type || rawLocker?.pickup_point_type);

  let distance = null;

  if (Number.isFinite(context.lat) && Number.isFinite(context.lng)) {
    distance = distanceKm(context.lat, context.lng, latitude, longitude);
  }

  return {
    code,
    name: name || code || "Locker",
    address,
    town,
    postalCode,
    type,
    latitude,
    longitude,
    distanceKm: Number.isFinite(distance) ? Number(distance.toFixed(2)) : null,
  };
}

function buildShiplogicUrl(context) {
  const url = new URL("https://api.shiplogic.com/pickup-points");

  if (context.search) {
    url.searchParams.set("search", context.search);
  }

  if (Number.isFinite(context.lat) && Number.isFinite(context.lng)) {
    url.searchParams.set("lat", String(context.lat));
    url.searchParams.set("lng", String(context.lng));
    url.searchParams.set("order_closest", "true");
  }

  url.searchParams.set("types", "locker");

  return url.toString();
}

function buildPudoUrl(context, host) {
  const url = new URL("/lockers-data", host);

  if (context.search) {
    url.searchParams.set("search", context.search);
  }

  if (Number.isFinite(context.lat) && Number.isFinite(context.lng)) {
    url.searchParams.set("lat", String(context.lat));
    url.searchParams.set("lng", String(context.lng));
    url.searchParams.set("order_closest", "true");
  }

  return url.toString();
}

async function queryPudoLockers(context, apiKey) {
  const attempts = [
    {
      provider: "api-pudo",
      url: buildPudoUrl(context, "https://api-pudo.co.za"),
      headers: {},
      authMode: "query",
    },
    {
      provider: "api-pudo-www",
      url: buildPudoUrl(context, "https://www.api-pudo.co.za"),
      headers: {},
      authMode: "query",
    },
    {
      provider: "shiplogic",
      url: buildShiplogicUrl(context),
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      authMode: "header",
    },
  ];
  const errors = [];

  for (const attempt of attempts) {
    try {
      const requestUrl = new URL(attempt.url);

      if (attempt.authMode === "query") {
        requestUrl.searchParams.set("api_key", apiKey);
      }

      const payload = await fetchJsonOrThrow(requestUrl.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...attempt.headers,
        },
      });
      const lockers = readArrayResponse(payload)
        .map((locker) => normalizeLocker(locker, context))
        .filter(Boolean);

      if (lockers.length > 0) {
        lockers.sort((a, b) => {
          if (a.distanceKm === null && b.distanceKm === null) {
            return a.name.localeCompare(b.name);
          }

          if (a.distanceKm === null) {
            return 1;
          }

          if (b.distanceKm === null) {
            return -1;
          }

          return a.distanceKm - b.distanceKm;
        });

        return {
          provider: attempt.provider,
          lockers: lockers.slice(0, context.limit),
        };
      }

      errors.push(`${attempt.provider}: no locker data returned`);
    } catch (error) {
      errors.push(`${attempt.provider}: ${cleanText(error?.message || "request failed", 180)}`);
    }
  }

  throw new HttpError(
    502,
    `Could not load PUDO lockers right now. ${errors.join(" | ") || "Please try again."}`,
  );
}

export default async function handler(request, response) {
  try {
    requireMethod(request, response, ["GET"]);
    requireAdminSession(request);
    response.setHeader("Cache-Control", "no-store");

    const apiKey = getPudoApiKey();
    const context = parseQueryParams(request);
    const result = await queryPudoLockers(context, apiKey);

    sendJson(response, 200, {
      provider: result.provider,
      lockers: result.lockers,
    });
  } catch (error) {
    sendError(response, error);
  }
}

