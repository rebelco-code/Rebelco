import { HttpError } from "./errors.js";

const DEFAULT_PUDO_API_BASE_URL = "https://api-sandbox.pudo.co.za";
const DEFAULT_SERVICE_LEVEL_CODE = "D2LXS - ECO";
const REQUEST_TIMEOUT_MS = 8_000;

function cleanText(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

function getPudoApiBaseUrl() {
  const configuredBaseUrl = cleanText(process.env.PUDO_API_BASE_URL, 300);
  const baseUrl = configuredBaseUrl || DEFAULT_PUDO_API_BASE_URL;
  return baseUrl.replace(/\/+$/, "");
}

function getCollectionAddress() {
  const rawJson = cleanText(process.env.PUDO_COLLECTION_ADDRESS_JSON, 4_000);

  if (!rawJson) {
    throw new HttpError(
      500,
      "PUDO collection address is not configured. Set PUDO_COLLECTION_ADDRESS_JSON.",
    );
  }

  let parsedAddress = null;

  try {
    parsedAddress = JSON.parse(rawJson);
  } catch {
    throw new HttpError(500, "PUDO_COLLECTION_ADDRESS_JSON is not valid JSON.");
  }

  if (!parsedAddress || typeof parsedAddress !== "object" || Array.isArray(parsedAddress)) {
    throw new HttpError(500, "PUDO_COLLECTION_ADDRESS_JSON must describe an address object.");
  }

  return parsedAddress;
}

function getCollectionContact() {
  const name = cleanText(process.env.PUDO_COLLECTION_CONTACT_NAME, 120);
  const email = cleanText(process.env.PUDO_COLLECTION_CONTACT_EMAIL, 160).toLowerCase();
  const mobileNumber = cleanText(process.env.PUDO_COLLECTION_CONTACT_MOBILE, 40);

  if (!name || !email || !mobileNumber) {
    throw new HttpError(
      500,
      "PUDO collection contact is incomplete. Set PUDO_COLLECTION_CONTACT_NAME, PUDO_COLLECTION_CONTACT_EMAIL, and PUDO_COLLECTION_CONTACT_MOBILE.",
    );
  }

  return {
    name,
    email,
    mobile_number: mobileNumber,
  };
}

function getServiceLevelCode() {
  return cleanText(process.env.PUDO_SERVICE_LEVEL_CODE, 80) || DEFAULT_SERVICE_LEVEL_CODE;
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

function buildTrackingUrl(customTrackingReference) {
  return cleanText(customTrackingReference, 120) ? "https://customer.pudo.co.za/track" : "";
}

function buildLabelUrl(shipmentId) {
  const apiBaseUrl = getPudoApiBaseUrl();
  const apiKey = cleanText(process.env.PUDO_API_KEY, 300);

  if (!shipmentId || !apiKey) {
    return "";
  }

  return `${apiBaseUrl}/generate/sticker/${encodeURIComponent(shipmentId)}?api_key=${encodeURIComponent(apiKey)}`;
}

function normalizeShipmentResponse(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(502, "PUDO shipment creation returned an invalid response.");
  }

  const shipmentId = cleanText(payload.id || payload.shipment_id, 120);
  const customTrackingReference = cleanText(
    payload.custom_tracking_reference || payload.short_tracking_reference || payload.tracking_reference,
    120,
  );
  const trackingNumber = cleanText(payload.waybill || customTrackingReference, 120);
  const parcelReference = cleanText(payload.tracking_reference || customTrackingReference, 120);

  if (!shipmentId) {
    throw new HttpError(502, "PUDO shipment creation did not return a shipment ID.");
  }

  return {
    shipmentId,
    status: cleanText(payload.status, 120),
    trackingNumber,
    parcelReference,
    trackingUrl: buildTrackingUrl(customTrackingReference || trackingNumber),
    labelUrl: buildLabelUrl(shipmentId),
  };
}

async function createShipmentAttempt(url, headers, payload) {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(payload),
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

function buildShipmentPayload(orders) {
  const firstOrder = orders[0] || {};
  const firstName = cleanText(firstOrder.customerFirstName, 80);
  const lastName = cleanText(firstOrder.customerLastName, 80);
  const deliveryName = cleanText(`${firstName} ${lastName}`.trim(), 120);
  const deliveryEmail = cleanText(firstOrder.customerEmail, 160).toLowerCase();
  const deliveryMobileNumber = cleanText(firstOrder.customerMobileNumber, 40);
  const terminalId = cleanText(firstOrder.pudoLockerCode, 40);

  if (!deliveryName || !deliveryEmail || !deliveryMobileNumber) {
    throw new HttpError(400, "Order is missing customer contact details required for PUDO shipment creation.");
  }

  if (!terminalId) {
    throw new HttpError(400, "Order is missing a selected PUDO locker code.");
  }

  const now = new Date().toISOString();

  return {
    collection_address: getCollectionAddress(),
    collection_contact: getCollectionContact(),
    delivery_address: {
      terminal_id: terminalId,
    },
    delivery_contact: {
      name: deliveryName,
      email: deliveryEmail,
      mobile_number: deliveryMobileNumber,
    },
    opt_in_time_based_rates: [],
    opt_in_rates: [],
    service_level_code: getServiceLevelCode(),
    collection_min_date: now,
    delivery_min_date: now,
  };
}

export async function createPudoShipmentForOrders(orders) {
  if (!Array.isArray(orders) || orders.length === 0) {
    throw new HttpError(400, "Orders are required before creating a PUDO shipment.");
  }

  const url = `${getPudoApiBaseUrl()}/shipments`;
  const payload = buildShipmentPayload(orders);
  const diagnostics = [];

  for (const attempt of buildAuthHeaderAttempts()) {
    const result = await createShipmentAttempt(url, attempt.headers, payload);

    diagnostics.push({
      label: attempt.label,
      status: result.status,
      ok: result.ok,
      bodyPreview: cleanText(result.rawBody, 240),
    });

    if (!result.ok) {
      continue;
    }

    return {
      provider: "pudo",
      shipment: normalizeShipmentResponse(result.body),
      diagnostics,
    };
  }

  throw new HttpError(
    502,
    `Could not create a PUDO shipment. ${diagnostics.map((entry) => `${entry.label}:${entry.status}`).join(", ")}`,
  );
}
