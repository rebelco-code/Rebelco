import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "./errors.js";

const COOKIE_NAME = "rebelco_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const GOOGLE_TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo";

function getEnv(name) {
  return process.env[name]?.trim() || "";
}

function getRequiredEnv(name, label) {
  const value = getEnv(name);

  if (!value) {
    throw new HttpError(500, `${label} is not configured.`);
  }

  return value;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getAllowedAdminEmails() {
  return getEnv("ADMIN_EMAILS")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
}

function isAllowedAdminEmail(email) {
  return getAllowedAdminEmails().includes(normalizeEmail(email));
}

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((cookies, cookie) => {
    const [name, ...valueParts] = cookie.trim().split("=");

    if (!name) {
      return cookies;
    }

    cookies[name] = decodeURIComponent(valueParts.join("="));
    return cookies;
  }, {});
}

function signValue(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function verifySignature(value, signature, secret) {
  const expected = signValue(value, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  return (
    signatureBuffer.length === expectedBuffer.length &&
    timingSafeEqual(signatureBuffer, expectedBuffer)
  );
}

function isSecureCookieRequest() {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

export function createAdminSessionCookie(admin) {
  const secret = getRequiredEnv("ADMIN_SESSION_SECRET", "Admin session secret");
  const payload = {
    email: normalizeEmail(admin.email),
    name: admin.name || admin.email,
    picture: admin.picture || "",
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signValue(encodedPayload, secret);
  const attributes = [
    `${COOKIE_NAME}=${encodedPayload}.${signature}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];

  if (isSecureCookieRequest()) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

export function clearAdminSessionCookie() {
  const attributes = [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];

  if (isSecureCookieRequest()) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

export function readAdminSession(request) {
  const cookies = parseCookies(request.headers.cookie || "");
  const sessionCookie = cookies[COOKIE_NAME];

  if (!sessionCookie) {
    return null;
  }

  const [encodedPayload, signature] = sessionCookie.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const secret = getRequiredEnv("ADMIN_SESSION_SECRET", "Admin session secret");

  if (!verifySignature(encodedPayload, signature, secret)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    const isExpired = Number(payload.exp) < Math.floor(Date.now() / 1000);

    if (isExpired || !isAllowedAdminEmail(payload.email)) {
      return null;
    }

    return {
      email: normalizeEmail(payload.email),
      name: payload.name || payload.email,
      picture: payload.picture || "",
    };
  } catch {
    return null;
  }
}

export function requireAdminSession(request) {
  const admin = readAdminSession(request);

  if (!admin) {
    throw new HttpError(401, "Admin sign-in required.");
  }

  return admin;
}

export async function verifyGoogleCredential(credential) {
  const clientId = getRequiredEnv("GOOGLE_CLIENT_ID", "Google client ID");
  const allowedAdminEmails = getAllowedAdminEmails();

  if (allowedAdminEmails.length === 0) {
    throw new HttpError(500, "Admin email allow-list is not configured.");
  }

  if (!credential) {
    throw new HttpError(400, "Google credential is required.");
  }

  const tokenInfoUrl = new URL(GOOGLE_TOKEN_INFO_URL);
  tokenInfoUrl.searchParams.set("id_token", credential);

  const tokenInfoResponse = await fetch(tokenInfoUrl, { cache: "no-store" });

  if (!tokenInfoResponse.ok) {
    throw new HttpError(401, "Google sign-in could not be verified.");
  }

  const tokenInfo = await tokenInfoResponse.json();
  const email = normalizeEmail(tokenInfo.email);
  const isEmailVerified =
    tokenInfo.email_verified === true || tokenInfo.email_verified === "true";

  if (tokenInfo.aud !== clientId || !email || !isEmailVerified) {
    throw new HttpError(401, "Google sign-in could not be verified.");
  }

  if (!isAllowedAdminEmail(email)) {
    throw new HttpError(403, "This Google account is not allowed to manage products.");
  }

  return {
    email,
    name: tokenInfo.name || email,
    picture: tokenInfo.picture || "",
  };
}
