const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
let refreshPromise = null;
const SESSION_EXPIRED_MESSAGE = "Votre session a expire. Veuillez vous reconnecter.";
const REQUEST_TIMEOUT_MS = 15000;

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

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const externalSignal = options.signal;
  let timeoutId = null;

  if (externalSignal?.aborted) {
    controller.abort();
  }

  const abortFromExternalSignal = () => controller.abort();
  externalSignal?.addEventListener?.("abort", abortFromExternalSignal);

  timeoutId = window.setTimeout(() => {
    const timeoutError = new Error("La requete a expire. Verifiez votre connexion puis reessayez.");
    timeoutError.name = "TimeoutError";
    timeoutError.code = "REQUEST_TIMEOUT";
    controller.abort(timeoutError);
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      const timeoutError = new Error("La requete a expire. Verifiez votre connexion puis reessayez.");
      timeoutError.code = "REQUEST_TIMEOUT";
      throw timeoutError;
    }
    const networkError = new Error("Connexion reseau impossible. Verifiez que le serveur AFRIVO est accessible.");
    networkError.code = "NETWORK_ERROR";
    networkError.cause = error;
    throw networkError;
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener?.("abort", abortFromExternalSignal);
  }
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
    refreshPromise = fetchWithTimeout(buildApiUrl("/api/auth/refresh/"), {
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

function notifySessionExpired() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("afrivo:session-expired"));
  }
}

function createApiError(response, payload) {
  const isAuthError = response.status === 401;
  const error = new Error(
    isAuthError
      ? SESSION_EXPIRED_MESSAGE
      : payload.detail || `Request failed with status ${response.status}`,
  );
  error.status = response.status;
  error.payload = payload;
  if (isAuthError) {
    error.code = "SESSION_EXPIRED";
  }
  return error;
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

  const response = await fetchWithTimeout(buildApiUrl(url), {
    credentials: "include",
    ...restOptions,
    ...(body !== undefined ? { body } : {}),
    headers,
  });

  const payload = await parseResponse(response);
  if (!response.ok) {
    if (response.status === 401 && shouldTryRefresh(url, options, allowRetry)) {
      try {
        await refreshAccessToken();
        return fetchJson(url, options, false);
      } catch (error) {
        notifySessionExpired();
        const sessionError = new Error(SESSION_EXPIRED_MESSAGE);
        sessionError.status = 401;
        sessionError.code = "SESSION_EXPIRED";
        sessionError.payload = error.payload || payload;
        throw sessionError;
      }
    }

    const error = createApiError(response, payload);
    if (error.code === "SESSION_EXPIRED") {
      notifySessionExpired();
    }
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

export async function sendFormData(url, method, formData) {
  return fetchJson(url, {
    method,
    headers: {
      "X-CSRFToken": getCookie("csrftoken"),
    },
    body: formData,
  });
}
