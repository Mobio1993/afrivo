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

export function createPlatformOrganization(payload) {
  return postJson("/api/platform/organizations/", payload);
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
