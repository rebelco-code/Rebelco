import { HttpError } from "./_utils/errors.js";
import { requireMethod, sendError, sendJson } from "./_utils/http.js";
import { readCustomerOrderHistory, readCustomerOrderSummary } from "./_utils/ordersStore.js";
import { reconcilePendingPayfastOrderGroup } from "./_utils/payfastReconciliation.js";

function getLookupParams(request) {
  const requestUrl = new URL(request.url, `https://${request.headers.host || "localhost"}`);

  return {
    customerOrderId:
      requestUrl.searchParams.get("customerOrderId") ||
      requestUrl.searchParams.get("orderId") ||
      requestUrl.searchParams.get("order"),
    customerEmail:
      requestUrl.searchParams.get("customerEmail") ||
      requestUrl.searchParams.get("email"),
  };
}

export default async function handler(request, response) {
  try {
    requireMethod(request, response, ["GET"]);

    const { customerOrderId, customerEmail } = getLookupParams(request);

    if (!String(customerEmail || "").trim()) {
      throw new HttpError(400, "Customer email is required.");
    }

    if (String(customerOrderId || "").trim()) {
      let summary = await readCustomerOrderSummary(customerOrderId, customerEmail);

      if (!["complete", "failed", "cancelled"].includes(String(summary.paymentStatus || "").trim().toLowerCase())) {
        try {
          const reconciliationResult = await reconcilePendingPayfastOrderGroup(summary.orderGroupId, {
            paymentReference: summary.paymentReference,
            createdAt: summary.orders?.[0]?.createdAt,
          });

          if (reconciliationResult?.reconciled) {
            summary = await readCustomerOrderSummary(customerOrderId, customerEmail);
          }
        } catch (reconciliationError) {
          console.warn("Customer order reconciliation skipped.", {
            customerOrderId,
            orderGroupId: summary.orderGroupId,
            message: reconciliationError?.message || String(reconciliationError),
          });
        }
      }

      sendJson(response, 200, {
        mode: "single",
        ...summary,
      });
      return;
    }

    let history = await readCustomerOrderHistory(customerEmail);
    let reconciledCount = 0;

    for (const summary of history.orders || []) {
      if (["complete", "failed", "cancelled"].includes(String(summary.paymentStatus || "").trim().toLowerCase())) {
        continue;
      }

      try {
        const reconciliationResult = await reconcilePendingPayfastOrderGroup(summary.orderGroupId, {
          paymentReference: summary.paymentReference,
          createdAt: summary.orders?.[0]?.createdAt,
        });

        if (reconciliationResult?.reconciled) {
          reconciledCount += 1;
        }
      } catch (reconciliationError) {
        console.warn("Customer order history reconciliation skipped.", {
          customerEmail,
          orderGroupId: summary.orderGroupId,
          message: reconciliationError?.message || String(reconciliationError),
        });
      }
    }

    if (reconciledCount > 0) {
      history = await readCustomerOrderHistory(customerEmail);
    }

    sendJson(response, 200, {
      mode: "history",
      ...history,
    });
  } catch (error) {
    sendError(response, error);
  }
}
