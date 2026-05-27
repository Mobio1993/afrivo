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

export function fetchSmartRoomsLive(params = {}) {
  return fetchJson(`/api/rooms/live/${buildQuery(params)}`);
}

export function fetchSmartAlerts(params = {}) {
  return fetchJson(`/api/rooms/alerts/${buildQuery(params)}`);
}

export function resolveSmartAlert(alertId) {
  return postJson(`/api/rooms/alerts/${alertId}/resolve/`, {});
}

export function fetchSmartSensors(params = {}) {
  return fetchJson(`/api/rooms/sensors/${buildQuery(params)}`);
}

export function createSensorEvent(payload) {
  return postJson("/api/rooms/sensor-events/", payload);
}

export function fetchEnergyReadings(params = {}) {
  return fetchJson(`/api/rooms/energy/${buildQuery(params)}`);
}
