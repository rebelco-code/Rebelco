import {
  clearAdminSessionCookie,
  createAdminSessionCookie,
  readAdminSession,
  verifyAdminLogin,
} from "../_utils/adminAuth.js";
import { requireMethod, readJsonBody, sendError, sendJson } from "../_utils/http.js";

export default async function handler(request, response) {
  try {
    requireMethod(request, response, ["GET", "POST", "DELETE"]);

    if (request.method === "GET") {
      const admin = readAdminSession(request);

      if (!admin) {
        sendJson(response, 401, { admin: null });
        return;
      }

      sendJson(response, 200, { admin });
      return;
    }

    if (request.method === "DELETE") {
      response.setHeader("Set-Cookie", clearAdminSessionCookie());
      sendJson(response, 200, { ok: true });
      return;
    }

    const body = await readJsonBody(request);
    const admin = verifyAdminLogin(body.email, body.password);

    response.setHeader("Set-Cookie", createAdminSessionCookie(admin));
    sendJson(response, 200, { admin });
  } catch (error) {
    sendError(response, error);
  }
}