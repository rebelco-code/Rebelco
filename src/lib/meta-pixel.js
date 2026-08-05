const META_PIXEL_ID = String(import.meta.env.VITE_META_PIXEL_ID || "").trim();

let scriptInjected = false;
let pixelInitialized = false;

function getWindowObject() {
  if (typeof window === "undefined") {
    return null;
  }

  return window;
}

function ensureFbqStub() {
  const windowObject = getWindowObject();

  if (!windowObject) {
    return null;
  }

  if (typeof windowObject.fbq === "function") {
    return windowObject.fbq;
  }

  const fbq = function fbqProxy() {
    if (fbq.callMethod) {
      fbq.callMethod.apply(fbq, arguments);
      return;
    }

    fbq.queue.push(arguments);
  };

  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];

  windowObject.fbq = fbq;
  windowObject._fbq = fbq;

  return fbq;
}

export function isMetaPixelEnabled() {
  return Boolean(META_PIXEL_ID);
}

export function loadMetaPixel() {
  const windowObject = getWindowObject();

  if (!windowObject || !META_PIXEL_ID) {
    return false;
  }

  ensureFbqStub();

  if (!scriptInjected) {
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
    scriptInjected = true;
  }

  if (!pixelInitialized) {
    windowObject.fbq("init", META_PIXEL_ID);
    pixelInitialized = true;
  }

  return true;
}

export function trackMetaPageView() {
  if (!loadMetaPixel()) {
    return;
  }

  window.fbq("track", "PageView");
}

export function trackMetaEvent(eventName, parameters = {}) {
  if (!loadMetaPixel()) {
    return;
  }

  window.fbq("track", eventName, parameters);
}

export function trackMetaEventOnce(storageKey, eventName, parameters = {}) {
  if (!loadMetaPixel()) {
    return;
  }

  const windowObject = getWindowObject();

  if (!windowObject) {
    return;
  }

  try {
    const dedupeKey = `meta-pixel:${storageKey}`;

    if (windowObject.sessionStorage.getItem(dedupeKey)) {
      return;
    }

    window.fbq("track", eventName, parameters);
    windowObject.sessionStorage.setItem(dedupeKey, "1");
  } catch {
    window.fbq("track", eventName, parameters);
  }
}
