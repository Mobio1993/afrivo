import { fetchJson, postJson, sendJson } from "../api/client";

export function listPayments({
  page = 1,
  pageSize = 20,
  search = "",
  status = "",
  method = "",
  paymentType = "",
  client = "",
  invoice = "",
  stay = "",
  dateFrom = "",
  dateTo = "",
  ordering = "",
} = {}) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  if (search.trim()) params.set("search", search.trim());
  if (status) params.set("status", status);
  if (method) params.set("method", method);
  if (paymentType) params.set("payment_type", paymentType);
  if (client) params.set("client", String(client));
  if (invoice) params.set("invoice", String(invoice));
  if (stay) params.set("stay", String(stay));
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  if (ordering) params.set("ordering", ordering);
  return fetchJson(`/api/payments/?${params.toString()}`);
}

export function getPayment(paymentId) {
  return fetchJson(`/api/payments/${paymentId}/`);
}

export function createPayment(payload) {
  return postJson("/api/payments/", payload);
}

export function updatePayment(paymentId, payload) {
  return sendJson(`/api/payments/${paymentId}/`, "PATCH", payload);
}

export function confirmPayment(paymentId) {
  return postJson(`/api/payments/${paymentId}/confirm/`, {});
}

export function cancelPayment(paymentId) {
  return postJson(`/api/payments/${paymentId}/cancel/`, {});
}

export function getPaymentSummary(filters = {}) {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.status) params.set("status", filters.status);
  if (filters.method) params.set("method", filters.method);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  return fetchJson(`/api/payments/summary/?${params.toString()}`);
}
