import { readProducts } from "./_utils/productsStore.js";
import { requireMethod, sendError, sendJson } from "./_utils/http.js";

export default async function handler(request, response) {
  try {
    requireMethod(request, response, ["GET"]);

    const products = await readProducts();

    sendJson(
      response,
      200,
      { products },
      {
        "Cache-Control": "no-store",
      },
    );
  } catch (error) {
    sendError(response, error);
  }
}
