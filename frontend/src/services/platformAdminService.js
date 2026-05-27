import { fetchJson, postJson, sendJson } from "../api/client";

export function getPlatformDashboard() {
  return fetchJson("/api/platform/dashboard/");
}

export function listPlatformOrganizations({ search = "", isActive = null } = {}) {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (isActive !== null) params.set("is_active", String(isActive));
  const qs = params.toString();
  return fetchJson(`/api/platform/organizations/${qs ? `?${qs}` : ""}`);
}

export function listPlatformHotels({
  organizationId = null,
  isActive = null,
  subscriptionStatus = null,
  search = "",
} = {}) {
  const params = new URLSearchParams();
  if (organizationId) params.set("organization", String(organizationId));
  if (isActive !== null) params.set("is_active", String(isActive));
  if (subscriptionStatus) params.set("subscription_status", subscriptionStatus);
  if (search.trim()) params.set("search", search.trim());
  const qs = params.toString();
  return fetchJson(`/api/platform/hotels/${qs ? `?${qs}` : ""}`);
}

export function getPlatformHotelsDashboard() {
  return fetchJson("/api/platform/hotels/dashboard/");
}

export function listPlatformSubscriptions({
  organizationId = null,
  hotelId = null,
  status = null,
  planId = null,
  search = "",
} = {}) {
  const params = new URLSearchParams();
  if (organizationId) params.set("organization", String(organizationId));
  if (hotelId) params.set("hotel", String(hotelId));
  if (status) params.set("status", status);
  if (planId) params.set("plan", String(planId));
  if (search.trim()) params.set("search", search.trim());
  const qs = params.toString();
  return fetchJson(`/api/platform/subscriptions/${qs ? `?${qs}` : ""}`);
}

export function listPlatformSubscriptionPlans() {
  return fetchJson("/api/platform/subscriptions/plans/");
}

export function createPlatformSubscriptionPlan(payload) {
  return postJson("/api/platform/subscriptions/plans/", payload);
}

export function updatePlatformSubscriptionPlan(planId, payload) {
  return sendJson(`/api/platform/subscriptions/plans/${planId}/`, "PATCH", payload);
}

export function listPlatformUsers() {
  return fetchJson("/api/platform/users/");
}

export function listPosAccesses() {
  return fetchJson("/api/pos/access/");
}

export function createPosAccess(payload) {
  return postJson("/api/pos/access/", payload);
}

export function updatePosAccess(accessId, payload) {
  return sendJson(`/api/pos/access/${accessId}/`, "PATCH", payload);
}

export function revokePosAccess(accessId) {
  return sendJson(`/api/pos/access/${accessId}/`, "DELETE");
}

export function createPlatformAdminUser(payload) {
  return postJson("/api/platform/users/", payload);
}

export function updatePlatformAdminUser(userId, payload) {
  return sendJson(`/api/platform/users/${userId}/`, "PATCH", payload);
}

export function resetPlatformAdminAccess(userId, payload) {
  return postJson(`/api/platform/users/${userId}/reset-access/`, payload);
}

export function listPlatformModules({ search = "", isActive = null } = {}) {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (isActive !== null) params.set("is_active", String(isActive));
  const qs = params.toString();
  return fetchJson(`/api/platform/modules/${qs ? `?${qs}` : ""}`);
}

export function createPlatformModule(payload) {
  return postJson("/api/platform/modules/", payload);
}

export function updatePlatformModule(moduleId, payload) {
  return sendJson(`/api/platform/modules/${moduleId}/`, "PATCH", payload);
}

export function listPlatformLicenses({
  moduleId = null,
  organizationId = null,
  hotelId = null,
  status = "",
  search = "",
} = {}) {
  const params = new URLSearchParams();
  if (moduleId) params.set("module", String(moduleId));
  if (organizationId) params.set("organization", String(organizationId));
  if (hotelId) params.set("hotel", String(hotelId));
  if (status) params.set("status", status);
  if (search.trim()) params.set("search", search.trim());
  const qs = params.toString();
  return fetchJson(`/api/platform/licenses/${qs ? `?${qs}` : ""}`);
}

