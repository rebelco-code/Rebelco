import { HttpError } from "../_utils/errors.js";
import { requireMethod, sendError, sendJson } from "../_utils/http.js";
import { readOrderGroupSummary } from "../_utils/ordersStore.js";
import {
  reconcilePayfastPaymentForOrderGroup,
  reconcilePendingPayfastOrderGroup,
} from "../_utils/payfastReconciliation.js";

function getOrderGroupId(request) {
  const requestUrl = new URL(request.url, `https://${request.headers.host || "localhost"}`);
  return requestUrl.searchParams.get("orderGroupId") || requestUrl.searchParams.get("group");
}

function getPayfastPaymentId(request) {
  const requestUrl = new URL(request.url, `https://${request.headers.host || "localhost"}`);
  return (
    requestUrl.searchParams.get("pfPaymentId") ||
    requestUrl.searchParams.get("paymentId") ||
    requestUrl.searchParams.get("pf_payment_id")
  );
}

export default async function handler(request, response) {
  try {
    requireMethod(request, response, ["GET"]);
    const orderGroupId = String(getOrderGroupId(request) || "").trim();
    const payfastPaymentId = String(getPayfastPaymentId(request) || "").trim();

    if (!orderGroupId) {
      throw new HttpError(400, "Order group ID is required.");
    }

    let summary = await readOrderGroupSummary(orderGroupId);

    if (
      payfastPaymentId &&
      !["complete", "failed", "cancelled"].includes(String(summary.paymentStatus || "").trim().toLowerCase())
    ) {
      try {
        const reconciliationResult = await reconcilePayfastPaymentForOrderGroup(
          orderGroupId,
          payfastPaymentId,
        );

        if (reconciliationResult?.reconciled) {
          summary = await readOrderGroupSummary(orderGroupId);
        }
      } catch (reconciliationError) {
        console.warn("PayFast status reconciliation skipped.", {
          orderGroupId,
          payfastPaymentId,
          message: reconciliationError?.message || String(reconciliationError),
        });
      }
    }

    if (
      !payfastPaymentId &&
      !["complete", "failed", "cancelled"].includes(String(summary.paymentStatus || "").trim().toLowerCase())
    ) {
      try {
        const reconciliationResult = await reconcilePendingPayfastOrderGroup(orderGroupId, {
          paymentReference: summary.paymentReference,
          createdAt: summary.orders?.[0]?.createdAt,
        });

        if (reconciliationResult?.reconciled) {
          summary = await readOrderGroupSummary(orderGroupId);
        }
      } catch (reconciliationError) {
        console.warn("PayFast history reconciliation skipped.", {
          orderGroupId,
          message: reconciliationError?.message || String(reconciliationError),
        });
      }
    }

    sendJson(response, 200, summary);
  } catch (error) {
    sendError(response, error);
  }
}
