import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../../auth/AuthContext";
import { hasPermission } from "../../auth/permissions";
import { AppSelect } from "../../components/AppSelect";
import { DatePicker } from "../../components/DatePicker";
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
  resolveMaintenanceIncident,
  startHousekeepingTask,
  updateRoom,
  updateRoomType,
} from "../../services/roomsService";
import "./RoomsPage.css";

const ROOM_STATUS_OPTIONS = [
  { value: "all", label: "Tous les statuts" },
  { value: "available", label: "Disponible" },
  { value: "occupied", label: "Occupée" },
  { value: "reserved", label: "Réservée" },
  { value: "cleaning", label: "Nettoyage" },
  { value: "out_of_service", label: "Hors service" },
];

const TABS = [
  { key: "overview", label: "Vue hôtel", permissions: [["rooms", "view"], ["operations", "view"]] },
  { key: "types", label: "Types de chambres", permissions: [["rooms", "manage"]] },
  { key: "rooms", label: "Toutes les chambres", permissions: [["rooms", "view"]] },
  { key: "realtime", label: "Vue temps réel", permissions: [["rooms", "view"]] },
  { key: "housekeeping", label: "Housekeeping", permissions: [["rooms", "view"], ["operations", "view"]] },
  { key: "maintenance", label: "Maintenance", permissions: [["rooms", "update"], ["operations", "update"], ["operations", "manage"]] },
  { key: "pricing", label: "Tarification", permissions: [["rooms", "manage"]] },
];

const REALTIME_FILTERS = [
  { value: "all", label: "Toutes" },
  { value: "occupied", label: "Occupées" },
  { value: "available", label: "Disponibles" },
  { value: "presence", label: "Présence détectée" },
  { value: "door_open", label: "Porte ouverte" },
  { value: "alerts", label: "Alertes" },
];

const EMPTY_ROOM_FORM = {
  number: "",
  room_type: "",
  floor: "",
  status: "available",
  custom_price_per_night: "",
  custom_price_day_use: "",
  is_vip_preferred: false,
  notes: "",
  is_active: true,
};

const EMPTY_ROOM_TYPE_FORM = {
  name: "",
  code: "",
  description: "",
  capacity: 1,
  max_adults: 1,
  max_children: 0,
  base_price_per_night: "",
  base_price_day_use: "",
  amenities: "",
  image_urls: "",
  pricing_policy_notes: "",
  is_day_use_available: true,
  is_active: true,
};

const EMPTY_TASK_FORM = {
  room: "",
  task_type: "turnover",
  priority: "normal",
  assigned_to: "",
  estimated_minutes: 30,
  notes: "",
  issue_reported: "",
};

const EMPTY_INCIDENT_FORM = {
  room: "",
  title: "",
  description: "",
  severity: "medium",
  marks_room_out_of_service: true,
  assigned_to: "",
};

const EMPTY_RULE_FORM = {
  room_type: "",
  name: "",
  applies_to: "night",
  rule_type: "weekend",
  adjustment_mode: "percent",
  adjustment_value: "",
  start_date: "",
  end_date: "",
  min_occupancy_rate: "",
  priority: 10,
  is_active: true,
};

const EMPTY_SUGGESTION_FORM = {
  guest: "",
  room_type: "",
  check_in_date: "",
  check_out_date: "",
};

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
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildRoomTypePayload(form) {
  return {
    ...form,
    capacity: Number(form.capacity) || 1,
    max_adults: Number(form.max_adults) || 1,
    max_children: Number(form.max_children) || 0,
    base_price_per_night: form.base_price_per_night || 0,
    base_price_day_use: form.base_price_day_use || 0,
    amenities: normalizeListInput(form.amenities),
    image_urls: normalizeListInput(form.image_urls),
  };
}

function buildRoomPayload(form) {
  return {
    ...form,
    room_type: Number(form.room_type),
    floor: form.floor === "" ? null : Number(form.floor),
    custom_price_per_night: form.custom_price_per_night || null,
    custom_price_day_use: form.custom_price_day_use || null,
  };
}

/* Mappings hors composant — évite la recréation à chaque appel (arch fix) */
const REALTIME_BADGE_MAPPINGS = {
  hotelStatus: {
    available:      { label: "Disponible",           tone: "available"    },
    occupied:       { label: "Occupée",               tone: "occupied"     },
    reserved:       { label: "Réservée",              tone: "info"         },
    cleaning:       { label: "Nettoyage",             tone: "cleaning"     },
    maintenance:    { label: "Maintenance",           tone: "maintenance"  },
    out_of_service: { label: "Hors service",          tone: "maintenance"  },
  },
  presenceStatus: {
    detected: { label: "Présence détectée", tone: "presence" },
    none:     { label: "Aucune présence",   tone: "neutral"  },
  },
  doorStatus: {
    closed:    { label: "Fermée",                 tone: "neutral"   },
    open:      { label: "Ouverte",                tone: "warning"   },
    open_long: { label: "Ouverte trop longtemps", tone: "critical"  },
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
    none:     { label: "Aucune",   tone: "neutral"   },
    warning:  { label: "Attention", tone: "warning"  },
    critical: { label: "Critique", tone: "critical"  },
  },
  sensorStatus: {
    online:  { label: "Capteurs en ligne",    tone: "available"   },
    offline: { label: "Capteurs hors ligne",  tone: "maintenance" },
  },
};

function getRealtimeBadgeMeta(type, value) {
  return REALTIME_BADGE_MAPPINGS[type]?.[value] || { label: value || "-", tone: "neutral" };
}

function sortRealtimeRooms(items) {
  const alertWeight = { critical: 0, warning: 1, none: 2 };
  return [...items].sort((first, second) => {
    const alertDelta = (alertWeight[first.alertLevel] ?? 3) - (alertWeight[second.alertLevel] ?? 3);
    if (alertDelta !== 0) {
      return alertDelta;
    }
    return first.roomNumber.localeCompare(second.roomNumber, "fr", { numeric: true });
  });
}

