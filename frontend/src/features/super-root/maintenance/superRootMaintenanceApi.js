import { httpClient } from "../../../shared/api/httpClient";

const BASE = "/api/super-root";

export const superRootMaintenanceApi = {
  getMaintenanceStatus: () => httpClient.get(`${BASE}/maintenance/`),
  runMaintenance: (action, dryRun = true, confirmation = null) =>
    httpClient.post(`${BASE}/maintenance/run/`, {
      action,
      dry_run: dryRun,
      ...(confirmation ? { confirmation } : {}),
    }),
};
