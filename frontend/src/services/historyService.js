import { fetchJson } from "../api/client";

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export function getActivityLogs(params = {}) {
  return fetchJson(`/api/history/activity-logs/${buildQuery(params)}`);
}

export function getActivityLogDetail(id) {
  return fetchJson(`/api/history/activity-logs/${id}/`);
}

export function getActivityLogSummary(params = {}) {
  return fetchJson(`/api/history/activity-logs/summary/${buildQuery(params)}`);
}
