import { fetchJson, postJson, sendJson } from "../api/client";

export function listAuthSessions() {
  return fetchJson("/api/auth/sessions/");
}

export function revokeAuthSession(sessionId) {
  return sendJson(`/api/auth/sessions/${sessionId}/`, "DELETE");
}

export function revokeAllAuthSessions() {
  return sendJson("/api/auth/sessions/all/", "DELETE");
}

export function changeOwnPassword(payload) {
  return postJson("/api/auth/change-password/", payload);
}

export function prepareTwoFactor() {
  return postJson("/api/auth/2fa/setup/", {});
}

export function verifyTwoFactor(code) {
  return postJson("/api/auth/2fa/verify/", { code });
}

export function disableTwoFactor() {
  return postJson("/api/auth/2fa/disable/", {});
}

export function verifyLoginTwoFactor({ challengeId, code }) {
  return postJson("/api/auth/2fa/login/verify/", { challenge_id: challengeId, code });
}
