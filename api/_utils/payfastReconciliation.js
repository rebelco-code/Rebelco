import crypto from "node:crypto";

import { HttpError } from "./errors.js";
import { createPudoShipmentForOrders } from "./pudoShipments.js";
import { getPayfastConfig } from "./payfast.js";
import {
  readOrdersByGroupId,
  updateOrderGroupPayment,
  updateOrderGroupTracking,
} from "./ordersStore.js";

const PAYFAST_API_BASE_URL = "https://api.payfast.co.za";
const PAYFAST_API_VERSION = "v1";
const MS_PER_DAY = 24 * 60 * 60 * 1_000;

function cleanValue(value) {
  return String(value || "").trim();
}

function logReconciliation(event, details = {}) {
  console.info(`[PayFast Reconciliation] ${event}`, details);
}

function encodeApiValue(value) {
  return encodeURIComponent(String(value ?? "")).replace(/%20/g, "+");
}

function buildApiSignature(fields, passphrase = "") {
  const pairs = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && String(value) !== "")
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${encodeApiValue(value)}`);

  if (passphrase) {
    pairs.push(`passphrase=${encodeApiValue(passphrase)}`);
  }

  return crypto.createHash("md5").update(pairs.join("&")).digest("hex");
}

function buildApiHeaders(payfastConfig, extraFields = {}) {
  const timestamp = new Date().toISOString();
  const signature = buildApiSignature(
    {
      "merchant-id": payfastConfig.merchantId,
      timestamp,
      version: PAYFAST_API_VERSION,
      ...extraFields,
    },
    payfastConfig.passphrase,
  );

  return {
    Accept: "application/json",
    "merchant-id": payfastConfig.merchantId,
    timestamp,
    version: PAYFAST_API_VERSION,
    signature,
  };
}

function formatDateOnly(value) {
  const timestamp = Date.parse(String(value || "").trim());

  if (!Number.isFinite(timestamp)) {
    return "";
  }

  return new Date(timestamp).toISOString().slice(0, 10);
}

function shiftDateOnly(dateText, dayDelta) {
  const timestamp = Date.parse(`${String(dateText || "").trim()}T00:00:00.000Z`);

  if (!Number.isFinite(timestamp)) {
    return "";
  }

  return new Date(timestamp + dayDelta * MS_PER_DAY).toISOString().slice(0, 10);
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsvTable(rawCsv) {
  const lines = String(rawCsv || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) => cleanValue(header).toLowerCase());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = cleanValue(values[index]);
    });

    return row;
  });
}

async function queryPayfastTransactionHistoryRange(fromDate, toDate) {
  const payfastConfig = getPayfastConfig();
  const url = new URL(`${PAYFAST_API_BASE_URL}/transactions/history`);
  url.searchParams.set("from", fromDate);
  url.searchParams.set("to", toDate);
  url.searchParams.set("limit", "200");

  const response = await fetch(url, {
    method: "GET",
    headers: buildApiHeaders(payfastConfig, {
      from: fromDate,
      limit: "200",
      to: toDate,
    }),
  });

  const rawBody = await response.text();

  logReconciliation("transaction-history-response", {
    fromDate,
    toDate,
    status: response.status,
    ok: response.ok,
    bodyPreview: cleanValue(rawBody).slice(0, 180),
  });

  if (!response.ok) {
    throw new HttpError(
      502,
      `PayFast transaction history lookup failed with status ${response.status}.`,
    );
  }

  return rawBody;
}

async function findPayfastPaymentIdForOrderGroup(orderGroupId, createdAt) {
  const createdDate = formatDateOnly(createdAt);

  logReconciliation("find-payment-id-start", {
    orderGroupId,
    createdAt,
    createdDate,
  });

  if (!createdDate) {
    logReconciliation("find-payment-id-no-created-date", {
      orderGroupId,
      createdAt,
    });
    return "";
  }

  const ranges = [
    {
      from: shiftDateOnly(createdDate, -1),
      to: shiftDateOnly(createdDate, 1),
    },
    {
      from: shiftDateOnly(createdDate, -7),
      to: shiftDateOnly(createdDate, 7),
    },
  ];

  for (const range of ranges) {
    if (!range.from || !range.to) {
      logReconciliation("find-payment-id-skip-range", {
        orderGroupId,
        range,
      });
      continue;
    }

    const csvResponse = await queryPayfastTransactionHistoryRange(range.from, range.to);
    const rows = parseCsvTable(csvResponse);
    const rowPreview = rows.slice(0, 5).map((row) => ({
      merchantPaymentId: cleanValue(row["m payment id"]),
      pfPaymentId: cleanValue(row["pf payment id"]),
      customStr1: cleanValue(row["custom str1"]),
      name: cleanValue(row.name),
      date: cleanValue(row.date),
    }));

    logReconciliation("find-payment-id-range-results", {
      orderGroupId,
      range,
      rowCount: rows.length,
      rowPreview,
    });

    const matchingRow = rows.find((row) => {
      const merchantPaymentId = cleanValue(row["m payment id"]);
      const customStr1 = cleanValue(row["custom str1"]);
      return merchantPaymentId === orderGroupId || customStr1 === orderGroupId;
    });

    if (matchingRow) {
      logReconciliation("find-payment-id-match", {
        orderGroupId,
        range,
        merchantPaymentId: cleanValue(matchingRow["m payment id"]),
        pfPaymentId: cleanValue(matchingRow["pf payment id"]),
        customStr1: cleanValue(matchingRow["custom str1"]),
      });
      return cleanValue(matchingRow["pf payment id"]);
    }
  }

  logReconciliation("find-payment-id-no-match", {
    orderGroupId,
    createdDate,
  });
  return "";
}

function parseAmountCandidates(value) {
  const normalizedValue = String(value ?? "").trim();
  const amount = Number(normalizedValue);

  if (!Number.isFinite(amount)) {
    return [];
  }

  const candidates = [Math.round(amount * 100) / 100];

  if (/^\d+$/.test(normalizedValue)) {
    candidates.push(Math.round(amount) / 100);
  }

  return Array.from(new Set(candidates));
}

function calculateExpectedAmount(orders) {
  return Math.round(
    orders.reduce((sum, order) => {
      const quantity = Number.parseInt(String(order?.quantity || "0"), 10);
      const unitPrice = Number(order?.productPrice || 0);

      if (!Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(unitPrice)) {
        return sum;
      }

      return sum + quantity * unitPrice;
    }, 0) * 100,
  ) / 100;
}

export async function createPudoShipmentAfterPayment(orderGroupId) {
  const currentOrders = await readOrdersByGroupId(orderGroupId);

  logReconciliation("shipment-check", {
    orderGroupId,
    orderCount: currentOrders.length,
  });

  if (currentOrders.length === 0) {
    return;
  }

  const hasExistingShipment = currentOrders.some(
    (order) =>
      String(order.pudoShipmentId || "").trim() ||
      String(order.pudoTrackingNumber || "").trim() ||
      String(order.pudoParcelReference || "").trim(),
  );

  if (hasExistingShipment) {
    logReconciliation("shipment-skip-existing", {
      orderGroupId,
    });
    return;
  }

  const shipmentResult = await createPudoShipmentForOrders(currentOrders);

  logReconciliation("shipment-created", {
    orderGroupId,
    shipmentId: shipmentResult.shipment.shipmentId,
    trackingNumber: shipmentResult.shipment.trackingNumber,
  });

  await updateOrderGroupTracking(orderGroupId, {
    pudoShipmentId: shipmentResult.shipment.shipmentId,
    pudoParcelReference: shipmentResult.shipment.parcelReference,
    pudoTrackingNumber: shipmentResult.shipment.trackingNumber,
    pudoTrackingUrl: shipmentResult.shipment.trackingUrl,
    pudoLabelUrl: shipmentResult.shipment.labelUrl,
    pudoShipmentStatus: shipmentResult.shipment.status,
  });
}

export async function queryPayfastPayment(paymentId) {
  const normalizedPaymentId = cleanValue(paymentId);

  if (!normalizedPaymentId) {
    throw new HttpError(400, "PayFast payment ID is required.");
  }

  const payfastConfig = getPayfastConfig();
  logReconciliation("payment-query-start", {
    paymentId: normalizedPaymentId,
    sandbox: payfastConfig.sandbox,
  });
  const response = await fetch(
    `${PAYFAST_API_BASE_URL}/process/query/${encodeURIComponent(normalizedPaymentId)}`,
    {
      method: "GET",
      headers: buildApiHeaders(payfastConfig),
    },
  );

  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  logReconciliation("payment-query-response", {
    paymentId: normalizedPaymentId,
    status: response.status,
    ok: response.ok,
    payload,
  });

  if (!response.ok) {
    throw new HttpError(
      502,
      payload?.data?.message ||
        payload?.status ||
        `PayFast payment lookup failed with status ${response.status}.`,
    );
  }

  return payload;
}

export async function reconcilePayfastPaymentForOrderGroup(orderGroupId, paymentId) {
  const normalizedOrderGroupId = cleanValue(orderGroupId);
  const normalizedPaymentId = cleanValue(paymentId);

  if (!normalizedOrderGroupId || !normalizedPaymentId) {
    return null;
  }

  const orders = await readOrdersByGroupId(normalizedOrderGroupId);

  if (orders.length === 0) {
    throw new HttpError(404, "Order group was not found.");
  }

  const payfastResponse = await queryPayfastPayment(normalizedPaymentId);
  const paymentResponse = payfastResponse?.data?.response || {};
  const payfastOrderGroupId = cleanValue(paymentResponse.m_payment_id);
  const paymentStatus = cleanValue(paymentResponse.status).toLowerCase();
  const expectedAmount = calculateExpectedAmount(orders);
  const receivedAmounts = parseAmountCandidates(paymentResponse.amount);

  logReconciliation("payment-verify", {
    orderGroupId: normalizedOrderGroupId,
    paymentId: normalizedPaymentId,
    payfastOrderGroupId,
    paymentStatus,
    expectedAmount,
    receivedAmounts,
    orderCount: orders.length,
  });

  if (payfastOrderGroupId && payfastOrderGroupId !== normalizedOrderGroupId) {
    throw new HttpError(409, "PayFast payment does not belong to this order group.");
  }

  if (receivedAmounts.length === 0 || !receivedAmounts.includes(expectedAmount)) {
    throw new HttpError(409, "PayFast payment amount does not match the stored order.");
  }

  if (paymentStatus !== "complete") {
    logReconciliation("payment-not-complete", {
      orderGroupId: normalizedOrderGroupId,
      paymentId: normalizedPaymentId,
      paymentStatus,
    });
    return {
      reconciled: false,
      paymentStatus,
      paymentReference: normalizedPaymentId,
    };
  }

  await updateOrderGroupPayment(normalizedOrderGroupId, {
    paymentMethod: "payfast",
    paymentProvider: "payfast",
    paymentStatus,
    paymentReference: normalizedPaymentId,
    paymentAmount: expectedAmount,
    proofOfPaymentReceived: true,
  });

  try {
    await createPudoShipmentAfterPayment(normalizedOrderGroupId);
  } catch (shipmentError) {
    console.error("PUDO shipment creation failed after PayFast API reconciliation.", {
      orderGroupId: normalizedOrderGroupId,
      paymentId: normalizedPaymentId,
      message: shipmentError?.message || String(shipmentError),
      stack: shipmentError?.stack || "",
    });
  }

  logReconciliation("payment-reconciled", {
    orderGroupId: normalizedOrderGroupId,
    paymentId: normalizedPaymentId,
    paymentStatus,
  });

  return {
    reconciled: true,
    paymentStatus,
    paymentReference: normalizedPaymentId,
  };
}

export async function reconcilePendingPayfastOrderGroup(orderGroupId, options = {}) {
  const normalizedOrderGroupId = cleanValue(orderGroupId);

  if (!normalizedOrderGroupId) {
    return null;
  }

  const paymentReference = cleanValue(options.paymentReference);
  const createdAt = cleanValue(options.createdAt);
  const paymentId =
    paymentReference || (await findPayfastPaymentIdForOrderGroup(normalizedOrderGroupId, createdAt));

  logReconciliation("pending-order-payment-id-result", {
    orderGroupId: normalizedOrderGroupId,
    paymentReference,
    createdAt,
    resolvedPaymentId: paymentId,
  });

  if (!paymentId) {
    return null;
  }

  return reconcilePayfastPaymentForOrderGroup(normalizedOrderGroupId, paymentId);
}
