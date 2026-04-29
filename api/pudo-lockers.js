import { requireMethod, sendError, sendJson } from "./_utils/http.js";
import { findNearbyPudoLockers, parsePudoQueryParams } from "./_utils/pudoLockers.js";

export default async function handler(request, response) {
  try {
    requireMethod(request, response, ["GET"]);
    response.setHeader("Cache-Control", "no-store");

    const context = parsePudoQueryParams(request);
    const result = await findNearbyPudoLockers(context);

    sendJson(response, 200, result);
  } catch (error) {
    sendError(response, error);
  }
}