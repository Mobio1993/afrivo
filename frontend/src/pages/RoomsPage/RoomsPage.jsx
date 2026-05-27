import { useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../../auth/AuthContext";
import { canPerformAction, hasPermission } from "../../auth/permissions";
import { useHousekeeping } from "../../hooks/useHousekeeping";
import { useRoomRealtime } from "../../hooks/useRoomRealtime";
import HkAgentBoard from "../../components/chambres/housekeeping/HkAgentBoard";
import HkAlertFeed from "../../components/chambres/housekeeping/HkAlertFeed";
import HkKanban from "../../components/chambres/housekeeping/HkKanban";
import HkKpiBar from "../../components/chambres/housekeeping/HkKpiBar";
import HkStats from "../../components/chambres/housekeeping/HkStats";
import HkTaskCard from "../../components/chambres/housekeeping/HkTaskCard";
import HotelViewPage from "./hotel-view/HotelViewPage";
import RtAlertFeed from "../../components/chambres/realtime/RtAlertFeed";
import RtDetailPanel from "../../components/chambres/realtime/RtDetailPanel";
import RtHeatmap from "../../components/chambres/realtime/RtHeatmap";
import RtKpiBar from "../../components/chambres/realtime/RtKpiBar";
import RtRoomTable from "../../components/chambres/realtime/RtRoomTable";
import { AppSelect } from "../../shared/components/AppSelect";
import { DatePicker } from "../../shared/components/DatePicker";
import {
  checkInRoom,
  checkOutRoom,
  completeHousekeepingTask,
  completeRoomCleaning,
  createHousekeepingTask,
  createMaintenanceIncident,
  createPricingRule,
  createRoom,
  createRoomType,
  deactivateRoom,
  deactivateRoomType,
  fetchRoomRealtimeStates,
  fetchOperationChoices,
  getRoomsDashboard,
  listAssignmentSuggestions,
  listHousekeepingTasks,
  listMaintenanceIncidents,
  listPricingRules,
  listRooms,
  listRoomTypes,
  reactivateRoom,
  resolveMaintenanceIncident,
  startHousekeepingTask,
  updateRoom,
  updateRoomType,
} from "../../services/roomsService";
import "./RoomsPage.css";
import "../../styles/housekeeping.css";
import "../../styles/room-realtime.css";

/* ─── Constants ──────────────────────────────────────────────────────────── */

const ROOM_STATUS_OPTIONS = [
  { value: "all",           label: "Tous les statuts" },
  { value: "available",     label: "Disponible"       },
  { value: "occupied",      label: "Occupée"          },
  { value: "reserved",      label: "Réservée"         },
  { value: "cleaning",      label: "Nettoyage"        },
  { value: "out_of_service", label: "Hors service"   },
];

const ROOM_ACTIVE_OPTIONS = [
  { value: "active",   label: "Actives"     },
  { value: "inactive", label: "Desactivees" },
  { value: "all",      label: "Toutes"      },
];

const TABS = [
  { key: "overview",     label: "Vue hôtel",        permissions: [["rooms", "view"], ["operations", "view"]] },
  { key: "rooms",        label: "Liste",             permissions: [["rooms", "view"]] },
  { key: "realtime",     label: "Vue temps réel",    permissions: [["rooms", "view"]] },
  { key: "types",        label: "Types de chambres", permissions: [["rooms", "manage"]] },
  { key: "housekeeping", label: "Housekeeping",      permissions: [["rooms", "view"], ["operations", "view"]] },
  { key: "maintenance",  label: "Maintenance",       permissions: [["rooms", "update"], ["operations", "update"], ["operations", "manage"]] },
  { key: "pricing",      label: "Tarification",      permissions: [["rooms", "manage"]] },
];

const REALTIME_FILTERS = [
  { value: "all",       label: "Toutes"             },
  { value: "occupied",  label: "Occupées"           },
  { value: "available", label: "Disponibles"        },
  { value: "presence",  label: "Présence détectée"  },
  { value: "door_open", label: "Porte ouverte"      },
  { value: "alerts",    label: "Alertes"            },
];

const EMPTY_ROOM_FORM = {
  number: "", room_type: "", floor: "", status: "available",
  custom_price_per_night: "", custom_price_day_use: "",
  is_vip_preferred: false, notes: "", is_active: true,
};

const EMPTY_ROOM_TYPE_FORM = {
  name: "", code: "", description: "", capacity: 1, max_adults: 1,
  max_children: 0, base_price_per_night: "", base_price_day_use: "",
  amenities: "", image_urls: "", pricing_policy_notes: "",
  is_day_use_available: true, is_active: true,
};

const EMPTY_TASK_FORM = {
  room: "", task_type: "turnover", priority: "normal",
  assigned_to: "", estimated_minutes: 30, notes: "", issue_reported: "",
};

const EMPTY_INCIDENT_FORM = {
  room: "", title: "", description: "", severity: "medium",
  marks_room_out_of_service: true, assigned_to: "",
};

const EMPTY_RULE_FORM = {
  room_type: "", name: "", applies_to: "night", rule_type: "weekend",
  adjustment_mode: "percent", adjustment_value: "", start_date: "",
  end_date: "", min_occupancy_rate: "", priority: 10, is_active: true,
};

const EMPTY_SUGGESTION_FORM = {
  guest: "", room_type: "", check_in_date: "", check_out_date: "",
};

/* ─── Shared display helpers ─────────────────────────────────────────────── */

function SummaryCard({ label, value, meta, tone = "default" }) {
  return (
    <article className={`info-card rooms-summary-card rooms-summary-card--${tone}`}>
      <strong>{label}</strong>
      <div className="metric">{value}</div>
      <p>{meta}</p>
    </article>
  );
}

function EmptyStateCard({ title, description }) {
  return (
    <article className="table-card rooms-empty-card">
      <strong>{title}</strong>
      <p>{description}</p>
    </article>
  );
}

function ReadOnlyActionNotice({ title, description }) {
  return (
    <article className="table-card rooms-empty-card">
      <strong>{title}</strong>
      <p>{description}</p>
    </article>
  );
}

function getRequestError(error, fallback) {
  if (error?.payload) {
    if (typeof error.payload.detail === "string") return error.payload.detail;
    const fieldErrors = Object.values(error.payload).flat().filter((v) => typeof v === "string");
    if (fieldErrors.length) return fieldErrors[0];
  }
  return error?.message || fallback;
}

function normalizeListInput(value) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function buildRoomTypePayload(form) {
  return {
    ...form,
    capacity:            Number(form.capacity)      || 1,
    max_adults:          Number(form.max_adults)    || 1,
    max_children:        Number(form.max_children)  || 0,
    base_price_per_night: form.base_price_per_night || 0,
    base_price_day_use:   form.base_price_day_use   || 0,
    amenities:   normalizeListInput(form.amenities),
    image_urls:  normalizeListInput(form.image_urls),
  };
}

function buildRoomPayload(form) {
  return {
    ...form,
    room_type:              Number(form.room_type),
    floor:                  form.floor === "" ? null : Number(form.floor),
    custom_price_per_night: form.custom_price_per_night || null,
    custom_price_day_use:   form.custom_price_day_use   || null,
  };
}

const REALTIME_BADGE_MAPPINGS = {
  hotelStatus: {
    available:      { label: "Disponible",           tone: "available"   },
    occupied:       { label: "Occupée",               tone: "occupied"    },
    reserved:       { label: "Réservée",              tone: "info"        },
    cleaning:       { label: "Nettoyage",             tone: "cleaning"    },
    maintenance:    { label: "Maintenance",           tone: "maintenance" },
    out_of_service: { label: "Hors service",          tone: "maintenance" },
  },
  presenceStatus: {
    detected: { label: "Présence détectée", tone: "presence" },
    none:     { label: "Aucune présence",   tone: "neutral"  },
  },
  doorStatus: {
    closed:    { label: "Fermée",                 tone: "neutral"  },
    open:      { label: "Ouverte",                tone: "warning"  },
    open_long: { label: "Ouverte trop longtemps", tone: "critical" },
  },
  acStatus: {
    on:  { label: "Allumée", tone: "info"    },
    off: { label: "Éteinte", tone: "neutral" },
  },
  lightStatus: {
    on:  { label: "Allumée", tone: "light-on" },
    off: { label: "Éteinte", tone: "neutral"  },
  },
  alertLevel: {
    none:     { label: "Aucune",    tone: "neutral"  },
    warning:  { label: "Attention", tone: "warning"  },
    critical: { label: "Critique",  tone: "critical" },
  },
  sensorStatus: {
    online:  { label: "Capteurs en ligne",   tone: "available"   },
    offline: { label: "Capteurs hors ligne", tone: "maintenance" },
  },
};

function getRealtimeBadgeMeta(type, value) {
  return REALTIME_BADGE_MAPPINGS[type]?.[value] || { label: value || "-", tone: "neutral" };
}

function sortRealtimeRooms(items) {
  const alertWeight = { critical: 0, warning: 1, none: 2 };
  return [...items].sort((a, b) => {
    const delta = (alertWeight[a.alertLevel] ?? 3) - (alertWeight[b.alertLevel] ?? 3);
    if (delta !== 0) return delta;
    return a.roomNumber.localeCompare(b.roomNumber, "fr", { numeric: true });
  });
}

/* ─── RoomCard ───────────────────────────────────────────────────────────── */

function RoomCard({
  room, onOpen,
  onCheckIn, onCheckOut, onMarkClean,
  activeRoomAction, anySubmitting,
  canOperate, isCheckInEligible,
}) {
  const typeName = room.room_type_name || room.room_type || "—";
  const submittingCheckin  = activeRoomAction?.roomId === room.id && activeRoomAction?.action === "checkin";
  const submittingCheckout = activeRoomAction?.roomId === room.id && activeRoomAction?.action === "checkout";
  const submittingClean    = activeRoomAction?.roomId === room.id && activeRoomAction?.action === "clean";

  return (
    <article
      className={`rp-room-card rp-room-card--${room.status}`}
      onClick={() => onOpen(room)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(room); } }}
      aria-label={`Chambre ${room.number} — ${room.status_label}`}
    >
      <div className="rp-room-card__header">
        <span className="rp-room-card__number">{room.number}</span>
        <span className={`rooms-status-badge rooms-status-badge--${room.status}`}>{room.status_label}</span>
      </div>

      <div className="rp-room-card__type">
        {typeName}
        {room.floor != null ? ` · Étage ${room.floor}` : ""}
      </div>

      <div className="rp-room-card__occupant">
        {room.occupant
          ? <span className="rp-room-card__occupant-name">{room.occupant}</span>
          : <span className="rp-room-card__vacant">Libre</span>
        }
      </div>

      <div className="rp-room-card__stats">
        <span className={`rp-stat ${(room.housekeeping_open ?? 0) > 0 ? "rp-stat--warn" : ""}`}
          title="Tâches housekeeping">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          </svg>
          {room.housekeeping_open ?? 0}
        </span>
        <span className={`rp-stat ${(room.incidents_open ?? 0) > 0 ? "rp-stat--danger" : ""}`}
          title="Incidents techniques">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {room.incidents_open ?? 0}
        </span>
        {room.revenue_total ? (
          <span className="rp-stat rp-stat--revenue" title="CA total">{room.revenue_total}</span>
        ) : null}
      </div>

      {canOperate ? (
        <div
          className="rp-room-card__actions"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="toolbar"
          aria-label={`Actions chambre ${room.number}`}
        >
          {isCheckInEligible(room) ? (
            <button
              type="button"
              className="rp-action-btn rp-action-btn--checkin"
              disabled={submittingCheckin || submittingCheckout || submittingClean}
              onClick={() => onCheckIn(room)}
            >
              {submittingCheckin ? "…" : "Check-in"}
            </button>
          ) : null}
          {room.status === "occupied" ? (
            <button
              type="button"
              className="rp-action-btn rp-action-btn--checkout"
              disabled={submittingCheckin || submittingCheckout || submittingClean}
              onClick={() => onCheckOut(room)}
            >
              {submittingCheckout ? "…" : "Check-out"}
            </button>
          ) : null}
          {room.status === "cleaning" ? (
            <button
              type="button"
              className="rp-action-btn rp-action-btn--clean"
              disabled={submittingCheckin || submittingCheckout || submittingClean}
              onClick={() => onMarkClean(room)}
            >
              {submittingClean ? "…" : "Propre ✓"}
            </button>
          ) : null}
          <button
            type="button"
            className="rp-action-btn rp-action-btn--detail"
            onClick={() => onOpen(room)}
            aria-label="Voir le détail"
          >
            ···
          </button>
        </div>
      ) : null}
    </article>
  );
}

