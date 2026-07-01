import { HttpError } from "../_utils/errors.js";
import {
  getPayfastConfig,
  parsePayfastPayload,
  readUrlEncodedBody,
  validatePayfastNotification,
  verifyPayfastSignature,
  verifyPayfastSourceIp,
} from "../_utils/payfast.js";
import { requireMethod, sendError } from "../_utils/http.js";
import { readOrdersByGroupId, updateOrderGroupPayment } from "../_utils/ordersStore.js";
import { restoreStockForOrderItems } from "../_utils/productsStore.js";

function cleanValue(value) {
  return String(value || "").trim();
}

function parseAmount(value) {
  const amount = Number.parseFloat(String(value || "").replace(",", "."));
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : null;
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

function getRequestedStockRestorationItems(orders) {
  return orders.map((order) => ({
    productId: order.productId,
    quantity: order.quantity,
  }));
}

function shouldReleaseReservedStock(paymentStatus) {
  return paymentStatus === "cancelled" || paymentStatus === "failed";
}

export default async function handler(request, response) {
  try {
    requireMethod(request, response, ["POST"]);

    const payfastConfig = getPayfastConfig();
    const rawBody = await readUrlEncodedBody(request);
    const payload = parsePayfastPayload(rawBody);
    const orderGroupId = cleanValue(payload.m_payment_id || payload.custom_str1);

    if (!orderGroupId) {
      throw new HttpError(400, "PayFast ITN is missing the order group ID.");
    }

    if (!verifyPayfastSignature(payload, payfastConfig.passphrase)) {
      throw new HttpError(400, "PayFast ITN signature verification failed.");
    }

    if (!verifyPayfastSourceIp(request)) {
      throw new HttpError(400, "PayFast ITN source IP is not trusted.");
    }

    const validNotification = await validatePayfastNotification(rawBody, payfastConfig.validateUrl);

    if (!validNotification) {
      throw new HttpError(400, "PayFast ITN payload validation failed.");
    }

    const orders = await readOrdersByGroupId(orderGroupId);
    const expectedAmount = calculateExpectedAmount(orders);
    const receivedAmount = parseAmount(payload.amount_gross || payload.amount);

    if (receivedAmount === null || receivedAmount !== expectedAmount) {
      throw new HttpError(400, "PayFast ITN amount does not match the stored order.");
    }

    const paymentStatus = cleanValue(payload.payment_status).toLowerCase();
    const paymentReference = cleanValue(payload.pf_payment_id || payload.payment_id);
    const proofOfPaymentReceived = paymentStatus === "complete";

    if (shouldReleaseReservedStock(paymentStatus)) {
      const alreadyPaid = orders.some((order) => order.proofOfPaymentReceived);
      const alreadyCancelled = orders.every((order) =>
        ["cancelled", "failed"].includes(String(order.paymentStatus || "").toLowerCase()),
      );

      if (!alreadyPaid && !alreadyCancelled) {
        await restoreStockForOrderItems(getRequestedStockRestorationItems(orders));
      }
    }

    await updateOrderGroupPayment(orderGroupId, {
      paymentMethod: "payfast",
      paymentProvider: "payfast",
      paymentStatus: paymentStatus || "pending",
      paymentReference,
      paymentAmount: expectedAmount,
      proofOfPaymentReceived,
    });

    response.statusCode = 200;
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.end("OK");
  } catch (error) {
    sendError(response, error);
  }
}
