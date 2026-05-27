import { useMemo, useState } from "react";

import PriorityQueues from "./PriorityQueues";
import RoomAlertBanner from "./RoomAlertBanner";
import RoomCard from "./RoomCard";
import RoomKpiBar from "./RoomKpiBar";
import RoomRevenueMiniCards from "./RoomRevenueMiniCards";
import RoomToolbar from "./RoomToolbar";
import SmartRoomAssignment from "./SmartRoomAssignment";
import "./HotelViewPage.css";

export const ROOM_STATUS = {
  AVAILABLE: "available",
  OCCUPIED: "occupied",
  RESERVED: "reserved",
  CLEANING: "cleaning",
  MAINTENANCE: "maintenance",
  BLOCKED: "out_of_service",
};

const STATUS_LABELS = {
  available: "Disponible",
  occupied: "Occupee",
  reserved: "Reservee",
  cleaning: "Nettoyage",
  maintenance: "Maintenance",
  out_of_service: "Bloquee",
};

const MOCK_GUESTS = ["Aminata Kone", "Mamadou Traore", "Grace Kouassi", "Nadia Diallo", "Jean Morel"];
const MOCK_TEMP = [22.4, 23.1, 24.7, 21.9, 25.2, 26.1, 22.8];

function toNumber(value) {
  const num = Number(String(value ?? 0).replace(",", "."));
  return Number.isFinite(num) ? num : 0;
}

function addDays(base, days) {
  const date = new Date(base);
  date.setDate(date.getDate() + days);
  return date;
}

function formatDate(date) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(date);
}

function normalizeRoom(room, index) {
  const status = room.status || ROOM_STATUS.AVAILABLE;
  const isOccupied = status === ROOM_STATUS.OCCUPIED || status === ROOM_STATUS.RESERVED;
  const arrival = addDays(new Date(), -((index % 4) + 1));
  const totalNights = isOccupied ? (index % 5) + 1 : 0;
  const currentNight = isOccupied ? Math.min(totalNights, (index % totalNights) + 1) : 0;
  const checkout = isOccupied ? addDays(arrival, totalNights) : null;
  const cleaningProgress = status === ROOM_STATUS.CLEANING ? 35 + ((index * 13) % 55) : 0;
  const stayProgress = totalNights > 0 ? Math.round((currentNight / totalNights) * 100) : 0;
  const revenue = toNumber(room.revenue_total) || (isOccupied ? toNumber(room.effective_price_per_night) * currentNight : 0);

  return {
    id: room.id ?? `mock-${index}`,
    number: room.number || String(100 + index),
    roomType: room.room_type || room.room_type_name || "Standard",
    roomTypeId: room.room_type_id || room.room_type,
    floor: room.floor || "-",
    status,
    statusLabel: STATUS_LABELS[status] || room.status_label || status,
    guestName: isOccupied ? (room.occupant && room.occupant !== "-" ? room.occupant : MOCK_GUESTS[index % MOCK_GUESTS.length]) : "",
    arrivalDate: isOccupied ? arrival : null,
    departureDate: checkout,
    currentNight,
    totalNights,
    checkoutTime: isOccupied ? `${10 + (index % 3)}:00` : "-",
    temperature: MOCK_TEMP[index % MOCK_TEMP.length],
    doorState: index % 9 === 0 ? "ouverte" : "fermee",
    lightState: index % 3 === 0 ? "ON" : "OFF",
    balanceDue: isOccupied ? Math.max(0, (index % 4) * 12500) : 0,
    revenue,
    price: toNumber(room.effective_price_per_night || room.custom_price_per_night),
    stayProgress,
    cleaningProgress,
    housekeepingOpen: room.housekeeping_open || 0,
    incidentsOpen: room.incidents_open || 0,
    raw: room,
  };
}

export function calculateOccupancyRate(rooms) {
  if (!rooms.length) return 0;
  const occupied = rooms.filter((room) => room.status === ROOM_STATUS.OCCUPIED || room.status === ROOM_STATUS.RESERVED).length;
  return Math.round((occupied / rooms.length) * 100);
}

export function calculateTodayRevenue(rooms) {
  return rooms.reduce((sum, room) => sum + toNumber(room.revenue), 0);
}

export function calculateAverageStayDuration(rooms) {
  const stays = rooms.filter((room) => room.totalNights > 0);
  if (!stays.length) return 0;
  return Math.round((stays.reduce((sum, room) => sum + room.totalNights, 0) / stays.length) * 10) / 10;
}

