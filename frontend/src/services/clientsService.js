import { fetchJson, postJson, sendJson } from "../api/client";

export function listClients({ page = 1, pageSize = 5, search = "" } = {}) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  if (search.trim()) {
    params.set("search", search.trim());
  }
  return fetchJson(`/api/clients/?${params.toString()}`);
}

export function getClient(clientId) {
  return fetchJson(`/api/clients/${clientId}/`);
}

export function getClientHistory(clientId, { page = 1, pageSize = 20, eventTypes = [], dateFrom = "", dateTo = "" } = {}) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  eventTypes.forEach((value) => {
    if (value) {
      params.append("event_type", value);
    }
  });
  if (dateFrom) {
    params.set("date_from", dateFrom);
  }
  if (dateTo) {
    params.set("date_to", dateTo);
  }
  return fetchJson(`/api/clients/${clientId}/history/?${params.toString()}`);
}

export function listAdminSatisfactions({
  page = 1,
  pageSize = 20,
  client = "",
  stay = "",
  overallRating = "",
  satisfactionLevel = "",
  dateFrom = "",
  dateTo = "",
} = {}) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  if (client) {
    params.set("client", String(client));
  }
  if (stay) {
    params.set("stay", String(stay));
  }
  if (overallRating) {
    params.set("overall_rating", String(overallRating));
  }
  if (satisfactionLevel) {
    params.set("satisfaction_level", satisfactionLevel);
  }
  if (dateFrom) {
    params.set("date_from", dateFrom);
  }
  if (dateTo) {
    params.set("date_to", dateTo);
  }
  return fetchJson(`/api/admin/satisfaction/?${params.toString()}`);
}

export function getAdminSatisfactionSummary(filters = {}) {
  const params = new URLSearchParams();
  if (filters.client) {
    params.set("client", String(filters.client));
  }
  if (filters.stay) {
    params.set("stay", String(filters.stay));
  }
  if (filters.overallRating) {
    params.set("overall_rating", String(filters.overallRating));
  }
  if (filters.satisfactionLevel) {
    params.set("satisfaction_level", filters.satisfactionLevel);
  }
  if (filters.dateFrom) {
    params.set("date_from", filters.dateFrom);
  }
  if (filters.dateTo) {
    params.set("date_to", filters.dateTo);
  }
  return fetchJson(`/api/admin/satisfaction/summary/?${params.toString()}`);
}

export function createClient(payload) {
  return postJson("/api/clients/", payload);
}

export function updateClient(clientId, payload) {
  return sendJson(`/api/clients/${clientId}/`, "PUT", payload);
}

export function deleteClient(clientId) {
  return sendJson(`/api/clients/${clientId}/`, "DELETE");
}
