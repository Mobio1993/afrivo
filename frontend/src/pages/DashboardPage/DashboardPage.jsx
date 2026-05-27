import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { fetchJson } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { canPerformAction, hasPermission } from "../../auth/permissions";
import "./DashboardPage.css";

// ── Constants ──────────────────────────────────────────────────────────────────

const PERIODS = [
  { value: "today", label: "Aujourd'hui" },
  { value: "week",  label: "7 jours" },
  { value: "month", label: "30 jours" },
];

const ROOM_TABS = [
  { key: "all",            label: "Toutes" },
  { key: "available",      label: "Dispo" },
  { key: "occupied",       label: "Occ." },
  { key: "reserved",       label: "Rés." },
  { key: "cleaning",       label: "Nett." },
  { key: "out_of_service", label: "H.S." },
];

const ROOM_STATUS_STYLES = {
  available: {
    bg: "rgba(22, 163, 74, 0.12)",
    color: "#166534",
    dot: "#16a34a",
  },
  occupied: {
    bg: "rgba(220, 38, 38, 0.12)",
    color: "#991b1b",
    dot: "#dc2626",
  },
  reserved: {
    bg: "rgba(14, 165, 233, 0.12)",
    color: "#075985",
    dot: "#0ea5e9",
  },
  cleaning: {
    bg: "rgba(245, 158, 11, 0.14)",
    color: "#92400e",
    dot: "#f59e0b",
  },
  out_of_service: {
    bg: "rgba(100, 116, 139, 0.14)",
    color: "#334155",
    dot: "#64748b",
  },
};

const ACTIVITY_TAG_STYLES = {
  Nettoyage:            { bg: "#EEEDFE", color: "#3C3489" },
  "Nettoyage complet":  { bg: "#EEEDFE", color: "#3C3489" },
  default:              { bg: "var(--theme-primary-light)", color: "var(--theme-primary)" },
};

// ── Utilities ──────────────────────────────────────────────────────────────────

function fmtAmount(value) {
  const raw = String(value ?? "0").replace(/[\s ]/g, "").replace(",", ".");
  const n = parseFloat(raw) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M XOF`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K XOF`;
  return `${Math.round(n)} XOF`;
}

function fmtTime(timeStr) {
  if (!timeStr) return "";
  const parts = String(timeStr).split(" ");
  return parts.length >= 2 ? parts[1] : timeStr;
}

function getTodayLabel() {
  const now  = new Date();
  const day  = now.toLocaleDateString("fr-FR", { weekday: "long" });
  const date = now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return `${day.charAt(0).toUpperCase() + day.slice(1)} ${date}`;
}

function getOpsItem(data, cardIdx, itemIdx) {
  return data?.operations_cards?.[cardIdx]?.items?.[itemIdx];
}

function getBizItem(data, cardIdx, itemIdx) {
  return data?.business_panels?.[cardIdx]?.items?.[itemIdx];
}

function alertToRoute(alert) {
  const t = (alert.title || "").toLowerCase();
  if (t.includes("chambre") || t.includes("nettoyage") || t.includes("service")) return "/rooms";
  if (t.includes("paiement")) return "/billing";
  return "/operations";
}

function getTagStyle(label) {
  return ACTIVITY_TAG_STYLES[label] || ACTIVITY_TAG_STYLES.default;
}

function normalizeRoomsResponse(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

// ── Framer Motion variants ─────────────────────────────────────────────────────

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const cardVariants = (i = 0) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, delay: i * 0.05 } },
});

const dataVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.25 } },
  exit:    { opacity: 0, transition: { duration: 0.15 } },
};

