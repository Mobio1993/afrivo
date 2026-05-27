import { fetchJson, postJson, sendJson } from "../api/client";

export function listClients({ page = 1, pageSize = 5, search = "", filter = "all", includeInactive = false } = {}) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  if (filter && filter !== "all") {
    params.set("filter", filter);
  }
  if (includeInactive || filter === "archived") {
    params.set("include_inactive", "true");
  }
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

export function getClientStays(clientId) {
  return fetchJson(`/api/clients/${clientId}/stays/`);
}

export function getClientPayments(clientId, { page = 1, pageSize = 12 } = {}) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  return fetchJson(`/api/clients/${clientId}/payments/?${params.toString()}`);
}

export function getClientInvoices(clientId, { page = 1, pageSize = 12 } = {}) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  return fetchJson(`/api/clients/${clientId}/invoices/?${params.toString()}`);
}

export function getClientConsumptions(clientId, { page = 1, pageSize = 12 } = {}) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  return fetchJson(`/api/clients/${clientId}/consumptions/?${params.toString()}`);
}

export function getClientSatisfaction(clientId, { page = 1, pageSize = 12 } = {}) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  return fetchJson(`/api/clients/${clientId}/satisfaction/?${params.toString()}`);
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

export function archiveClient(clientId) {
  return postJson(`/api/clients/${clientId}/archive/`, {});
}

export function reactivateClient(clientId) {
  return postJson(`/api/clients/${clientId}/reactivate/`, {});
}
