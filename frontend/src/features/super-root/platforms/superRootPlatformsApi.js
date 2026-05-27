import { httpClient } from "../../../shared/api/httpClient";

const BASE = "/api/super-root";

export const superRootPlatformsApi = {
  getPlatformOverview: () => httpClient.get(`${BASE}/platform/`),
  getPlatforms: () => httpClient.get(`${BASE}/platforms/`),
  createPlatform: (payload) => httpClient.post(`${BASE}/platforms/`, payload),
  runPlatformAction: (platformId, action, payload = {}) => (
    httpClient.post(`${BASE}/platforms/${platformId}/${action}/`, payload)
  ),
  attachTenants: (platformId, payload) => httpClient.post(`${BASE}/platforms/${platformId}/attach/`, payload),
  listOrganizations: () => httpClient.get(`${BASE}/organizations/`),
  healthcheck: (platformId) => httpClient.post(`${BASE}/platforms/${platformId}/healthcheck/`, {}),
  maintenance: (platformId, payload) => httpClient.post(`${BASE}/platforms/${platformId}/maintenance/`, payload),
  reactivate: (platformId) => httpClient.post(`${BASE}/platforms/${platformId}/reactivate/`, {}),
  incidents: (platformId) => httpClient.post(`${BASE}/platforms/${platformId}/incidents/`, {}),
  monitoringLive: (platformId) => httpClient.post(`${BASE}/platforms/${platformId}/monitoring-live/`, {}),
  platformAudit: (platformId) => httpClient.post(`${BASE}/platforms/${platformId}/audit/`, {}),
  subscriptionLifecycle: (platformId, payload) => (
    httpClient.post(`${BASE}/platforms/${platformId}/subscription-lifecycle/`, payload)
  ),
  integrityCheck: (platformId) => httpClient.post(`${BASE}/platforms/${platformId}/integrity-check/`, {}),
  snapshot: (platformId) => httpClient.post(`${BASE}/platforms/${platformId}/snapshot/`, {}),
  snapshotExportUrl: (platformId) => `${BASE}/platforms/${platformId}/snapshot/export/`,
  criticalQuotas: (platformId) => httpClient.post(`${BASE}/platforms/${platformId}/critical-quotas/`, {}),
  suspendedClients: (platformId) => httpClient.post(`${BASE}/platforms/${platformId}/suspended-clients/`, {}),
};