export function filterRooms(rooms, filters) {
  const query = filters.search.trim().toLowerCase();
  return rooms.filter((room) => {
    const matchesQuery = !query || [room.number, room.guestName, room.roomType].join(" ").toLowerCase().includes(query);
    const matchesStatus =
      filters.status === "all" ? true
        : filters.status === "checkout" ? room.status === ROOM_STATUS.OCCUPIED && room.checkoutTime !== "-"
        : room.status === filters.status;
    const matchesType = filters.roomType === "all" || String(room.roomTypeId || room.roomType) === String(filters.roomType) || room.roomType === filters.roomType;
    const matchesFloor = filters.floor === "all" || String(room.floor) === String(filters.floor);
    return matchesQuery && matchesStatus && matchesType && matchesFloor;
  });
}

export function sortRooms(rooms, sortBy) {
  return [...rooms].sort((a, b) => {
    if (sortBy === "status") return a.status.localeCompare(b.status);
    if (sortBy === "price") return b.price - a.price;
    if (sortBy === "guest") return (a.guestName || "").localeCompare(b.guestName || "");
    if (sortBy === "arrival") return (a.arrivalDate?.getTime() || 0) - (b.arrivalDate?.getTime() || 0);
    return String(a.number).localeCompare(String(b.number), "fr", { numeric: true });
  });
}

