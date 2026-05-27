import { fetchJson, postJson, sendJson } from "../api/client";

export function listUsers(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "all") {
      params.set(key, value);
    }
  });
  const query = params.toString();
  return fetchJson(`/api/users/${query ? `?${query}` : ""}`);
}

export function getUserStats(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "all") {
      params.set(key, value);
    }
  });
  const query = params.toString();
  return fetchJson(`/api/users/stats/${query ? `?${query}` : ""}`);
}

export function createUser(payload) {
  return postJson("/api/users/", payload);
}

export function updateUser(userId, payload) {
  return sendJson(`/api/users/${userId}/`, "PATCH", payload);
}

export function deactivateUser(userId) {
  return sendJson(`/api/users/${userId}/`, "DELETE");
}

export function setUserPassword(userId, password) {
  return postJson(`/api/users/${userId}/set_password/`, { password });
}
