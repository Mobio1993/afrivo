import { useCallback, useEffect, useState } from "react";

import { fetchRoomRealtimeStates } from "../../services/roomsService";
import { fetchSmartAlerts, fetchSmartSensors, resolveSmartAlert } from "../../services/smartRoomsService";
import "./SmartRoomsPage.css";

const STATUS_LABELS = {
  available: "Disponible",
  occupied: "Occupee",
  reserved: "Reservee",
  cleaning: "Nettoyage",
  maintenance: "Maintenance",
  out_of_service: "Hors service",
};

const STATUS_CLASSES = {
  available: "badge--available",
  occupied: "badge--occupied",
  reserved: "badge--reserved",
  cleaning: "badge--cleaning",
  maintenance: "badge--maintenance",
  out_of_service: "badge--maintenance",
};

const ALERT_CLASSES = {
  none: "",
  warning: "alert--warning",
  critical: "alert--critical",
};

function Badge({ value, classMap, labelMap }) {
  return (
    <span className={`sr-badge ${classMap[value] || ""}`}>
      {labelMap[value] || value}
    </span>
  );
}

function SummaryCards({ summary }) {
  const cards = [
    { label: "Total chambres", value: summary.total, mod: "" },
    { label: "Disponibles", value: summary.available, mod: "card--available" },
    { label: "Occupees", value: summary.occupied, mod: "card--occupied" },
    { label: "Nettoyage", value: summary.cleaning, mod: "card--cleaning" },
    { label: "Maintenance", value: summary.maintenance, mod: "card--maintenance" },
    { label: "Alertes actives", value: summary.activeAlerts, mod: "card--alert" },
    { label: "Presence detectee", value: summary.presenceDetected, mod: "card--presence" },
    { label: "kWh aujourd'hui", value: summary.energyToday, mod: "" },
  ];

  return (
    <div className="sr-summary-grid">
      {cards.map((c) => (
        <div key={c.label} className={`sr-summary-card ${c.mod}`}>
          <span className="sr-summary-label">{c.label}</span>
          <strong className="sr-summary-value">{c.value}</strong>
        </div>
      ))}
    </div>
  );
}

