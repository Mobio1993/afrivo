const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
let refreshPromise = null;

function isFormDataBody(body) {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

function getCookie(name) {
  const cookieValue = `; ${document.cookie}`;
  const parts = cookieValue.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop().split(";").shift();
  }
  return "";
}

function buildApiUrl(url) {
  if (/^https?:\/\//.test(url)) {
    return url;
  }
  if (!API_BASE_URL) {
    return url;
  }
  return `${API_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`;
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  const text = await response.text();
  return text ? { detail: text } : {};
}

function shouldTryRefresh(url, options, allowRetry) {
  if (!allowRetry) {
    return false;
  }
  if ((options.method || "GET").toUpperCase() === "GET" && url.includes("/api/auth/session/")) {
    return true;
  }
  return !url.includes("/api/auth/login/") && !url.includes("/api/auth/logout/") && !url.includes("/api/auth/refresh/");
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetch(buildApiUrl("/api/auth/refresh/"), {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("csrftoken"),
      },
    })
      .then(async (response) => {
        const payload = await parseResponse(response);
        if (!response.ok) {
          const error = new Error(payload.detail || "Refresh token invalide.");
          error.status = response.status;
          error.payload = payload;
          throw error;
        }
        return payload;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function fetchJson(url, options = {}, allowRetry = true) {
  const { headers: optionHeaders = {}, body, ...restOptions } = options;
  const headers = {
    Accept: "application/json",
    ...optionHeaders,
  };

  if (body !== undefined && body !== null && !isFormDataBody(body) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(buildApiUrl(url), {
    credentials: "include",
    ...restOptions,
    ...(body !== undefined ? { body } : {}),
    headers,
  });

  const payload = await parseResponse(response);
  if (!response.ok) {
    if (response.status === 401 && shouldTryRefresh(url, options, allowRetry)) {
      await refreshAccessToken();
      return fetchJson(url, options, false);
    }

    const error = new Error(payload.detail || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function ensureCsrfCookie() {
  return fetchJson("/api/auth/csrf/", { method: "GET" });
}

export async function postJson(url, body) {
  return fetchJson(url, {
    method: "POST",
    headers: {
      "X-CSRFToken": getCookie("csrftoken"),
    },
    body: JSON.stringify(body || {}),
  });
}

export async function sendJson(url, method, body = null) {
  return fetchJson(url, {
    method,
    headers: {
      "X-CSRFToken": getCookie("csrftoken"),
    },
    ...(body !== null ? { body: JSON.stringify(body) } : {}),
  });
}
