import crypto from "node:crypto";
import net from "node:net";

import { HttpError } from "./errors.js";

const DEFAULT_PROCESS_URL = "https://www.payfast.co.za/eng/process";
const DEFAULT_VALIDATE_URL = "https://www.payfast.co.za/eng/query/validate";
const DEFAULT_SANDBOX_PROCESS_URL = "https://sandbox.payfast.co.za/eng/process";
const DEFAULT_SANDBOX_VALIDATE_URL = "https://sandbox.payfast.co.za/eng/query/validate";
const DEFAULT_RETURN_URL = "https://rebelco.vercel.app/payment/success";
const DEFAULT_CANCEL_URL = "https://rebelco.vercel.app/payment/cancel";
const DEFAULT_NOTIFY_URL = "https://rebelco.vercel.app/api/payfast/notify";
const DEFAULT_SOURCE_IP_CIDRS = [
  "197.97.145.144/28",
  "41.74.179.192/27",
  "102.216.36.0/28",
  "102.216.36.128/28",
  "144.126.193.139/32",
];

function parseBooleanEnv(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function cleanValue(value) {
  return String(value ?? "").trim();
}

function encodeFormComponent(value) {
  return encodeURIComponent(String(value ?? "")).replace(/%20/g, "+");
}

function buildSignatureString(fields, passphrase = "") {
  const pairs = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && String(value) !== "")
    .filter(([key]) => key !== "signature")
    .map(([key, value]) => `${key}=${encodeFormComponent(value)}`);

  if (passphrase) {
    pairs.push(`passphrase=${encodeFormComponent(passphrase)}`);
  }

  return pairs.join("&");
}

function ipToNumber(ipAddress) {
  const parts = ipAddress.split(".").map((part) => Number.parseInt(part, 10));

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }

  return (
    parts[0] * 256 ** 3 +
    parts[1] * 256 ** 2 +
    parts[2] * 256 +
    parts[3]
  );
}

function isIpv4InCidr(ipAddress, cidr) {
  const [rangeAddress, prefixLengthText] = String(cidr || "").split("/");
  const prefixLength = Number.parseInt(prefixLengthText || "32", 10);
  const ipNumber = ipToNumber(ipAddress);
  const rangeNumber = ipToNumber(rangeAddress);

  if (
    ipNumber === null ||
    rangeNumber === null ||
    !Number.isInteger(prefixLength) ||
    prefixLength < 0 ||
    prefixLength > 32
  ) {
    return false;
  }

  if (prefixLength === 0) {
    return true;
  }

  const mask = (0xffffffff << (32 - prefixLength)) >>> 0;
  return (ipNumber & mask) === (rangeNumber & mask);
}

export function getPayfastConfig() {
  const merchantId = cleanValue(process.env.PAYFAST_MERCHANT_ID);
  const merchantKey = cleanValue(process.env.PAYFAST_MERCHANT_KEY);
  const passphrase = cleanValue(process.env.PAYFAST_PASSPHRASE);
  const sandbox = parseBooleanEnv(process.env.PAYFAST_SANDBOX);

  if (!merchantId || !merchantKey) {
    throw new HttpError(
      500,
      "PayFast is not configured. Set PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY.",
    );
  }

  return {
    merchantId,
    merchantKey,
    passphrase,
    sandbox,
    processUrl: sandbox ? DEFAULT_SANDBOX_PROCESS_URL : DEFAULT_PROCESS_URL,
    validateUrl: sandbox ? DEFAULT_SANDBOX_VALIDATE_URL : DEFAULT_VALIDATE_URL,
    returnUrl: cleanValue(process.env.PAYFAST_RETURN_URL) || DEFAULT_RETURN_URL,
    cancelUrl: cleanValue(process.env.PAYFAST_CANCEL_URL) || DEFAULT_CANCEL_URL,
    notifyUrl: cleanValue(process.env.PAYFAST_NOTIFY_URL) || DEFAULT_NOTIFY_URL,
  };
}

export function generatePayfastSignature(fields, passphrase = "") {
  return crypto.createHash("md5").update(buildSignatureString(fields, passphrase)).digest("hex");
}

export function buildPayfastFormPayload(fields, passphrase = "") {
  const signature = generatePayfastSignature(fields, passphrase);

  return {
    ...fields,
    signature,
  };
}

export function buildPayfastMerchantPayload(fields = {}) {
  const config = getPayfastConfig();

  return {
    ...fields,
    merchant_id: config.merchantId,
    merchant_key: config.merchantKey,
    return_url: config.returnUrl,
    cancel_url: config.cancelUrl,
    notify_url: config.notifyUrl,
  };
}

export function normalizeAmount(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return "0.00";
  }

  return amount.toFixed(2);
}

export async function readUrlEncodedBody(request, maxBytes = 1_000_000) {
  if (typeof request.body === "string") {
    return request.body;
  }

  if (request.body && typeof request.body === "object") {
    const params = new URLSearchParams();

    Object.entries(request.body).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => params.append(key, String(item ?? "")));
        return;
      }

      params.append(key, String(value ?? ""));
    });

    return params.toString();
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;

    request.on("data", (chunk) => {
      totalBytes += chunk.length;

      if (totalBytes > maxBytes) {
        reject(new HttpError(413, "Request body is too large."));
        request.destroy();
        return;
      }

      chunks.push(Buffer.from(chunk));
    });

    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

export function parsePayfastPayload(rawBody) {
  const params = new URLSearchParams(String(rawBody || ""));
  const payload = {};

  params.forEach((value, key) => {
    payload[key] = value;
  });

  return payload;
}

export function verifyPayfastSignature(payload, passphrase = "") {
  const expectedSignature = generatePayfastSignature(payload, passphrase);
  const providedSignature = cleanValue(payload?.signature).toLowerCase();

  return Boolean(providedSignature) && providedSignature === expectedSignature.toLowerCase();
}

export function getPayfastSourceIp(request) {
  const forwardedFor = String(request.headers["x-forwarded-for"] || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const candidates = [
    ...forwardedFor,
    cleanValue(request.headers["x-real-ip"]),
    cleanValue(request.socket?.remoteAddress),
  ].filter(Boolean);

  const ipv4Candidate = candidates.find((candidate) => {
    if (candidate.startsWith("::ffff:")) {
      return net.isIP(candidate.slice(7)) === 4;
    }

    return net.isIP(candidate) === 4;
  });

  if (!ipv4Candidate) {
    return "";
  }

  return ipv4Candidate.startsWith("::ffff:") ? ipv4Candidate.slice(7) : ipv4Candidate;
}

export function verifyPayfastSourceIp(request) {
  const sourceIp = getPayfastSourceIp(request);

  if (!sourceIp) {
    return false;
  }

  const configuredRanges = String(process.env.PAYFAST_ITN_TRUSTED_IPS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowedRanges = configuredRanges.length > 0 ? configuredRanges : DEFAULT_SOURCE_IP_CIDRS;

  return allowedRanges.some((range) => isIpv4InCidr(sourceIp, range));
}

export async function validatePayfastNotification(rawBody, validateUrl) {
  const validationBody = rawBody
    ? `cmd=_notify-validate&${rawBody}`
    : "cmd=_notify-validate";

  const response = await fetch(validateUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: validationBody,
  });

  const text = (await response.text()).trim().toUpperCase();
  return response.ok && text === "VALID";
}
