import { HttpError } from "./errors.js";

const DEFAULT_PUDO_API_BASE_URL = "https://api-sandbox.pudo.co.za";
const REQUEST_TIMEOUT_MS = 5_000;

function cleanText(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

function getPudoApiBaseUrl() {
  const configuredBaseUrl = String(process.env.PUDO_API_BASE_URL || "").trim();
  const baseUrl = configuredBaseUrl || DEFAULT_PUDO_API_BASE_URL;
  return baseUrl.replace(/\/+$/, "");
}

function buildAuthHeaderAttempts() {
  const apiKey = cleanText(process.env.PUDO_API_KEY, 300);
  const bearerToken = cleanText(
    process.env.PUDO_BEARER_TOKEN || process.env.PUDO_API_TOKEN,
    300,
  );

  return [
    ...(bearerToken
      ? [
          {
            label: "bearer-token",
            headers: { Authorization: `Bearer ${bearerToken}` },
          },
        ]
      : []),
    ...(apiKey
      ? [
          {
            label: "api-key",
            headers: { "api-key": apiKey },
          },
          {
            label: "x-api-key",
            headers: { "x-api-key": apiKey },
          },
          {
            label: "x-pudo-key",
            headers: { "x-pudo-key": apiKey },
          },
        ]
      : []),
    {
      label: "no-auth",
      headers: {},
    },
  ];
}

async function fetchJson(url, headers = {}) {
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
    let body = null;

    try {
      body = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      body = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      body,
      rawBody,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeTrackingEvent(event) {
  return {
    id: cleanText(event?.id, 80),
    date: cleanText(event?.date, 80),
    message: cleanText(event?.message, 300),
    status: cleanText(event?.status, 120),
    location: cleanText(event?.location, 160),
    source: cleanText(event?.source, 120),
    parcelId: cleanText(event?.parcel_id, 80),
    trackingReference: cleanText(event?.tracking_reference, 120),
  };
}

function normalizeTrackingPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const trackingEvents = Array.isArray(payload.tracking_events)
    ? payload.tracking_events
        .map(normalizeTrackingEvent)
        .filter((event) => event.status || event.date)
        .sort((left, right) => {
          const leftTimestamp = Date.parse(String(left?.date || ""));
          const rightTimestamp = Date.parse(String(right?.date || ""));
          return (Number.isFinite(rightTimestamp) ? rightTimestamp : 0) - (Number.isFinite(leftTimestamp) ? leftTimestamp : 0);
        })
    : [];
  const customTrackingReference = cleanText(
    payload.custom_tracking_reference || payload.short_tracking_reference || payload.tracking_reference,
    120,
  );
  const trackingNumber = cleanText(
    payload.waybill || payload.short_tracking_reference || customTrackingReference,
    120,
  );
  const parcelReference = cleanText(
    payload.tracking_reference || payload.parcel_tracking_reference || customTrackingReference,
    120,
  );

  return {
    shipmentId: cleanText(payload.shipment_id || payload.id, 120),
    customTrackingReference,
    trackingNumber,
    parcelReference,
    status: cleanText(payload.status, 120),
    shipmentCreatedAt: cleanText(payload.shipment_time_created, 80),
    shipmentUpdatedAt: cleanText(payload.shipment_time_modified, 80),
    collectedDate: cleanText(payload.shipment_collected_date, 80),
    deliveredDate: cleanText(payload.shipment_delivered_date, 80),
    collectionFrom: cleanText(payload.collection_from, 120),
    collectionHub: cleanText(payload.collection_hub, 80),
    deliveryHub: cleanText(payload.delivery_hub, 80),
    serviceLevelCode: cleanText(payload.service_level_code, 80),
    deliveryName: cleanText(payload.delivery_to?.name, 120),
    deliveryEmail: cleanText(payload.delivery_to?.email, 160),
    deliveryMobileNumber: cleanText(payload.delivery_to?.mobile_number, 40),
    latestEvent: trackingEvents[0] || null,
    trackingEvents,
  };
}

function buildPublicTrackingUrl(customTrackingReference) {
  const reference = cleanText(customTrackingReference, 120);

  if (!reference) {
    return "";
  }

  return `https://customer.pudo.co.za/track`;
}

function buildAttemptList(identifiers) {
  const apiBaseUrl = getPudoApiBaseUrl();
  const shipmentId = cleanText(identifiers.shipmentId, 120);
  const trackingNumber = cleanText(identifiers.trackingNumber, 120);
  const parcelReference = cleanText(identifiers.parcelReference, 120);
  const attempts = [];

  if (shipmentId) {
    const url = `${apiBaseUrl}/tracking/shipments?include_parcels=false&id=${encodeURIComponent(shipmentId)}`;

    buildAuthHeaderAttempts().forEach((attempt) => {
      attempts.push({
        label: `shipment-id-${attempt.label}`,
        url,
        headers: attempt.headers,
      });
    });
  }

  if (trackingNumber) {
    attempts.push({
      label: "public-waybill",
      url: `${apiBaseUrl}/tracking/shipments/public?waybill=${encodeURIComponent(trackingNumber)}`,
      headers: {},
    });
  }

  if (parcelReference) {
    attempts.push({
      label: "public-parcel-barcode",
      url: `${apiBaseUrl}/tracking/shipments/public?tracking_reference=${encodeURIComponent(parcelReference)}`,
      headers: {},
    });

    if (/^\d+$/.test(parcelReference)) {
      const url = `${apiBaseUrl}/tracking/shipments?parcel_id=${encodeURIComponent(parcelReference)}`;

      buildAuthHeaderAttempts().forEach((attempt) => {
        attempts.push({
          label: `parcel-id-${attempt.label}`,
          url,
          headers: attempt.headers,
        });
      });
    }
  }

  return attempts;
}

export function parsePudoTrackingQueryParams(request) {
  const requestUrl = new URL(request.url, `https://${request.headers.host || "localhost"}`);

  const shipmentId =
    requestUrl.searchParams.get("shipmentId") || requestUrl.searchParams.get("shipment_id") || "";
  const trackingNumber =
    requestUrl.searchParams.get("trackingNumber") ||
    requestUrl.searchParams.get("tracking_number") ||
    requestUrl.searchParams.get("waybill") ||
    "";
  const parcelReference =
    requestUrl.searchParams.get("parcelReference") ||
    requestUrl.searchParams.get("parcel_reference") ||
    requestUrl.searchParams.get("tracking_reference") ||
    requestUrl.searchParams.get("parcelId") ||
    requestUrl.searchParams.get("parcel_id") ||
    "";

  if (!cleanText(shipmentId) && !cleanText(trackingNumber) && !cleanText(parcelReference)) {
    throw new HttpError(
      400,
      "At least one PUDO tracking identifier is required.",
    );
  }

  return {
    shipmentId,
    trackingNumber,
    parcelReference,
  };
}

export async function fetchPudoTracking(identifiers) {
  const attempts = buildAttemptList(identifiers);
  const diagnostics = [];

  for (const attempt of attempts) {
    const result = await fetchJson(attempt.url, attempt.headers);
    const normalized = normalizeTrackingPayload(result.body);

    diagnostics.push({
      label: attempt.label,
      url: attempt.url,
      status: result.status,
      ok: result.ok,
      bodyPreview: cleanText(result.rawBody, 240),
    });

    if (result.ok && normalized) {
      return {
        provider: "pudo",
        tracking: {
          ...normalized,
          trackingUrl: buildPublicTrackingUrl(normalized.customTrackingReference),
        },
        diagnostics,
      };
    }
  }

  throw new HttpError(
    502,
    "Could not fetch live PUDO tracking information with the saved identifiers.",
  );
}
