import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "./errors.js";

const COOKIE_NAME = "rebelco_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

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

function safeCompare(value, expectedValue) {
  const valueBuffer = Buffer.from(String(value || ""));
  const expectedBuffer = Buffer.from(String(expectedValue || ""));

  return (
    valueBuffer.length === expectedBuffer.length &&
    timingSafeEqual(valueBuffer, expectedBuffer)
  );
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
  return safeCompare(signature, expected);
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
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    );

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

export function verifyAdminLogin(email, password) {
  const adminPassword = getRequiredEnv("ADMIN_PASSWORD", "Admin password");
  const allowedAdminEmails = getAllowedAdminEmails();
  const normalizedEmail = normalizeEmail(email);

  if (allowedAdminEmails.length === 0) {
    throw new HttpError(500, "Admin email allow-list is not configured.");
  }

  if (!normalizedEmail || !password) {
    throw new HttpError(400, "Email and password are required.");
  }

  if (!isAllowedAdminEmail(normalizedEmail) || !safeCompare(password, adminPassword)) {
    throw new HttpError(401, "Invalid admin email or password.");
  }

  return {
    email: normalizedEmail,
    name: normalizedEmail,
    picture: "",
  };
}