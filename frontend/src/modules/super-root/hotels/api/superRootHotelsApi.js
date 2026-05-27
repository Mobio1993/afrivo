import { httpClient } from "../../../../shared/api/httpClient";

const BASE = "/api/super-root/hotels";

function query(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, value);
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

function confirmation(reason, phrase = "CONFIRMER") {
  return { reason, confirmation: { confirmed: true, phrase } };
}

export const superRootHotelsApi = {
  getHotels: (params = {}) => httpClient.get(`${BASE}/${query(params)}`),
  listHotels: (params = {}) => httpClient.get(`${BASE}/${query(params)}`),
  listOrganizations: () => httpClient.get("/api/super-root/organizations/"),
  createHotel: (payload) => httpClient.post("/api/platform/hotels/", payload),
  getHotelById: (hotelId) => httpClient.get(`${BASE}/${hotelId}/`),
  getHotelModules: (hotelId) => httpClient.get(`${BASE}/${hotelId}/modules/`),
  getHotelSecurity: (hotelId) => httpClient.get(`${BASE}/${hotelId}/security/`),
  getHotelBilling: (hotelId) => httpClient.get(`${BASE}/${hotelId}/billing/`),
  getHotelMonitoring: (hotelId) => httpClient.get(`${BASE}/${hotelId}/monitoring/`),
  getHotelAuditLogs: (hotelId, params = {}) => httpClient.get(`${BASE}/${hotelId}/audit-logs/${query(params)}`),
  suspendHotel: (hotelId, reason) => httpClient.post(`${BASE}/${hotelId}/suspend/`, confirmation(reason)),
  reactivateHotel: (hotelId, reason) => httpClient.post(`${BASE}/${hotelId}/reactivate/`, confirmation(reason)),
  putHotelInMaintenance: (hotelId, reason) => httpClient.post(`${BASE}/${hotelId}/maintenance/`, confirmation(reason)),
  exportHotelAuditLogs: (hotelId, params = {}) => `${BASE}/${hotelId}/audit-logs/export/${query(params)}`,
};