export function suggestRoomsForClient(rooms, request) {
  return rooms
    .map((room) => {
      const reasons = [];
      let score = 54;
      if (room.status === ROOM_STATUS.AVAILABLE) {
        score += 24;
        reasons.push("Disponible immediatement");
      }
      if (room.status === ROOM_STATUS.CLEANING) {
        score += 10;
        reasons.push("Disponible apres nettoyage");
      }
      if (!request.roomType || request.roomType === "all" || String(room.roomTypeId || room.roomType) === String(request.roomType)) {
        score += 16;
        reasons.push("Meme type demande");
      }
      if (room.price <= 45000 || !room.price) {
        score += 6;
        reasons.push("Tarif compatible");
      }
      if (Number(room.floor) === 1) {
        score += 4;
        reasons.push("Proche d'une chambre liee");
      }
      return { ...room, score: Math.min(score, 99), reasons };
    })
    .filter((room) => room.status === ROOM_STATUS.AVAILABLE || room.status === ROOM_STATUS.CLEANING)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function getPriorityTasks(dashboard) {
  const housekeeping = (dashboard?.housekeeping_queue || []).map((task, index) => ({
    id: task.id,
    kind: "housekeeping",
    room: task.room,
    title: task.task_type,
    urgency: task.priority_label || "Normale",
    status: task.status_label,
    agent: task.assigned_to && task.assigned_to !== "-" ? task.assigned_to : "Non assigne",
    wait: `${18 + index * 7} min`,
    raw: task,
  }));
  const maintenance = (dashboard?.maintenance_alerts || []).map((item, index) => ({
    id: item.id,
    kind: "maintenance",
    room: item.room,
    title: item.title,
    urgency: item.severity_label || "Moyenne",
    status: item.status_label,
    agent: "Non assigne",
    wait: `${25 + index * 11} min`,
    raw: item,
  }));
  return [...maintenance, ...housekeeping].slice(0, 8);
}

export default function HotelViewPage({
  dashboard,
  rooms = [],
  roomTypes = [],
  choices,
  suggestions = [],
  submittingSuggestions = false,
  canOperateRooms,
  canCheckInRooms = false,
  canCheckOutRooms = false,
  canMarkCleanRooms = false,
  canCreateMaintenance = false,
  canStartHousekeeping = false,
  canAssignHousekeeping = false,
  canResolveMaintenance = false,
  activeRoomAction,
  onOpenRoom,
  onCheckIn,
  onCheckOut,
  onMarkClean,
  onMaintenance,
  onSuggestionSubmit,
  suggestionForm,
  setSuggestionForm,
  onStartHousekeeping,
  onResolveMaintenance,
}) {
  const [filters, setFilters] = useState({ search: "", status: "all", roomType: "all", floor: "all", sortBy: "number" });
  const normalizedRooms = useMemo(() => (dashboard?.room_grid?.length ? dashboard.room_grid : rooms).map(normalizeRoom), [dashboard, rooms]);
  const visibleRooms = useMemo(() => sortRooms(filterRooms(normalizedRooms, filters), filters.sortBy), [filters, normalizedRooms]);
  const smartSuggestions = useMemo(() => {
    if (suggestions.length) return suggestions.map((item, index) => ({ ...normalizeRoom(item, index), score: item.score || 84, reasons: item.reasons || ["Suggestion DRF"] }));
    return suggestRoomsForClient(normalizedRooms, { roomType: suggestionForm?.room_type || "all" });
  }, [normalizedRooms, suggestionForm?.room_type, suggestions]);
  const priorityTasks = useMemo(() => getPriorityTasks(dashboard), [dashboard]);
  const kpis = {
    available: normalizedRooms.filter((room) => room.status === ROOM_STATUS.AVAILABLE).length,
    occupied: normalizedRooms.filter((room) => room.status === ROOM_STATUS.OCCUPIED || room.status === ROOM_STATUS.RESERVED).length,
    cleaning: normalizedRooms.filter((room) => room.status === ROOM_STATUS.CLEANING).length,
    occupancyRate: dashboard?.summary?.occupancy_rate ?? calculateOccupancyRate(normalizedRooms),
    checkinsToday: Math.max(2, normalizedRooms.filter((room) => room.status === ROOM_STATUS.RESERVED).length),
    checkoutsToday: normalizedRooms.filter((room) => room.status === ROOM_STATUS.OCCUPIED).length,
    revenueToday: calculateTodayRevenue(normalizedRooms),
    avgStay: calculateAverageStayDuration(normalizedRooms),
  };
  const alerts = [
    ...priorityTasks.filter((task) => task.kind === "maintenance").slice(0, 2).map((task) => ({ label: "Maintenance urgente", detail: `Ch. ${task.room} - ${task.title}` })),
    ...normalizedRooms.filter((room) => room.status === ROOM_STATUS.BLOCKED).slice(0, 2).map((room) => ({ label: "Chambre bloquee", detail: `Ch. ${room.number}` })),
    ...normalizedRooms.filter((room) => room.doorState === "ouverte").slice(0, 2).map((room) => ({ label: "Porte ouverte", detail: `Ch. ${room.number}` })),
    ...priorityTasks.filter((task) => task.kind === "housekeeping").slice(0, 2).map((task) => ({ label: "Nettoyage en retard", detail: `Ch. ${task.room} - ${task.wait}` })),
  ];
  const floors = [...new Set(normalizedRooms.map((room) => room.floor).filter((floor) => floor !== "-"))];

  return (
    <section className="hv-page">
      <RoomKpiBar kpis={kpis} />
      <RoomAlertBanner alerts={alerts} />
      <RoomToolbar filters={filters} onChange={setFilters} roomTypes={roomTypes} floors={floors} />

      <div className="hv-layout">
        <div className="hv-main">
          <div className="hv-section-head">
            <div>
              <div className="hv-eyebrow">Parc hotelier</div>
              <h3>{visibleRooms.length} chambres filtrees</h3>
            </div>
          </div>
          <div className="hv-room-grid">
            {visibleRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                canOperate={canOperateRooms}
                canCheckIn={canCheckInRooms}
                canCheckOut={canCheckOutRooms}
                canMarkClean={canMarkCleanRooms}
                canMaintenance={canCreateMaintenance}
                activeRoomAction={activeRoomAction}
                formatDate={formatDate}
                onOpen={onOpenRoom}
                onCheckIn={onCheckIn}
                onCheckOut={onCheckOut}
                onMarkClean={onMarkClean}
                onMaintenance={onMaintenance}
              />
            ))}
          </div>
        </div>

        <aside className="hv-side">
          <SmartRoomAssignment
            choices={choices}
            roomTypes={roomTypes}
            form={suggestionForm}
            setForm={setSuggestionForm}
            suggestions={smartSuggestions}
            submitting={submittingSuggestions}
            onSubmit={onSuggestionSubmit}
            onAssign={(room) => onOpenRoom?.(room.raw || room)}
          />
          <PriorityQueues
            tasks={priorityTasks}
            canStartHousekeeping={canStartHousekeeping}
            canAssignHousekeeping={canAssignHousekeeping}
            canResolveMaintenance={canResolveMaintenance}
            onStartHousekeeping={onStartHousekeeping}
            onResolveMaintenance={onResolveMaintenance}
            onDetail={(task) => task.kind === "maintenance" ? onMaintenance?.() : null}
          />
          <RoomRevenueMiniCards rooms={normalizedRooms} />
        </aside>
      </div>
    </section>
  );
}
