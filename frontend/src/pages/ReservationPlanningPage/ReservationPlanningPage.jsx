import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

import { getReservationPlanning, updateBookingFromPlanning } from "../../services/reservationPlanningService";
import { PlanningBookingModal } from "./PlanningBookingModal";
import "./ReservationPlanningPage.css";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getTodayISO() {
  return new Date().toISOString().split("T")[0];
}

function addDaysToISO(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function buildDays(startISO, count) {
  return Array.from({ length: count }, (_, i) => addDaysToISO(startISO, i));
}

function diffDays(isoA, isoB) {
  return (new Date(`${isoB}T00:00:00`) - new Date(`${isoA}T00:00:00`)) / 86_400_000;
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function fmtWeekday(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short" });
}

function fmtDay(iso) {
  return new Date(`${iso}T12:00:00`).getDate();
}

function fmtShortDate(iso) {
  if (!iso) return "–";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

function fmtAmount(n) {
  if (n === undefined || n === null) return "–";
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " XOF";
}

function formatMoneyPayload(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

function fmtPeriodLabel(days) {
  if (!days.length) return "";
  const d0 = new Date(`${days[0]}T12:00:00`);
  const dn = new Date(`${days[days.length - 1]}T12:00:00`);
  const opts0 = { day: "numeric", month: "short" };
  const optsN = { day: "numeric", month: "short", year: "numeric" };
  return `${d0.toLocaleDateString("fr-FR", opts0)} – ${dn.toLocaleDateString("fr-FR", optsN)}`;
}

// ─── Group rooms by floor ──────────────────────────────────────────────────────

function groupByFloor(rooms) {
  const map = new Map();
  for (const r of rooms) {
    const k = r.floor ?? -1;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([floor, items]) => ({
      floor,
      label: floor === -1 ? "Rez-de-chaussée" : `Étage ${floor}`,
      rooms: items,
    }));
}

// ─── Occupied cell check ──────────────────────────────────────────────────────

function isDayOccupied(blocks, day) {
  return blocks.some((b) => b.arrival_date <= day && b.departure_date > day);
}

// ─── Block position ────────────────────────────────────────────────────────────

function computeBlock(block, days) {
  if (!block.arrival_date || !block.departure_date) return null;
  const winStart = days[0];
  const winEnd = addDaysToISO(days[days.length - 1], 1);
  if (block.arrival_date >= winEnd || block.departure_date <= winStart) return null;
  const clampedStart = block.arrival_date < winStart ? winStart : block.arrival_date;
  const clampedEnd = block.departure_date > winEnd ? winEnd : block.departure_date;
  const total = days.length;
  const left = diffDays(winStart, clampedStart) / total;
  const width = Math.max(diffDays(clampedStart, clampedEnd) / total, 1 / total);
  return { left, width };
}

function getBlockDates(block) {
  return {
    start: block.check_in_date || block.arrival_date,
    end: block.check_out_date || block.departure_date,
  };
}

function canDragPlanningBlock(block) {
  return block?.entity_type === "booking" && ["pending", "confirmed"].includes(block.status);
}

function getAlertTargetPath(alert) {
  if (alert?.target_type === "booking" && alert.target_id) {
    return `/operations/bookings/${alert.target_id}`;
  }
  if (alert?.target_type === "stay" && alert.target_id) {
    return `/operations/stays/${alert.target_id}`;
  }
  if (alert?.booking_id) {
    return `/operations/bookings/${alert.booking_id}`;
  }
  if (alert?.stay_id) {
    return `/operations/stays/${alert.stay_id}`;
  }
  return "";
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const ZOOM_OPTIONS = [
  { value: 7, label: "7 jours" },
  { value: 14, label: "14 jours" },
  { value: 30, label: "30 jours" },
];

const ROOMS_PER_PAGE = 10;

const STATUS_META = {
  pending:     { label: "En attente", cls: "status--pending" },
  confirmed:   { label: "Confirmée",   cls: "status--confirmed" },
  checked_in:  { label: "En séjour",   cls: "status--checked_in" },
  in_progress: { label: "En séjour",   cls: "status--in_progress" },
  cancelled:   { label: "Annulée",     cls: "status--cancelled" },
  no_show:     { label: "No-show",     cls: "status--no_show" },
  completed:   { label: "Terminé",     cls: "status--completed" },
};

const ROOM_DOT_CLS = {
  available:     "dot--available",
  occupied:      "dot--occupied",
  reserved:      "dot--reserved",
  cleaning:      "dot--cleaning",
  out_of_service:"dot--oos",
};

const LEGEND_ITEMS = [
  { cls: "status--confirmed",  label: "Confirmée" },
  { cls: "status--pending",    label: "En attente" },
  { cls: "status--in_progress",label: "En séjour" },
  { cls: "status--checked_in", label: "Check-in fait" },
  { cls: "status--cancelled",  label: "Annulée" },
  { cls: "room-cleaning",      label: "Nettoyage" },
  { cls: "room-oos",           label: "Hors service" },
];

// ─── Mock data (dev fallback) ──────────────────────────────────────────────────

const PLANNING_SIZE_LIMITS = {
  dayWidth:   { min: 50,  max: 200, step: 10, fallback: 90  },
  rowHeight:  { min: 38,  max: 76,  step: 6,  fallback: 52  },
  roomsWidth: { min: 140, max: 320, step: 10, fallback: 220 },
};

function getStoredPlanningSize(key) {
  if (typeof window === "undefined") {
    return PLANNING_SIZE_LIMITS[key].fallback;
  }
  const raw = Number(window.localStorage.getItem(`afrivo.reservationPlanning.${key}`));
  const limits = PLANNING_SIZE_LIMITS[key];
  if (!Number.isFinite(raw)) {
    return limits.fallback;
  }
  return Math.min(limits.max, Math.max(limits.min, raw));
}

function clampPlanningSize(key, value) {
  const limits = PLANNING_SIZE_LIMITS[key];
  return Math.min(limits.max, Math.max(limits.min, value));
}

const MOCK = {
  rooms: [
    { id:1, number:"101", type:"Standard", floor:1, floor_label:"Étage 1", status:"available",     status_label:"Disponible" },
    { id:2, number:"102", type:"Standard", floor:1, floor_label:"Étage 1", status:"occupied",      status_label:"Occupée" },
    { id:3, number:"201", type:"Deluxe",   floor:2, floor_label:"Étage 2", status:"cleaning",      status_label:"Nettoyage" },
    { id:4, number:"202", type:"Suite",    floor:2, floor_label:"Étage 2", status:"reserved",      status_label:"Réservée" },
    { id:5, number:"301", type:"Suite",    floor:3, floor_label:"Étage 3", status:"out_of_service",status_label:"Hors service" },
  ],
  reservations: [
    { id:1, reference:"RES-001", room_id:1, room_number:"101", room_type:"Standard", client_name:"Koffi Anan",    client_phone:"+225 01 02 03 04", client_id:1, arrival_date: getTodayISO(), departure_date: addDaysToISO(getTodayISO(), 3), status:"confirmed",   status_label:"Confirmée",  source:"Walk-in", total_amount:120000, adults:2, children:0, notes:"",                   entity_type:"booking" },
    { id:2, reference:"RES-002", room_id:4, room_number:"202", room_type:"Suite",    client_name:"Amina Diallo",  client_phone:"+225 05 06 07 08", client_id:2, arrival_date: addDaysToISO(getTodayISO(), 2), departure_date: addDaysToISO(getTodayISO(), 6), status:"pending",     status_label:"En attente", source:"Phone",   total_amount:320000, adults:2, children:1, notes:"Vue mer si possible", entity_type:"booking" },
  ],
  stays: [
    { id:1, reference:"STY-001", room_id:2, room_number:"102", client_name:"Fanta Keita", client_phone:"+225 09 10 11 12", client_id:3, arrival_date: addDaysToISO(getTodayISO(), -2), departure_date: addDaysToISO(getTodayISO(), 1), status:"in_progress", status_label:"En séjour", adults:1, children:0, entity_type:"stay" },
  ],
  alerts: [
    { type:"arrival_pending", severity:"medium", room_id:1, message:"Arrivée non traitée : RES-001 – Koffi Anan." },
  ],
  daily_summary: {
    arrivals:2, departures:1, in_stay:8, free_rooms:12, total_rooms:25,
    occupancy_rate:32, revenue_today:450000, pending_payments:3, alerts_count:1,
  },
};

// ─── Icons ─────────────────────────────────────────────────────────────────────

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function IconChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function IconChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function IconRefresh() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}
function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <div className="rp-grid-skeleton">
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="rp-skeleton-row">
          <div className="rp-skeleton-room" />
          <div className="rp-skeleton-timeline" />
        </div>
      ))}
    </div>
  );
}

