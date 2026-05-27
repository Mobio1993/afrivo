import { httpClient } from "../../../shared/api/httpClient";

const SUPER_ROOT_BASE = "/api/super-root";
const PLATFORM_BASE = "/api/platform";

export const superRootUsersApi = {
  listUsers: () => httpClient.get(`${SUPER_ROOT_BASE}/users/`),
  listPlatformAdmins: () => httpClient.get(`${PLATFORM_BASE}/users/`),
  listOrganizations: () => httpClient.get(`${SUPER_ROOT_BASE}/organizations/`),
  listHotels: () => httpClient.get(`${SUPER_ROOT_BASE}/hotels/`),
  createAdmin: (payload) => httpClient.post(`${PLATFORM_BASE}/users/`, payload),
  createPlatformAdmin: (payload) => httpClient.post(`${PLATFORM_BASE}/users/`, {
    ...payload,
    admin_scope: "platform",
  }),
  createOrganizationAdmin: (payload) => httpClient.post(`${PLATFORM_BASE}/users/`, {
    ...payload,
    admin_scope: "organization",
  }),
  createHotelAdmin: (payload) => httpClient.post(`${PLATFORM_BASE}/users/`, {
    ...payload,
    admin_scope: "hotel",
  }),
  updatePlatformAdmin: (userId, payload) => httpClient.patch(`${PLATFORM_BASE}/users/${userId}/`, payload),
  activatePlatformAdmin: (userId) => httpClient.post(`${PLATFORM_BASE}/users/${userId}/activate/`),
  deactivatePlatformAdmin: (userId) => httpClient.post(`${PLATFORM_BASE}/users/${userId}/deactivate/`),
};