/* ─── RoomsGrid ──────────────────────────────────────────────────────────── */

function RoomsGrid({ rooms, ...cardProps }) {
  if (!rooms.length) {
    return (
      <EmptyStateCard
        title="Aucune chambre configurée"
        description="Crée les premiers types de chambres puis ajoute des chambres depuis l'onglet correspondant."
      />
    );
  }
  return (
    <div className="rp-rooms-grid">
      {rooms.map((room) => (
        <RoomCard key={room.id} room={room} {...cardProps} />
      ))}
    </div>
  );
}

/* ─── RoomsFilters ───────────────────────────────────────────────────────── */

function RoomsFilters({ search, onSearch, statusFilter, onStatus, activeFilter, onActiveFilter }) {
  return (
    <div className="rp-filters">
      <div className="rp-filters__search-wrap">
        <svg className="rp-filters__icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Numéro, type de chambre…"
          className="rp-filters__input"
          aria-label="Rechercher une chambre"
        />
      </div>
      <div className="rp-filters__chips">
        {ROOM_STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`rooms-chip ${statusFilter === opt.value ? "active" : ""}`}
            onClick={() => onStatus(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="rp-filters__chips rp-filters__chips--active">
        {ROOM_ACTIVE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`rooms-chip rooms-chip--inventory ${activeFilter === opt.value ? "active" : ""}`}
            onClick={() => onActiveFilter(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── RoomsTable ─────────────────────────────────────────────────────────── */

function RoomsTable({ rooms, onSelectRoom }) {
  const [sortField, setSortField] = useState("number");
  const [sortDir,   setSortDir]   = useState("asc");

  function toggleSort(field) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    return [...rooms].sort((a, b) => {
      let av = a[sortField] ?? "";
      let bv = b[sortField] ?? "";
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ?  1 : -1;
      return 0;
    });
  }, [rooms, sortField, sortDir]);

  function Th({ field, children, noSort = false }) {
    const active = sortField === field;
    if (noSort) return <th className="rp-th">{children}</th>;
    return (
      <th
        className={`rp-th rp-th--sortable ${active ? "rp-th--active" : ""}`}
        onClick={() => toggleSort(field)}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        {children}
        <span className="rp-sort-icon">{active ? (sortDir === "asc" ? " ↑" : " ↓") : " ⇅"}</span>
      </th>
    );
  }

  if (!rooms.length) {
    return (
      <EmptyStateCard
        title="Aucune chambre"
        description="Aucune chambre ne correspond aux critères de recherche."
      />
    );
  }

  return (
    <div className="rp-table-shell">
      <div className="rp-table-scroll">
        <table className="rp-table">
          <thead>
            <tr>
              <Th field="number">Numéro</Th>
              <Th field="room_type_name">Type</Th>
              <Th field="floor">Étage</Th>
              <Th field="status">Statut</Th>
              <Th field="is_vip_preferred" noSort>VIP</Th>
              <Th field="room_code" noSort>Code</Th>
              <th className="rp-th rp-th--actions"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((room) => (
              <tr
                key={room.id}
                className="rp-table-row"
                onClick={() => onSelectRoom(room)}
                tabIndex={0}
                role="button"
                aria-label={`Ouvrir détail chambre ${room.number}`}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectRoom(room); } }}
              >
                <td className="rp-td--number">
                  <span className={`rp-status-dot rp-status-dot--${room.status}`} aria-hidden="true" />
                  <strong>{room.number}</strong>
                </td>
                <td>{room.room_type_name || "—"}</td>
                <td>{room.floor ?? "—"}</td>
                <td>
                  <div className="rooms-status-stack">
                    <span className={`rooms-status-badge rooms-status-badge--${room.status}`}>
                      {room.status_label}
                    </span>
                    {!room.is_active ? (
                      <span className="rooms-status-badge rooms-status-badge--inactive">Desactivee</span>
                    ) : null}
                  </div>
                </td>
                <td className="rp-td--center">{room.is_vip_preferred ? "⭐" : "—"}</td>
                <td className="rp-td--code">{room.room_code || "—"}</td>
                <td className="rp-td--action">
                  <button
                    type="button"
                    className="rp-detail-btn"
                    onClick={(e) => { e.stopPropagation(); onSelectRoom(room); }}
                    aria-label={`Détail chambre ${room.number}`}
                  >
                    Détail →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── RoomDrawer ─────────────────────────────────────────────────────────── */

function RoomDrawer({
  open, room, roomForm, setRoomForm,
  onClose, onSubmit,
  onCheckIn, onCheckOut, onMarkClean, onDeactivate, onReactivate,
  canManage, canOperate, roomTypes,
  canCheckIn = false, canCheckOut = false, canMarkClean = false,
  submittingRoom, activeRoomAction, anySubmitting,
  isCheckInEligible,
}) {
  const submittingCheckin  = activeRoomAction?.roomId === room?.id && activeRoomAction?.action === "checkin";
  const submittingCheckout = activeRoomAction?.roomId === room?.id && activeRoomAction?.action === "checkout";
  const submittingClean    = activeRoomAction?.roomId === room?.id && activeRoomAction?.action === "clean";
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open || !room) return null;

  const typeName  = room.room_type_name || room.room_type || "—";
  const hasCheckin  = isCheckInEligible(room);
  const hasCheckout = room.status === "occupied";
  const hasClean    = room.status === "cleaning";

  return (
    <>
      <div className="rp-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside
        className="rp-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Détail chambre ${room.number}`}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="rp-drawer-header">
          <div className="rp-drawer-title">
            <span className="rp-drawer-room-num">Ch. {room.number}</span>
            <span className={`rooms-status-badge rooms-status-badge--${room.status}`}>
              {room.status_label}
            </span>
            {!room.is_active ? (
              <span className="rooms-status-badge rooms-status-badge--inactive">Desactivee</span>
            ) : null}
          </div>
          <button
            type="button"
            className="ghost-button rp-drawer-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="18" height="18">
              <line x1="18" y1="6"  x2="6"  y2="18" />
              <line x1="6"  y1="6"  x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="rp-drawer-body">

          {/* ── Info rapide ─────────────────────────────────── */}
          <div className="rp-drawer-info-grid">
            <div className="rp-info-cell">
              <span className="rp-info-label">Type</span>
              <span className="rp-info-value">{typeName}</span>
            </div>
            <div className="rp-info-cell">
              <span className="rp-info-label">Étage</span>
              <span className="rp-info-value">{room.floor ?? "—"}</span>
            </div>
            <div className="rp-info-cell">
              <span className="rp-info-label">Code</span>
              <span className="rp-info-value">{room.room_code || "—"}</span>
            </div>
            <div className="rp-info-cell">
              <span className="rp-info-label">VIP</span>
              <span className="rp-info-value">{room.is_vip_preferred ? "Oui ⭐" : "Non"}</span>
            </div>
            {room.occupant ? (
              <div className="rp-info-cell rp-info-cell--full">
                <span className="rp-info-label">Occupant actuel</span>
                <span className="rp-info-value rp-info-value--occupant">{room.occupant}</span>
              </div>
            ) : null}
            {(room.housekeeping_open > 0 || room.incidents_open > 0) ? (
              <div className="rp-info-cell rp-info-cell--full">
                <div className="rp-drawer-counters">
                  {room.housekeeping_open > 0 ? (
                    <span className="rp-drawer-counter rp-drawer-counter--warn">
                      {room.housekeeping_open} tâche{room.housekeeping_open > 1 ? "s" : ""} housekeeping
                    </span>
                  ) : null}
                  {room.incidents_open > 0 ? (
                    <span className="rp-drawer-counter rp-drawer-counter--danger">
                      {room.incidents_open} incident{room.incidents_open > 1 ? "s" : ""} technique{room.incidents_open > 1 ? "s" : ""}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
            {room.notes ? (
              <div className="rp-info-cell rp-info-cell--full">
                <span className="rp-info-label">Notes internes</span>
                <span className="rp-info-value rp-info-value--notes">{room.notes}</span>
              </div>
            ) : null}
          </div>

          {/* ── Actions rapides ──────────────────────────────── */}
          {room.is_active && canOperate && ((canCheckIn && hasCheckin) || (canCheckOut && hasCheckout) || (canMarkClean && hasClean)) ? (
            <div className="rp-drawer-section">
              <h4 className="rp-drawer-section-title">Actions rapides</h4>
              <div className="rp-drawer-action-row">
                {canCheckIn && hasCheckin ? (
                  <button
                    type="button"
                    className="primary-button rp-drawer-action-btn"
                    disabled={submittingCheckin || submittingCheckout || submittingClean}
                    onClick={() => { onCheckIn(room); }}
                  >
                    {submittingCheckin ? "Check-in…" : "✓ Check-in"}
                  </button>
                ) : null}
                {canCheckOut && hasCheckout ? (
                  <button
                    type="button"
                    className="secondary-button rp-drawer-action-btn"
                    disabled={submittingCheckin || submittingCheckout || submittingClean}
                    onClick={() => { onCheckOut(room); }}
                  >
                    {submittingCheckout ? "Check-out…" : "Check-out"}
                  </button>
                ) : null}
                {canMarkClean && hasClean ? (
                  <button
                    type="button"
                    className="secondary-button rp-drawer-action-btn"
                    disabled={submittingCheckin || submittingCheckout || submittingClean}
                    onClick={() => { onMarkClean(room); }}
                  >
                    {submittingClean ? "Nettoyage…" : "Marquer propre ✓"}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* ── Formulaire de modification ───────────────────── */}
          {canManage ? (
            <div className="rp-drawer-section">
              <h4 className="rp-drawer-section-title">Modifier la chambre</h4>
              <form onSubmit={onSubmit} className="rp-drawer-form">
                <div className="rp-drawer-form-grid">
                  <label className="rooms-field">
                    <span>Numéro</span>
                    <input
                      value={roomForm.number}
                      onChange={(e) => setRoomForm((c) => ({ ...c, number: e.target.value }))}
                      disabled={submittingRoom}
                    />
                  </label>
                  <label className="rooms-field">
                    <span>Étage</span>
                    <input
                      type="number"
                      value={roomForm.floor}
                      onChange={(e) => setRoomForm((c) => ({ ...c, floor: e.target.value }))}
                      disabled={submittingRoom}
                    />
                  </label>
                  <label className="rooms-field">
                    <span>Type</span>
                    <AppSelect
                      value={roomForm.room_type}
                      onChange={(e) => setRoomForm((c) => ({ ...c, room_type: e.target.value }))}
                      name="drawer_room_type"
                      disabled={submittingRoom}
                    >
                      <option value="">Choisir un type</option>
                      {roomTypes.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </AppSelect>
                  </label>
                  <label className="rooms-field">
                    <span>Statut</span>
                    <AppSelect
                      value={roomForm.status}
                      onChange={(e) => setRoomForm((c) => ({ ...c, status: e.target.value }))}
                      name="drawer_room_status"
                      disabled={submittingRoom}
                    >
                      {ROOM_STATUS_OPTIONS.filter((o) => o.value !== "all").map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </AppSelect>
                  </label>
                  <label className="rooms-field">
                    <span>Tarif nuit</span>
                    <input
                      type="number"
                      step="0.01"
                      value={roomForm.custom_price_per_night}
                      onChange={(e) => setRoomForm((c) => ({ ...c, custom_price_per_night: e.target.value }))}
                      disabled={submittingRoom}
                    />
                  </label>
                  <label className="rooms-field">
                    <span>Tarif day use</span>
                    <input
                      type="number"
                      step="0.01"
                      value={roomForm.custom_price_day_use}
                      onChange={(e) => setRoomForm((c) => ({ ...c, custom_price_day_use: e.target.value }))}
                      disabled={submittingRoom}
                    />
                  </label>
                  <label className="rooms-field rooms-field--checkbox">
                    <input
                      type="checkbox"
                      checked={roomForm.is_vip_preferred}
                      onChange={(e) => setRoomForm((c) => ({ ...c, is_vip_preferred: e.target.checked }))}
                      disabled={submittingRoom}
                    />
                    <span>Prioritaire VIP</span>
                  </label>
                  <label className="rooms-field rooms-field--full">
                    <span>Notes internes</span>
                    <textarea
                      rows={3}
                      value={roomForm.notes}
                      onChange={(e) => setRoomForm((c) => ({ ...c, notes: e.target.value }))}
                      disabled={submittingRoom}
                    />
                  </label>
                </div>
                <div className="rp-drawer-form-actions">
                  <button type="submit" className="primary-button" disabled={submittingRoom || !room.is_active}>
                    {submittingRoom ? "Enregistrement…" : "Mettre à jour"}
                  </button>
                  <button
                    type="button"
                    className="secondary-button danger"
                    disabled={submittingRoom || !room.is_active}
                    onClick={() => onDeactivate(room)}
                  >
                    Désactiver
                  </button>
                  {!room.is_active ? (
                    <button
                      type="button"
                      className="primary-button"
                      disabled={submittingRoom}
                      onClick={() => onReactivate(room)}
                    >
                      {submittingRoom ? "Reactivation..." : "Reactiver la chambre"}
                    </button>
                  ) : null}
                </div>
              </form>
            </div>
          ) : !canOperate ? (
            <ReadOnlyActionNotice
              title="Consultation uniquement"
              description="Votre profil peut consulter les fiches chambres, mais la modification est réservée aux gestionnaires."
            />
          ) : null}

        </div>
      </aside>
    </>
  );
}

/* ─── RoomsPage ──────────────────────────────────────────────────────────── */

export function RoomsPage() {
  const { user } = useAuth();
  const housekeepingDashboard = useHousekeeping();
  const roomRealtime = useRoomRealtime();

  /* ── State ─────────────────────────────────────────────────────── */
  const [activeTab,      setActiveTab]      = useState("overview");
  const [dashboard,      setDashboard]      = useState(null);
  const [rooms,          setRooms]          = useState([]);
  const [roomTypes,      setRoomTypes]      = useState([]);
  const [tasks,          setTasks]          = useState([]);
  const [incidents,      setIncidents]      = useState([]);
  const [pricingRules,   setPricingRules]   = useState([]);
  const [realtimeRooms,  setRealtimeRooms]  = useState([]);
  const [choices,        setChoices]        = useState(null);
  const [suggestions,    setSuggestions]    = useState([]);

  const [loading,  setLoading]  = useState(true);
  const [fetching, setFetching] = useState(false);

  /* Filters (client-side) */
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("active");

  /* Realtime filters */
  const [realtimeSearch, setRealtimeSearch] = useState("");
  const [realtimeFilter, setRealtimeFilter] = useState("all");
  const [housekeepingViewMode, setHousekeepingViewMode] = useState("kanban");

  /* Selection */
  const [selectedRoomId,        setSelectedRoomId]        = useState(null);
  const [selectedTypeId,        setSelectedTypeId]        = useState(null);
  const [selectedRealtimeRoomId, setSelectedRealtimeRoomId] = useState(null);

  /* Drawer */
  const [drawerOpen, setDrawerOpen] = useState(false);

  /* Form state */
  const [roomForm,       setRoomForm]       = useState(EMPTY_ROOM_FORM);
  const [roomTypeForm,   setRoomTypeForm]   = useState(EMPTY_ROOM_TYPE_FORM);
  const [taskForm,       setTaskForm]       = useState(EMPTY_TASK_FORM);
  const [incidentForm,   setIncidentForm]   = useState(EMPTY_INCIDENT_FORM);
  const [ruleForm,       setRuleForm]       = useState(EMPTY_RULE_FORM);
  const [suggestionForm, setSuggestionForm] = useState(EMPTY_SUGGESTION_FORM);

  /* Inline resolution state */
  const [resolvingIncidentId, setResolvingIncidentId] = useState(null);
  const [resolveNotes,        setResolveNotes]        = useState("");

  /* Creation form visibility */
  const [showCreateRoomForm, setShowCreateRoomForm] = useState(false);

  /* Submitting guards */
  const [activeRoomAction,      setActiveRoomAction]      = useState(null); // { roomId, action }
  const [submittingRoom,        setSubmittingRoom]        = useState(false);
  const [submittingType,        setSubmittingType]        = useState(false);
  const [submittingTask,        setSubmittingTask]        = useState(false);
  const [submittingIncident,    setSubmittingIncident]    = useState(false);
  const [submittingRule,        setSubmittingRule]        = useState(false);
  const [submittingSuggestions, setSubmittingSuggestions] = useState(false);

  const anySubmitting = activeRoomAction !== null || submittingRoom ||
    submittingType || submittingTask ||
    submittingIncident || submittingRule || submittingSuggestions;

  /* Notifications */
  const [errorMsg,   setErrorMsg]   = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const errorTimerRef   = useRef(null);
  const successTimerRef = useRef(null);
  const abortRef        = useRef(null);

  /* ── Permissions ──────────────────────────────────────────────── */
  const visibleTabs = useMemo(
    () => TABS.filter((tab) =>
      tab.permissions.some(([module, action]) => hasPermission(user, module, action))
    ),
    [user],
  );
  const allowedTabKeys  = useMemo(() => new Set(visibleTabs.map((t) => t.key)), [visibleTabs]);
  const defaultTabKey   = visibleTabs[0]?.key || "overview";
  const canAccessTab    = (tabKey) => allowedTabKeys.has(tabKey);
  const canManageInventory = hasPermission(user, "rooms", "manage");
  const canCheckInRooms = canPerformAction(user, "operations.check_in");
  const canCheckOutRooms = canPerformAction(user, "operations.check_out");
  const canMarkCleanRooms = canPerformAction(user, "rooms.cleaning_complete");
  const canStartHousekeeping = canPerformAction(user, "housekeeping.start");
  const canCompleteHousekeeping = canPerformAction(user, "housekeeping.complete") || canMarkCleanRooms;
  const canAssignHousekeeping = canPerformAction(user, "housekeeping.assign");
  const canReportHousekeepingProblem = canPerformAction(user, "housekeeping.report_problem");
  const canCreateMaintenance = canPerformAction(user, "maintenance.create");
  const canResolveMaintenance = canPerformAction(user, "maintenance.resolve");
  const canOperateRooms    =
    canCheckInRooms ||
    canCheckOutRooms ||
    canMarkCleanRooms ||
    canStartHousekeeping ||
    canCompleteHousekeeping ||
    canAssignHousekeeping ||
    canReportHousekeepingProblem ||
    canCreateMaintenance ||
    canResolveMaintenance;
  const roomAgents = choices?.room_agents || choices?.supervisor_users || [];

  /* ── Data loading ─────────────────────────────────────────────── */
  async function loadData() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setFetching(true);

    try {
      const [
        dashboardPayload, roomsPayload, roomTypesPayload,
        tasksPayload, incidentsPayload, pricingPayload,
        choicesPayload, realtimePayload,
      ] = await Promise.all([
        getRoomsDashboard(controller.signal),
        listRooms({}, controller.signal),
        listRoomTypes({ is_active: "true" }, controller.signal),
        listHousekeepingTasks({}, controller.signal),
        listMaintenanceIncidents({}, controller.signal),
        listPricingRules({}, controller.signal),
        fetchOperationChoices(controller.signal),
        fetchRoomRealtimeStates(controller.signal),
      ]);

      setDashboard(dashboardPayload);
      setRooms(Array.isArray(roomsPayload) ? roomsPayload : roomsPayload.results || []);
      setRoomTypes(Array.isArray(roomTypesPayload) ? roomTypesPayload : roomTypesPayload.results || []);
      setTasks(Array.isArray(tasksPayload) ? tasksPayload : tasksPayload.results || []);
      setIncidents(Array.isArray(incidentsPayload) ? incidentsPayload : incidentsPayload.results || []);
      setPricingRules(Array.isArray(pricingPayload) ? pricingPayload : pricingPayload.results || []);
      setChoices(choicesPayload);
      setRealtimeRooms(sortRealtimeRooms(realtimePayload.results || []));
    } catch (err) {
      if (err.name === "AbortError") return;
      throw err;
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    loadData()
      .catch((err) => {
        if (err.name === "AbortError") return;
        showError(getRequestError(err, "Impossible de charger le module chambres."));
      })
      .finally(() => setLoading(false));

    return () => {
      clearTimeout(errorTimerRef.current);
      clearTimeout(successTimerRef.current);
      abortRef.current?.abort();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Tab guard ────────────────────────────────────────────────── */
  useEffect(() => {
    if (!allowedTabKeys.has(activeTab)) setActiveTab(defaultTabKey);
  }, [activeTab, allowedTabKeys, defaultTabKey]);

  /* ── Notifications ────────────────────────────────────────────── */
  function showError(msg) {
    clearTimeout(errorTimerRef.current);
    setErrorMsg(msg);
    errorTimerRef.current = window.setTimeout(() => setErrorMsg(""), 4000);
  }

  function showSuccess(msg) {
    clearTimeout(successTimerRef.current);
    setSuccessMsg(msg);
    successTimerRef.current = window.setTimeout(() => setSuccessMsg(""), 4000);
  }

  /* ── Derived state ────────────────────────────────────────────── */
  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) || null,
    [rooms, selectedRoomId],
  );
  const selectedRoomType = useMemo(
    () => roomTypes.find((r) => r.id === selectedTypeId) || null,
    [roomTypes, selectedTypeId],
  );
  const activeRooms = useMemo(
    () => rooms.filter((room) => room.is_active),
    [rooms],
  );

  /* Client-side filtering for the "Liste" table */
  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rooms.filter((room) => {
      if (q) {
        const haystack = [room.number, room.room_type_name, room.room_code]
          .filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (statusFilter !== "all" && room.status !== statusFilter) return false;
      if (activeFilter === "active" && !room.is_active) return false;
      if (activeFilter === "inactive" && room.is_active) return false;
      return true;
    });
  }, [activeFilter, rooms, search, statusFilter]);

  const filteredRealtimeRooms = useMemo(() => {
    const query = realtimeSearch.trim().toLowerCase();
    return sortRealtimeRooms(
      realtimeRooms.filter((room) => {
        const matchesQuery = !query || [
          room.roomNumber, room.roomType, room.floor,
          getRealtimeBadgeMeta("hotelStatus", room.hotelStatus).label,
          room.alertMessage,
        ].join(" ").toLowerCase().includes(query);

        const matchesFilter = (() => {
          switch (realtimeFilter) {
            case "occupied":  return room.hotelStatus === "occupied";
            case "available": return room.hotelStatus === "available";
            case "presence":  return room.presenceStatus === "detected";
            case "door_open": return room.doorStatus === "open" || room.doorStatus === "open_long";
            case "alerts":    return room.alertLevel !== "none";
            default:          return true;
          }
        })();

        return matchesQuery && matchesFilter;
      }),
    );
  }, [realtimeFilter, realtimeRooms, realtimeSearch]);

  const selectedRealtimeRoom = useMemo(
    () =>
      filteredRealtimeRooms.find((r) => r.id === selectedRealtimeRoomId) ||
      realtimeRooms.find((r) => r.id === selectedRealtimeRoomId) ||
      filteredRealtimeRooms[0] || null,
    [filteredRealtimeRooms, realtimeRooms, selectedRealtimeRoomId],
  );

  useEffect(() => {
    if (!selectedRealtimeRoomId && filteredRealtimeRooms.length) {
      setSelectedRealtimeRoomId(filteredRealtimeRooms[0].id);
      return;
    }
    if (selectedRealtimeRoomId && !filteredRealtimeRooms.some((r) => r.id === selectedRealtimeRoomId)) {
      setSelectedRealtimeRoomId(filteredRealtimeRooms[0]?.id || null);
    }
  }, [filteredRealtimeRooms, selectedRealtimeRoomId]);

  const realtimeSummaryCards = useMemo(() => {
    const total             = realtimeRooms.length;
    const presenceDetected  = realtimeRooms.filter((r) => r.presenceStatus === "detected").length;
    const doorsOpen         = realtimeRooms.filter((r) => r.doorStatus === "open" || r.doorStatus === "open_long").length;
    const activeAlerts      = realtimeRooms.filter((r) => r.alertLevel !== "none").length;
    const offlineSensors    = realtimeRooms.filter((r) => r.sensorStatus === "offline").length;
    return [
      { label: "Chambres supervisées", value: total,            meta: "Inventaire temps réel.",                       tone: "default"   },
      { label: "Présence détectée",    value: presenceDetected, meta: "Pièces actuellement occupées ou animées.",      tone: "available" },
      { label: "Portes ouvertes",      value: doorsOpen,        meta: "Ouvertures à vérifier en priorité réception.", tone: "cleaning"  },
      { label: "Alertes actives",      value: activeAlerts,     meta: "Anomalies à traiter rapidement.",               tone: "blocked"   },
      { label: "Capteurs hors ligne",  value: offlineSensors,   meta: "Équipements à reconnecter.",                   tone: "occupied"  },
    ];
  }, [realtimeRooms]);

  const summaryCards = useMemo(() => {
    const s = dashboard?.summary || {};
    return [
      { label: "Disponibles",  value: s.available_count    || 0, meta: "Chambres remises en vente immédiatement.", tone: "available" },
      { label: "Occupées",     value: s.occupied_count     || 0, meta: "Séjours ou day use en cours.",             tone: "occupied"  },
      { label: "Nettoyage",    value: s.cleaning_count     || 0, meta: "Priorités housekeeping à traiter.",        tone: "cleaning"  },
      { label: "Hors service", value: s.out_of_service_count || 0, meta: "Incidents techniques bloquants.",        tone: "blocked"   },
    ];
  }, [dashboard]);

  /* ── Helpers ──────────────────────────────────────────────────── */
  function buildRoomFormFromRoom(room) {
    return {
      number:                room.number                                    || "",
      room_type:             String(room.room_type || room.room_type_id || ""),
      floor:                 room.floor === "-" || room.floor === null ? "" : room.floor,
      status:                room.status                                    || "available",
      custom_price_per_night: room.custom_price_per_night                  || "",
      custom_price_day_use:   room.custom_price_day_use                    || "",
      is_vip_preferred:       room.is_vip_preferred                        || false,
      notes:                  room.notes                                   || "",
      is_active:              room.is_active ?? true,
    };
  }

  function isCheckInEligible(room) {
    return false;
  }

  function handleSelectRoom(room) {
    setSelectedRoomId(room.id);
    setRoomForm(buildRoomFormFromRoom(room));
  }

  function handleSelectType(item) {
    setSelectedTypeId(item.id);
    setRoomTypeForm({
      name:                 item.name                   || "",
      code:                 item.code                   || "",
      description:          item.description            || "",
      capacity:             item.capacity               || 1,
      max_adults:           item.max_adults             || 1,
      max_children:         item.max_children           || 0,
      base_price_per_night: item.base_price_per_night   || "",
      base_price_day_use:   item.base_price_day_use     || "",
      amenities:            (item.amenities || []).join(", "),
      image_urls:           (item.image_urls || []).join(", "),
      pricing_policy_notes: item.pricing_policy_notes   || "",
      is_day_use_available: item.is_day_use_available   ?? true,
      is_active:            item.is_active              ?? true,
    });
  }

  /* ── Drawer ───────────────────────────────────────────────────── */
  function openDrawer(room) {
    const fullRoom = rooms.find((r) => r.id === room.id) || room;
    handleSelectRoom(fullRoom);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  /* ── Generic action runner ────────────────────────────────────── */
  async function runAction(task, successMessage, setSubmittingFn, onSuccess) {
    setSubmittingFn(true);
    try {
      await task();
      await loadData();
      showSuccess(successMessage);
      onSuccess?.();
    } catch (error) {
      if (error.name === "AbortError") return;
      showError(getRequestError(error, "Action impossible."));
    } finally {
      setSubmittingFn(false);
    }
  }

  /* ── Room actions ─────────────────────────────────────────────── */
  async function handleCheckIn(room) {
    if (!canCheckInRooms || activeRoomAction) return;
    setActiveRoomAction({ roomId: room.id, action: "checkin" });
    try {
      const updated = await checkInRoom(room.id);
      await loadData();
      if (selectedRoomId === room.id && updated) setRoomForm(buildRoomFormFromRoom(updated));
      showSuccess(`Check-in effectué pour la chambre ${room.number}.`);
    } catch (error) {
      if (error.name !== "AbortError") showError(getRequestError(error, "Impossible d'effectuer le check-in."));
    } finally {
      setActiveRoomAction(null);
    }
  }

  async function handleCheckOut(room) {
    if (!canCheckOutRooms || activeRoomAction) return;
    setActiveRoomAction({ roomId: room.id, action: "checkout" });
    try {
      const updated = await checkOutRoom(room.id);
      await loadData();
      if (selectedRoomId === room.id && updated) setRoomForm(buildRoomFormFromRoom(updated));
      showSuccess(`Check-out effectué pour la chambre ${room.number}.`);
    } catch (error) {
      if (error.name !== "AbortError") showError(getRequestError(error, "Impossible d'effectuer le check-out."));
    } finally {
      setActiveRoomAction(null);
    }
  }

  async function handleMarkClean(room) {
    if (!canMarkCleanRooms || activeRoomAction) return;
    setActiveRoomAction({ roomId: room.id, action: "clean" });
    try {
      await completeRoomCleaning(room.id);
      await loadData();
      showSuccess(`Nettoyage terminé pour la chambre ${room.number}.`);
    } catch (error) {
      if (error.name !== "AbortError") showError(getRequestError(error, "Action impossible."));
    } finally {
      setActiveRoomAction(null);
    }
  }

  function handleDeactivateFromDrawer(room) {
    return runAction(
      () => deactivateRoom(room.id),
      "Chambre désactivée.",
      setSubmittingRoom,
      () => {
        setActiveFilter("inactive");
        setSelectedRoomId(room.id);
      },
    );
  }

  /* ── Form submit handlers ─────────────────────────────────────── */
  function handleReactivateFromDrawer(room) {
    return runAction(
      () => reactivateRoom(room.id),
      "Chambre reactivee.",
      setSubmittingRoom,
      () => {
        setActiveFilter("active");
        setSelectedRoomId(room.id);
      },
    );
  }

  async function handleRoomSubmit(event) {
    event.preventDefault();
    if (!canManageInventory) return;
    const payload = buildRoomPayload(roomForm);
    await runAction(
      () => (selectedRoom ? updateRoom(selectedRoom.id, payload) : createRoom(payload)),
      selectedRoom ? "Chambre mise à jour." : "Chambre créée avec succès.",
      setSubmittingRoom,
      () => {
        if (!selectedRoom) {
          setRoomForm(EMPTY_ROOM_FORM);
          setShowCreateRoomForm(false);
        }
      },
    );
  }

  async function handleRoomTypeSubmit(event) {
    event.preventDefault();
    if (!canManageInventory) return;
    const payload = buildRoomTypePayload(roomTypeForm);
    await runAction(
      () => (selectedRoomType ? updateRoomType(selectedRoomType.id, payload) : createRoomType(payload)),
      selectedRoomType ? "Type de chambre mis à jour." : "Type de chambre créé avec succès.",
      setSubmittingType,
      () => { if (!selectedRoomType) setRoomTypeForm(EMPTY_ROOM_TYPE_FORM); },
    );
  }

  async function handleTaskSubmit(event) {
    event.preventDefault();
    if (!canAssignHousekeeping) return;
    await runAction(() => createHousekeepingTask(taskForm), "Tâche housekeeping créée.", setSubmittingTask);
    setTaskForm(EMPTY_TASK_FORM);
  }

  async function handleIncidentSubmit(event) {
    event.preventDefault();
    if (!canCreateMaintenance) return;
    await runAction(() => createMaintenanceIncident(incidentForm), "Incident technique enregistré.", setSubmittingIncident);
    setIncidentForm(EMPTY_INCIDENT_FORM);
  }

  async function handleRuleSubmit(event) {
    event.preventDefault();
    if (!canManageInventory) return;
    await runAction(() => createPricingRule(ruleForm), "Règle tarifaire enregistrée.", setSubmittingRule);
    setRuleForm(EMPTY_RULE_FORM);
  }

  async function handleSuggestions(event) {
    event.preventDefault();
    setSubmittingSuggestions(true);
    try {
      const payload = await listAssignmentSuggestions(suggestionForm);
      setSuggestions(payload.results || []);
    } catch (error) {
      if (error.name !== "AbortError") showError(getRequestError(error, "Impossible de calculer les suggestions."));
    } finally {
      setSubmittingSuggestions(false);
    }
  }

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div className="page-stack rooms-page">

      {/* ── Status banners ───────────────────────────────────── */}
      {loading          ? <div className="status-box"  role="status"  aria-live="polite">Chargement du module chambres…</div>    : null}
      {fetching && !loading ? <div className="status-box" role="status" aria-live="polite">Actualisation…</div>                  : null}
      {errorMsg         ? <div className="alert-box"   role="alert"   aria-live="assertive">{errorMsg}</div>                      : null}
      {successMsg       ? <div className="success-box" role="status"  aria-live="polite" aria-atomic="true">{successMsg}</div>    : null}

      {/* ── Summary cards ────────────────────────────────────── */}
      <section className="rooms-summary-grid">
        {summaryCards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </section>

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <section className="list-panel dashboard-panel rooms-tabs-panel">
        <div className="report-tabs" role="tablist">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`report-tab-button ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
              role="tab"
              aria-selected={activeTab === tab.key}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {!visibleTabs.length ? (
        <EmptyStateCard
          title="Aucun onglet chambres autorisé"
          description="Ce compte ne dispose d'aucun accès au module Chambres. Contacte un administrateur AFRIVO."
        />
      ) : null}

      {/* ═══════════════════════════════════════════════════════
          TAB: VUE HÔTEL
      ═══════════════════════════════════════════════════════ */}
      {canAccessTab("overview") && activeTab === "overview" ? (
        <HotelViewPage
          dashboard={dashboard}
          rooms={rooms}
          roomTypes={roomTypes}
          choices={choices}
          suggestions={suggestions}
          submittingSuggestions={submittingSuggestions}
          canOperateRooms={canOperateRooms}
          canCheckInRooms={canCheckInRooms}
          canCheckOutRooms={canCheckOutRooms}
          canMarkCleanRooms={canMarkCleanRooms}
          canCreateMaintenance={canCreateMaintenance}
          canStartHousekeeping={canStartHousekeeping}
          canAssignHousekeeping={canAssignHousekeeping}
          canCompleteHousekeeping={canCompleteHousekeeping}
          canResolveMaintenance={canResolveMaintenance}
          activeRoomAction={activeRoomAction}
          suggestionForm={suggestionForm}
          setSuggestionForm={setSuggestionForm}
          onSuggestionSubmit={handleSuggestions}
          onOpenRoom={openDrawer}
          onCheckIn={handleCheckIn}
          onCheckOut={handleCheckOut}
          onMarkClean={handleMarkClean}
          onMaintenance={() => setActiveTab("maintenance")}
          onStartHousekeeping={(task) => runAction(
            () => startHousekeepingTask(task.id),
            "Tache demarree.",
            setSubmittingTask,
          )}
          onCompleteHousekeeping={(task) => runAction(
            () => completeHousekeepingTask(task.id),
            "Tache terminee.",
            setSubmittingTask,
          )}
          onAssignHousekeeping={() => setActiveTab("housekeeping")}
          onResolveMaintenance={(incident) => runAction(
            () => resolveMaintenanceIncident(incident.id, { resolution_notes: "Resolution depuis la vue hotel." }),
            "Incident resolu.",
            setSubmittingIncident,
          )}
        />
      ) : null}

      {/* ═══════════════════════════════════════════════════════
          TAB: LISTE (table + drawer)
      ═══════════════════════════════════════════════════════ */}
      {canAccessTab("rooms") && activeTab === "rooms" ? (
        <section className="rp-list-section">

          {/* Filters */}
          <RoomsFilters
            search={search}
            onSearch={setSearch}
            statusFilter={statusFilter}
            onStatus={setStatusFilter}
            activeFilter={activeFilter}
            onActiveFilter={setActiveFilter}
          />

          {/* Table */}
          <RoomsTable rooms={filteredRooms} onSelectRoom={openDrawer} />

          {/* Create new room */}
          {canManageInventory ? (
            <div className="rp-create-panel">
              <button
                type="button"
                className={`rp-create-toggle ${showCreateRoomForm ? "rp-create-toggle--open" : ""}`}
                onClick={() => {
                  setShowCreateRoomForm((v) => !v);
                  setSelectedRoomId(null);
                  setRoomForm(EMPTY_ROOM_FORM);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  {showCreateRoomForm
                    ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                    : <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>
                  }
                </svg>
                {showCreateRoomForm ? "Annuler" : "Nouvelle chambre"}
              </button>

              {showCreateRoomForm ? (
                <section className="list-panel dashboard-panel rp-create-form-panel">
                  <div className="panel-head">
                    <div>
                      <h3>Nouvelle chambre</h3>
                      <p>Ajoute une chambre à l&apos;inventaire de l&apos;hôtel.</p>
                    </div>
                  </div>
                  <form className="rooms-form-card" onSubmit={handleRoomSubmit}>
                    <div className="rooms-form-grid">
                      <label className="rooms-field">
                        <span>Numéro</span>
                        <input value={roomForm.number} onChange={(e) => setRoomForm((c) => ({ ...c, number: e.target.value }))} disabled={submittingRoom} />
                      </label>
                      <label className="rooms-field">
                        <span>Type</span>
                        <AppSelect value={roomForm.room_type} onChange={(e) => setRoomForm((c) => ({ ...c, room_type: e.target.value }))} name="room_type" disabled={submittingRoom}>
                          <option value="">Choisir un type</option>
                          {roomTypes.map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </AppSelect>
                      </label>
                      <label className="rooms-field">
                        <span>Étage</span>
                        <input type="number" value={roomForm.floor} onChange={(e) => setRoomForm((c) => ({ ...c, floor: e.target.value }))} disabled={submittingRoom} />
                      </label>
                      <label className="rooms-field">
                        <span>Statut</span>
                        <AppSelect value={roomForm.status} onChange={(e) => setRoomForm((c) => ({ ...c, status: e.target.value }))} name="room_status" disabled={submittingRoom}>
                          {ROOM_STATUS_OPTIONS.filter((o) => o.value !== "all").map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </AppSelect>
                      </label>
                      <label className="rooms-field">
                        <span>Tarif nuit</span>
                        <input type="number" step="0.01" value={roomForm.custom_price_per_night} onChange={(e) => setRoomForm((c) => ({ ...c, custom_price_per_night: e.target.value }))} disabled={submittingRoom} />
                      </label>
                      <label className="rooms-field">
                        <span>Tarif day use</span>
                        <input type="number" step="0.01" value={roomForm.custom_price_day_use} onChange={(e) => setRoomForm((c) => ({ ...c, custom_price_day_use: e.target.value }))} disabled={submittingRoom} />
                      </label>
                      <label className="rooms-field rooms-field--checkbox">
                        <input type="checkbox" checked={roomForm.is_vip_preferred} onChange={(e) => setRoomForm((c) => ({ ...c, is_vip_preferred: e.target.checked }))} disabled={submittingRoom} />
                        <span>Prioritaire VIP</span>
                      </label>
                      <label className="rooms-field rooms-field--full">
                        <span>Notes internes</span>
                        <textarea value={roomForm.notes} onChange={(e) => setRoomForm((c) => ({ ...c, notes: e.target.value }))} disabled={submittingRoom} />
                      </label>
                    </div>
                    <div className="rooms-form-actions">
                      <button type="submit" className="primary-button" disabled={submittingRoom}>
                        {submittingRoom ? "Enregistrement…" : "Créer la chambre"}
                      </button>
                    </div>
                  </form>
                </section>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ═══════════════════════════════════════════════════════
          TAB: VUE TEMPS RÉEL
      ═══════════════════════════════════════════════════════ */}
      {canAccessTab("realtime") && activeTab === "realtime" ? (
        <section className="rt-page">
          {roomRealtime.loading && <div className="rt-loading">Chargement...</div>}
          {roomRealtime.error && <div className="rt-error">{roomRealtime.error}</div>}

          {roomRealtime.data ? (
            <>
              <RtKpiBar summary={roomRealtime.data} lastUpdate={roomRealtime.lastUpdate} />

              <div className="rt-toolbar">
                <input
                  type="search"
                  className="rt-search"
                  placeholder="Rechercher par chambre, etat ou alerte..."
                  value={roomRealtime.search}
                  onChange={(e) => roomRealtime.setSearch(e.target.value)}
                />
                <div className="rt-filters">
                  {[
                    { key: "all", label: "Toutes" },
                    { key: "occupees", label: "Occupees" },
                    { key: "disponibles", label: "Disponibles" },
                    { key: "presence", label: "Presence detectee" },
                    { key: "porte_ouverte", label: "Porte ouverte" },
                    { key: "alertes", label: "Alertes" },
                  ].map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      className={`rt-filter-btn ${roomRealtime.filter === filter.key ? "active" : ""}`}
                      onClick={() => roomRealtime.setFilter(filter.key)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              <RtAlertFeed alerts={roomRealtime.data.alerts_feed || []} />

              <div className="rt-split">
                <div className="rt-left">
                  <div className="rt-section">
                    <div className="rt-sec-label">Vue heatmap - cliquez une chambre pour le detail</div>
                    <RtHeatmap
                      rooms={roomRealtime.filteredRooms}
                      selectedRoom={roomRealtime.selectedRoom}
                      onSelect={roomRealtime.setSelectedRoom}
                    />
                  </div>

                  <div className="rt-section">
                    <div className="rt-sec-label">
                      {roomRealtime.filteredRooms.length} chambre{roomRealtime.filteredRooms.length > 1 ? "s" : ""}
                    </div>
                    <RtRoomTable
                      rooms={roomRealtime.filteredRooms}
                      selectedRoom={roomRealtime.selectedRoom}
                      onSelect={roomRealtime.setSelectedRoom}
                    />
                  </div>
                </div>

                <div className="rt-right">
                  <RtDetailPanel room={roomRealtime.selectedRoom} />
                </div>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {/* ═══════════════════════════════════════════════════════
          TAB: TYPES DE CHAMBRES
      ═══════════════════════════════════════════════════════ */}
      {canAccessTab("types") && activeTab === "types" ? (
        <section className="rooms-management-layout">
          <section className="list-panel dashboard-panel">
            <div className="panel-head"><div><h3>Types de chambres</h3><p>Socle de capacité, pricing de base, équipements et politique day use.</p></div></div>
            <div className="table-like">
              {roomTypes.map((item) => (
                <button key={item.id} type="button" className={`table-card rooms-list-row ${selectedTypeId === item.id ? "active" : ""}`} onClick={() => handleSelectType(item)}>
                  <div className="rooms-list-row__head"><strong>{item.name}</strong><span>{item.code}</span></div>
                  <p>{item.capacity} pers. · Nuit {item.base_price_per_night}</p>
                  <small>{(item.amenities || []).slice(0, 3).join(", ") || "Sans équipement détaillé"}</small>
                </button>
              ))}
            </div>
          </section>
          <section className="list-panel dashboard-panel">
            <div className="panel-head"><div><h3>{selectedRoomType ? `Modifier ${selectedRoomType.name}` : "Nouveau type"}</h3><p>Structure le catalogue chambres avec tarifs de base, équipements et politique commerciale.</p></div></div>
            <form className="rooms-form-card" onSubmit={handleRoomTypeSubmit}>
              <div className="rooms-form-grid">
                <label className="rooms-field"><span>Nom</span><input value={roomTypeForm.name} onChange={(e) => setRoomTypeForm((c) => ({ ...c, name: e.target.value }))} disabled={!canManageInventory || submittingType} /></label>
                <label className="rooms-field"><span>Code</span><input value={roomTypeForm.code} onChange={(e) => setRoomTypeForm((c) => ({ ...c, code: e.target.value }))} disabled={!canManageInventory || submittingType} /></label>
                <label className="rooms-field"><span>Capacité</span><input type="number" value={roomTypeForm.capacity} onChange={(e) => setRoomTypeForm((c) => ({ ...c, capacity: e.target.value }))} disabled={!canManageInventory || submittingType} /></label>
                <label className="rooms-field"><span>Adultes max</span><input type="number" value={roomTypeForm.max_adults} onChange={(e) => setRoomTypeForm((c) => ({ ...c, max_adults: e.target.value }))} disabled={!canManageInventory || submittingType} /></label>
                <label className="rooms-field"><span>Enfants max</span><input type="number" value={roomTypeForm.max_children} onChange={(e) => setRoomTypeForm((c) => ({ ...c, max_children: e.target.value }))} disabled={!canManageInventory || submittingType} /></label>
                <label className="rooms-field"><span>Tarif nuit</span><input type="number" step="0.01" value={roomTypeForm.base_price_per_night} onChange={(e) => setRoomTypeForm((c) => ({ ...c, base_price_per_night: e.target.value }))} disabled={!canManageInventory || submittingType} /></label>
                <label className="rooms-field"><span>Tarif day use</span><input type="number" step="0.01" value={roomTypeForm.base_price_day_use} onChange={(e) => setRoomTypeForm((c) => ({ ...c, base_price_day_use: e.target.value }))} disabled={!canManageInventory || submittingType} /></label>
                <label className="rooms-field rooms-field--checkbox">
                  <input type="checkbox" checked={roomTypeForm.is_day_use_available} onChange={(e) => setRoomTypeForm((c) => ({ ...c, is_day_use_available: e.target.checked }))} disabled={!canManageInventory || submittingType} />
                  <span>Day use autorisé</span>
                </label>
                <label className="rooms-field rooms-field--full"><span>Description</span><textarea value={roomTypeForm.description} onChange={(e) => setRoomTypeForm((c) => ({ ...c, description: e.target.value }))} disabled={!canManageInventory || submittingType} /></label>
                <label className="rooms-field rooms-field--full"><span>Équipements (virgules)</span><input value={roomTypeForm.amenities} onChange={(e) => setRoomTypeForm((c) => ({ ...c, amenities: e.target.value }))} disabled={!canManageInventory || submittingType} /></label>
                <label className="rooms-field rooms-field--full"><span>Images (URLs séparées par virgule)</span><input value={roomTypeForm.image_urls} onChange={(e) => setRoomTypeForm((c) => ({ ...c, image_urls: e.target.value }))} disabled={!canManageInventory || submittingType} /></label>
                <label className="rooms-field rooms-field--full"><span>Politique tarifaire</span><textarea value={roomTypeForm.pricing_policy_notes} onChange={(e) => setRoomTypeForm((c) => ({ ...c, pricing_policy_notes: e.target.value }))} disabled={!canManageInventory || submittingType} /></label>
              </div>
              <div className="rooms-form-actions">
                <button type="submit" className="primary-button" disabled={!canManageInventory || submittingType}>
                  {selectedRoomType ? "Mettre à jour" : "Créer le type"}
                </button>
                {selectedRoomType && canManageInventory ? (
                  <button
                    type="button"
                    className="secondary-button danger"
                    disabled={submittingType}
                    onClick={() => runAction(
                      () => deactivateRoomType(selectedRoomType.id),
                      "Type de chambre désactivé.",
                      setSubmittingType,
                      () => { setSelectedTypeId(null); setRoomTypeForm(EMPTY_ROOM_TYPE_FORM); },
                    )}
                  >
                    Désactiver
                  </button>
                ) : null}
              </div>
            </form>
          </section>
        </section>
      ) : null}

      {/* ═══════════════════════════════════════════════════════
          TAB: HOUSEKEEPING
      ═══════════════════════════════════════════════════════ */}
      {canAccessTab("housekeeping") && activeTab === "housekeeping" ? (
        <section className="hk-page">
          {housekeepingDashboard.loading && <div className="hk-loading">Chargement...</div>}
          {housekeepingDashboard.error && <div className="hk-error">{housekeepingDashboard.error}</div>}

          {housekeepingDashboard.data ? (
            <>
              <HkKpiBar data={housekeepingDashboard.data} />

              <div className="hk-view-toggle">
                {[
                  { key: "kanban", label: "Kanban" },
                  { key: "liste", label: "File" },
                ].map((mode) => (
                  <button
                    key={mode.key}
                    type="button"
                    className={`hk-view-btn ${housekeepingViewMode === mode.key ? "active" : ""}`}
                    onClick={() => setHousekeepingViewMode(mode.key)}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {housekeepingDashboard.data.alertes?.length > 0 ? (
                <div className="hk-section">
                  <div className="hk-sec-label">
                    Alertes &amp; retards
                    <span className="hk-badge-count">{housekeepingDashboard.data.alertes.filter((alert) => alert.type !== "ok").length}</span>
                  </div>
                  <HkAlertFeed alertes={housekeepingDashboard.data.alertes} />
                </div>
              ) : null}

              <div className="hk-section">
                {housekeepingViewMode === "kanban" ? (
                  <>
                    <div className="hk-sec-label">Vue Kanban</div>
                    <HkKanban data={housekeepingDashboard.data} onSelectTask={() => setHousekeepingViewMode("liste")} />
                  </>
                ) : (
                  <>
                    <div className="hk-sec-label">
                      File housekeeping - {[
                        ...(housekeepingDashboard.data.kanban_a_nettoyer || []),
                        ...(housekeepingDashboard.data.kanban_en_cours || []),
                        ...(housekeepingDashboard.data.kanban_probleme || []),
                        ...(housekeepingDashboard.data.kanban_termine || []),
                      ].length} taches
                    </div>
                    <div className="hk-task-list">
                      {[
                        ...(housekeepingDashboard.data.kanban_a_nettoyer || []),
                        ...(housekeepingDashboard.data.kanban_en_cours || []),
                        ...(housekeepingDashboard.data.kanban_probleme || []),
                        ...(housekeepingDashboard.data.kanban_termine || []),
                      ].map((task) => (
                        <HkTaskCard
                          key={task.id}
                          task={task}
                          canStart={canStartHousekeeping}
                          canComplete={canCompleteHousekeeping}
                          canSuspend={canStartHousekeeping}
                          canReportProblem={canReportHousekeepingProblem}
                          canAssign={canAssignHousekeeping}
                          onDemarrer={housekeepingDashboard.demarrer}
                          onTerminer={housekeepingDashboard.terminer}
                          onSuspendre={housekeepingDashboard.suspendre}
                          onSignalerProbleme={housekeepingDashboard.signalerProbleme}
                          onAssigner={housekeepingDashboard.assigner}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="hk-section">
                <div className="hk-sec-label">Tableau de bord agents</div>
                <HkAgentBoard agents={housekeepingDashboard.data.agents || []} />
              </div>

              <div className="hk-section">
                <div className="hk-sec-label">Statistiques du jour</div>
                <HkStats data={housekeepingDashboard.data} />
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {/* ═══════════════════════════════════════════════════════
          TAB: MAINTENANCE
      ═══════════════════════════════════════════════════════ */}
      {canAccessTab("maintenance") && activeTab === "maintenance" ? (
        <section className="rooms-management-layout">
          <section className="list-panel dashboard-panel">
            <div className="panel-head"><div><h3>Incidents techniques</h3><p>Suivi des chambres bloquées, réparations en cours et incidents signalés depuis le terrain.</p></div></div>
            <div className="table-like">
              {incidents.length ? incidents.map((incident) => (
                <article key={incident.id} className="table-card detail-info-card">
                  <div className="table-row"><strong>Chambre</strong><span>{incident.room_number}</span></div>
                  <div className="table-row"><strong>Titre</strong><span>{incident.title}</span></div>
                  <div className="table-row"><strong>Sévérité</strong><span>{incident.severity_label}</span></div>
                  <div className="table-row"><strong>Statut</strong><span>{incident.status_label}</span></div>
                  <div className="table-row"><strong>Déclarant</strong><span>{incident.reported_by_name || "—"}</span></div>
                  {incident.status !== "resolved" && incident.status !== "closed" && canResolveMaintenance ? (
                    resolvingIncidentId === incident.id ? (
                      <div style={{ marginTop: "0.75rem" }}>
                        <label className="rooms-field rooms-field--full">
                          <span>Notes de résolution</span>
                          <textarea value={resolveNotes} onChange={(e) => setResolveNotes(e.target.value)} placeholder="Décrivez les actions correctives effectuées…" rows={2} disabled={submittingIncident} />
                        </label>
                        <div className="action-row">
                          <button type="button" className="primary-button" disabled={submittingIncident}
                            onClick={() => runAction(
                              () => resolveMaintenanceIncident(incident.id, { resolution_notes: resolveNotes.trim() }),
                              "Incident résolu.", setSubmittingIncident,
                              () => { setResolvingIncidentId(null); setResolveNotes(""); },
                            )}
                          >
                            {submittingIncident ? "Résolution…" : "Confirmer"}
                          </button>
                          <button type="button" className="secondary-button" disabled={submittingIncident} onClick={() => { setResolvingIncidentId(null); setResolveNotes(""); }}>Annuler</button>
                        </div>
                      </div>
                    ) : (
                      <div className="action-row">
                        <button type="button" className="primary-button" onClick={() => setResolvingIncidentId(incident.id)}>Marquer résolu</button>
                      </div>
                    )
                  ) : null}
                </article>
              )) : <EmptyStateCard title="Aucun incident ouvert" description="Les problèmes techniques et pannes apparaîtront ici." />}
            </div>
          </section>
          <section className="list-panel dashboard-panel">
            <div className="panel-head"><div><h3>Nouvel incident</h3><p>Signale une panne ou un incident et mets automatiquement la chambre hors service si nécessaire.</p></div></div>
            <form className="rooms-form-card" onSubmit={handleIncidentSubmit}>
              <div className="rooms-form-grid">
                <label className="rooms-field"><span>Chambre</span><AppSelect value={incidentForm.room} onChange={(e) => setIncidentForm((c) => ({ ...c, room: e.target.value }))} name="incident_room" disabled={!canCreateMaintenance || submittingIncident}><option value="">Choisir</option>{activeRooms.map((r) => <option key={r.id} value={r.id}>{r.number}</option>)}</AppSelect></label>
                <label className="rooms-field"><span>Sévérité</span><AppSelect value={incidentForm.severity} onChange={(e) => setIncidentForm((c) => ({ ...c, severity: e.target.value }))} name="incident_severity" disabled={!canCreateMaintenance || submittingIncident}><option value="low">Faible</option><option value="medium">Moyenne</option><option value="high">Haute</option><option value="critical">Critique</option></AppSelect></label>
                <label className="rooms-field"><span>Attribué à</span><AppSelect value={incidentForm.assigned_to} onChange={(e) => setIncidentForm((c) => ({ ...c, assigned_to: e.target.value }))} name="incident_assigned_to" disabled={!canCreateMaintenance || submittingIncident}><option value="">Non attribué</option>{roomAgents.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</AppSelect></label>
                <label className="rooms-field rooms-field--checkbox"><input type="checkbox" checked={incidentForm.marks_room_out_of_service} onChange={(e) => setIncidentForm((c) => ({ ...c, marks_room_out_of_service: e.target.checked }))} disabled={!canCreateMaintenance || submittingIncident} /><span>Hors service automatique</span></label>
                <label className="rooms-field rooms-field--full"><span>Titre</span><input value={incidentForm.title} onChange={(e) => setIncidentForm((c) => ({ ...c, title: e.target.value }))} disabled={!canCreateMaintenance || submittingIncident} /></label>
                <label className="rooms-field rooms-field--full"><span>Description</span><textarea value={incidentForm.description} onChange={(e) => setIncidentForm((c) => ({ ...c, description: e.target.value }))} disabled={!canCreateMaintenance || submittingIncident} /></label>
              </div>
              <div className="rooms-form-actions"><button type="submit" className="primary-button" disabled={!canCreateMaintenance || submittingIncident}>Enregistrer l&apos;incident</button></div>
            </form>
          </section>
        </section>
      ) : null}

      {/* ═══════════════════════════════════════════════════════
          TAB: TARIFICATION
      ═══════════════════════════════════════════════════════ */}
      {canAccessTab("pricing") && activeTab === "pricing" ? (
        <section className="rooms-management-layout">
          <section className="list-panel dashboard-panel">
            <div className="panel-head"><div><h3>Revenue management lite</h3><p>Week-end, saison et pression d&apos;occupation: les règles tarifaires simples restent visibles et auditables.</p></div></div>
            <div className="table-like">
              {pricingRules.length ? pricingRules.map((rule) => (
                <article key={rule.id} className="table-card detail-info-card">
                  <div className="table-row"><strong>Nom</strong><span>{rule.name}</span></div>
                  <div className="table-row"><strong>Type</strong><span>{rule.rule_type}</span></div>
                  <div className="table-row"><strong>Périmètre</strong><span>{rule.applies_to}</span></div>
                  <div className="table-row"><strong>Valeur</strong><span>{rule.adjustment_value}</span></div>
                  <div className="table-row"><strong>Priorité</strong><span>{rule.priority}</span></div>
                </article>
              )) : <EmptyStateCard title="Aucune règle tarifaire" description="Ajoute une première règle week-end, saisonnière ou liée à l'occupation." />}
            </div>
          </section>
          <section className="list-panel dashboard-panel">
            <div className="panel-head"><div><h3>Nouvelle règle</h3><p>Prépare un premier niveau de yield management sans complexifier la réception.</p></div></div>
            <form className="rooms-form-card" onSubmit={handleRuleSubmit}>
              <div className="rooms-form-grid">
                <label className="rooms-field"><span>Type de chambre</span><AppSelect value={ruleForm.room_type} onChange={(e) => setRuleForm((c) => ({ ...c, room_type: e.target.value }))} name="rule_room_type" disabled={!canManageInventory || submittingRule}><option value="">Choisir</option>{roomTypes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</AppSelect></label>
                <label className="rooms-field"><span>Nom</span><input value={ruleForm.name} onChange={(e) => setRuleForm((c) => ({ ...c, name: e.target.value }))} disabled={!canManageInventory || submittingRule} /></label>
                <label className="rooms-field"><span>Règle</span><AppSelect value={ruleForm.rule_type} onChange={(e) => setRuleForm((c) => ({ ...c, rule_type: e.target.value }))} name="rule_type" disabled={!canManageInventory || submittingRule}><option value="weekend">Week-end</option><option value="seasonal">Saisonnière</option><option value="occupancy">Occupation</option></AppSelect></label>
                <label className="rooms-field"><span>S'applique à</span><AppSelect value={ruleForm.applies_to} onChange={(e) => setRuleForm((c) => ({ ...c, applies_to: e.target.value }))} name="rule_applies_to" disabled={!canManageInventory || submittingRule}><option value="night">Nuit</option><option value="day_use">Day use</option><option value="both">Les deux</option></AppSelect></label>
                <label className="rooms-field"><span>Mode</span><AppSelect value={ruleForm.adjustment_mode} onChange={(e) => setRuleForm((c) => ({ ...c, adjustment_mode: e.target.value }))} name="rule_adjustment_mode" disabled={!canManageInventory || submittingRule}><option value="percent">Pourcentage</option><option value="fixed">Montant fixe</option></AppSelect></label>
                <label className="rooms-field"><span>Valeur</span><input type="number" step="0.01" value={ruleForm.adjustment_value} onChange={(e) => setRuleForm((c) => ({ ...c, adjustment_value: e.target.value }))} disabled={!canManageInventory || submittingRule} /></label>
                <label className="rooms-field"><span>Début</span><DatePicker value={ruleForm.start_date} onChange={(e) => setRuleForm((c) => ({ ...c, start_date: e.target.value }))} name="rule_start_date" disabled={!canManageInventory || submittingRule} placeholder="Choisir une date" /></label>
                <label className="rooms-field"><span>Fin</span><DatePicker value={ruleForm.end_date} onChange={(e) => setRuleForm((c) => ({ ...c, end_date: e.target.value }))} name="rule_end_date" minDate={ruleForm.start_date} disabled={!canManageInventory || submittingRule} placeholder="Choisir une date" /></label>
                <label className="rooms-field"><span>Occupation min (%)</span><input type="number" value={ruleForm.min_occupancy_rate} onChange={(e) => setRuleForm((c) => ({ ...c, min_occupancy_rate: e.target.value }))} disabled={!canManageInventory || submittingRule} /></label>
                <label className="rooms-field"><span>Priorité</span><input type="number" value={ruleForm.priority} onChange={(e) => setRuleForm((c) => ({ ...c, priority: Number(e.target.value) }))} disabled={!canManageInventory || submittingRule} /></label>
              </div>
              <div className="rooms-form-actions"><button type="submit" className="primary-button" disabled={!canManageInventory || submittingRule}>Ajouter la règle</button></div>
            </form>
          </section>
        </section>
      ) : null}

      {/* ═══════════════════════════════════════════════════════
          DRAWER — rendu hors flux, accessible depuis tous les onglets
      ═══════════════════════════════════════════════════════ */}
      <RoomDrawer
        open={drawerOpen}
        room={selectedRoom}
        roomForm={roomForm}
        setRoomForm={setRoomForm}
        onClose={closeDrawer}
        onSubmit={handleRoomSubmit}
        onCheckIn={handleCheckIn}
        onCheckOut={handleCheckOut}
        onMarkClean={handleMarkClean}
        onDeactivate={handleDeactivateFromDrawer}
        onReactivate={handleReactivateFromDrawer}
        canManage={canManageInventory}
        canOperate={canOperateRooms}
        canCheckIn={canCheckInRooms}
        canCheckOut={canCheckOutRooms}
        canMarkClean={canMarkCleanRooms}
        roomTypes={roomTypes}
        submittingRoom={submittingRoom}
        activeRoomAction={activeRoomAction}
        anySubmitting={anySubmitting}
        isCheckInEligible={isCheckInEligible}
      />

    </div>
  );
}
