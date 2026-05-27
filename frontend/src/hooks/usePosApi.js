import { fetchJson, postJson, sendJson } from "../api/client";

const BASE = "/api/pos";

function list(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.results || [];
}

function query(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, value);
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const posApi = {
  getTables: async (params) => list(await fetchJson(`${BASE}/tables/${query(params)}`)),
  openOrder: (tableId, data = {}) => postJson(`${BASE}/tables/${tableId}/open_order/`, data),

  getOrders: async (params) => list(await fetchJson(`${BASE}/orders/${query(params)}`)),
  getOrder: (id) => fetchJson(`${BASE}/orders/${id}/`),
  addItem: (orderId, data) => postJson(`${BASE}/orders/${orderId}/add_item/`, data),
  sendToKitchen: (orderId) => postJson(`${BASE}/orders/${orderId}/send_to_kitchen/`, {}),
  voidItem: (orderId, data) => postJson(`${BASE}/orders/${orderId}/void_item/`, data),
  generateBill: (orderId, data = {}) => postJson(`${BASE}/orders/${orderId}/generate_bill/`, data),

  getMenus: async () => list(await fetchJson(`${BASE}/menus/`)),

  getKitchenTickets: async () => list(await fetchJson(`${BASE}/kitchen/`)),
  startTicket: (id) => postJson(`${BASE}/kitchen/${id}/start/`, {}),
  readyTicket: (id) => postJson(`${BASE}/kitchen/${id}/ready/`, {}),

  getPayments: async (params) => list(await fetchJson(`${BASE}/payments/${query(params)}`)),
  processPayment: (data) => postJson(`${BASE}/payments/`, data),

  dailyReport: (restaurantId) => fetchJson(`${BASE}/reports/daily/${query({ restaurant_id: restaurantId })}`),

  getServers: async (params) => list(await fetchJson(`${BASE}/servers/${query(params)}`)),
  getServer: (id) => fetchJson(`${BASE}/servers/${id}/`),
  createServer: (data) => postJson(`${BASE}/servers/`, data),
  updateServer: (id, data) => sendJson(`${BASE}/servers/${id}/`, "PATCH", data),
  updateServerStatus: (id, status) => sendJson(`${BASE}/servers/${id}/status/`, "PATCH", { status }),
  getServerSales: (id, params) => fetchJson(`${BASE}/servers/${id}/sales/${query(params)}`),
  getServerPerformance: (id, params) => fetchJson(`${BASE}/servers/${id}/performance/${query(params)}`),
  getServerPerformanceTable: (params) => fetchJson(`${BASE}/server-performance/${query(params)}`),
  getServerRanking: (params) => fetchJson(`${BASE}/server-ranking/${query(params)}`),
};
