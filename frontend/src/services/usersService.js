import { fetchJson, postJson, sendJson } from "../api/client";

export function listUsers() {
  return fetchJson("/api/users/");
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
