import { httpClient } from "../../../shared/api/httpClient";

const BASE = "/api/super-root";

export const superRootOrganizationsApi = {
  listOrganizations: () => httpClient.get(`${BASE}/organizations/`),
  createOrganization: (payload) => httpClient.post("/api/platform/organizations/", payload),
};
