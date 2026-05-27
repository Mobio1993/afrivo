import { fetchJson, sendFormData, sendJson } from "../api/client";


export function getHotelSettings() {
  return fetchJson("/api/settings/hotel/");
}

export function getSettingsOptions() {
  return fetchJson("/api/settings/options/");
}

export function updateHotelSettings(payload) {
  if (payload instanceof FormData) {
    return sendFormData("/api/settings/hotel/", "PATCH", payload);
  }

  return sendJson("/api/settings/hotel/", "PATCH", payload);
}
