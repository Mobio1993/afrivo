import {
  ensureCsrfCookie,
  fetchJson,
  postJson,
  sendFormData,
  sendJson,
} from "../../api/client";

export {
  ensureCsrfCookie,
  fetchJson,
  postJson,
  sendFormData,
  sendJson,
};

export const httpClient = {
  get: (url, options = {}) => fetchJson(url, { ...options, method: "GET" }),
  post: (url, body = {}, options = {}) => postJson(url, body, options),
  patch: (url, body = {}, options = {}) => sendJson(url, "PATCH", body, options),
  put: (url, body = {}, options = {}) => sendJson(url, "PUT", body, options),
  delete: (url, body = null, options = {}) => sendJson(url, "DELETE", body, options),
  form: (url, method, formData) => sendFormData(url, method, formData),
};
