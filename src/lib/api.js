export async function readJsonResponse(response, fallbackMessage = "Request failed.") {
  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.error ||
      data?.message ||
      data?.details ||
      data?.detail ||
      (typeof data === "string" ? data : "") ||
      fallbackMessage;

    throw new Error(message);
  }

  return data || {};
}