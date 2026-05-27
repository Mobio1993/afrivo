import { fetchJson, postJson, sendJson } from "../api/client";

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  });
  const output = query.toString();
  return output ? `?${output}` : "";
}

export function getRoomsDashboard() {
  return fetchJson("/api/rooms/dashboard/");
}

export function listRooms(params = {}) {
  return fetchJson(`/api/rooms/${buildQuery(params)}`);
}

export function createRoom(payload) {
  return postJson("/api/rooms/", payload);
}

export function updateRoom(roomId, payload) {
  return sendJson(`/api/rooms/${roomId}/`, "PATCH", payload);
}

export function deactivateRoom(roomId) {
  return sendJson(`/api/rooms/${roomId}/`, "DELETE");
}

export function reactivateRoom(roomId) {
  return postJson(`/api/rooms/${roomId}/reactivate/`, {});
}

export function completeRoomCleaning(roomId) {
  return postJson(`/api/rooms/${roomId}/complete-cleaning/`, {});
}

export function checkInRoom(roomId) {
  return postJson(`/api/rooms/${roomId}/check-in/`, {});
}

export function checkOutRoom(roomId) {
  return postJson(`/api/rooms/${roomId}/check-out/`, {});
}

export function listRoomTypes(params = {}) {
  return fetchJson(`/api/rooms/types/${buildQuery(params)}`);
}

export function createRoomType(payload) {
  return postJson("/api/rooms/types/", payload);
}

export function updateRoomType(roomTypeId, payload) {
  return sendJson(`/api/rooms/types/${roomTypeId}/`, "PATCH", payload);
}

export function deactivateRoomType(roomTypeId) {
  return sendJson(`/api/rooms/types/${roomTypeId}/`, "DELETE");
}

export function listHousekeepingTasks(params = {}) {
  return fetchJson(`/api/rooms/housekeeping/tasks/${buildQuery(params)}`);
}

export function createHousekeepingTask(payload) {
  return postJson("/api/rooms/housekeeping/tasks/", payload);
}

export function startHousekeepingTask(taskId) {
  return postJson(`/api/rooms/housekeeping/tasks/${taskId}/start/`, {});
}

export function completeHousekeepingTask(taskId, payload = {}) {
  return postJson(`/api/rooms/housekeeping/tasks/${taskId}/complete/`, payload);
}

export function listMaintenanceIncidents(params = {}) {
  return fetchJson(`/api/rooms/maintenance/incidents/${buildQuery(params)}`);
}

export function createMaintenanceIncident(payload) {
  return postJson("/api/rooms/maintenance/incidents/", payload);
}

export function resolveMaintenanceIncident(incidentId, payload = {}) {
  return postJson(`/api/rooms/maintenance/incidents/${incidentId}/resolve/`, payload);
}

export function listPricingRules(params = {}) {
  return fetchJson(`/api/rooms/pricing/rules/${buildQuery(params)}`);
}

export function createPricingRule(payload) {
  return postJson("/api/rooms/pricing/rules/", payload);
}

export function listAssignmentSuggestions(params = {}) {
  return fetchJson(`/api/rooms/assignment-suggestions/${buildQuery(params)}`);
}

export function fetchOperationChoices() {
  return fetchJson("/api/operations/choices/");
}

export async function fetchRoomRealtimeStates() {
  return fetchJson("/api/rooms/realtime/");
}
