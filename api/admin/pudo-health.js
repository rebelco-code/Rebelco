import { requireAdminSession } from "../_utils/adminAuth.js";
import { requireMethod, sendError, sendJson } from "../_utils/http.js";
import { runPudoHealthCheck } from "../_utils/pudoLockers.js";

export default async function handler(request, response) {
  try {
    requireMethod(request, response, ["GET"]);
    requireAdminSession(request);
    response.setHeader("Cache-Control", "no-store");

    const result = await runPudoHealthCheck();
    sendJson(response, 200, result);
  } catch (error) {
    sendError(response, error);
  }
}