export function RoomsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [dashboard, setDashboard] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [pricingRules, setPricingRules] = useState([]);
  const [realtimeRooms, setRealtimeRooms] = useState([]);
  const [choices, setChoices] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [realtimeSearch, setRealtimeSearch] = useState("");
  const [realtimeFilter, setRealtimeFilter] = useState("all");
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [selectedRealtimeRoomId, setSelectedRealtimeRoomId] = useState(null);
  const [roomForm, setRoomForm] = useState(EMPTY_ROOM_FORM);
  const [roomTypeForm, setRoomTypeForm] = useState(EMPTY_ROOM_TYPE_FORM);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK_FORM);
  const [incidentForm, setIncidentForm] = useState(EMPTY_INCIDENT_FORM);
  const [ruleForm, setRuleForm] = useState(EMPTY_RULE_FORM);
  const [suggestionForm, setSuggestionForm] = useState(EMPTY_SUGGESTION_FORM);
  const [resolvingIncidentId, setResolvingIncidentId] = useState(null);
  const [resolveNotes, setResolveNotes] = useState("");
  /* États de soumission distincts par formulaire */
  const [submittingCheckin,     setSubmittingCheckin]     = useState(false);
  const [submittingCheckout,    setSubmittingCheckout]    = useState(false);
  const [submittingRoom,        setSubmittingRoom]        = useState(false);
  const [submittingClean,       setSubmittingClean]       = useState(false);
  const [submittingType,        setSubmittingType]        = useState(false);
  const [submittingTask,        setSubmittingTask]        = useState(false);
  const [submittingIncident,    setSubmittingIncident]    = useState(false);
  const [submittingRule,        setSubmittingRule]        = useState(false);
  const [submittingSuggestions, setSubmittingSuggestions] = useState(false);
  const anySubmitting = submittingCheckin || submittingCheckout || submittingRoom || submittingClean || submittingType || submittingTask || submittingIncident || submittingRule || submittingSuggestions;

  const [errorMsg,   setErrorMsg]   = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const errorTimerRef   = useRef(null);
  const successTimerRef = useRef(null);
  const abortRef        = useRef(null);
  const isFirstRender   = useRef(true);

  const visibleTabs = useMemo(
    () =>
      TABS.filter((tab) =>
        tab.permissions.some(([module, action]) => hasPermission(user, module, action)),
      ),
    [user],
  );
  const allowedTabKeys = useMemo(() => new Set(visibleTabs.map((tab) => tab.key)), [visibleTabs]);
  const defaultTabKey = visibleTabs[0]?.key || "overview";
  const canAccessTab = useCallback(
    (tabKey) => allowedTabKeys.has(tabKey),
    [allowedTabKeys],
  );

  const canManageInventory = hasPermission(user, "rooms", "manage");
  const canOperateRooms =
    hasPermission(user, "rooms", "update")
    || hasPermission(user, "operations", "update")
    || hasPermission(user, "operations", "manage");
  const roomAgents = choices?.room_agents || choices?.supervisor_users || [];

  function buildRoomFormFromRoom(room) {
    return {
      number: room.number || "",
      room_type: String(room.room_type || room.room_type_id || ""),
      floor: room.floor === "-" || room.floor === null ? "" : room.floor,
      status: room.status || "available",
      custom_price_per_night: room.custom_price_per_night || "",
      custom_price_day_use: room.custom_price_day_use || "",
      is_vip_preferred: room.is_vip_preferred || false,
      notes: room.notes || "",
      is_active: room.is_active ?? true,
    };
  }

  async function loadData(currentSearch = search, currentStatus = statusFilter) {
    /* Annuler la requête précédente pour éviter les race conditions */
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setFetching(true);

    const roomParams = {
      search: currentSearch,
      status: currentStatus === "all" ? "" : currentStatus,
      is_active: "true",
    };

    try {
      const [dashboardPayload, roomsPayload, roomTypesPayload, tasksPayload, incidentsPayload, pricingPayload, choicesPayload, realtimePayload] =
        await Promise.all([
          getRoomsDashboard(controller.signal),
          listRooms(roomParams, controller.signal),
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

  /* Un seul useEffect de chargement — évite le double appel au montage */
  useEffect(() => {
    const delay = isFirstRender.current ? 0 : 250;
    isFirstRender.current = false;

    const timer = setTimeout(() => {
      loadData(search, statusFilter)
        .catch((err) => {
          if (err.name === "AbortError") return;
          showError(getRequestError(err, "Impossible de charger le module chambres."));
        })
        .finally(() => setLoading(false));
    }, delay);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [search, statusFilter]);

  /* auto-dismiss notifications */
  useEffect(() => () => {
    clearTimeout(errorTimerRef.current);
    clearTimeout(successTimerRef.current);
    abortRef.current?.abort();
  }, []);

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

  useEffect(() => {
    if (!allowedTabKeys.has(activeTab)) {
      setActiveTab(defaultTabKey);
    }
  }, [activeTab, allowedTabKeys, defaultTabKey]);

  const selectedRoom = useMemo(() => rooms.find((item) => item.id === selectedRoomId) || null, [rooms, selectedRoomId]);
  const selectedRoomType = useMemo(() => roomTypes.find((item) => item.id === selectedTypeId) || null, [roomTypes, selectedTypeId]);
  const filteredRealtimeRooms = useMemo(() => {
    const query = realtimeSearch.trim().toLowerCase();
    return sortRealtimeRooms(
      realtimeRooms.filter((room) => {
        const matchesQuery = !query || [
          room.roomNumber,
          room.roomType,
          room.floor,
          getRealtimeBadgeMeta("hotelStatus", room.hotelStatus).label,
          room.alertMessage,
        ].join(" ").toLowerCase().includes(query);

        const matchesFilter = (() => {
          switch (realtimeFilter) {
            case "occupied":
              return room.hotelStatus === "occupied";
            case "available":
              return room.hotelStatus === "available";
            case "presence":
              return room.presenceStatus === "detected";
            case "door_open":
              return room.doorStatus === "open" || room.doorStatus === "open_long";
            case "alerts":
              return room.alertLevel !== "none";
            default:
              return true;
          }
        })();

        return matchesQuery && matchesFilter;
      }),
    );
  }, [realtimeFilter, realtimeRooms, realtimeSearch]);
  const selectedRealtimeRoom = useMemo(
    () => filteredRealtimeRooms.find((item) => item.id === selectedRealtimeRoomId)
      || realtimeRooms.find((item) => item.id === selectedRealtimeRoomId)
      || filteredRealtimeRooms[0]
      || null,
    [filteredRealtimeRooms, realtimeRooms, selectedRealtimeRoomId],
  );
  const realtimeSummaryCards = useMemo(() => {
    const total = realtimeRooms.length;
    const presenceDetected = realtimeRooms.filter((item) => item.presenceStatus === "detected").length;
    const doorsOpen = realtimeRooms.filter((item) => item.doorStatus === "open" || item.doorStatus === "open_long").length;
    const activeAlerts = realtimeRooms.filter((item) => item.alertLevel !== "none").length;
    const offlineSensors = realtimeRooms.filter((item) => item.sensorStatus === "offline").length;
    return [
      { label: "Chambres supervisées", value: total, meta: "Inventaire temps réel disponible dans cette vue.", tone: "default" },
      { label: "Présence détectée", value: presenceDetected, meta: "Pièces actuellement occupées ou animées.", tone: "available" },
      { label: "Portes ouvertes", value: doorsOpen, meta: "Ouvertures à vérifier en priorité réception.", tone: "cleaning" },
      { label: "Alertes actives", value: activeAlerts, meta: "Anomalies ou situations à traiter rapidement.", tone: "blocked" },
      { label: "Capteurs hors ligne", value: offlineSensors, meta: "Équipements à reconnecter ou contrôler.", tone: "occupied" },
    ];
  }, [realtimeRooms]);

  const summaryCards = useMemo(() => {
    const summary = dashboard?.summary || {};
    return [
      { label: "Disponibles", value: summary.available_count || 0, meta: "Chambres remises en vente immédiatement.", tone: "available" },
      { label: "Occupées", value: summary.occupied_count || 0, meta: "Séjours ou day use actuellement en cours.", tone: "occupied" },
      { label: "Nettoyage", value: summary.cleaning_count || 0, meta: "Priorités housekeeping a traiter.", tone: "cleaning" },
      { label: "Hors service", value: summary.out_of_service_count || 0, meta: "Incidents techniques bloquants.", tone: "blocked" },
    ];
  }, [dashboard]);

  useEffect(() => {
    if (!selectedRealtimeRoomId && filteredRealtimeRooms.length) {
      setSelectedRealtimeRoomId(filteredRealtimeRooms[0].id);
      return;
    }
    if (selectedRealtimeRoomId && !filteredRealtimeRooms.some((item) => item.id === selectedRealtimeRoomId)) {
      setSelectedRealtimeRoomId(filteredRealtimeRooms[0]?.id || null);
    }
  }, [filteredRealtimeRooms, selectedRealtimeRoomId]);

  function handleSelectRoom(room) {
    setSelectedRoomId(room.id);
    setRoomForm(buildRoomFormFromRoom(room));
  }

  /* ── Check-in depuis la fiche chambre ─────────────────────── */
  async function handleCheckIn(room) {
    if (!canOperateRooms || submittingCheckin) return;
    setSubmittingCheckin(true);
    try {
      const updatedRoom = await checkInRoom(room.id);
      await loadData(search, statusFilter);
      if (selectedRoomId === room.id && updatedRoom) setRoomForm(buildRoomFormFromRoom(updatedRoom));
      showSuccess(`Check-in effectué pour la chambre ${room.number}.`);
    } catch (error) {
      if (error.name === "AbortError") return;
      showError(getRequestError(error, "Impossible d'effectuer le check-in."));
    } finally {
      setSubmittingCheckin(false);
    }
  }

  /* ── Check-out depuis la fiche chambre ─────────────────────── */
  async function handleCheckOut(room) {
    if (!canOperateRooms || submittingCheckout) return;
    setSubmittingCheckout(true);
    try {
      const updatedRoom = await checkOutRoom(room.id);
      await loadData(search, statusFilter);
      if (selectedRoomId === room.id && updatedRoom) setRoomForm(buildRoomFormFromRoom(updatedRoom));
      showSuccess(`Check-out effectué pour la chambre ${room.number}.`);
    } catch (error) {
      if (error.name === "AbortError") return;
      showError(getRequestError(error, "Impossible d'effectuer le check-out."));
    } finally {
      setSubmittingCheckout(false);
    }
  }

  function handleSelectType(item) {
    setSelectedTypeId(item.id);
    setRoomTypeForm({
      name: item.name || "",
      code: item.code || "",
      description: item.description || "",
      capacity: item.capacity || 1,
      max_adults: item.max_adults || 1,
      max_children: item.max_children || 0,
      base_price_per_night: item.base_price_per_night || "",
      base_price_day_use: item.base_price_day_use || "",
      amenities: (item.amenities || []).join(", "),
      image_urls: (item.image_urls || []).join(", "),
      pricing_policy_notes: item.pricing_policy_notes || "",
      is_day_use_available: item.is_day_use_available ?? true,
      is_active: item.is_active ?? true,
    });
  }

  async function runAction(task, successMessage, setSubmittingFn, onSuccess) {
    setSubmittingFn(true);
    try {
      await task();
      await loadData(search, statusFilter);
      showSuccess(successMessage);
      onSuccess?.();
    } catch (error) {
      if (error.name === "AbortError") return;
      showError(getRequestError(error, "Action impossible."));
    } finally {
      setSubmittingFn(false);
    }
  }

  async function handleRoomSubmit(event) {
    event.preventDefault();
    if (!canManageInventory) return;
    const payload = buildRoomPayload(roomForm);
    await runAction(
      () => (selectedRoom ? updateRoom(selectedRoom.id, payload) : createRoom(payload)),
      selectedRoom ? "Chambre mise à jour." : "Chambre créée avec succès.",
      setSubmittingRoom,
    );
    if (!selectedRoom) {
      setRoomForm(EMPTY_ROOM_FORM);
    }
  }

  async function handleRoomTypeSubmit(event) {
    event.preventDefault();
    if (!canManageInventory) return;
    const payload = buildRoomTypePayload(roomTypeForm);
    await runAction(
      () => (selectedRoomType ? updateRoomType(selectedRoomType.id, payload) : createRoomType(payload)),
      selectedRoomType ? "Type de chambre mis à jour." : "Type de chambre créé avec succès.",
      setSubmittingType,
    );
    if (!selectedRoomType) {
      setRoomTypeForm(EMPTY_ROOM_TYPE_FORM);
    }
  }

  async function handleTaskSubmit(event) {
    event.preventDefault();
    if (!canOperateRooms) return;
    await runAction(() => createHousekeepingTask(taskForm), "Tâche housekeeping créée.", setSubmittingTask);
    setTaskForm(EMPTY_TASK_FORM);
  }

  async function handleIncidentSubmit(event) {
    event.preventDefault();
    if (!canOperateRooms) return;
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
      if (error.name !== "AbortError") {
        showError(getRequestError(error, "Impossible de calculer les suggestions."));
      }
    } finally {
      setSubmittingSuggestions(false);
    }
  }

  function isCheckInEligible(room) {
    return room.status === "reserved" || room.status === "available";
  }

  return (
    <div className="page-stack rooms-page">
      <section className="dashboard-hero dashboard-hero-modern rooms-hero">
        <div className="section-head">
          <div className="dashboard-hero-copy">
            <span className="eyebrow">Rooms intelligence</span>
            <h2>Gestion intelligente des chambres</h2>
            <p>
              Pilote l&apos;inventaire, la rotation housekeeping, les incidents techniques et les suggestions
              d&apos;affectation depuis un cockpit unique, scoppé par hotel.
            </p>
          </div>
          <div className="rooms-hero-side">
            <div className="rooms-occupancy-card">
              <strong>Taux d&apos;occupation</strong>
              <div>{dashboard?.summary?.occupancy_rate || 0}%</div>
              <p>Base calculée sur les chambres actives de l&apos;hotel.</p>
            </div>
          </div>
        </div>

        <div className="rooms-toolbar">
          <input
            type="search"
            className="filter-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Numéro, code chambre, type..."
            aria-label="Rechercher une chambre"
          />
          <AppSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} name="rooms_status_filter" aria-label="Filtrer par statut">
            {ROOM_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </AppSelect>
        </div>
      </section>

      {loading ? <div className="status-box" role="status" aria-live="polite">Chargement du module chambres...</div> : null}
      {fetching && !loading ? <div className="status-box" role="status" aria-live="polite">Actualisation...</div> : null}
      {errorMsg ? <div className="alert-box" role="alert" aria-live="assertive">{errorMsg}</div> : null}
      {successMsg ? <div className="success-box" role="status" aria-live="polite" aria-atomic="true">{successMsg}</div> : null}

      <section className="rooms-summary-grid">
        {summaryCards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </section>

      <section className="list-panel dashboard-panel">
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
          description="Ce compte ne dispose actuellement d'aucun acces visible au module Chambres. Contacte un administrateur AFRIVO."
        />
      ) : null}

      {canAccessTab("overview") && activeTab === "overview" ? (
        <>
          <section className="rooms-grid-board">
            {(dashboard?.room_grid || []).length === 0 ? (
              <EmptyStateCard
                title="Aucune chambre configurée"
                description="Crée les premiers types de chambres puis ajoute des chambres depuis l'onglet correspondant pour les voir apparaître ici."
              />
            ) : null}
          {(dashboard?.room_grid || []).map((room) => (
              <article key={room.id} className={`table-card rooms-grid-card rooms-grid-card--${room.status}`}>
                <div className="rooms-grid-card__head">
                  <div>
                    <strong>{room.number}</strong>
                    <span>{room.room_type}</span>
                  </div>
                  <span className={`rooms-status-badge rooms-status-badge--${room.status}`}>{room.status_label}</span>
                </div>
                <div className="rooms-grid-card__meta">
                  <span>Étage {room.floor}</span>
                  <span>{room.room_code || "Code à générer"}</span>
                </div>
                <div className="rooms-grid-card__occupant">{room.occupant || "-"}</div>
                <div className="rooms-grid-card__stats">
                  <span>Nettoyage : {room.housekeeping_open}</span>
                  <span>Incidents : {room.incidents_open}</span>
                  <span>CA: {room.revenue_total}</span>
                </div>
                <div className="action-row">
                  <button type="button" className="secondary-button" onClick={() => { handleSelectRoom(room); setActiveTab("rooms"); }}>
                    Détail
                  </button>

                  {isCheckInEligible(room) && canOperateRooms ? (
                    <button
                      type="button"
                      className="primary-button"
                      disabled={submittingCheckin || anySubmitting}
                      onClick={() => handleCheckIn(room)}
                    >
                      {submittingCheckin ? "…" : "Check-in"}
                    </button>
                  ) : null}

                  {room.status === "occupied" && canOperateRooms ? (
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={submittingCheckout || anySubmitting}
                      onClick={() => handleCheckOut(room)}
                    >
                      {submittingCheckout ? "…" : "Check-out"}
                    </button>
                  ) : null}

                  {room.status === "cleaning" ? (
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={submittingClean}
                      onClick={() => runAction(() => completeRoomCleaning(room.id), `Nettoyage terminé pour ${room.number}.`, setSubmittingClean)}
                    >
                      {submittingClean ? "…" : "Remettre dispo"}
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </section>

          <section className="rooms-overview-columns">
            <section className="list-panel dashboard-panel">
              <div className="panel-head">
                <div>
                  <h3>Affectation intelligente</h3>
                  <p>Suggere les meilleures chambres selon le type demande, la disponibilite et le profil client.</p>
                </div>
              </div>
              <form className="rooms-form-card rooms-form-card--compact" onSubmit={handleSuggestions}>
                <div className="rooms-form-grid">
                  <label className="rooms-field">
                    <span>Client</span>
                    <AppSelect value={suggestionForm.guest} onChange={(event) => setSuggestionForm((current) => ({ ...current, guest: event.target.value }))} name="suggestion_guest">
                      <option value="">Client optionnel</option>
                      {(choices?.guests || []).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </AppSelect>
                  </label>
                  <label className="rooms-field">
                    <span>Type de chambre</span>
                    <AppSelect value={suggestionForm.room_type} onChange={(event) => setSuggestionForm((current) => ({ ...current, room_type: event.target.value }))} name="suggestion_room_type">
                      <option value="">Tous les types</option>
                      {roomTypes.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </AppSelect>
                  </label>
                  <label className="rooms-field">
                    <span>Arrivee</span>
                    <DatePicker value={suggestionForm.check_in_date} onChange={(event) => setSuggestionForm((current) => ({ ...current, check_in_date: event.target.value }))} name="suggestion_check_in_date" placeholder="Choisir une date" />
                  </label>
                  <label className="rooms-field">
                    <span>Depart</span>
                    <DatePicker value={suggestionForm.check_out_date} onChange={(event) => setSuggestionForm((current) => ({ ...current, check_out_date: event.target.value }))} name="suggestion_check_out_date" minDate={suggestionForm.check_in_date} placeholder="Choisir une date" />
                  </label>
                </div>
                <div className="rooms-form-actions">
                  <button type="submit" className="primary-button" disabled={submittingSuggestions}>
                    Suggérer les chambres
                  </button>
                </div>
              </form>
              <div className="table-like">
                {suggestions.length ? (
                  suggestions.map((item) => (
                    <article key={item.id} className="table-card rooms-suggestion-card">
                      <div className="table-row"><strong>Chambre</strong><span>{item.number}</span></div>
                      <div className="table-row"><strong>Type</strong><span>{item.room_type}</span></div>
                      <div className="table-row"><strong>Statut</strong><span>{item.status_label}</span></div>
                      <div className="table-row"><strong>Score</strong><span>{item.score}</span></div>
                      <div className="table-row"><strong>Nuit</strong><span>{item.effective_price_per_night}</span></div>
                    </article>
                  ))
                ) : (
                  <EmptyStateCard title="Aucune suggestion calculée" description="Lance une simulation pour recevoir des propositions d'affectation." />
                )}
              </div>
            </section>

            <section className="list-panel dashboard-panel">
              <div className="panel-head">
                <div>
                  <h3>Files prioritaires</h3>
                  <p>Housekeeping et maintenance remontees en temps reel pour la supervision terrain.</p>
                </div>
              </div>
              <div className="table-like">
                {(dashboard?.housekeeping_queue || []).slice(0, 5).map((item) => (
                  <article key={item.id} className="table-card detail-info-card">
                    <div className="table-row"><strong>Chambre</strong><span>{item.room}</span></div>
                    <div className="table-row"><strong>Tâche</strong><span>{item.task_type}</span></div>
                    <div className="table-row"><strong>Priorité</strong><span>{item.priority_label}</span></div>
                    <div className="table-row"><strong>Agent</strong><span>{item.assigned_to}</span></div>
                  </article>
                ))}
                {(dashboard?.maintenance_alerts || []).slice(0, 5).map((item) => (
                  <article key={`incident-${item.id}`} className="table-card detail-info-card">
                    <div className="table-row"><strong>Chambre</strong><span>{item.room}</span></div>
                    <div className="table-row"><strong>Incident</strong><span>{item.title}</span></div>
                    <div className="table-row"><strong>Sévérité</strong><span>{item.severity_label}</span></div>
                    <div className="table-row"><strong>Statut</strong><span>{item.status_label}</span></div>
                  </article>
                ))}
              </div>
            </section>
          </section>
        </>
      ) : null}

      {canAccessTab("rooms") && activeTab === "rooms" ? (
        <section className="rooms-management-layout">
          <section className="list-panel dashboard-panel">
            <div className="panel-head">
              <div>
                <h3>Inventaire chambres</h3>
                <p>Consulte les chambres de l'hotel, leur statut temps reel et leur niveau de priorite VIP.</p>
              </div>
            </div>
            <div className="table-like">
              {rooms.map((item) => (
                <button key={item.id} type="button" className={`table-card rooms-list-row ${selectedRoomId === item.id ? "active" : ""}`} onClick={() => handleSelectRoom(item)}>
                  <div className="rooms-list-row__head">
                    <strong>{item.number}</strong>
                    <span className={`rooms-status-badge rooms-status-badge--${item.status}`}>{item.status_label}</span>
                  </div>
                  <p>{item.room_type_name}</p>
                  <small>{item.room_code || "Code en attente"} • Étage {item.floor ?? "-"}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="list-panel dashboard-panel">
            <div className="panel-head">
              <div>
                <h3>{selectedRoom ? `Modifier ${selectedRoom.number}` : "Nouvelle chambre"}</h3>
                <p>Gestion admin de l'inventaire physique, des overrides tarifaires et du paramétrage VIP.</p>
              </div>
            </div>
            <form className="rooms-form-card" onSubmit={handleRoomSubmit}>
              <div className="rooms-form-grid">
                <label className="rooms-field">
                  <span>Numero</span>
                  <input value={roomForm.number} onChange={(event) => setRoomForm((current) => ({ ...current, number: event.target.value }))} disabled={!canManageInventory || submittingRoom} />
                </label>
                <label className="rooms-field">
                  <span>Type</span>
                  <AppSelect value={roomForm.room_type} onChange={(event) => setRoomForm((current) => ({ ...current, room_type: event.target.value }))} name="room_type" disabled={!canManageInventory || submittingRoom}>
                    <option value="">Choisir un type</option>
                    {roomTypes.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </AppSelect>
                </label>
                <label className="rooms-field">
                  <span>Étage</span>
                  <input type="number" value={roomForm.floor} onChange={(event) => setRoomForm((current) => ({ ...current, floor: event.target.value }))} disabled={!canManageInventory || submittingRoom} />
                </label>
                <label className="rooms-field">
                  <span>Statut</span>
                  <AppSelect value={roomForm.status} onChange={(event) => setRoomForm((current) => ({ ...current, status: event.target.value }))} name="room_status" disabled={!canManageInventory || submittingRoom}>
                    {ROOM_STATUS_OPTIONS.filter((item) => item.value !== "all").map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </AppSelect>
                </label>
                <label className="rooms-field">
                  <span>Tarif nuit</span>
                  <input type="number" step="0.01" value={roomForm.custom_price_per_night} onChange={(event) => setRoomForm((current) => ({ ...current, custom_price_per_night: event.target.value }))} disabled={!canManageInventory || submittingRoom} />
                </label>
                <label className="rooms-field">
                  <span>Tarif day use</span>
                  <input type="number" step="0.01" value={roomForm.custom_price_day_use} onChange={(event) => setRoomForm((current) => ({ ...current, custom_price_day_use: event.target.value }))} disabled={!canManageInventory || submittingRoom} />
                </label>
                <label className="rooms-field rooms-field--checkbox">
                  <input type="checkbox" checked={roomForm.is_vip_preferred} onChange={(event) => setRoomForm((current) => ({ ...current, is_vip_preferred: event.target.checked }))} disabled={!canManageInventory || submittingRoom} />
                  <span>Prioritaire VIP</span>
                </label>
                <label className="rooms-field rooms-field--full">
                  <span>Notes internes</span>
                  <textarea value={roomForm.notes} onChange={(event) => setRoomForm((current) => ({ ...current, notes: event.target.value }))} disabled={!canManageInventory || submittingRoom} />
                </label>
              </div>
              <div className="rooms-form-actions">
                {canManageInventory ? (
                  <button type="submit" className="primary-button" disabled={submittingRoom}>
                    {submittingRoom ? "Enregistrement…" : selectedRoom ? "Mettre à jour" : "Créer la chambre"}
                  </button>
                ) : (
                  <ReadOnlyActionNotice
                    title="Consultation uniquement"
                    description="Votre profil peut consulter les fiches chambres, mais la création et la modification sont réservées aux gestionnaires d'inventaire."
                  />
                )}

                {/* Check-in — walk-in (available) ou réservé */}
                {selectedRoom && isCheckInEligible(selectedRoom) && canOperateRooms ? (
                  <button
                    type="button"
                    className="primary-button"
                    style={{ background: "var(--primary, #0f9d8a)" }}
                    disabled={submittingCheckin || anySubmitting}
                    onClick={() => handleCheckIn(selectedRoom)}
                  >
                    {submittingCheckin ? "Check-in…" : "Check-in"}
                  </button>
                ) : null}

                {/* Check-out — visible si chambre occupée */}
                {selectedRoom && selectedRoom.status === "occupied" && canOperateRooms ? (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={submittingCheckout || anySubmitting}
                    onClick={() => handleCheckOut(selectedRoom)}
                  >
                    {submittingCheckout ? "Check-out…" : "Check-out"}
                  </button>
                ) : null}

                {selectedRoom && canManageInventory ? (
                  <button
                    type="button"
                    className="secondary-button danger"
                    disabled={submittingRoom}
                    onClick={() => runAction(
                      () => deactivateRoom(selectedRoom.id),
                      "Chambre désactivée.",
                      setSubmittingRoom,
                      () => { setSelectedRoomId(null); setRoomForm(EMPTY_ROOM_FORM); },
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

      {canAccessTab("realtime") && activeTab === "realtime" ? (
        <section className="rooms-realtime-stack">
          <section className="list-panel dashboard-panel">
            <div className="panel-head">
              <div>
                <h3>Vue temps reel des chambres</h3>
                <p>Supervision operationnelle des chambres, presence, porte, energie et alertes.</p>
              </div>
            </div>

            <div className="rooms-realtime-summary-grid">
              {realtimeSummaryCards.map((card) => (
                <SummaryCard key={card.label} {...card} />
              ))}
            </div>

            <div className="rooms-realtime-controls">
              <input
                type="search"
                className="filter-input"
                value={realtimeSearch}
                onChange={(event) => setRealtimeSearch(event.target.value)}
                placeholder="Rechercher par chambre, etat ou alerte..."
              />
              <div className="rooms-realtime-filter-row">
                {REALTIME_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    className={`rooms-chip ${realtimeFilter === filter.value ? "active" : ""}`}
                    onClick={() => setRealtimeFilter(filter.value)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rooms-realtime-table-shell">
              <div className="rooms-realtime-table-scroll">
                <table className="rooms-realtime-table">
                  <thead>
                    <tr>
                      <th>Chambre</th>
                      <th>Etat hotelier</th>
                      <th>Presence</th>
                      <th>Porte</th>
                      <th>Climatisation</th>
                      <th>Lumière</th>
                      <th>Temperature</th>
                      <th>Humidite</th>
                      <th>Dernière activité</th>
                      <th>Alerte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRealtimeRooms.length ? filteredRealtimeRooms.map((room) => {
                      const hotelMeta = getRealtimeBadgeMeta("hotelStatus", room.hotelStatus);
                      const presenceMeta = getRealtimeBadgeMeta("presenceStatus", room.presenceStatus);
                      const doorMeta = getRealtimeBadgeMeta("doorStatus", room.doorStatus);
                      const acMeta = getRealtimeBadgeMeta("acStatus", room.acStatus);
                      const lightMeta = getRealtimeBadgeMeta("lightStatus", room.lightStatus);
                      const alertMeta = getRealtimeBadgeMeta("alertLevel", room.alertLevel);

                      return (
                        <tr
                          key={room.id}
                          className={`rooms-realtime-row ${selectedRealtimeRoom?.id === room.id ? "is-active" : ""}`}
                          onClick={() => setSelectedRealtimeRoomId(room.id)}
                          tabIndex={0}
                          role="button"
                          aria-pressed={selectedRealtimeRoom?.id === room.id}
                          aria-label={`Voir le détail de la chambre ${room.roomNumber}`}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedRealtimeRoomId(room.id); } }}
                        >
                          <td>
                            <div className="rooms-realtime-room-cell">
                              <strong>{room.roomNumber}</strong>
                              <span>{room.roomType} - {room.floor}</span>
                            </div>
                          </td>
                          <td><span className={`rooms-pill rooms-pill--${hotelMeta.tone}`}>{hotelMeta.label}</span></td>
                          <td><span className={`rooms-pill rooms-pill--${presenceMeta.tone}`}>{presenceMeta.label}</span></td>
                          <td><span className={`rooms-pill rooms-pill--${doorMeta.tone}`}>{doorMeta.label}</span></td>
                          <td><span className={`rooms-pill rooms-pill--${acMeta.tone}`}>{acMeta.label}</span></td>
                          <td><span className={`rooms-pill rooms-pill--${lightMeta.tone}`}>{lightMeta.label}</span></td>
                          <td>{room.temperature}°C</td>
                          <td>{room.humidity}%</td>
                          <td>{room.lastActivity}</td>
                          <td>
                            <div className="rooms-realtime-alert-cell">
                              <span className={`rooms-pill rooms-pill--${alertMeta.tone}`}>{alertMeta.label}</span>
                              <small>{room.alertMessage}</small>
                            </div>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan="10" className="rooms-realtime-empty-cell">
                          <EmptyStateCard
                            title="Aucune chambre ne correspond aux filtres"
                            description="Ajuste la recherche ou les filtres rapides pour retrouver une chambre supervisee."
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="list-panel dashboard-panel rooms-realtime-detail-panel">
            <div className="panel-head">
              <div>
                <h3>{selectedRealtimeRoom ? `Detail chambre ${selectedRealtimeRoom.roomNumber}` : "Detail temps reel"}</h3>
                <p>Données temps reel simulees pour le moment, structure deja prete pour une future API.</p>
              </div>
            </div>

            {selectedRealtimeRoom ? (
              <div className="rooms-realtime-detail-grid">
                <article className="table-card detail-info-card">
                  <div className="table-row"><strong>Chambre</strong><span>{selectedRealtimeRoom.roomNumber}</span></div>
                  <div className="table-row"><strong>Type</strong><span>{selectedRealtimeRoom.roomType}</span></div>
                  <div className="table-row"><strong>Etage</strong><span>{selectedRealtimeRoom.floor}</span></div>
                  <div className="table-row"><strong>Etat hotelier</strong><span>{getRealtimeBadgeMeta("hotelStatus", selectedRealtimeRoom.hotelStatus).label}</span></div>
                  <div className="table-row"><strong>Dernière activité</strong><span>{selectedRealtimeRoom.lastActivity}</span></div>
                </article>
                <article className="table-card detail-info-card">
                  <div className="table-row"><strong>Presence</strong><span>{getRealtimeBadgeMeta("presenceStatus", selectedRealtimeRoom.presenceStatus).label}</span></div>
                  <div className="table-row"><strong>Porte</strong><span>{getRealtimeBadgeMeta("doorStatus", selectedRealtimeRoom.doorStatus).label}</span></div>
                  <div className="table-row"><strong>Climatisation</strong><span>{getRealtimeBadgeMeta("acStatus", selectedRealtimeRoom.acStatus).label}</span></div>
                  <div className="table-row"><strong>Lumière</strong><span>{getRealtimeBadgeMeta("lightStatus", selectedRealtimeRoom.lightStatus).label}</span></div>
                  <div className="table-row"><strong>Capteurs</strong><span>{getRealtimeBadgeMeta("sensorStatus", selectedRealtimeRoom.sensorStatus).label}</span></div>
                </article>
                <article className="table-card detail-info-card">
                  <div className="table-row"><strong>Temperature</strong><span>{selectedRealtimeRoom.temperature}°C</span></div>
                  <div className="table-row"><strong>Humidite</strong><span>{selectedRealtimeRoom.humidity}%</span></div>
                  <div className="table-row"><strong>Dernière alerte</strong><span>{selectedRealtimeRoom.alertMessage}</span></div>
                  <div className="table-row"><strong>Niveau</strong><span>{getRealtimeBadgeMeta("alertLevel", selectedRealtimeRoom.alertLevel).label}</span></div>
                </article>
                <article className="table-card rooms-realtime-note-card">
                  <strong>Historique futur</strong>
                  <p>Cette zone accueillera plus tard la timeline IoT, les ouvertures de porte, les variations climatiques et les anomalies energie.</p>
                  <p>Branchement prévu sur `GET /api/rooms/realtime/` puis sur un flux WebSocket dedie.</p>
                </article>
              </div>
            ) : (
              <EmptyStateCard
                title="Aucune chambre sélectionnée"
                description="Choisis une ligne du tableau pour afficher son détail temps réel et préparer le futur suivi IoT."
              />
            )}
          </section>
        </section>
      ) : null}

      {canAccessTab("types") && activeTab === "types" ? (
        <section className="rooms-management-layout">
          <section className="list-panel dashboard-panel">
            <div className="panel-head">
              <div>
                <h3>Types de chambres</h3>
                <p>Socle de capacité, pricing de base, équipements et politique day use.</p>
              </div>
            </div>
            <div className="table-like">
              {roomTypes.map((item) => (
                <button key={item.id} type="button" className={`table-card rooms-list-row ${selectedTypeId === item.id ? "active" : ""}`} onClick={() => handleSelectType(item)}>
                  <div className="rooms-list-row__head">
                    <strong>{item.name}</strong>
                    <span>{item.code}</span>
                  </div>
                  <p>{item.capacity} pers. • Nuit {item.base_price_per_night}</p>
                  <small>{(item.amenities || []).slice(0, 3).join(", ") || "Sans equipement detaille"}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="list-panel dashboard-panel">
            <div className="panel-head">
              <div>
                <h3>{selectedRoomType ? `Modifier ${selectedRoomType.name}` : "Nouveau type"}</h3>
                <p>Structure le catalogue chambres avec tarifs de base, équipements et politique commerciale.</p>
              </div>
            </div>
            <form className="rooms-form-card" onSubmit={handleRoomTypeSubmit}>
              <div className="rooms-form-grid">
                <label className="rooms-field"><span>Nom</span><input value={roomTypeForm.name} onChange={(event) => setRoomTypeForm((current) => ({ ...current, name: event.target.value }))} disabled={!canManageInventory || submittingType} /></label>
                <label className="rooms-field"><span>Code</span><input value={roomTypeForm.code} onChange={(event) => setRoomTypeForm((current) => ({ ...current, code: event.target.value }))} disabled={!canManageInventory || submittingType} /></label>
                <label className="rooms-field"><span>Capacité</span><input type="number" value={roomTypeForm.capacity} onChange={(event) => setRoomTypeForm((current) => ({ ...current, capacity: event.target.value }))} disabled={!canManageInventory || submittingType} /></label>
                <label className="rooms-field"><span>Adultes max</span><input type="number" value={roomTypeForm.max_adults} onChange={(event) => setRoomTypeForm((current) => ({ ...current, max_adults: event.target.value }))} disabled={!canManageInventory || submittingType} /></label>
                <label className="rooms-field"><span>Enfants max</span><input type="number" value={roomTypeForm.max_children} onChange={(event) => setRoomTypeForm((current) => ({ ...current, max_children: event.target.value }))} disabled={!canManageInventory || submittingType} /></label>
                <label className="rooms-field"><span>Tarif nuit</span><input type="number" step="0.01" value={roomTypeForm.base_price_per_night} onChange={(event) => setRoomTypeForm((current) => ({ ...current, base_price_per_night: event.target.value }))} disabled={!canManageInventory || submittingType} /></label>
                <label className="rooms-field"><span>Tarif day use</span><input type="number" step="0.01" value={roomTypeForm.base_price_day_use} onChange={(event) => setRoomTypeForm((current) => ({ ...current, base_price_day_use: event.target.value }))} disabled={!canManageInventory || submittingType} /></label>
                <label className="rooms-field rooms-field--checkbox">
                  <input type="checkbox" checked={roomTypeForm.is_day_use_available} onChange={(event) => setRoomTypeForm((current) => ({ ...current, is_day_use_available: event.target.checked }))} disabled={!canManageInventory || submittingType} />
                  <span>Day use autorisé</span>
                </label>
                <label className="rooms-field rooms-field--full"><span>Description</span><textarea value={roomTypeForm.description} onChange={(event) => setRoomTypeForm((current) => ({ ...current, description: event.target.value }))} disabled={!canManageInventory || submittingType} /></label>
                <label className="rooms-field rooms-field--full"><span>Equipements (virgules)</span><input value={roomTypeForm.amenities} onChange={(event) => setRoomTypeForm((current) => ({ ...current, amenities: event.target.value }))} disabled={!canManageInventory || submittingType} /></label>
                <label className="rooms-field rooms-field--full"><span>Images (URLs séparées par virgule)</span><input value={roomTypeForm.image_urls} onChange={(event) => setRoomTypeForm((current) => ({ ...current, image_urls: event.target.value }))} disabled={!canManageInventory || submittingType} /></label>
                <label className="rooms-field rooms-field--full"><span>Politique tarifaire</span><textarea value={roomTypeForm.pricing_policy_notes} onChange={(event) => setRoomTypeForm((current) => ({ ...current, pricing_policy_notes: event.target.value }))} disabled={!canManageInventory || submittingType} /></label>
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

      {canAccessTab("housekeeping") && activeTab === "housekeeping" ? (
        <section className="rooms-management-layout">
          <section className="list-panel dashboard-panel">
            <div className="panel-head">
              <div>
                <h3>File housekeeping</h3>
                <p>Vue mobile-friendly des chambres à traiter, avec démarrage et clôture en un clic.</p>
              </div>
            </div>
            <div className="table-like">
              {tasks.length ? tasks.map((task) => (
                <article key={task.id} className="table-card detail-info-card">
                  <div className="table-row"><strong>Chambre</strong><span>{task.room_number}</span></div>
                  <div className="table-row"><strong>Tâche</strong><span>{task.task_type_label}</span></div>
                  <div className="table-row"><strong>Statut</strong><span>{task.status_label}</span></div>
                  <div className="table-row"><strong>Priorité</strong><span>{task.priority_label}</span></div>
                  <div className="table-row"><strong>Agent</strong><span>{task.assigned_to_name || "-"}</span></div>
                  {canOperateRooms ? (
                    <div className="action-row">
                      {task.status === "pending" ? (
                        <button type="button" className="secondary-button" onClick={() => runAction(() => startHousekeepingTask(task.id), "Tâche housekeeping démarrée.", setSubmittingTask)}>
                          Démarrer
                        </button>
                      ) : null}
                      {task.status !== "completed" ? (
                        <button type="button" className="primary-button" onClick={() => runAction(() => completeHousekeepingTask(task.id, { actual_minutes: task.estimated_minutes }), "Tâche housekeeping terminée.", setSubmittingTask)}>
                          Marquer propre
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              )) : <EmptyStateCard title="Aucune tâche housekeeping" description="Les rotations et nettoyages profonds apparaîtront ici." />}
            </div>
          </section>

          <section className="list-panel dashboard-panel">
            <div className="panel-head">
              <div>
                <h3>Nouvelle tache</h3>
                <p>Prépare une mission housekeeping attribuée à un agent ou laissée en file libre.</p>
              </div>
            </div>
            {canOperateRooms ? (
              <form className="rooms-form-card" onSubmit={handleTaskSubmit}>
                <div className="rooms-form-grid">
                  <label className="rooms-field"><span>Chambre</span><AppSelect value={taskForm.room} onChange={(event) => setTaskForm((current) => ({ ...current, room: event.target.value }))} name="task_room" disabled={submittingTask}><option value="">Choisir</option>{rooms.map((item) => <option key={item.id} value={item.id}>{item.number} - {item.room_type_name}</option>)}</AppSelect></label>
                  <label className="rooms-field"><span>Type</span><AppSelect value={taskForm.task_type} onChange={(event) => setTaskForm((current) => ({ ...current, task_type: event.target.value }))} name="task_type" disabled={submittingTask}><option value="turnover">Rotation</option><option value="deep_cleaning">Nettoyage profond</option><option value="inspection">Inspection</option><option value="touch_up">Retouche</option></AppSelect></label>
                  <label className="rooms-field"><span>Priorité</span><AppSelect value={taskForm.priority} onChange={(event) => setTaskForm((current) => ({ ...current, priority: event.target.value }))} name="task_priority" disabled={submittingTask}><option value="low">Faible</option><option value="normal">Normale</option><option value="high">Haute</option><option value="urgent">Urgente</option></AppSelect></label>
                  <label className="rooms-field"><span>Agent</span><AppSelect value={taskForm.assigned_to} onChange={(event) => setTaskForm((current) => ({ ...current, assigned_to: event.target.value }))} name="task_assigned_to" disabled={submittingTask}><option value="">Non attribué</option>{roomAgents.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</AppSelect></label>
                  <label className="rooms-field"><span>Temps estimé</span><input type="number" value={taskForm.estimated_minutes} onChange={(event) => setTaskForm((current) => ({ ...current, estimated_minutes: Number(event.target.value) }))} disabled={submittingTask} /></label>
                  <label className="rooms-field rooms-field--full"><span>Notes</span><textarea value={taskForm.notes} onChange={(event) => setTaskForm((current) => ({ ...current, notes: event.target.value }))} disabled={submittingTask} /></label>
                  <label className="rooms-field rooms-field--full"><span>Problème signalé</span><textarea value={taskForm.issue_reported} onChange={(event) => setTaskForm((current) => ({ ...current, issue_reported: event.target.value }))} disabled={submittingTask} /></label>
                </div>
                <div className="rooms-form-actions"><button type="submit" className="primary-button" disabled={submittingTask}>Créer la tâche</button></div>
              </form>
            ) : (
              <ReadOnlyActionNotice
                title="Création non autorisée"
                description="Votre profil peut consulter la file housekeeping, mais ne peut pas créer ou lancer de nouvelles tâches depuis cette vue."
              />
            )}
          </section>
        </section>
      ) : null}

      {canAccessTab("maintenance") && activeTab === "maintenance" ? (
        <section className="rooms-management-layout">
          <section className="list-panel dashboard-panel">
            <div className="panel-head">
              <div>
                <h3>Incidents techniques</h3>
                <p>Suivi des chambres bloquées, réparations en cours et incidents signalés depuis le terrain.</p>
              </div>
            </div>
            <div className="table-like">
              {incidents.length ? incidents.map((incident) => (
                <article key={incident.id} className="table-card detail-info-card">
                  <div className="table-row"><strong>Chambre</strong><span>{incident.room_number}</span></div>
                  <div className="table-row"><strong>Titre</strong><span>{incident.title}</span></div>
                  <div className="table-row"><strong>Sévérité</strong><span>{incident.severity_label}</span></div>
                  <div className="table-row"><strong>Statut</strong><span>{incident.status_label}</span></div>
                  <div className="table-row"><strong>Declarant</strong><span>{incident.reported_by_name || "-"}</span></div>
                  {incident.status !== "resolved" && incident.status !== "closed" && canOperateRooms ? (
                    resolvingIncidentId === incident.id ? (
                      <div style={{ marginTop: "0.75rem" }}>
                        <label className="rooms-field rooms-field--full">
                          <span>Notes de résolution</span>
                          <textarea
                            value={resolveNotes}
                            onChange={(e) => setResolveNotes(e.target.value)}
                            placeholder="Décrivez les actions correctives effectuées..."
                            rows={2}
                            disabled={submittingIncident}
                          />
                        </label>
                        <div className="action-row">
                          <button
                            type="button"
                            className="primary-button"
                            disabled={submittingIncident}
                            onClick={() => runAction(
                              () => resolveMaintenanceIncident(incident.id, { resolution_notes: resolveNotes.trim() }),
                              "Incident résolu.",
                              setSubmittingIncident,
                              () => { setResolvingIncidentId(null); setResolveNotes(""); },
                            )}
                          >
                            {submittingIncident ? "Résolution…" : "Confirmer"}
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={submittingIncident}
                            onClick={() => { setResolvingIncidentId(null); setResolveNotes(""); }}
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="action-row">
                        <button type="button" className="primary-button" onClick={() => setResolvingIncidentId(incident.id)}>
                          Marquer résolu
                        </button>
                      </div>
                    )
                  ) : null}
                </article>
              )) : <EmptyStateCard title="Aucun incident ouvert" description="Les problèmes techniques et pannes apparaîtront ici." />}
            </div>
          </section>

          <section className="list-panel dashboard-panel">
            <div className="panel-head">
              <div>
                <h3>Nouvel incident</h3>
                <p>Signale une panne ou un incident et mets automatiquement la chambre hors service si nécessaire.</p>
              </div>
            </div>
            <form className="rooms-form-card" onSubmit={handleIncidentSubmit}>
              <div className="rooms-form-grid">
                <label className="rooms-field"><span>Chambre</span><AppSelect value={incidentForm.room} onChange={(event) => setIncidentForm((current) => ({ ...current, room: event.target.value }))} name="incident_room" disabled={!canOperateRooms || submittingIncident}><option value="">Choisir</option>{rooms.map((item) => <option key={item.id} value={item.id}>{item.number}</option>)}</AppSelect></label>
                <label className="rooms-field"><span>Sévérité</span><AppSelect value={incidentForm.severity} onChange={(event) => setIncidentForm((current) => ({ ...current, severity: event.target.value }))} name="incident_severity" disabled={!canOperateRooms || submittingIncident}><option value="low">Faible</option><option value="medium">Moyenne</option><option value="high">Haute</option><option value="critical">Critique</option></AppSelect></label>
                <label className="rooms-field"><span>Attribue a</span><AppSelect value={incidentForm.assigned_to} onChange={(event) => setIncidentForm((current) => ({ ...current, assigned_to: event.target.value }))} name="incident_assigned_to" disabled={!canOperateRooms || submittingIncident}><option value="">Non attribué</option>{roomAgents.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</AppSelect></label>
                <label className="rooms-field rooms-field--checkbox"><input type="checkbox" checked={incidentForm.marks_room_out_of_service} onChange={(event) => setIncidentForm((current) => ({ ...current, marks_room_out_of_service: event.target.checked }))} disabled={!canOperateRooms || submittingIncident} /><span>Hors service automatique</span></label>
                <label className="rooms-field rooms-field--full"><span>Titre</span><input value={incidentForm.title} onChange={(event) => setIncidentForm((current) => ({ ...current, title: event.target.value }))} disabled={!canOperateRooms || submittingIncident} /></label>
                <label className="rooms-field rooms-field--full"><span>Description</span><textarea value={incidentForm.description} onChange={(event) => setIncidentForm((current) => ({ ...current, description: event.target.value }))} disabled={!canOperateRooms || submittingIncident} /></label>
              </div>
              <div className="rooms-form-actions"><button type="submit" className="primary-button" disabled={!canOperateRooms || submittingIncident}>Enregistrer l&apos;incident</button></div>
            </form>
          </section>
        </section>
      ) : null}

      {canAccessTab("pricing") && activeTab === "pricing" ? (
        <section className="rooms-management-layout">
          <section className="list-panel dashboard-panel">
            <div className="panel-head">
              <div>
                <h3>Revenue management lite</h3>
                <p>Week-end, saison et pression d&apos;occupation: les règles tarifaires simples restent visibles et auditables.</p>
              </div>
            </div>
            <div className="table-like">
              {pricingRules.length ? pricingRules.map((rule) => (
                <article key={rule.id} className="table-card detail-info-card">
                  <div className="table-row"><strong>Nom</strong><span>{rule.name}</span></div>
                  <div className="table-row"><strong>Type</strong><span>{rule.rule_type}</span></div>
                  <div className="table-row"><strong>Périmètre</strong><span>{rule.applies_to}</span></div>
                  <div className="table-row"><strong>Valeur</strong><span>{rule.adjustment_value}</span></div>
                  <div className="table-row"><strong>Priorité</strong><span>{rule.priority}</span></div>
                </article>
              )) : <EmptyStateCard title="Aucune règle tarifaire" description="Ajoute une première règle week-end, saisonnière ou liée à l&apos;occupation." />}
            </div>
          </section>

          <section className="list-panel dashboard-panel">
            <div className="panel-head">
              <div>
                <h3>Nouvelle règle</h3>
                <p>Prépare un premier niveau de yield management sans complexifier la réception.</p>
              </div>
            </div>
            <form className="rooms-form-card" onSubmit={handleRuleSubmit}>
              <div className="rooms-form-grid">
                <label className="rooms-field"><span>Type de chambre</span><AppSelect value={ruleForm.room_type} onChange={(event) => setRuleForm((current) => ({ ...current, room_type: event.target.value }))} name="rule_room_type" disabled={!canManageInventory || submittingRule}><option value="">Choisir</option>{roomTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</AppSelect></label>
                <label className="rooms-field"><span>Nom</span><input value={ruleForm.name} onChange={(event) => setRuleForm((current) => ({ ...current, name: event.target.value }))} disabled={!canManageInventory || submittingRule} /></label>
                <label className="rooms-field"><span>Règle</span><AppSelect value={ruleForm.rule_type} onChange={(event) => setRuleForm((current) => ({ ...current, rule_type: event.target.value }))} name="rule_type" disabled={!canManageInventory || submittingRule}><option value="weekend">Week-end</option><option value="seasonal">Saisonnière</option><option value="occupancy">Occupation</option></AppSelect></label>
                <label className="rooms-field"><span>S'applique à</span><AppSelect value={ruleForm.applies_to} onChange={(event) => setRuleForm((current) => ({ ...current, applies_to: event.target.value }))} name="rule_applies_to" disabled={!canManageInventory || submittingRule}><option value="night">Nuit</option><option value="day_use">Day use</option><option value="both">Les deux</option></AppSelect></label>
                <label className="rooms-field"><span>Mode</span><AppSelect value={ruleForm.adjustment_mode} onChange={(event) => setRuleForm((current) => ({ ...current, adjustment_mode: event.target.value }))} name="rule_adjustment_mode" disabled={!canManageInventory || submittingRule}><option value="percent">Pourcentage</option><option value="fixed">Montant fixe</option></AppSelect></label>
                <label className="rooms-field"><span>Valeur</span><input type="number" step="0.01" value={ruleForm.adjustment_value} onChange={(event) => setRuleForm((current) => ({ ...current, adjustment_value: event.target.value }))} disabled={!canManageInventory || submittingRule} /></label>
                <label className="rooms-field"><span>Début</span><DatePicker value={ruleForm.start_date} onChange={(event) => setRuleForm((current) => ({ ...current, start_date: event.target.value }))} name="rule_start_date" disabled={!canManageInventory || submittingRule} placeholder="Choisir une date" /></label>
                <label className="rooms-field"><span>Fin</span><DatePicker value={ruleForm.end_date} onChange={(event) => setRuleForm((current) => ({ ...current, end_date: event.target.value }))} name="rule_end_date" minDate={ruleForm.start_date} disabled={!canManageInventory || submittingRule} placeholder="Choisir une date" /></label>
                <label className="rooms-field"><span>Occupation min (%)</span><input type="number" value={ruleForm.min_occupancy_rate} onChange={(event) => setRuleForm((current) => ({ ...current, min_occupancy_rate: event.target.value }))} disabled={!canManageInventory || submittingRule} /></label>
                <label className="rooms-field"><span>Priorité</span><input type="number" value={ruleForm.priority} onChange={(event) => setRuleForm((current) => ({ ...current, priority: Number(event.target.value) }))} disabled={!canManageInventory || submittingRule} /></label>
              </div>
              <div className="rooms-form-actions"><button type="submit" className="primary-button" disabled={!canManageInventory || submittingRule}>Ajouter la règle</button></div>
            </form>
          </section>
        </section>
      ) : null}
    </div>
  );
}