// ── Component ──────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [period,       setPeriod]       = useState("today");
  const [data,         setData]         = useState(null);
  const [rooms,        setRooms]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [error,        setError]        = useState("");
  const [roomFilter,   setRoomFilter]   = useState("all");
  const [roomSearch,   setRoomSearch]   = useState("");
  const quickActions = [
    { to: "/operations", icon: "ti-calendar-plus", label: "Nouvelle reservation", allowed: hasPermission(user, "operations", "create") },
    { to: "/operations", icon: "ti-clock", label: "Nouveau day use", allowed: hasPermission(user, "operations", "create") },
    { to: "/billing", icon: "ti-credit-card", label: "Nouveau paiement", allowed: canPerformAction(user, "payments.record") },
    { to: "/reports", icon: "ti-report-analytics", label: "Rapports financiers", allowed: canPerformAction(user, "reports.view_financial", { strict: false }) },
  ].filter((action) => action.allowed);

  // Fetch dashboard summary when period changes
  useEffect(() => {
    const ctrl = new AbortController();
    setError("");
    setLoading(true);
    fetchJson(`/api/dashboard/summary/?period=${period}`, { signal: ctrl.signal })
      .then((payload) => {
        setData(payload);
        setError("");
      })
      .catch((err) => {
        if (err.name === "AbortError" || ctrl.signal.aborted) return;
        setData(null);
        setError("Impossible de charger le tableau de bord. Vérifiez votre connexion.");
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [period]);

  // Fetch individual rooms once on mount
  useEffect(() => {
    const ctrl = new AbortController();
    setRoomsLoading(true);
    fetchJson("/api/rooms/?is_active=true&page_size=200", { signal: ctrl.signal })
      .then((res) => setRooms(normalizeRoomsResponse(res)))
      .catch((err) => {
        if (err.name === "AbortError" || ctrl.signal.aborted) return;
        setRooms([]);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setRoomsLoading(false);
      });
    return () => ctrl.abort();
  }, []);

  // ── Derived values ───────────────────────────────────────────────────────────
  const totalRoomsApi     = data?.spotlight_cards?.[0]?.value ?? 0;
  const availableRoomsApi = getOpsItem(data, 0, 0)?.value ?? 0;
  const occupiedRooms     = getOpsItem(data, 0, 1)?.value ?? 0;
  const reservedRoomsApi  = getOpsItem(data, 0, 2)?.value ?? 0;
  const cleaningRooms     = getOpsItem(data, 0, 3)?.value ?? 0;
  const outOfServiceRooms = getOpsItem(data, 0, 4)?.value ?? 0;
  const pendingBookings   = getOpsItem(data, 1, 0)?.value ?? 0;
  const confirmedBookings = getOpsItem(data, 1, 1)?.value ?? 0;
  const pendingDayUse     = getOpsItem(data, 1, 2)?.value ?? 0;
  const readyDayUse       = getOpsItem(data, 1, 3)?.value ?? 0;

  const activeClients      = getBizItem(data, 0, 0)?.value ?? 0;
  const blacklistedClients = getBizItem(data, 0, 1)?.value ?? 0;
  const teamActive         = getBizItem(data, 0, 2)?.value ?? 0;
  const adminsReception    = getBizItem(data, 0, 3)?.value ?? "—";

  const arrivalsToday = data?.alerts?.find((a) => a.title.toLowerCase().includes("arriv"))?.count ?? 0;
  const arrivalsKpi   = data?.kpi_cards?.[0]?.value ?? 0;
  const departuresKpi = data?.kpi_cards?.[1]?.value ?? 0;
  const dayUseKpi     = data?.kpi_cards?.[2]?.value ?? 0;
  const revenueKpi    = data?.kpi_cards?.[3]?.value ?? "0";
  const totalPaid     = data?.financial_cards?.[0]?.value ?? "0";
  const periodRevenue = data?.financial_cards?.[1]?.value ?? "0";
  const staysAmount   = data?.payment_channels?.[1]?.amount ?? "0";
  const bookingAmount = data?.payment_channels?.[0]?.amount ?? "0";

  const periodLabel = period === "today" ? "Aujourd'hui" : period === "week" ? "7 jours" : "30 jours";

  const mobileMoney = data?.payment_mix?.find((pm) => {
    const m = (pm.method || "").toLowerCase();
    return m.includes("mobile") || m.includes("mtn") || m.includes("orange") || m.includes("wave") || m.includes("moov");
  });

  const totalRooms = rooms.length > 0 ? rooms.length : totalRoomsApi;

  const occRate = useMemo(() => {
    if (rooms.length > 0) {
      const occ = rooms.filter((r) => r.status === "occupied").length;
      return Math.round((occ / rooms.length) * 100);
    }
    const tot = Number(totalRoomsApi);
    return tot > 0 ? Math.round((Number(occupiedRooms) / tot) * 100) : 0;
  }, [rooms, occupiedRooms, totalRoomsApi]);

  const showBanner = !loading && data && (cleaningRooms > 0 || arrivalsToday > 0 || pendingBookings > 0);

  const roomTabCounts = useMemo(() => {
    if (rooms.length > 0) {
      return {
        all:            rooms.length,
        available:      rooms.filter((r) => r.status === "available").length,
        occupied:       rooms.filter((r) => r.status === "occupied").length,
        reserved:       rooms.filter((r) => r.status === "reserved").length,
        cleaning:       rooms.filter((r) => r.status === "cleaning").length,
        out_of_service: rooms.filter((r) => r.status === "out_of_service").length,
      };
    }

    return {
      all:            Number(totalRoomsApi) || 0,
      available:      Number(availableRoomsApi) || 0,
      occupied:       Number(occupiedRooms) || 0,
      reserved:       Number(reservedRoomsApi) || 0,
      cleaning:       Number(cleaningRooms) || 0,
      out_of_service: Number(outOfServiceRooms) || 0,
    };
  }, [rooms, totalRoomsApi, availableRoomsApi, occupiedRooms, reservedRoomsApi, cleaningRooms, outOfServiceRooms]);

  const filteredRooms = useMemo(() => {
    let list = rooms;
    if (roomFilter !== "all") {
      list = list.filter((r) => r.status === roomFilter);
    }
    if (roomSearch.trim()) {
      const q = roomSearch.trim().toLowerCase();
      list = list.filter((r) => String(r.number).toLowerCase().includes(q));
    }
    return list;
  }, [rooms, roomFilter, roomSearch]);

  const hotelName     = user?.hotel_name || user?.hotel?.name || "Mon hôtel";
  const todayLabel    = getTodayLabel();
  const revenueIsZero = parseFloat(String(periodRevenue).replace(/[\s ]/g, "")) === 0;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <motion.div
      className="page-stack db2-page"
      variants={pageVariants}
      initial="initial"
      animate="animate"
    >
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="db2-header">
        <div>
          <h2 className="db2-title">Vue d'ensemble · {hotelName}</h2>
          <p className="db2-subtitle">
            {todayLabel} · {hotelName} · {totalRooms} chambres · {activeClients} clients actifs
          </p>
        </div>
        <div className="db2-period-row">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`db2-period-btn${period === p.value ? " active" : ""}`}
              onClick={() => setPeriod(p.value)}
              aria-pressed={period === p.value}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {loading && <div className="status-box" role="status" aria-live="polite">Chargement…</div>}
      {error   && <div className="alert-box"  role="alert"  aria-live="assertive">{error}</div>}

      {/* ── ALERT BANNER ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showBanner && (
          <motion.div
            className="db2-banner"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="db2-banner-left">
              <i className="ti ti-alert-triangle db2-banner-icon" />
              <span className="db2-banner-text">
                {[
                  cleaningRooms   > 0 && `${cleaningRooms} chambre${cleaningRooms > 1 ? "s" : ""} en nettoyage`,
                  arrivalsToday   > 0 && `${arrivalsToday} arrivée${arrivalsToday > 1 ? "s" : ""} à traiter aujourd'hui`,
                  pendingBookings > 0 && `${pendingBookings} réservation${pendingBookings > 1 ? "s" : ""} en attente`,
                ].filter(Boolean).join(" · ")}
              </span>
            </div>
            <div className="db2-banner-actions">
              {(cleaningRooms > 0 || outOfServiceRooms > 0) && (
                <Link to="/rooms" className="db2-banner-btn">Chambres</Link>
              )}
              {(arrivalsToday > 0 || pendingBookings > 0) && (
                <Link to="/operations" className="db2-banner-btn">Réservations</Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 3-COLUMN GRID ──────────────────────────────────────────────────── */}
      {!loading && data && (
        <AnimatePresence mode="wait">
          <motion.div
            key={period}
            className="db2-grid"
            variants={dataVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {/* ── LEFT: Rooms ──────────────────────────────────────────── */}
            <motion.div className="db2-col-left" variants={cardVariants(0)}>
              <div className="db2-rooms-card">
                <div className="db2-rooms-hd">
                  <span className="db2-rooms-eyebrow">Occupation actuelle</span>
                  <div className="db2-rooms-rate">{occRate}%</div>
                  <span className="db2-rooms-meta">
                    {occupiedRooms} occ. · {totalRooms} chambres total
                  </span>
                </div>

                <div className="db2-rooms-tabs" role="tablist">
                  {ROOM_TABS.map((tab) => {
                    const tabStyle = ROOM_STATUS_STYLES[tab.key];
                    const isActive = roomFilter === tab.key;

                    return (
                      <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        className={`db2-rooms-tab${isActive ? " active" : ""}`}
                        style={tabStyle && isActive ? { borderBottomColor: tabStyle.dot } : undefined}
                        onClick={() => setRoomFilter(tab.key)}
                      >
                        <span className="db2-tab-n" style={tabStyle ? { color: tabStyle.color } : undefined}>
                          {roomTabCounts[tab.key]}
                        </span>
                        <span className="db2-tab-lbl" style={tabStyle && isActive ? { color: tabStyle.color } : undefined}>
                          {tab.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="db2-rooms-search-row">
                  <i className="ti ti-search db2-search-ico" />
                  <input
                    type="text"
                    placeholder="Chambre…"
                    value={roomSearch}
                    onChange={(e) => setRoomSearch(e.target.value)}
                    className="db2-search-inp"
                    aria-label="Rechercher une chambre"
                  />
                </div>

                <div className="db2-rooms-grid" role="grid">
                  {roomsLoading ? (
                    <span className="db2-rooms-hint">Chargement…</span>
                  ) : filteredRooms.length === 0 ? (
                    <span className="db2-rooms-hint">Aucune chambre</span>
                  ) : (
                    filteredRooms.map((room) => {
                      const s = ROOM_STATUS_STYLES[room.status] || ROOM_STATUS_STYLES.available;
                      return (
                        <button
                          key={room.id}
                          type="button"
                          className="db2-room-cell"
                          style={{ background: s.bg, color: s.color }}
                          onClick={() => navigate("/rooms")}
                          title={`${room.number} — ${room.status_label || room.status}`}
                        >
                          {room.number}
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="db2-rooms-ft">
                  <span>{filteredRooms.length}/{totalRooms} affichées</span>
                  <div className="db2-legend">
                    {[
                      ["available", ROOM_STATUS_STYLES.available.dot, "Disponible"],
                      ["occupied", ROOM_STATUS_STYLES.occupied.dot, "Occupee"],
                      ["reserved", ROOM_STATUS_STYLES.reserved.dot, "Reservee"],
                      ["cleaning", ROOM_STATUS_STYLES.cleaning.dot, "Nettoyage"],
                      ["out_of_service", ROOM_STATUS_STYLES.out_of_service.dot, "H.S."],
                    ].map(([key, c, t]) => (
                      <button
                        key={key}
                        type="button"
                        className={`db2-legend-dot${roomFilter === key ? " active" : ""}`}
                        style={{ background: c }}
                        title={`Filtrer : ${t}`}
                        aria-label={`Filtrer les chambres : ${t}`}
                        aria-pressed={roomFilter === key}
                        onClick={() => setRoomFilter(key)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* ── CENTER: Analytics ────────────────────────────────────── */}
            <motion.div className="db2-col-center" variants={cardVariants(1)}>
              {/* Activité du jour */}
              <div className="db2-card">
                <div className="db2-card-hd">
                  <span className="db2-card-ttl">Activité du jour</span>
                </div>
                <div className="db2-kpi-grid">
                  <div className="db2-kpi-cell">
                    <span className="db2-kpi-lbl">Arrivées</span>
                    <span className="db2-kpi-val" style={{ color: arrivalsKpi > 0 ? "#3B6D11" : undefined }}>
                      {arrivalsKpi}
                    </span>
                  </div>
                  <div className="db2-kpi-cell">
                    <span className="db2-kpi-lbl">Départs</span>
                    <span className="db2-kpi-val" style={{ color: departuresKpi > 0 ? "#A32D2D" : undefined }}>
                      {departuresKpi}
                    </span>
                  </div>
                  <div className="db2-kpi-cell">
                    <span className="db2-kpi-lbl">Day use</span>
                    <span className="db2-kpi-val">{dayUseKpi}</span>
                  </div>
                  <div className="db2-kpi-cell">
                    <span className="db2-kpi-lbl">Revenus du jour</span>
                    <span className="db2-kpi-val db2-kpi-rev">{fmtAmount(revenueKpi)}</span>
                  </div>
                </div>
              </div>

              {/* Pair: Financier + Équipe & clients */}
              <div className="db2-pair">
                <div className="db2-card">
                  <div className="db2-card-hd">
                    <span className="db2-card-ttl">Financier</span>
                    <span className="db2-fin-badge">{fmtAmount(totalPaid)}</span>
                  </div>
                  <div className="db2-metric-list">
                    <div className="db2-metric-row">
                      <span className="db2-m-lbl">Total encaissé</span>
                      <span className="db2-m-val" style={{ color: "#3B6D11" }}>{fmtAmount(totalPaid)}</span>
                    </div>
                    <div className="db2-metric-row">
                      <span className="db2-m-lbl">{periodLabel}</span>
                      <span className="db2-m-val" style={{ color: revenueIsZero ? "#A32D2D" : undefined }}>
                        {fmtAmount(periodRevenue)}
                      </span>
                    </div>
                    <div className="db2-metric-row">
                      <span className="db2-m-lbl">Séjours</span>
                      <span className="db2-m-val">{fmtAmount(staysAmount)}</span>
                    </div>
                    <div className="db2-metric-row">
                      <span className="db2-m-lbl">Réservations</span>
                      <span className="db2-m-val">{fmtAmount(bookingAmount)}</span>
                    </div>
                    {mobileMoney && (
                      <div className="db2-metric-row">
                        <span className="db2-m-lbl">Mobile money</span>
                        <span className="db2-m-val">{fmtAmount(mobileMoney.amount)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="db2-card">
                  <div className="db2-card-hd">
                    <span className="db2-card-ttl">Équipe & clients</span>
                  </div>
                  <div className="db2-metric-list">
                    <div className="db2-metric-row">
                      <span className="db2-m-lbl">Clients actifs</span>
                      <span className="db2-m-val">{activeClients}</span>
                    </div>
                    <div className="db2-metric-row">
                      <span className="db2-m-lbl">Blacklistés</span>
                      <span
                        className="db2-m-val"
                        style={{ color: Number(blacklistedClients) > 0 ? "#A32D2D" : undefined }}
                      >
                        {blacklistedClients}
                      </span>
                    </div>
                    <div className="db2-metric-row">
                      <span className="db2-m-lbl">Équipe active</span>
                      <span className="db2-m-val">{teamActive}</span>
                    </div>
                    <div className="db2-metric-row">
                      <span className="db2-m-lbl">Admins / Réception</span>
                      <span className="db2-m-val">{adminsReception}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Activité récente */}
              <div className="db2-card">
                <div className="db2-card-hd">
                  <span className="db2-card-ttl">Activité récente</span>
                </div>
                <div className="db2-act-list">
                  {(data?.recent_activity || []).length === 0 ? (
                    <span className="db2-empty">Aucune activité récente.</span>
                  ) : (
                    data.recent_activity.slice(0, 6).map((item, i) => {
                      const ts = getTagStyle(item.label);
                      return (
                        <div key={`act-${i}`} className="db2-act-row">
                          <span className="db2-act-tag" style={{ background: ts.bg, color: ts.color }}>
                            {item.label}
                          </span>
                          <span className="db2-act-text">{item.title || item.description}</span>
                          <span className="db2-act-time">{fmtTime(item.time)}</span>
                          {item.url && (
                            <Link to="/history/activity-logs" className="db2-act-link">Voir</Link>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>

            {/* ── RIGHT: Operations ────────────────────────────────────── */}
            <motion.div className="db2-col-right" variants={cardVariants(2)}>
              {/* Alertes */}
              {(data?.alerts || []).length > 0 && (
                <div className="db2-card db2-alerts-card">
                  <div className="db2-card-hd db2-alerts-hd">
                    <span className="db2-card-ttl db2-alerts-ttl">Alertes</span>
                  </div>
                  <div className="db2-alerts-list">
                    {data.alerts.map((alert, i) => (
                      <div key={`alrt-${i}`} className="db2-alert-item">
                        <span className="db2-alert-badge">{alert.count}</span>
                        <div className="db2-alert-body">
                          <span className="db2-alert-ttl">{alert.title}</span>
                          <Link to={alertToRoute(alert)} className="db2-alert-lnk">Voir →</Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Réservations */}
              <div className="db2-card">
                <div className="db2-card-hd">
                  <span className="db2-card-ttl">Réservations</span>
                </div>
                <div className="db2-metric-list">
                  <div className="db2-metric-row">
                    <span className="db2-m-lbl">En attente</span>
                    <span className="db2-m-val" style={{ color: pendingBookings > 0 ? "#854F0B" : undefined }}>
                      {pendingBookings}
                    </span>
                  </div>
                  <div className="db2-metric-row">
                    <span className="db2-m-lbl">Confirmées</span>
                    <span className="db2-m-val" style={{ color: confirmedBookings > 0 ? "#3B6D11" : undefined }}>
                      {confirmedBookings}
                    </span>
                  </div>
                  <div className="db2-metric-row">
                    <span className="db2-m-lbl">DU paiement</span>
                    <span className="db2-m-val">{pendingDayUse}</span>
                  </div>
                  <div className="db2-metric-row">
                    <span className="db2-m-lbl">DU prêts</span>
                    <span className="db2-m-val">{readyDayUse}</span>
                  </div>
                </div>
              </div>

              {/* Actions rapides */}
              <div className="db2-card">
                <div className="db2-card-hd">
                  <span className="db2-card-ttl">Actions rapides</span>
                </div>
                <div className="db2-quick-list">
                  {quickActions.map((action) => (
                    <Link key={`${action.to}-${action.label}`} to={action.to} className="db2-quick-btn">
                      <i className={`ti ${action.icon} db2-quick-ico`} />
                      <span>{action.label}</span>
                    </Link>
                  ))}
                  {!quickActions.length ? <span className="db2-empty">Aucune action disponible pour ce profil.</span> : null}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}
    </motion.div>
  );
}

