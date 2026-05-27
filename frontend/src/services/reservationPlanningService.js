import { fetchJson, postJson } from "../api/client";

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const s = query.toString();
  return s ? `?${s}` : "";
}

export function getReservationPlanning({
  startDate,
  endDate,
  floor,
  roomStatus,
  search,
} = {}) {
  return fetchJson(
    `/api/operations/planning/${buildQuery({
      start_date: startDate,
      end_date: endDate,
      floor,
      room_status: roomStatus,
      search,
    })}`
  );
}

export function getBookingDetailForPlanning(bookingId) {
  return fetchJson(`/api/operations/bookings/${bookingId}/`);
}

export function getStayDetailForPlanning(stayId) {
  return fetchJson(`/api/operations/stays/${stayId}/`);
}

export function updateBookingFromPlanning(bookingId, payload) {
  return postJson(`/api/operations/bookings/${bookingId}/update/`, payload);
}