// ─── Empty / Error states ──────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="rp-state-box">
      <span className="rp-state-icon"><IconCalendar /></span>
      <p className="rp-state-title">Aucune chambre trouvée</p>
      <p className="rp-state-msg">Aucune chambre active pour cette période ou ces filtres.</p>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="rp-state-box rp-state-box--error">
      <span className="rp-state-icon"><IconAlert /></span>
      <p className="rp-state-title">Erreur de chargement</p>
      <p className="rp-state-msg">{message}</p>
      {onRetry && (
        <button type="button" className="rp-btn rp-btn--secondary" onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  );
}

// ─── Planning Grid ─────────────────────────────────────────────────────────────

function PlanningGrid({
  days,
  roomsByFloor,
  reservations,
  stays,
  alerts,
  selectedItem,
  onSelect,
  onCellClick,
  onMoveBooking,
  onResizeBooking,
  onDropRejected,
  loading,
  error,
  isCompact,
  planningSize,
  onRetry,
  onDayWidthChange,
  onRoomsWidthChange,
}) {
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const today = getTodayISO();
  const [draggedBlock, setDraggedBlock] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [resizing, setResizing] = useState(null);

  function syncScroll() {
    if (leftRef.current && rightRef.current) {
      leftRef.current.scrollTop = rightRef.current.scrollTop;
    }
  }

  // Closure-based drag resize — no stale refs, no memory leaks.
  // Sets global cursor + userSelect during drag so the UX stays smooth
  // even when the mouse moves fast outside the handle.
  function startDragResize(e, startWidth, minW, maxW, onChange) {
    if (!onChange) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onMove(ev) {
      onChange(Math.max(minW, Math.min(maxW, startWidth + ev.clientX - startX)));
    }

    function onUp() {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  const alertRoomIds = useMemo(
    () => new Set(alerts.map((a) => a.room_id).filter(Boolean)),
    [alerts],
  );

  const blocksByRoom = useMemo(() => {
    const map = {};
    const all = [
      ...reservations.map((r) => ({ ...r, _key: `booking-${r.id}` })),
      ...stays.map((s) => ({ ...s, _key: `stay-${s.id}` })),
    ];
    for (const b of all) {
      if (b.room_id) {
        if (!map[b.room_id]) map[b.room_id] = [];
        map[b.room_id].push(b);
      }
    }
    return map;
  }, [reservations, stays]);

  const resizeDayWidth = isCompact
    ? Math.max(54, planningSize.dayWidth - 18)
    : planningSize.dayWidth;

  function handleResizeStart(event, block, side) {
    if (!canDragPlanningBlock(block)) return;
    event.preventDefault();
    event.stopPropagation();
    const dates = getBlockDates(block);
    setResizing({
      bookingId: block.id,
      block,
      side,
      startX: event.clientX,
      originalStartDate: dates.start,
      originalEndDate: dates.end,
      currentStartDate: dates.start,
      currentEndDate: dates.end,
    });
  }

  useEffect(() => {
    if (!resizing) return undefined;

    document.body.classList.add("is-resizing-block");

    function onMouseMove(event) {
      const deltaX = event.clientX - resizing.startX;
      const deltaDays = Math.round(deltaX / resizeDayWidth);

      if (resizing.side === "right") {
        const newEndDate = addDaysToISO(resizing.originalEndDate, deltaDays);
        if (newEndDate > resizing.originalStartDate) {
          setResizing((current) => current ? { ...current, currentEndDate: newEndDate } : current);
        }
      }

      if (resizing.side === "left") {
        const newStartDate = addDaysToISO(resizing.originalStartDate, deltaDays);
        if (newStartDate < resizing.originalEndDate) {
          setResizing((current) => current ? { ...current, currentStartDate: newStartDate } : current);
        }
      }
    }

    function onMouseUp() {
      document.body.classList.remove("is-resizing-block");
      if (
        onResizeBooking &&
        (
          resizing.currentStartDate !== resizing.originalStartDate ||
          resizing.currentEndDate !== resizing.originalEndDate
        )
      ) {
        onResizeBooking(resizing.block, resizing.currentStartDate, resizing.currentEndDate);
      }
      setResizing(null);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    return () => {
      document.body.classList.remove("is-resizing-block");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [resizing, resizeDayWidth, onResizeBooking]);

  function getDropPreview(room, day) {
    if (!draggedBlock || !canDragPlanningBlock(draggedBlock)) {
      return { allowed: false, reason: "" };
    }

    const duration = Math.max(1, diffDays(draggedBlock.arrival_date, draggedBlock.departure_date));
    const nextEnd = addDaysToISO(day, duration);

    if (room.status === "cleaning" || room.status === "out_of_service") {
      return { allowed: false, reason: "Chambre indisponible." };
    }
    if (draggedBlock.room_type && room.type && draggedBlock.room_type !== room.type) {
      return { allowed: false, reason: "Type de chambre incompatible." };
    }

    const conflicts = (blocksByRoom[room.id] || []).some((block) => {
      if (block.entity_type === draggedBlock.entity_type && block.id === draggedBlock.id) {
        return false;
      }
      if (!block.arrival_date) {
        return false;
      }
      const blockEnd = block.departure_date || addDaysToISO(days[days.length - 1], 1);
      return rangesOverlap(day, nextEnd, block.arrival_date, blockEnd);
    });
    if (conflicts) {
      return { allowed: false, reason: "Periode deja occupee." };
    }

    return { allowed: true, reason: `Deplacer vers chambre ${room.number}` };
  }

  function handleDragStart(event, block) {
    if (!canDragPlanningBlock(block)) {
      event.preventDefault();
      return;
    }
    setDraggedBlock(block);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", block._key);
  }

  function handleDragEnd() {
    setDraggedBlock(null);
    setDropTarget(null);
  }

  function handleCellDragOver(event, room, day) {
    if (!draggedBlock) return;
    const preview = getDropPreview(room, day);
    event.dataTransfer.dropEffect = preview.allowed ? "move" : "none";
    event.preventDefault();
  }

  function handleCellDrop(event, room, day) {
    event.preventDefault();
    event.stopPropagation();
    if (!draggedBlock || !onMoveBooking) return;
    const preview = getDropPreview(room, day);
    if (preview.allowed) {
      onMoveBooking(draggedBlock, room, day);
    } else if (preview.reason && onDropRejected) {
      onDropRejected(preview.reason);
    }
    handleDragEnd();
  }

  if (loading) return <GridSkeleton />;
  if (error && !roomsByFloor.length) return <ErrorState message={error} onRetry={onRetry} />;
  if (!loading && !roomsByFloor.length) return <EmptyState />;

  return (
    <div
      className={`rp-grid-container${isCompact ? " rp-grid-container--compact" : ""}`}
      style={{
        "--rp-day-width":      `${planningSize.dayWidth}px`,
        "--rp-row-height":     `${planningSize.rowHeight}px`,
        "--rp-grid-min-width": `${days.length * planningSize.dayWidth}px`,
        "--rp-rooms-width":    `${planningSize.roomsWidth}px`,
      }}
    >

      {/* Left: rooms column — vertically synced via JS */}
      <div
        className="rp-rooms-panel"
        ref={leftRef}
        style={{ flex: `0 0 ${planningSize.roomsWidth}px` }}
      >
        <div className="rp-rooms-panel-header">Chambres</div>
        {roomsByFloor.map(({ floor, label, rooms }) => (
          <div key={floor} className="rp-floor-group-left">
            <div className="rp-floor-label-cell">{label}</div>
            {rooms.map((room) => (
              <div
                key={room.id}
                className={[
                  "rp-room-info-cell",
                  alertRoomIds.has(room.id) ? "rp-room-info-cell--alert" : "",
                  selectedItem?.room_id === room.id ? "rp-room-info-cell--active" : "",
                ].filter(Boolean).join(" ")}
              >
                <span className="rp-room-number">{room.number}</span>
                <div className="rp-room-meta">
                  <span className="rp-room-type-label">{room.type}</span>
                  <span className={`rp-room-dot ${ROOM_DOT_CLS[room.status] || ""}`} />
                </div>
              </div>
            ))}
          </div>
        ))}
        {/* Drag handle — right edge of rooms panel */}
        <div
          className="rp-col-resize-handle rp-col-resize-handle--rooms"
          onMouseDown={(e) =>
            startDragResize(
              e,
              planningSize.roomsWidth,
              PLANNING_SIZE_LIMITS.roomsWidth.min,
              PLANNING_SIZE_LIMITS.roomsWidth.max,
              onRoomsWidthChange,
            )
          }
          aria-hidden="true"
        />
      </div>

      {/* Right: scrollable timeline */}
      <div className="rp-timeline-panel" ref={rightRef} onScroll={syncScroll}>

        {/* Dates header — sticky top */}
        <div className="rp-dates-header">
          {days.map((day) => (
            <div
              key={day}
              className={`rp-date-cell${day === today ? " rp-date-cell--today" : ""}`}
            >
              <span className="rp-date-wd">{fmtWeekday(day)}</span>
              <span className="rp-date-d">{fmtDay(day)}</span>
              {/* Drag handle — right edge of each date column */}
              <div
                className="rp-col-resize-handle"
                onMouseDown={(e) =>
                  startDragResize(
                    e,
                    planningSize.dayWidth,
                    PLANNING_SIZE_LIMITS.dayWidth.min,
                    PLANNING_SIZE_LIMITS.dayWidth.max,
                    onDayWidthChange,
                  )
                }
                aria-hidden="true"
              />
            </div>
          ))}
        </div>

        {/* Rows */}
        {roomsByFloor.map(({ floor, label, rooms }) => (
          <div key={floor} className="rp-floor-group-right">

            {/* Floor separator row */}
            <div className="rp-floor-sep-row">
              {days.map((d) => (
                <div key={d} className={`rp-floor-sep-cell${d === today ? " rp-floor-sep-cell--today" : ""}`} />
              ))}
            </div>

            {rooms.map((room) => {
              const blocks = blocksByRoom[room.id] ?? [];
              return (
                <div key={room.id} className="rp-timeline-row">

                  {/* Day cell backgrounds — cliquables si vides */}
                  {days.map((day) => {
                    const isOccupied = isDayOccupied(blocks, day);
                    const isRestricted = room.status === "cleaning" || room.status === "out_of_service";
                    const isEmpty = !isOccupied && !isRestricted;
                    const isDropTarget = dropTarget?.roomId === room.id && dropTarget?.day === day;
                    const dropPreview = isDropTarget ? getDropPreview(room, day) : null;
                    return (
                      <div
                        key={day}
                        className={[
                          "rp-day-bg",
                          day === today ? "rp-day-bg--today" : "",
                          isEmpty ? "rp-day-bg--empty" : "",
                          draggedBlock ? "rp-day-bg--drop-aware" : "",
                          isDropTarget && dropPreview?.allowed ? "rp-day-bg--drop-ok" : "",
                          isDropTarget && dropPreview && !dropPreview.allowed ? "rp-day-bg--drop-blocked" : "",
                        ].filter(Boolean).join(" ")}
                        onDragEnter={() => draggedBlock && setDropTarget({ roomId: room.id, day })}
                        onDragOver={(event) => handleCellDragOver(event, room, day)}
                        onDragLeave={() => setDropTarget((current) =>
                          current?.roomId === room.id && current?.day === day ? null : current
                        )}
                        onDrop={(event) => handleCellDrop(event, room, day)}
                        onClick={
                          isEmpty && onCellClick
                            ? () => onCellClick(room, day)
                            : () => onSelect(null)
                        }
                        title={
                          isEmpty
                            ? `Réserver la chambre ${room.number} — ${fmtShortDate(day)}`
                            : undefined
                        }
                      />
                    );
                  })}

                  {/* Reservation / Stay blocks */}
                  {blocks.map((block) => {
                    const isBeingResized =
                      resizing?.bookingId === block.id &&
                      block.entity_type === "booking";
                    const resizeDates = getBlockDates(block);
                    const displayStart = isBeingResized ? resizing.currentStartDate : resizeDates.start;
                    const displayEnd = isBeingResized ? resizing.currentEndDate : resizeDates.end;
                    const displayBlock = {
                      ...block,
                      arrival_date: displayStart,
                      departure_date: displayEnd,
                    };
                    const pos = computeBlock(displayBlock, days);
                    if (!pos) return null;
                    const isSelected =
                      selectedItem &&
                      selectedItem.id === block.id &&
                      selectedItem.entity_type === block.entity_type;
                    const statusCls = STATUS_META[block.status]?.cls ?? "";
                    const draggable = canDragPlanningBlock(block);
                    return (
                      <div
                        key={block._key}
                        className={[
                          "rp-block",
                          statusCls,
                          isSelected ? "rp-block--selected" : "",
                          draggable ? "rp-block--draggable" : "rp-block--locked",
                          draggedBlock?._key === block._key ? "rp-block--dragging" : "",
                          isBeingResized ? "rp-block--resizing" : "",
                        ].filter(Boolean).join(" ")}
                        draggable={draggable && !resizing}
                        // CSS custom properties for positioning — avoids presentational inline styles
                        style={{ "--blk-left": pos.left, "--blk-w": pos.width }}
                        onDragStart={(event) => handleDragStart(event, block)}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => { e.stopPropagation(); onSelect(block); }}
                        title={`${block.client_name} · ${fmtShortDate(block.arrival_date)} → ${fmtShortDate(block.departure_date)}`}
                      >
                        {draggable ? (
                          <div
                            className="rp-block-handle rp-block-handle--left"
                            onMouseDown={(event) => handleResizeStart(event, block, "left")}
                            aria-hidden="true"
                          />
                        ) : null}
                        <span className="rp-block-name">{block.client_name}</span>
                        <span className="rp-block-dates">
                          {fmtShortDate(displayStart)} {"->"} {fmtShortDate(displayEnd)}
                        </span>
                        <span className="rp-block-dates rp-block-dates--legacy">
                          {fmtShortDate(block.arrival_date)} → {fmtShortDate(block.departure_date)}
                        </span>
                        {draggable ? (
                          <div
                            className="rp-block-handle rp-block-handle--right"
                            onMouseDown={(event) => handleResizeStart(event, block, "right")}
                            aria-hidden="true"
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({ item, onClose, alerts }) {
  const navigate = useNavigate();
  const panelVariants = {
    hidden: { opacity: 0, x: 26, scale: 0.985 },
    visible: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 280,
        damping: 28,
        mass: 0.8,
        when: "beforeChildren",
        staggerChildren: 0.035,
      },
    },
    exit: {
      opacity: 0,
      x: 18,
      scale: 0.985,
      transition: { duration: 0.16, ease: "easeInOut" },
    },
  };
  const contentVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: "easeOut" } },
  };

  if (!item) {
    return (
      <motion.div
        className="rp-detail-panel rp-detail-panel--empty"
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        layout
      >
        <motion.span className="rp-detail-empty-icon" variants={contentVariants}><IconUser /></motion.span>
        <p className="rp-detail-empty-title">Aucune sélection</p>
        <p className="rp-detail-empty-msg">
          Cliquez sur une réservation dans le planning pour voir ses détails.
        </p>
      </motion.div>
    );
  }

  const itemAlerts = alerts.filter((a) => a.room_id === item.room_id);
  const statusMeta = STATUS_META[item.status] ?? { label: item.status_label ?? item.status, cls: "" };
  const isBooking = item.entity_type === "booking";
  const isStay = item.entity_type === "stay";
  const nights = item.arrival_date && item.departure_date
    ? diffDays(item.arrival_date, item.departure_date)
    : null;

  return (
    <motion.div
      className="rp-detail-panel"
      variants={panelVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
    >
      <motion.div className="rp-detail-header" variants={contentVariants}>
        <div>
          <p className="rp-detail-ref">{item.reference}</p>
          <span className={`rp-detail-badge ${statusMeta.cls}`}>{item.status_label}</span>
        </div>
        <button type="button" className="rp-btn-icon" onClick={onClose} aria-label="Fermer le détail">
          <IconX />
        </button>
      </motion.div>

      {itemAlerts.length > 0 && (
        <motion.div className="rp-detail-alerts" variants={contentVariants}>
          {itemAlerts.map((a, i) => (
            <div key={i} className={`rp-detail-alert rp-detail-alert--${a.severity}`}>
              <IconAlert /><span>{a.message}</span>
            </div>
          ))}
        </motion.div>
      )}

      <motion.div className="rp-detail-body" variants={contentVariants}>
        <div className="rp-detail-section">
          <p className="rp-detail-section-title">Client</p>
          <dl className="rp-detail-dl">
            <dt>Nom</dt>          <dd>{item.client_name}</dd>
            {item.client_phone && <><dt>Tél.</dt><dd>{item.client_phone}</dd></>}
          </dl>
        </div>

        <div className="rp-detail-section">
          <p className="rp-detail-section-title">Hébergement</p>
          <dl className="rp-detail-dl">
            <dt>Chambre</dt>      <dd>{item.room_number ?? "–"}</dd>
            {item.room_type && <><dt>Type</dt><dd>{item.room_type}</dd></>}
            <dt>Arrivée</dt>      <dd>{fmtShortDate(item.arrival_date)}</dd>
            <dt>Départ</dt>       <dd>{fmtShortDate(item.departure_date)}</dd>
            {nights !== null && <><dt>Durée</dt><dd>{nights} nuit{nights > 1 ? "s" : ""}</dd></>}
            <dt>Personnes</dt>    <dd>{item.adults} adulte{item.adults > 1 ? "s" : ""}{item.children > 0 ? ` / ${item.children} enfant${item.children > 1 ? "s" : ""}` : ""}</dd>
          </dl>
        </div>

        {isBooking && (
          <div className="rp-detail-section">
            <p className="rp-detail-section-title">Finances</p>
            <dl className="rp-detail-dl">
              <dt>Montant</dt>   <dd>{fmtAmount(item.total_amount)}</dd>
              {item.source && <><dt>Source</dt><dd>{item.source}</dd></>}
            </dl>
          </div>
        )}

        {item.notes && (
          <div className="rp-detail-section">
            <p className="rp-detail-section-title">Notes</p>
            <p className="rp-detail-note">{item.notes}</p>
          </div>
        )}
      </motion.div>

      <motion.div className="rp-detail-actions" variants={contentVariants}>
        {isBooking && (
          <button
            type="button"
            className="rp-btn rp-btn--primary rp-btn--full"
            onClick={() => navigate(`/operations/bookings/${item.id}`)}
          >
            Voir la réservation
          </button>
        )}
        {isStay && (
          <button
            type="button"
            className="rp-btn rp-btn--primary rp-btn--full"
            onClick={() => navigate(`/operations/stays/${item.id}`)}
          >
            Voir le séjour
          </button>
        )}
        {isBooking && item.status === "confirmed" && (
          <button
            type="button"
            className="rp-btn rp-btn--success rp-btn--full"
            onClick={() => navigate(`/operations/bookings/${item.id}`)}
          >
            Faire le check-in
          </button>
        )}
        {isStay && item.status === "in_progress" && (
          <button
            type="button"
            className="rp-btn rp-btn--warning rp-btn--full"
            onClick={() => navigate(`/operations/stays/${item.id}`)}
          >
            Faire le check-out
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Daily Summary ─────────────────────────────────────────────────────────────

function DailySummary({ summary, alerts, loading }) {
  const navigate = useNavigate();
  const kpis = summary
    ? [
        { label: "Arrivées",          value: summary.arrivals,        mod: "kpi--arrivals" },
        { label: "Départs",           value: summary.departures,      mod: "kpi--departures" },
        { label: "En séjour",         value: summary.in_stay,         mod: "kpi--stay" },
        { label: "Chambres libres",   value: summary.free_rooms,      mod: "kpi--free" },
        { label: "Taux d'occupation", value: `${summary.occupancy_rate}%`, mod: "kpi--occ" },
        { label: "CA du jour",        value: fmtAmount(summary.revenue_today), mod: "kpi--revenue" },
        { label: "Paiements en attente", value: summary.pending_payments, mod: summary.pending_payments > 0 ? "kpi--warning" : "" },
        { label: "Alertes actives",   value: summary.alerts_count,    mod: summary.alerts_count > 0 ? "kpi--alert" : "" },
      ]
    : [];

  return (
    <section className="rp-daily-summary">
      <p className="rp-daily-title">Résumé du jour</p>
      <div className="rp-kpi-grid">
        {loading
          ? Array.from({ length: 8 }, (_, i) => <div key={i} className="rp-kpi-skeleton" />)
          : kpis.map((k) => (
              <div key={k.label} className={`rp-kpi-card ${k.mod}`}>
                <span className="rp-kpi-value">{k.value}</span>
                <span className="rp-kpi-label">{k.label}</span>
              </div>
            ))}
      </div>
      {!loading && alerts.length > 0 && (
        <div className="rp-alerts-list">
          {alerts.slice(0, 5).map((a, i) => {
            const targetPath = getAlertTargetPath(a);
            const className = [
              "rp-alert-item",
              `rp-alert-item--${a.severity}`,
              targetPath ? "rp-alert-item--clickable" : "",
            ].filter(Boolean).join(" ");
            return targetPath ? (
              <button
                key={i}
                type="button"
                className={className}
                onClick={() => navigate(targetPath)}
              >
                <IconAlert /><span>{a.message}</span>
              </button>
            ) : (
              <div key={i} className={className}>
                <IconAlert /><span>{a.message}</span>
              </div>
            );
          })}
          {alerts.length > 5 && (
            <p className="rp-alerts-more">+{alerts.length - 5} alerte(s) supplémentaire(s)</p>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function ReservationPlanningPage() {
  const navigate = useNavigate();
  const planningGridRef = useRef(null);

  const [zoom, setZoom] = useState(14);
  const [startDate, setStartDate] = useState(getTodayISO());
  const [isCompact, setIsCompact] = useState(false);
  const [isFocus, setIsFocus] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [planning, setPlanning] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [moveStatus, setMoveStatus] = useState({ type: "", message: "" });
  const [search, setSearch] = useState("");
  const [planningSize, setPlanningSize] = useState(() => ({
    dayWidth:   getStoredPlanningSize("dayWidth"),
    rowHeight:  getStoredPlanningSize("rowHeight"),
    roomsWidth: getStoredPlanningSize("roomsWidth"),
  }));
  const [roomPage, setRoomPage] = useState(0);
  const [bookingModal, setBookingModal] = useState(null);
  const [bookingModalClosing, setBookingModalClosing] = useState(false);

  const rooms = planning?.rooms ?? [];

  const totalRoomPages = useMemo(
    () => Math.ceil(rooms.length / ROOMS_PER_PAGE),
    [rooms],
  );

  const visibleRooms = useMemo(
    () => rooms.slice(
      roomPage * ROOMS_PER_PAGE,
      (roomPage + 1) * ROOMS_PER_PAGE,
    ),
    [rooms, roomPage],
  );

  const days = useMemo(() => buildDays(startDate, zoom), [startDate, zoom]);
  const endDate = days[days.length - 1];

  const loadPlanning = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getReservationPlanning({
        startDate,
        endDate,
        search: search || undefined,
      });
      setPlanning(data);
    } catch (err) {
      setError(err.message || "Erreur de chargement du planning.");
      if (import.meta.env.DEV) setPlanning(MOCK);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, search]);

  useEffect(() => {
    loadPlanning();
  }, [loadPlanning]);

  useEffect(() => {
    window.localStorage.setItem("afrivo.reservationPlanning.dayWidth",   String(planningSize.dayWidth));
    window.localStorage.setItem("afrivo.reservationPlanning.rowHeight",  String(planningSize.rowHeight));
    window.localStorage.setItem("afrivo.reservationPlanning.roomsWidth", String(planningSize.roomsWidth));
  }, [planningSize]);

  useEffect(() => {
    setRoomPage((current) => {
      if (totalRoomPages <= 0) return 0;
      return Math.min(current, totalRoomPages - 1);
    });
  }, [totalRoomPages]);

  const roomsByFloor = useMemo(
    () => groupByFloor(visibleRooms),
    [visibleRooms],
  );

  function scrollPlanningGridIntoView() {
    planningGridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function goPrev() { setStartDate((s) => addDaysToISO(s, -zoom)); }
  function goNext() { setStartDate((s) => addDaysToISO(s, zoom)); }
  function goToday() { setStartDate(getTodayISO()); }

  function handleCellClick(room, dateISO) {
    setBookingModal({
      roomId: room.id,
      roomNumber: room.number,
      roomTypeId: room.room_type_id ?? "",
      checkInDate: dateISO,
    });
    setBookingModalClosing(false);
  }

  function closeBookingModal() {
    setBookingModalClosing(true);
    setTimeout(() => {
      setBookingModal(null);
      setBookingModalClosing(false);
    }, 260);
  }

  async function handleBookingCreated() {
    closeBookingModal();
    await loadPlanning();
  }

  function buildMovePayload(block, room, nextStartDate) {
    const duration = Math.max(1, diffDays(block.arrival_date, block.departure_date));
    return {
      room_id: room.id,
      check_in_date: nextStartDate,
      check_out_date: addDaysToISO(nextStartDate, duration),
      adults: block.adults || 1,
      children: block.children || 0,
      estimated_amount: formatMoneyPayload(block.total_amount),
      notes: block.notes || "",
    };
  }

  function buildResizePayload(block, nextStartDate, nextEndDate) {
    return {
      room_id: block.room_id,
      check_in_date: nextStartDate,
      check_out_date: nextEndDate,
      adults: block.adults || 1,
      children: block.children || 0,
      estimated_amount: formatMoneyPayload(block.total_amount),
      notes: block.notes || "",
    };
  }

  async function handleMoveBooking(block, room, nextStartDate) {
    if (!canDragPlanningBlock(block)) return;
    const payload = buildMovePayload(block, room, nextStartDate);
    setMoveStatus({ type: "info", message: `Deplacement de ${block.reference} en cours...` });
    try {
      await updateBookingFromPlanning(block.id, payload);
      setSelectedItem((current) =>
        current?.entity_type === block.entity_type && current?.id === block.id
          ? {
              ...current,
              room_id: room.id,
              room_number: room.number,
              arrival_date: payload.check_in_date,
              departure_date: payload.check_out_date,
            }
          : current
      );
      await loadPlanning();
      setMoveStatus({
        type: "success",
        message: `${block.reference} deplacee vers la chambre ${room.number}.`,
      });
      window.setTimeout(() => setMoveStatus({ type: "", message: "" }), 3500);
    } catch (err) {
      const validationErrors = err.payload?.errors || {};
      const firstError = Object.values(validationErrors).flat?.()[0];
      setMoveStatus({
        type: "error",
        message: firstError || err.payload?.detail || err.message || "Deplacement impossible.",
      });
    }
  }

  const handleResizeBooking = useCallback(async (block, nextStartDate, nextEndDate) => {
    if (!canDragPlanningBlock(block)) return;
    if (!nextStartDate || !nextEndDate || nextEndDate <= nextStartDate) return;
    const payload = buildResizePayload(block, nextStartDate, nextEndDate);
    setMoveStatus({ type: "info", message: `Mise a jour de ${block.reference} en cours...` });
    try {
      await updateBookingFromPlanning(block.id, payload);
      setSelectedItem((current) =>
        current?.entity_type === block.entity_type && current?.id === block.id
          ? {
              ...current,
              arrival_date: payload.check_in_date,
              departure_date: payload.check_out_date,
            }
          : current
      );
      await loadPlanning();
      setMoveStatus({
        type: "success",
        message: `${block.reference} mise a jour.`,
      });
      window.setTimeout(() => setMoveStatus({ type: "", message: "" }), 3500);
    } catch (err) {
      const validationErrors = err.payload?.errors || {};
      const firstError = Object.values(validationErrors).flat?.()[0];
      setMoveStatus({
        type: "error",
        message: firstError || err.payload?.detail || err.message || "Redimensionnement impossible.",
      });
    }
  }, [loadPlanning]);

  function handleDropRejected(reason) {
    setMoveStatus({ type: "error", message: reason || "Deplacement impossible." });
  }

  function handleDayWidthChange(newWidth) {
    setPlanningSize((prev) => ({
      ...prev,
      dayWidth: clampPlanningSize("dayWidth", Math.round(newWidth)),
    }));
  }

  function handleRoomsWidthChange(newWidth) {
    setPlanningSize((prev) => ({
      ...prev,
      roomsWidth: clampPlanningSize("roomsWidth", Math.round(newWidth)),
    }));
  }

  const periodLabel = fmtPeriodLabel(days);

  return (
    <div
      className={[
        "page-stack",
        "rp-page",
        isCompact ? "rp-page--compact" : "",
        isFocus ? "rp-page--focus" : "",
      ].filter(Boolean).join(" ")}
    >
      {/* ── Header ── */}
      <section className="rp-section rp-header-section">
        <div className="rp-header-top">
          <div>
            <h1 className="rp-page-title">Planning des réservations</h1>
            <p className="rp-page-subtitle">Vue d'ensemble des chambres · {periodLabel}</p>
          </div>
        </div>
      </section>

      {/* ── Control bar ── */}
      <section className="rp-section rp-control-bar">
        <div className="rp-ctrl-left">
          <button type="button" className="rp-btn rp-btn--secondary" onClick={goToday}>
            Aujourd'hui
          </button>
          <div className="rp-nav-group">
            <button type="button" className="rp-btn-icon" onClick={goPrev} aria-label="Période précédente">
              <IconChevronLeft />
            </button>
            <span className="rp-period-label">{periodLabel}</span>
            <button type="button" className="rp-btn-icon" onClick={goNext} aria-label="Période suivante">
              <IconChevronRight />
            </button>
          </div>
        </div>
        <div className="rp-ctrl-right">
          <div className="rp-zoom-group">
            {ZOOM_OPTIONS.map((z) => (
              <button
                key={z.value}
                type="button"
                className={`rp-zoom-btn${zoom === z.value ? " rp-zoom-btn--active" : ""}`}
                onClick={() => setZoom(z.value)}
              >
                {z.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`rp-toggle-btn${isCompact ? " rp-toggle-btn--on" : ""}`}
            onClick={() => setIsCompact((c) => !c)}
          >
            Compact
          </button>
          <button
            type="button"
            className={`rp-toggle-btn${isFocus ? " rp-toggle-btn--on" : ""}`}
            onClick={() => setIsFocus((f) => !f)}
          >
            Focus
          </button>
        </div>
        <div className="rp-control-actions">
          <input
            type="search"
            className="rp-search-input"
            placeholder="Rechercher une chambre..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setRoomPage(0);
            }}
          />
          <button
            type="button"
            className="rp-btn rp-btn--icon-only"
            onClick={loadPlanning}
            title="Actualiser"
            disabled={loading}
          >
            <IconRefresh />
          </button>
          <button
            type="button"
            className="rp-btn rp-btn--primary"
            onClick={() => navigate("/operations")}
          >
            <IconPlus />
            Nouvelle rÃ©servation
          </button>
        </div>
      </section>

      {/* ── Legend ── */}
      {moveStatus.message ? (
        <div className={`rp-move-status rp-move-status--${moveStatus.type}`} role="status">
          {moveStatus.message}
        </div>
      ) : null}

      <div className="rp-legend" role="list" aria-label="Légende des statuts">
        {LEGEND_ITEMS.map((l) => (
          <span key={l.label} className="rp-legend-item" role="listitem">
            <span className={`rp-legend-swatch ${l.cls}`} aria-hidden="true" />
            {l.label}
          </span>
        ))}
      </div>

      {/* ── Main area: planning + detail ── */}
      <div className="rp-main-area">
        <div className="rp-planning-section" ref={planningGridRef}>
          <PlanningGrid
            days={days}
            roomsByFloor={roomsByFloor}
            reservations={planning?.reservations ?? []}
            stays={planning?.stays ?? []}
            alerts={planning?.alerts ?? []}
            selectedItem={selectedItem}
            onSelect={setSelectedItem}
            onCellClick={handleCellClick}
            onMoveBooking={handleMoveBooking}
            onResizeBooking={handleResizeBooking}
            onDropRejected={handleDropRejected}
            loading={loading}
            error={error}
            isCompact={isCompact}
            planningSize={planningSize}
            onRetry={loadPlanning}
            onDayWidthChange={handleDayWidthChange}
            onRoomsWidthChange={handleRoomsWidthChange}
          />
          {totalRoomPages > 1 && (
            <div className="planning-pagination">
              <button
                type="button"
                className="planning-pagination-btn"
                onClick={() => {
                  setRoomPage((p) => Math.max(0, p - 1));
                  scrollPlanningGridIntoView();
                }}
                disabled={roomPage === 0}
                aria-label="Page precedente"
              >
                <i className="ti ti-chevron-left" aria-hidden="true" />
              </button>

              <div className="planning-pagination-pages">
                {Array.from({ length: totalRoomPages }, (_, index) => (
                  <button
                    key={index}
                    type="button"
                    className={[
                      "planning-pagination-page",
                      roomPage === index ? "planning-pagination-page--active" : "",
                    ].filter(Boolean).join(" ")}
                    onClick={() => {
                      setRoomPage(index);
                      scrollPlanningGridIntoView();
                    }}
                    aria-label={`Page ${index + 1}`}
                    aria-current={roomPage === index ? "page" : undefined}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="planning-pagination-btn"
                onClick={() => {
                  setRoomPage((p) => Math.min(totalRoomPages - 1, p + 1));
                  scrollPlanningGridIntoView();
                }}
                disabled={roomPage === totalRoomPages - 1}
                aria-label="Page suivante"
              >
                <i className="ti ti-chevron-right" aria-hidden="true" />
              </button>

              <span className="planning-pagination-info">
                Chambres {roomPage * ROOMS_PER_PAGE + 1}
                &ndash;{Math.min((roomPage + 1) * ROOMS_PER_PAGE, rooms.length)}
                &nbsp;sur {rooms.length}
              </span>
            </div>
          )}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <DetailPanel
            key={selectedItem ? `${selectedItem.entity_type}-${selectedItem.id}` : "empty"}
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            alerts={planning?.alerts ?? []}
          />
        </AnimatePresence>
      </div>

      {/* ── Daily summary — hidden in focus mode ── */}
      {!isFocus && (
        <DailySummary
          summary={planning?.daily_summary}
          alerts={planning?.alerts ?? []}
          loading={loading}
        />
      )}

      {/* ── Quick booking modal ── */}
      {(bookingModal || bookingModalClosing) && (
        <PlanningBookingModal
          prefill={bookingModal}
          onClose={closeBookingModal}
          onSuccess={handleBookingCreated}
          isClosing={bookingModalClosing}
        />
      )}
    </div>
  );
}
