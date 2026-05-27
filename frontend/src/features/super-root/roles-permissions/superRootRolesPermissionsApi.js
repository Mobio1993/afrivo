import { httpClient } from "../../../shared/api/httpClient";

const BASE = "/api/super-root";

export const superRootRolesPermissionsApi = {
  listRoles: () => httpClient.get(`${BASE}/roles/`),
  listPermissions: () => httpClient.get(`${BASE}/permissions/`),
};