export function createPlatformLicense(payload) {
  return postJson("/api/platform/licenses/", payload);
}

export function updatePlatformLicense(licenseId, payload) {
  return sendJson(`/api/platform/licenses/${licenseId}/`, "PATCH", payload);
}

export function suspendPlatformLicense(licenseId, payload = {}) {
  return postJson(`/api/platform/licenses/${licenseId}/suspend/`, payload);
}

export function renewPlatformLicense(licenseId, payload) {
  return postJson(`/api/platform/licenses/${licenseId}/renew/`, payload);
}

export function checkPlatformModuleAccess({ moduleCode, organizationId = null, hotelId = null }) {
  const params = new URLSearchParams();
  params.set("module_code", moduleCode);
  if (organizationId) params.set("organization_id", String(organizationId));
  if (hotelId) params.set("hotel_id", String(hotelId));
  return fetchJson(`/api/platform/modules/check-access/?${params.toString()}`);
}

export function listPlatformSecurityEvents() {
  return fetchJson("/api/platform/security-events/");
}

export function listPlatformSecurityEventsFiltered(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  });
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return fetchJson(`/api/platform/security-events/${suffix}`);
}

export function createPlatformSecurityReview(payload) {
  return postJson("/api/platform/security-events/review/", payload);
}

export function listIamRoles() {
  return fetchJson("/api/iam/roles/");
}

export function createIamRole(payload) {
  return postJson("/api/iam/roles/create/", payload);
}

export function updateIamRole(roleId, payload) {
  return sendJson(`/api/iam/roles/${roleId}/`, "PATCH", payload);
}

export function listIamPermissions() {
  return fetchJson("/api/iam/permissions/");
}

export function listIamAssignments() {
  return fetchJson("/api/iam/assignments/");
}

export function listRolePermissionHistory(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  });
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return fetchJson(`/api/history/activity-logs/role-permission-history/${suffix}`);
}

export function listSecurityAlerts(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  });
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return fetchJson(`/api/history/activity-logs/security-alerts/${suffix}`);
}

export function getAuditIntegrityStatus(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  });
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return fetchJson(`/api/history/activity-logs/integrity/${suffix}`);
}

export function createPlatformOrganization(payload) {
  return postJson("/api/platform/organizations/", payload);
}

export function updatePlatformOrganization(organizationId, payload) {
  return sendJson(`/api/platform/organizations/${organizationId}/`, "PATCH", payload);
}

export function createPlatformHotel(payload) {
  return postJson("/api/platform/hotels/", payload);
}

export function updatePlatformHotel(hotelId, payload) {
  return sendJson(`/api/platform/hotels/${hotelId}/`, "PATCH", payload);
}

export function createPlatformHotelAdmin(hotelId, payload) {
  return postJson(`/api/platform/hotels/${hotelId}/admin/`, payload);
}

export function suspendPlatformHotel(hotelId) {
  return postJson(`/api/platform/hotels/${hotelId}/suspend/`, {});
}

export function reactivatePlatformHotel(hotelId) {
  return postJson(`/api/platform/hotels/${hotelId}/reactivate/`, {});
}

export function createPlatformSubscription(payload) {
  return postJson("/api/platform/subscriptions/", payload);
}

export function updatePlatformSubscription(subscriptionId, payload) {
  return sendJson(`/api/platform/subscriptions/${subscriptionId}/`, "PATCH", payload);
}

export function runPlatformSubscriptionLifecycle(payload = {}) {
  return postJson("/api/platform/subscriptions/process-lifecycle/", payload);
}

export function renewPlatformSubscription(subscriptionId, payload) {
  return postJson(`/api/platform/subscriptions/${subscriptionId}/renew/`, payload);
}

export function changePlatformSubscriptionPlan(subscriptionId, payload) {
  return postJson(`/api/platform/subscriptions/${subscriptionId}/change-plan/`, payload);
}

export function createPlatformOnboardingBundle(payload) {
  return postJson("/api/platform/onboarding/", payload);
}
