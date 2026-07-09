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

function cleanValue(value) {
  return String(value || "").trim();
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
    return;
  }

  const shipmentResult = await createPudoShipmentForOrders(currentOrders);

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

  if (payfastOrderGroupId && payfastOrderGroupId !== normalizedOrderGroupId) {
    throw new HttpError(409, "PayFast payment does not belong to this order group.");
  }

  if (receivedAmounts.length === 0 || !receivedAmounts.includes(expectedAmount)) {
    throw new HttpError(409, "PayFast payment amount does not match the stored order.");
  }

  if (paymentStatus !== "complete") {
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

  return {
    reconciled: true,
    paymentStatus,
    paymentReference: normalizedPaymentId,
  };
}