function ViewTabs({ activeView, onChange }) {
  const tabs = [
    { key: "receptionist", label: "Vue receptionniste" },
    { key: "manager", label: "Vue manager" },
    { key: "security", label: "Securite / Maintenance" },
  ];

  return (
    <div className="sr-tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={activeView === t.key}
          className={`sr-tab ${activeView === t.key ? "sr-tab--active" : ""}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function RoomDetailModal({ room, onClose }) {
  if (!room) return null;

  return (
    <div className="sr-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="sr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sr-modal-header">
          <h2>Chambre {room.roomNumber}</h2>
          <button type="button" className="ghost-button sr-modal-close" onClick={onClose} aria-label="Fermer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="20" height="20">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="sr-modal-body">
          <div className="sr-detail-grid">
            <div className="sr-detail-row">
              <span className="sr-detail-label">Type</span>
              <span>{room.roomType}</span>
            </div>
            <div className="sr-detail-row">
              <span className="sr-detail-label">Etage</span>
              <span>{room.floor}</span>
            </div>
            <div className="sr-detail-row">
              <span className="sr-detail-label">Statut hotelier</span>
              <Badge value={room.hotelStatus} classMap={STATUS_CLASSES} labelMap={STATUS_LABELS} />
            </div>
            <div className="sr-detail-row">
              <span className="sr-detail-label">Presence</span>
              <span className={`sr-indicator ${room.presenceStatus === "detected" ? "sr-indicator--on" : "sr-indicator--off"}`}>
                {room.presenceStatus === "detected" ? "Detectee" : "Aucune"}
              </span>
            </div>
            <div className="sr-detail-row">
              <span className="sr-detail-label">Porte</span>
              <span className={`sr-indicator ${room.doorStatus !== "closed" ? "sr-indicator--warn" : "sr-indicator--off"}`}>
                {room.doorStatus === "closed" ? "Fermee" : room.doorStatus === "open_long" ? "Ouverte (trop longtemps)" : "Ouverte"}
              </span>
            </div>
            <div className="sr-detail-row">
              <span className="sr-detail-label">Climatisation</span>
              <span className={`sr-indicator ${room.acStatus === "on" ? "sr-indicator--on" : "sr-indicator--off"}`}>
                {room.acStatus === "on" ? "Allumee" : "Eteinte"}
              </span>
            </div>
            <div className="sr-detail-row">
              <span className="sr-detail-label">Lumiere</span>
              <span className={`sr-indicator ${room.lightStatus === "on" ? "sr-indicator--on" : "sr-indicator--off"}`}>
                {room.lightStatus === "on" ? "Allumee" : "Eteinte"}
              </span>
            </div>
            <div className="sr-detail-row">
              <span className="sr-detail-label">Temperature</span>
              <span className={room.temperature > 27 ? "sr-value--warn" : ""}>{room.temperature} C</span>
            </div>
            <div className="sr-detail-row">
              <span className="sr-detail-label">Humidite</span>
              <span>{room.humidity} %</span>
            </div>
            <div className="sr-detail-row">
              <span className="sr-detail-label">Derniere activite</span>
              <span>{room.lastActivity}</span>
            </div>
            <div className="sr-detail-row">
              <span className="sr-detail-label">Capteur</span>
              <span className={`sr-indicator ${room.sensorStatus === "online" ? "sr-indicator--on" : "sr-indicator--off"}`}>
                {room.sensorStatus === "online" ? "En ligne" : "Hors ligne"}
              </span>
            </div>
          </div>
          {room.alertLevel !== "none" && (
            <div className={`sr-modal-alert ${ALERT_CLASSES[room.alertLevel]}`}>
              {room.alertMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReceptionistView({ rooms, onSelectRoom }) {
  if (rooms.length === 0) {
    return <p className="sr-empty">Aucune chambre a afficher.</p>;
  }

  return (
    <div className="sr-cards-grid">
      {rooms.map((room) => (
        <div key={room.id} className={`sr-room-card ${room.alertLevel !== "none" ? `sr-room-card--${room.alertLevel}` : ""}`}>
          <div className="sr-room-card-header">
            <strong className="sr-room-number">Ch. {room.roomNumber}</strong>
            <Badge value={room.hotelStatus} classMap={STATUS_CLASSES} labelMap={STATUS_LABELS} />
          </div>
          <div className="sr-room-card-type">{room.roomType} &middot; {room.floor}</div>
          <div className="sr-room-card-indicators">
            <span className={`sr-indicator-dot ${room.presenceStatus === "detected" ? "sr-indicator-dot--on" : "sr-indicator-dot--off"}`} title="Presence" />
            <span className={`sr-indicator-dot ${room.doorStatus !== "closed" ? "sr-indicator-dot--warn" : "sr-indicator-dot--off"}`} title="Porte" />
            <span className={`sr-indicator-dot ${room.acStatus === "on" ? "sr-indicator-dot--on" : "sr-indicator-dot--off"}`} title="Clim" />
            <span className={`sr-indicator-dot ${room.lightStatus === "on" ? "sr-indicator-dot--on" : "sr-indicator-dot--off"}`} title="Lumiere" />
            <span className={`sr-indicator-dot ${room.sensorStatus === "online" ? "sr-indicator-dot--on" : "sr-indicator-dot--offline"}`} title="Capteur" />
          </div>
          {room.alertLevel !== "none" && (
            <div className={`sr-room-card-alert ${ALERT_CLASSES[room.alertLevel]}`}>
              {room.alertMessage}
            </div>
          )}
          <div className="sr-room-card-footer">
            <span className="sr-room-last-activity">{room.lastActivity}</span>
            <button
              type="button"
              className="ghost-button sr-detail-btn"
              onClick={() => onSelectRoom(room)}
            >
              Voir detail
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ManagerView({ rooms, search, setSearch, filterStatus, setFilterStatus, filterPresence, setFilterPresence, filterAlert, setFilterAlert, onRefresh, onSelectRoom }) {
  return (
    <div className="sr-manager-layout">
      <div className="sr-toolbar">
        <input
          type="search"
          className="filter-input"
          placeholder="Rechercher chambre ou type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="filter-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="available">Disponible</option>
          <option value="occupied">Occupee</option>
          <option value="reserved">Reservee</option>
          <option value="cleaning">Nettoyage</option>
          <option value="maintenance">Maintenance</option>
        </select>
        <select className="filter-input" value={filterPresence} onChange={(e) => setFilterPresence(e.target.value)}>
          <option value="">Toute presence</option>
          <option value="detected">Presence detectee</option>
          <option value="none">Aucune presence</option>
        </select>
        <select className="filter-input" value={filterAlert} onChange={(e) => setFilterAlert(e.target.value)}>
          <option value="">Toutes alertes</option>
          <option value="active">Alertes actives</option>
          <option value="critical">Critique</option>
          <option value="warning">Avertissement</option>
        </select>
        <button type="button" className="ghost-button" onClick={onRefresh}>
          Actualiser
        </button>
      </div>

      {rooms.length === 0 ? (
        <p className="sr-empty">Aucune chambre ne correspond aux filtres.</p>
      ) : (
        <div className="sr-table-wrapper">
          <table className="sr-table">
            <thead>
              <tr>
                <th>Chambre</th>
                <th>Type</th>
                <th>Statut</th>
                <th>Presence</th>
                <th>Porte</th>
                <th>Clim</th>
                <th>Temp.</th>
                <th>Humidite</th>
                <th>Derniere activite</th>
                <th>Alerte</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id} className={room.alertLevel !== "none" ? `sr-row--${room.alertLevel}` : ""}>
                  <td className="sr-cell-number">{room.roomNumber}</td>
                  <td>{room.roomType}</td>
                  <td>
                    <Badge value={room.hotelStatus} classMap={STATUS_CLASSES} labelMap={STATUS_LABELS} />
                  </td>
                  <td>
                    <span className={`sr-dot ${room.presenceStatus === "detected" ? "sr-dot--on" : "sr-dot--off"}`}>
                      {room.presenceStatus === "detected" ? "Oui" : "Non"}
                    </span>
                  </td>
                  <td>
                    <span className={room.doorStatus !== "closed" ? "sr-value--warn" : ""}>
                      {room.doorStatus === "closed" ? "Fermee" : room.doorStatus === "open_long" ? "Ouverte !" : "Ouverte"}
                    </span>
                  </td>
                  <td>
                    <span className={room.acStatus === "on" ? "sr-dot--on" : "sr-dot--off"}>
                      {room.acStatus === "on" ? "On" : "Off"}
                    </span>
                  </td>
                  <td className={room.temperature > 27 ? "sr-value--warn" : ""}>{room.temperature} C</td>
                  <td>{room.humidity} %</td>
                  <td className="sr-cell-activity">{room.lastActivity}</td>
                  <td>
                    {room.alertLevel !== "none" ? (
                      <span className={`sr-badge ${ALERT_CLASSES[room.alertLevel]}`}>
                        {room.alertLevel === "critical" ? "Critique" : "Attention"}
                      </span>
                    ) : (
                      <span className="sr-badge sr-badge--none">OK</span>
                    )}
                  </td>
                  <td>
                    <button type="button" className="ghost-button sr-detail-btn-sm" onClick={() => onSelectRoom(room)}>
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SecurityView({ rooms, alerts, sensors, onResolveAlert }) {
  const criticalAlerts = rooms.filter((r) => r.alertLevel === "critical");
  const warningAlerts = rooms.filter((r) => r.alertLevel === "warning");
  const offlineSensors = rooms.filter((r) => r.sensorStatus === "offline");
  const tempAnomalies = rooms.filter((r) => r.temperature > 27);
  const presenceAnomalies = rooms.filter((r) => r.hotelStatus === "available" && r.presenceStatus === "detected");
  const doorAlerts = rooms.filter((r) => r.doorStatus === "open_long");
  const dbAlerts = alerts.filter((a) => a.is_active);

  return (
    <div className="sr-security-layout">
      <div className="sr-security-col">
        <section className="sr-security-section">
          <h3 className="sr-section-title">
            Alertes critiques
            {criticalAlerts.length > 0 && <span className="sr-section-count sr-section-count--critical">{criticalAlerts.length}</span>}
          </h3>
          {criticalAlerts.length === 0 ? (
            <p className="sr-empty-sm">Aucune alerte critique.</p>
          ) : (
            <ul className="sr-alert-list">
              {criticalAlerts.map((r) => (
                <li key={r.id} className="sr-alert-item sr-alert-item--critical">
                  <strong>Ch. {r.roomNumber}</strong>
                  <span>{r.alertMessage}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="sr-security-section">
          <h3 className="sr-section-title">
            Avertissements
            {warningAlerts.length > 0 && <span className="sr-section-count sr-section-count--warning">{warningAlerts.length}</span>}
          </h3>
          {warningAlerts.length === 0 ? (
            <p className="sr-empty-sm">Aucun avertissement.</p>
          ) : (
            <ul className="sr-alert-list">
              {warningAlerts.map((r) => (
                <li key={r.id} className="sr-alert-item sr-alert-item--warning">
                  <strong>Ch. {r.roomNumber}</strong>
                  <span>{r.alertMessage}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {dbAlerts.length > 0 && (
          <section className="sr-security-section">
            <h3 className="sr-section-title">
              Alertes enregistrees
              <span className="sr-section-count sr-section-count--critical">{dbAlerts.length}</span>
            </h3>
            <ul className="sr-alert-list">
              {dbAlerts.map((a) => (
                <li key={a.id} className={`sr-alert-item ${a.severity === "critical" ? "sr-alert-item--critical" : "sr-alert-item--warning"}`}>
                  <div className="sr-alert-item-content">
                    <strong>Ch. {a.room_number}</strong>
                    <span>{a.message}</span>
                  </div>
                  <button
                    type="button"
                    className="ghost-button sr-resolve-btn"
                    onClick={() => onResolveAlert(a.id)}
                  >
                    Resoudre
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="sr-security-col">
        <section className="sr-security-section">
          <h3 className="sr-section-title">
            Capteurs hors ligne
            {offlineSensors.length > 0 && <span className="sr-section-count sr-section-count--warning">{offlineSensors.length}</span>}
          </h3>
          {offlineSensors.length === 0 ? (
            <p className="sr-empty-sm">Tous les capteurs sont en ligne.</p>
          ) : (
            <ul className="sr-alert-list">
              {offlineSensors.map((r) => (
                <li key={r.id} className="sr-alert-item sr-alert-item--warning">
                  <strong>Ch. {r.roomNumber}</strong>
                  <span>Capteur hors ligne — {r.lastActivity}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="sr-security-section">
          <h3 className="sr-section-title">
            Anomalies temperature
            {tempAnomalies.length > 0 && <span className="sr-section-count sr-section-count--warning">{tempAnomalies.length}</span>}
          </h3>
          {tempAnomalies.length === 0 ? (
            <p className="sr-empty-sm">Aucune anomalie de temperature.</p>
          ) : (
            <ul className="sr-alert-list">
              {tempAnomalies.map((r) => (
                <li key={r.id} className="sr-alert-item sr-alert-item--warning">
                  <strong>Ch. {r.roomNumber}</strong>
                  <span>{r.temperature} C — superieure au seuil (27 C)</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="sr-security-section">
          <h3 className="sr-section-title">
            Anomalies presence
            {presenceAnomalies.length > 0 && <span className="sr-section-count sr-section-count--critical">{presenceAnomalies.length}</span>}
          </h3>
          {presenceAnomalies.length === 0 ? (
            <p className="sr-empty-sm">Aucune anomalie de presence.</p>
          ) : (
            <ul className="sr-alert-list">
              {presenceAnomalies.map((r) => (
                <li key={r.id} className="sr-alert-item sr-alert-item--critical">
                  <strong>Ch. {r.roomNumber}</strong>
                  <span>Chambre disponible avec presence detectee</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="sr-security-section">
          <h3 className="sr-section-title">
            Portes ouvertes trop longtemps
            {doorAlerts.length > 0 && <span className="sr-section-count sr-section-count--critical">{doorAlerts.length}</span>}
          </h3>
          {doorAlerts.length === 0 ? (
            <p className="sr-empty-sm">Aucune porte ouverte anormalement.</p>
          ) : (
            <ul className="sr-alert-list">
              {doorAlerts.map((r) => (
                <li key={r.id} className="sr-alert-item sr-alert-item--critical">
                  <strong>Ch. {r.roomNumber}</strong>
                  <span>Porte ouverte — {r.lastActivity}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export function SmartRoomsPage() {
  const [rooms, setRooms] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState("receptionist");
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPresence, setFilterPresence] = useState("");
  const [filterAlert, setFilterAlert] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [realtimeResult, alertsResult, sensorsResult] = await Promise.allSettled([
        fetchRoomRealtimeStates(),
        fetchSmartAlerts({ is_active: "true" }),
        fetchSmartSensors({ status: "offline" }),
      ]);

      if (realtimeResult.status === "fulfilled") {
        setRooms(realtimeResult.value?.results || []);
      } else {
        setRooms([]);
        setError("Impossible de charger les chambres intelligentes de cet hotel.");
      }

      if (alertsResult.status === "fulfilled") {
        setAlerts(alertsResult.value?.results || []);
      } else {
        setAlerts([]);
      }
      if (sensorsResult.status === "fulfilled") {
        setSensors(sensorsResult.value?.results || []);
      } else {
        setSensors([]);
      }
    } catch {
      setRooms([]);
      setAlerts([]);
      setSensors([]);
      setError("Impossible de contacter l'API des chambres intelligentes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleResolveAlert(alertId) {
    try {
      await resolveSmartAlert(alertId);
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, is_active: false } : a)));
    } catch {
      // silently fail — the alert will refresh on next load
    }
  }

  const summary = {
    total: rooms.length,
    available: rooms.filter((r) => r.hotelStatus === "available").length,
    occupied: rooms.filter((r) => r.hotelStatus === "occupied").length,
    cleaning: rooms.filter((r) => r.hotelStatus === "cleaning").length,
    maintenance: rooms.filter((r) => r.hotelStatus === "maintenance" || r.hotelStatus === "out_of_service").length,
    activeAlerts: rooms.filter((r) => r.alertLevel !== "none").length,
    presenceDetected: rooms.filter((r) => r.presenceStatus === "detected").length,
    energyToday: "—",
  };

  const filteredRooms = rooms.filter((room) => {
    const q = search.toLowerCase();
    if (q && !room.roomNumber.toLowerCase().includes(q) && !room.roomType.toLowerCase().includes(q)) return false;
    if (filterStatus && room.hotelStatus !== filterStatus) return false;
    if (filterPresence && room.presenceStatus !== filterPresence) return false;
    if (filterAlert === "active" && room.alertLevel === "none") return false;
    if (filterAlert === "critical" && room.alertLevel !== "critical") return false;
    if (filterAlert === "warning" && room.alertLevel !== "warning") return false;
    return true;
  });

  return (
    <div className="smart-rooms-page page-stack">
      <header className="page-hero">
        <div className="page-hero-content">
          <h1 className="page-title">Chambres intelligentes</h1>
          <p className="page-subtitle">
            Suivi en temps reel — presence, capteurs, alertes, energie
          </p>
        </div>
      </header>

      {error && <div className="sr-error-banner">{error}</div>}

      {loading ? (
        <div className="sr-loading">Chargement des donnees en temps reel...</div>
      ) : (
        <>
          <SummaryCards summary={summary} />
          <ViewTabs activeView={activeView} onChange={setActiveView} />

          {activeView === "receptionist" && (
            <ReceptionistView rooms={filteredRooms} onSelectRoom={setSelectedRoom} />
          )}
          {activeView === "manager" && (
            <ManagerView
              rooms={filteredRooms}
              search={search}
              setSearch={setSearch}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              filterPresence={filterPresence}
              setFilterPresence={setFilterPresence}
              filterAlert={filterAlert}
              setFilterAlert={setFilterAlert}
              onRefresh={loadData}
              onSelectRoom={setSelectedRoom}
            />
          )}
          {activeView === "security" && (
            <SecurityView
              rooms={rooms}
              alerts={alerts}
              sensors={sensors}
              onResolveAlert={handleResolveAlert}
            />
          )}
        </>
      )}

      <RoomDetailModal room={selectedRoom} onClose={() => setSelectedRoom(null)} />
    </div>
  );
}
