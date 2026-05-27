import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { listClients } from "../../services/clientsService";
import {
  createDayUse,
  getDayUseAvailability,
  getDayUseDashboard,
  listDayUses,
} from "../../services/dayUseService";
import { AppSelect } from "../../shared/components/AppSelect";
import { useToast } from "../../shared/toast/ToastContext";
import { buildInitials, formatDate } from "../ClientsPage/utils";
import "./DayUsePage.css";

const PAGE_SIZE = 100;
const REFRESH_INTERVAL_MS = 1000;
const ACTIVE_STATUSES = new Set(["in_progress", "checked_in", "overtime"]);
const WAITING_STATUSES = new Set(["payment_pending", "pending_payment", "ready", "draft"]);
const COMPLETED_STATUSES = new Set(["completed", "checked_out"]);

function Icon({ name }) {
  return <i className={`ti ti-${name}`} aria-hidden="true" />;
}

function todayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

function currentTimeValue() {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function padTimePart(value) {
  return String(value).padStart(2, "0");
}

function normalizeTimeInput(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return currentTimeValue();
  const hours = Math.min(Math.max(Number(match[1]), 0), 23);
  const minutes = Math.min(Math.max(Number(match[2]), 0), 59);
  return `${padTimePart(hours)}:${padTimePart(minutes)}`;
}

function buildStartDatetime(timeValue) {
  const [hours, minutes] = normalizeTimeInput(timeValue).split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

function formatTime(value) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return "--:--";
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatMoneyCompact(value) {
  const number = Number(value || 0);
  if (number >= 1000000) return `${Math.round(number / 1000000)}M XOF`;
  if (number >= 1000) return `${Math.round(number / 1000)}K XOF`;
  return `${Math.round(number)} XOF`;
}

function formatMoney(value) {
  const number = Number(value || 0);
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(number)} XOF`;
}

function formatDuration(minutesValue, { showSeconds = false } = {}) {
  const totalSeconds = Math.max(0, Math.round(Number(minutesValue || 0) * 60));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (showSeconds) {
      return rest ? `${hours}h ${rest}min ${padTimePart(seconds)}s` : `${hours}h ${padTimePart(seconds)}s`;
    }
    return rest ? `${hours}h ${rest}min` : `${hours}h`;
  }
  if (showSeconds) {
    return minutes > 0 ? `${minutes}min ${padTimePart(seconds)}s` : `${seconds}s`;
  }
  return `${minutes}min`;
}

function clamp(value, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max);
}

function getItems(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.results || [];
}

function extractError(error, fallback) {
  const errors = error?.payload?.errors;
  if (errors) {
    const firstValue = Object.values(errors)[0];
    if (Array.isArray(firstValue) && firstValue[0]) return firstValue[0];
    if (typeof firstValue === "string") return firstValue;
  }
  return error?.payload?.detail || error?.message || fallback;
}

function statusKind(status, paymentStatus) {
  if (ACTIVE_STATUSES.has(status)) return "active";
  if (WAITING_STATUSES.has(status) || ["unpaid", "partial"].includes(paymentStatus)) return "waiting";
  if (COMPLETED_STATUSES.has(status)) return "completed";
  return "neutral";
}

function statusCopy(kind) {
  if (kind === "active") return "En cours";
  if (kind === "waiting") return "Paiement att.";
  if (kind === "completed") return "Terminé";
  return "Autre";
}

function normalizeDayUse(item) {
  const roomValue = item.room?.number || item.room || item.room_number || "-";
  const roomType = item.room?.type || item.room?.room_type || item.room_type || "-";
  const clientName = item.client?.full_name || item.client_name || item.guest_name || "Client";
  const finalAmount = Number(item.amount ?? item.final_amount ?? item.total_amount ?? 0);
  const paidAmount = Number(item.paid_amount ?? item.amount_paid ?? 0);
  const paymentStatus = item.payment_status || "";
  const kind = statusKind(item.status, paymentStatus);

  return {
    ...item,
    clientName,
    clientPhone: item.client?.phone || item.client_phone || "",
    roomNumber: roomValue,
    roomType,
    startDate: parseDate(item.start_datetime),
    endDate: parseDate(item.end_datetime),
    durationHours: Number(item.duration_hours || item.expected_duration_hours || 0),
    finalAmount,
    paidAmount,
    remainingAmount: Number(item.remaining_amount ?? Math.max(finalAmount - paidAmount, 0)),
    statusKind: kind,
    statusLabel: item.status_label || statusCopy(kind),
    detailPath: item.detail_path || `/operations/day-uses/${item.id}`,
  };
}

function getProgress(item, now) {
  if (!item.startDate || !item.endDate) {
    return { elapsedPct: 0, remainingMinutes: 0, tone: "green" };
  }
  const duration = item.endDate.getTime() - item.startDate.getTime();
  const elapsed = now.getTime() - item.startDate.getTime();
  const remainingMinutes = Math.max(0, (item.endDate.getTime() - now.getTime()) / 60000);
  const elapsedPct = duration > 0 ? clamp((elapsed / duration) * 100) : 0;
  const tone = remainingMinutes < 10 ? "red" : remainingMinutes <= 30 ? "orange" : "green";
  return { elapsedPct, remainingMinutes, tone };
}

function progressColor(tone) {
  if (tone === "red") return "#A32D2D";
  if (tone === "orange") return "#EF9F27";
  return "var(--primary)";
}

function initialForm() {
  return {
    client_id: "",
    room_id: "",
    start_time: currentTimeValue(),
    duration_hours: 3,
    discount_percent: 0,
    hourly_rate: "",
  };
}

function DayUseCard({ item, now, onOpen }) {
  const progress = getProgress(item, now);
  const showProgress = item.statusKind === "active" || item.statusKind === "waiting";
  const remainingText = progress.remainingMinutes < 10
    ? `Fin imminente · ${formatDuration(progress.remainingMinutes, { showSeconds: true })}`
    : `${formatDuration(progress.remainingMinutes, { showSeconds: true })} restantes`;
  const paymentText = item.remainingAmount > 0 ? "À encaisser" : "Soldé";

  return (
    <button type="button" className={`du-card du-card--${item.statusKind}`} onClick={() => onOpen(item)}>
      <div className="du-card-top">
        <div className={`du-avatar du-avatar--${item.statusKind}`}>{buildInitials(item.clientName)}</div>
        <div className="du-card-identity">
          <strong>{item.clientName}</strong>
          <div className="du-card-meta">
            <span><Icon name="bed" /> Ch. {item.roomNumber} · {item.roomType}</span>
            <span><Icon name="clock" /> {formatTime(item.startDate)} → {formatTime(item.endDate)}</span>
          </div>
        </div>
        <span className={`du-status du-status--${item.statusKind}`}>{statusCopy(item.statusKind)}</span>
        <div className="du-card-price">
          <strong>{formatMoney(item.finalAmount)}</strong>
          <span>{paymentText}</span>
        </div>
      </div>

      {showProgress ? (
        <div className="du-progress-block">
          <div className="du-progress-row">
            <span><Icon name="hourglass" /> Temps restant</span>
            <strong>Fin à {formatTime(item.endDate)}</strong>
          </div>
          <div className="du-progress-track">
            <span
              className="du-progress-fill"
              style={{ width: `${progress.elapsedPct}%`, backgroundColor: progressColor(progress.tone) }}
            />
          </div>
          <div className="du-progress-footer">
            <span>{formatTime(item.startDate)}</span>
            <strong className={`du-progress-left du-progress-left--${progress.tone}`}>{remainingText}</strong>
            <span>{formatTime(item.endDate)}</span>
          </div>
        </div>
      ) : null}
    </button>
  );
}

function Timeline({ items, now }) {
  const { rangeStart, rangeEnd, ticks } = useMemo(() => {
    const baseStart = new Date(now);
    baseStart.setHours(6, 0, 0, 0);
    const baseEnd = new Date(now);
    baseEnd.setDate(baseEnd.getDate() + 1);
    baseEnd.setHours(0, 0, 0, 0);

    const validDates = items.flatMap((item) => [item.startDate, item.endDate]).filter(Boolean);
    const minData = validDates.length ? Math.min(...validDates.map((date) => date.getTime())) : baseStart.getTime();
    const maxData = validDates.length ? Math.max(...validDates.map((date) => date.getTime())) : baseEnd.getTime();

    const start = new Date(Math.min(baseStart.getTime(), minData, now.getTime() - 60 * 60000));
    start.setMinutes(0, 0, 0);
    const end = new Date(Math.max(baseEnd.getTime(), maxData, now.getTime() + 60 * 60000));
    end.setMinutes(0, 0, 0);
    if (end.getTime() <= Math.max(maxData, now.getTime())) {
      end.setHours(end.getHours() + 1);
    }

    const tickItems = [];
    const cursor = new Date(start);
    const totalHours = Math.max(1, (end.getTime() - start.getTime()) / 3600000);
    const step = totalHours > 18 ? 2 : 1;
    while (cursor <= end) {
      tickItems.push(new Date(cursor));
      cursor.setHours(cursor.getHours() + step);
    }

    return { rangeStart: start, rangeEnd: end, ticks: tickItems };
  }, [items, now]);

  const rangeDuration = Math.max(rangeEnd.getTime() - rangeStart.getTime(), 1);
  const nowLeft = clamp(((now.getTime() - rangeStart.getTime()) / rangeDuration) * 100);

  return (
    <section className="du-timeline-card">
      <header className="du-timeline-header">
        <Icon name="timeline" />
        <strong>PLANNING DES OCCUPATIONS · {formatDate(now)}</strong>
        <span>Maintenant : {formatTime(now)}</span>
      </header>

      <div className="du-timeline-body">
        {items.map((item) => {
          const startLeft = item.startDate ? ((item.startDate.getTime() - rangeStart.getTime()) / rangeDuration) * 100 : 0;
          const width = item.startDate && item.endDate
            ? ((item.endDate.getTime() - item.startDate.getTime()) / rangeDuration) * 100
            : 0;
          const progress = getProgress(item, now);
          const segmentTone = item.statusKind === "completed" ? "past" : item.statusKind === "waiting" ? "orange" : progress.tone;

          return (
            <div className="du-timeline-row" key={`timeline-${item.id}`}>
              <div className="du-timeline-client">
                <div className={`du-avatar du-avatar--small du-avatar--${item.statusKind}`}>{buildInitials(item.clientName)}</div>
                <div>
                  <strong>{item.clientName}</strong>
                  <span>Ch. {item.roomNumber}</span>
                </div>
              </div>

              <div className="du-timeline-line">
                <div className="du-timeline-axis" />
                {ticks.map((tick) => (
                  <span
                    key={`${item.id}-${tick.toISOString()}`}
                    className="du-timeline-tick"
                    style={{ left: `${clamp(((tick.getTime() - rangeStart.getTime()) / rangeDuration) * 100)}%` }}
                  >
                    <small>{formatTime(tick)}</small>
                  </span>
                ))}
                <span className="du-timeline-now" style={{ left: `${nowLeft}%` }}>
                  <i />
                </span>
                <span
                  className={`du-timeline-segment du-timeline-segment--${segmentTone}`}
                  title={`${item.clientName} · ${formatTime(item.startDate)} → ${formatTime(item.endDate)} · ${formatDuration(progress.remainingMinutes)}`}
                  style={{ left: `${clamp(startLeft)}%`, width: `${clamp(width, 2, 100)}%` }}
                >
                  {width > 15 ? `${formatTime(item.startDate)} → ${formatTime(item.endDate)}` : ""}
                </span>
              </div>

              <strong className={`du-timeline-remaining du-timeline-remaining--${progress.tone}`}>
                {item.statusKind === "completed"
                  ? "Terminé"
                  : progress.remainingMinutes < 10
                    ? `⚠ ${Math.round(progress.remainingMinutes)}min`
                    : formatDuration(progress.remainingMinutes)}
              </strong>
            </div>
          );
        })}

        <div className="du-timeline-legend">
          <span><i className="du-legend-box du-legend-box--green" /> En cours</span>
          <span><i className="du-legend-box du-legend-box--orange" /> Fin imminente/Att. paiem.</span>
          <span><i className="du-legend-box du-legend-box--gray" /> Terminé</span>
          <span><i className="du-legend-line" /> Maintenant</span>
        </div>
      </div>
    </section>
  );
}

export function DayUsePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [dashboard, setDashboard] = useState(null);
  const [dayUses, setDayUses] = useState([]);
  const [clients, setClients] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [now, setNow] = useState(new Date());

  const normalizedDayUses = useMemo(() => dayUses.map(normalizeDayUse), [dayUses]);

  const counts = useMemo(() => {
    const active = normalizedDayUses.filter((item) => item.statusKind === "active").length;
    const waiting = normalizedDayUses.filter((item) => item.statusKind === "waiting").length;
    const completed = normalizedDayUses.filter((item) => item.statusKind === "completed").length;
    return { all: normalizedDayUses.length, active, waiting, completed };
  }, [normalizedDayUses]);

  const filteredDayUses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return normalizedDayUses.filter((item) => {
      const matchesTab = activeFilter === "all" || item.statusKind === activeFilter;
      const searchable = `${item.clientName} ${item.roomNumber} ${item.reference}`.toLowerCase();
      return matchesTab && (!query || searchable.includes(query));
    });
  }, [activeFilter, normalizedDayUses, search]);

  const selectedRoom = useMemo(
    () => availableRooms.find((room) => String(room.id) === String(form.room_id)),
    [availableRooms, form.room_id],
  );

  const estimatedAmount = useMemo(() => {
    const hourlyRate = Number(form.hourly_rate || selectedRoom?.hourly_rate || 0);
    const duration = Number(form.duration_hours || 0);
    const discountPercent = clamp(Number(form.discount_percent || 0), 0, 100);
    return Math.max(hourlyRate * duration * (1 - discountPercent / 100), 0);
  }, [form.discount_percent, form.duration_hours, form.hourly_rate, selectedRoom]);

  const kpis = useMemo(() => ({
    today: Number(dashboard?.total_day_use ?? counts.all),
    active: Number(dashboard?.occupied_day_use ?? counts.active),
    waiting: Number(dashboard?.pending_payments ?? counts.waiting),
    revenue: Number(dashboard?.revenue ?? normalizedDayUses.reduce((total, item) => total + item.paidAmount, 0)),
  }), [counts, dashboard, normalizedDayUses]);

  const loadAvailability = useCallback(async (nextForm) => {
    const payload = await getDayUseAvailability({
      start_datetime: buildStartDatetime(nextForm.start_time),
      duration_hours: nextForm.duration_hours,
    });
    setAvailableRooms(getItems(payload));
  }, []);

  async function refreshAll(nextForm = form) {
    setError("");
    try {
      const today = todayDateValue();
      const [dashboardPayload, dayUsePayload, clientPayload, availabilityPayload] = await Promise.all([
        getDayUseDashboard(),
        listDayUses({ page: 1, page_size: PAGE_SIZE, date_from: today, date_to: today }),
        listClients({ page: 1, pageSize: 100, filter: "all" }),
        getDayUseAvailability({
          start_datetime: buildStartDatetime(form.start_time),
          duration_hours: form.duration_hours,
        }),
      ]);
      setDashboard(dashboardPayload);
      setDayUses(getItems(dayUsePayload));
      setClients(getItems(clientPayload).filter((client) => client.is_active !== false));
      setAvailableRooms(getItems(availabilityPayload));
    } catch (err) {
      const message = extractError(err, "Chargement Day Use impossible.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    loadAvailability(form).catch((err) => setFormError(extractError(err, "Disponibilités indisponibles.")));
  }, [form.duration_hours, form.start_time, loadAvailability]);

  function updateForm(field, value) {
    setFormError("");
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "room_id") {
        const room = availableRooms.find((item) => String(item.id) === String(value));
        next.hourly_rate = room?.hourly_rate || "";
      }
      if (field === "start_time") {
        next.start_time = normalizeTimeInput(value);
      }
      return next;
    });
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!form.client_id || !form.room_id) return;

    setSubmitting(true);
    setFormError("");
    try {
      const grossAmount = Number(form.hourly_rate || selectedRoom?.hourly_rate || 0) * Number(form.duration_hours || 0);
      const discountAmount = grossAmount * (clamp(Number(form.discount_percent || 0), 0, 100) / 100);
      const created = await createDayUse({
        client_id: form.client_id,
        room_id: form.room_id,
        start_datetime: buildStartDatetime(form.start_time),
        duration_hours: Number(form.duration_hours),
        expected_duration_hours: Number(form.duration_hours),
        hourly_rate: Number(form.hourly_rate || selectedRoom?.hourly_rate || 0),
        discount_amount: discountAmount,
        notes: "",
      });
      const resetForm = initialForm();
      setForm(resetForm);
      const actionPath = created?.detail_path
        || created?.day_use?.detail_path
        || (created?.id ? `/operations/day-uses/${created.id}` : "");
      toast.success("Day Use créé.", actionPath ? { actionLabel: "Voir →", actionPath } : undefined);
      await refreshAll(resetForm);
    } catch (err) {
      const message = extractError(err, "Création Day Use impossible.");
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  function openDayUse(item) {
    navigate(item.detailPath);
  }

  const filterTabs = [
    { key: "all", label: "Tous", count: counts.all },
    { key: "active", label: "En cours", count: counts.active },
    { key: "waiting", label: "Attente", count: counts.waiting },
    { key: "completed", label: "Terminé", count: counts.completed },
  ];

  return (
    <main className="day-use-page">
      <header className="du-page-header">
        <div>
          <span className="du-eyebrow">RÉCEPTION</span>
          <h1>Day Use</h1>
          <p>Location horaire · {formatDate(now)} · {availableRooms.length} chambre(s) disponible(s)</p>
        </div>
        <div className="du-header-actions">
          <button type="button" className="du-btn du-btn--secondary" onClick={refreshAll} disabled={loading}>
            <Icon name="refresh" /> Actualiser
          </button>
          <button type="button" className="du-btn du-btn--primary" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <Icon name="plus" /> Nouveau Day Use
          </button>
        </div>
      </header>

      <section className="du-kpis" aria-label="Indicateurs Day Use">
        <article>
          <span><Icon name="clock" /> Aujourd'hui</span>
          <strong>{kpis.today}</strong>
        </article>
        <article className={kpis.active > 0 ? "du-kpi--green" : ""}>
          <span><Icon name="door-enter" /> En chambre</span>
          <strong>{kpis.active}</strong>
        </article>
        <article className={kpis.waiting > 0 ? "du-kpi--orange" : ""}>
          <span><Icon name="coin" /> Paiements att.</span>
          <strong>{kpis.waiting}</strong>
        </article>
        <article>
          <span><Icon name="chart-bar" /> Revenus jour</span>
          <strong>{formatMoneyCompact(kpis.revenue)}</strong>
        </article>
      </section>

      <form className="du-quick-create" onSubmit={handleCreate}>
        <div className="du-section-title"><Icon name="plus" /> CRÉATION RAPIDE</div>
        <div className="du-quick-grid">
          <label>
            <span>CLIENT</span>
            <AppSelect
              className="du-app-select"
              value={form.client_id}
              onChange={(event) => updateForm("client_id", event.target.value)}
              name="client_id"
              searchable
            >
              <option value="">Sélectionner un client…</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.full_name} · {client.phone}</option>
              ))}
            </AppSelect>
          </label>

          <label>
            <span>CHAMBRE</span>
            <AppSelect
              className="du-app-select"
              value={form.room_id}
              onChange={(event) => updateForm("room_id", event.target.value)}
              name="room_id"
              searchable
            >
              <option value="">Sélectionner…</option>
              {availableRooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.number} - {room.room_type || room.type} · {formatMoney(room.hourly_rate)}/h
                </option>
              ))}
            </AppSelect>
          </label>

          <label>
            <span>DÉBUT</span>
            <input type="text" inputMode="numeric" value={form.start_time} onChange={(event) => updateForm("start_time", event.target.value)} placeholder="HH:MM" />
          </label>

          <label>
            <span>DURÉE (H)</span>
            <input type="number" min="1" max="10" value={form.duration_hours} onChange={(event) => updateForm("duration_hours", event.target.value)} />
          </label>

          <button type="submit" className="du-create-btn" disabled={!form.client_id || !form.room_id || submitting}>
            <Icon name="plus" /> {submitting ? "Création…" : "Créer"}
          </button>
        </div>
        <div className="du-estimate">
          <span>Prix estimé</span>
          <strong>{formatMoney(estimatedAmount)}</strong>
        </div>
        {formError ? <p className="du-form-error">{formError}</p> : null}
      </form>

      <section className="du-filters">
        <label className="du-search">
          <Icon name="search" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher client, chambre, référence…"
          />
        </label>
        <div className="du-tabs" role="tablist" aria-label="Filtrer les Day Use">
          {filterTabs.map((tab) => (
            <button
              type="button"
              key={tab.key}
              className={activeFilter === tab.key ? "active" : ""}
              onClick={() => setActiveFilter(tab.key)}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </section>

      {error ? (
        <section className="du-error-state">
          <p>{error}</p>
          <button type="button" className="du-btn du-btn--primary" onClick={refreshAll}>Réessayer</button>
        </section>
      ) : null}

      {loading ? (
        <section className="du-list">
          {[0, 1, 2].map((item) => <div className="du-skeleton-card" key={item} />)}
        </section>
      ) : !error && filteredDayUses.length === 0 ? (
        <section className="du-empty-state">
          <Icon name="clock-off" />
          <h2>Aucun Day Use enregistré aujourd'hui</h2>
          <p>Utilisez le formulaire ci-dessus pour créer le premier.</p>
          <button type="button" className="du-btn du-btn--primary" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <Icon name="plus" /> Créer un Day Use
          </button>
        </section>
      ) : !error ? (
        <>
          <section className="du-list">
            {filteredDayUses.map((item) => (
              <DayUseCard key={item.id} item={item} now={now} onOpen={openDayUse} />
            ))}
          </section>
          <Timeline items={filteredDayUses} now={now} />
        </>
      ) : null}
    </main>
  );
}
