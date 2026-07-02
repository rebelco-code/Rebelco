import { fetchPudoTracking, parsePudoTrackingQueryParams } from "./_utils/pudoTracking.js";
import { requireMethod, sendError, sendJson } from "./_utils/http.js";

export default async function handler(request, response) {
  try {
    requireMethod(request, response, ["GET"]);
    response.setHeader("Cache-Control", "no-store");

    const identifiers = parsePudoTrackingQueryParams(request);
    const result = await fetchPudoTracking(identifiers);
    const requestUrl = new URL(request.url, `https://${request.headers.host || "localhost"}`);
    const includeDiagnostics = requestUrl.searchParams.get("debug") === "1";

    sendJson(response, 200, {
      provider: result.provider,
      tracking: result.tracking,
      ...(includeDiagnostics ? { diagnostics: result.diagnostics } : {}),
    });
  } catch (error) {
    sendError(response, error);
  }
}
