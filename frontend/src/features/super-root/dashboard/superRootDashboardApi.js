import { httpClient } from "../../../shared/api/httpClient";

const BASE = "/api/super-root";

export const superRootDashboardApi = {
  getDashboard: () => httpClient.get(`${BASE}/dashboard/`),
};
