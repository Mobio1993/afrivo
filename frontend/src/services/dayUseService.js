import { fetchJson, postJson, sendJson } from "../api/client";

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  });
  const output = query.toString();
  return output ? `?${output}` : "";
}

export function listDayUses(params = {}) {
  return fetchJson(`/api/day-use/${buildQuery(params)}`);
}

export function getDayUse(dayUseId) {
  return fetchJson(`/api/day-use/${dayUseId}/`);
}

export function createDayUse(payload) {
  return postJson("/api/day-use/", payload);
}

export function updateDayUse(dayUseId, payload) {
  return sendJson(`/api/day-use/${dayUseId}/`, "PATCH", payload);
}

export function checkInDayUse(dayUseId) {
  return sendJson(`/api/day-use/${dayUseId}/check-in/`, "PATCH", {});
}

export function checkOutDayUse(dayUseId) {
  return sendJson(`/api/day-use/${dayUseId}/check-out/`, "PATCH", {});
}

export function cancelDayUse(dayUseId, reason) {
  return sendJson(`/api/day-use/${dayUseId}/cancel/`, "PATCH", { reason });
}

export function markNoShowDayUse(dayUseId, reason) {
  return sendJson(`/api/day-use/${dayUseId}/no-show/`, "PATCH", { reason });
}

export function extendDayUse(dayUseId, extraHours) {
  return sendJson(`/api/day-use/${dayUseId}/extend/`, "PATCH", { extra_hours: extraHours });
}

export function recordDayUsePayment(dayUseId, payload) {
  return postJson(`/api/day-use/${dayUseId}/payments/`, payload);
}

export function getDayUseAvailability(params = {}) {
  return fetchJson(`/api/day-use/availability/${buildQuery(params)}`);
}

export function getDayUseDashboard() {
  return fetchJson("/api/day-use/dashboard/");
}

export function getDayUseHistory(dayUseId) {
  return fetchJson(`/api/day-use/${dayUseId}/history/`);
}

export function getDayUseReceipt(dayUseId) {
  return fetchJson(`/api/day-use/${dayUseId}/receipt/`);
}
