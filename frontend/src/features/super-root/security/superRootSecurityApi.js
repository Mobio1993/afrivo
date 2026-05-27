import { httpClient } from "../../../shared/api/httpClient";

const BASE = "/api/super-root";

export const superRootSecurityApi = {
  getSecurityReview: () => httpClient.get(`${BASE}/security/`),
  listSecurityAlerts: () => httpClient.get(`${BASE}/security-alerts/`),
  revokeSession: (sessionId, confirmation = null) =>
    httpClient.delete(`${BASE}/security/sessions/${sessionId}/`, {
      ...(confirmation ? { confirmation } : {}),
    }),
};
