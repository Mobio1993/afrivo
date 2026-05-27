import { httpClient } from "../../../shared/api/httpClient";

const BASE = "/api/super-root";

export const superRootMonitoringApi = {
  getMonitoring: () => httpClient.get(`${BASE}/monitoring/`),
  getMonitoringLive: () => httpClient.get(`${BASE}/monitoring/live/`),
};
