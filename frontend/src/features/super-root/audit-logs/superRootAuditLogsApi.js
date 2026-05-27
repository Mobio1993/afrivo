import { httpClient } from "../../../shared/api/httpClient";

const BASE = "/api/super-root";

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, value);
    }
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const superRootAuditLogsApi = {
  listAuditLogs: (params = {}) => httpClient.get(`${BASE}/audit-logs/${buildQuery(params)}`),
  exportCsvUrl: (params = {}) => `${BASE}/audit-logs/${buildQuery({ ...params, export: "csv" })}`,
};
