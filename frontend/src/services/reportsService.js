import { fetchJson, postJson } from "../api/client";

export function getReportsOverview(period = "today") {
  return fetchJson(`/api/reports/overview/?period=${period}`);
}

export function getReportBySlug(slug, period = "today") {
  const endpoints = {
    financial: "/api/reports/financial/",
    occupancy: "/api/reports/occupancy/",
    day_use: "/api/reports/day-use/",
    tenancy: "/api/reports/tenancy-readiness/",
  };

  const endpoint = endpoints[slug];
  if (!endpoint) {
    throw new Error(`Rapport inconnu: ${slug}`);
  }

  const separator = endpoint.includes("?") ? "&" : "?";
  return fetchJson(`${endpoint}${separator}period=${period}`);
}

export function assignDefaultHotelFromReport() {
  return postJson("/api/reports/tenancy-readiness/assign-default-hotel/", {});
}
