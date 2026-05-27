import { fetchJson, postJson, sendJson } from "../../../api/client";

export function listInvoices({
  page = 1,
  pageSize = 20,
  search = "",
  status = "",
  client = "",
  stay = "",
  reservation = "",
  dateFrom = "",
  dateTo = "",
} = {}) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  if (search.trim()) params.set("search", search.trim());
  if (status) params.set("status", status);
  if (client) params.set("client", String(client));
  if (stay) params.set("stay", String(stay));
  if (reservation) params.set("reservation", String(reservation));
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  return fetchJson(`/api/billing/client-invoices/?${params.toString()}`);
}

export function getInvoice(invoiceId) {
  return fetchJson(`/api/billing/client-invoices/${invoiceId}/`);
}

export function createInvoice(payload) {
  return postJson("/api/billing/client-invoices/", payload);
}

export function createInvoiceFromStay(stayId) {
  return postJson("/api/billing/client-invoices/create-from-stay/", { stay_id: stayId });
}

export function createInvoiceFromDayUse(dayUseId) {
  return postJson("/api/billing/client-invoices/create-from-day-use/", { day_use_id: dayUseId });
}

export function updateInvoice(invoiceId, payload) {
  return sendJson(`/api/billing/client-invoices/${invoiceId}/`, "PATCH", payload);
}

export function deleteInvoice(invoiceId, note = "") {
  return sendJson(`/api/billing/client-invoices/${invoiceId}/`, "DELETE", { note });
}

export function issueInvoice(invoiceId) {
  return postJson(`/api/billing/client-invoices/${invoiceId}/issue/`, {});
}

export function cancelInvoice(invoiceId, note = "") {
  return postJson(`/api/billing/client-invoices/${invoiceId}/cancel/`, { note });
}

export function duplicateInvoice(invoiceId) {
  return postJson(`/api/billing/client-invoices/${invoiceId}/duplicate/`, {});
}

export function addPaymentToInvoice(invoiceId, payload) {
  return postJson(`/api/billing/client-invoices/${invoiceId}/add-payment/`, payload);
}

export function getInvoicePdfPayload(invoiceId) {
  return fetchJson(`/api/billing/client-invoices/${invoiceId}/pdf/`);
}

export function getInvoiceReceiptPayload(invoiceId) {
  return fetchJson(`/api/billing/client-invoices/${invoiceId}/receipt/`);
}

export function getInvoiceSummary(filters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.client) params.set("client", String(filters.client));
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  return fetchJson(`/api/billing/client-invoices/summary/?${params.toString()}`);
}

export function getEligibleConsumptions({ client = "", stay = "" } = {}) {
  const params = new URLSearchParams();
  if (client) params.set("client", String(client));
  if (stay) params.set("stay", String(stay));
  return fetchJson(`/api/billing/client-invoices/eligible-consumptions/?${params.toString()}`);
}

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
  return fetchJson(`/api/billing/client-payments/?${params.toString()}`);
}

export function getPayment(paymentId) {
  return fetchJson(`/api/billing/client-payments/${paymentId}/`);
}

export function createPayment(payload) {
  return postJson("/api/billing/client-payments/", payload);
}

export function updatePayment(paymentId, payload) {
  return sendJson(`/api/billing/client-payments/${paymentId}/`, "PATCH", payload);
}

export function confirmPayment(paymentId) {
  return postJson(`/api/billing/client-payments/${paymentId}/confirm/`, {});
}

export function cancelPayment(paymentId) {
  return postJson(`/api/billing/client-payments/${paymentId}/cancel/`, {});
}

export function getPaymentSummary(filters = {}) {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  return fetchJson(`/api/billing/client-payments/summary/?${params.toString()}`);
}

export function getBillingDashboard(period = "today") {
  return fetchJson(`/api/billing/dashboard/?period=${period}`);
}

export function getClientBalance(clientId) {
  return fetchJson(`/api/billing/client/${clientId}/balance/`);
}
