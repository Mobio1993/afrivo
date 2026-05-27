import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchJson } from "../../api/client";
import { AppSelect } from "../../shared/components/AppSelect";
import { DatePicker } from "../../shared/components/DatePicker";
import { useToast } from "../../shared/toast/ToastContext";
import "./AllOperationsPage.css";

const PAGE_SIZE = 20;

const DEFAULT_FILTERS = {
  search: "",
  type: "all",
  status: "all",
  paymentStatus: "all",
  ordering: "-created_at",
  dateFrom: "",
  dateTo: "",
  room: "",
};

const TYPE_OPTIONS = [
  { value: "all", label: "Tous types" },
  { value: "payment", label: "Paiement" },
  { value: "booking", label: "Reservation" },
  { value: "dayuse", label: "Day use" },
  { value: "stay", label: "Sejour" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "Tous statuts operation" },
  { value: "paid", label: "Paye" },
  { value: "pending", label: "En attente" },
  { value: "in_progress", label: "En cours" },
  { value: "cancelled", label: "Annule" },
  { value: "pending_payment", label: "Paiement en attente" },
  { value: "confirmed", label: "Confirme" },
  { value: "no_show", label: "No-show" },
];

const PAYMENT_OPTIONS = [
  { value: "all", label: "Tout paiement" },
  { value: "paid", label: "Paye" },
  { value: "partial", label: "Partiel" },
  { value: "unpaid", label: "Impaye" },
];

const ORDERING_OPTIONS = [
  { value: "-created_at", label: "Date creation ↓" },
  { value: "created_at", label: "Date creation ↑" },
  { value: "-amount", label: "Montant ↓" },
  { value: "amount", label: "Montant ↑" },
  { value: "client__name", label: "Client A→Z" },
];

const TYPE_META = {
  payment: { label: "Paiement", short: "Paiement", tone: "payment", color: "#7F77DD" },
  booking: { label: "Reservation", short: "Reserv.", tone: "booking", color: "#185FA5" },
  day_use: { label: "Day use", short: "Day use", tone: "dayuse", color: "#BA7517" },
  dayuse: { label: "Day use", short: "Day use", tone: "dayuse", color: "#BA7517" },
  stay: { label: "Sejour", short: "Sejour", tone: "stay", color: "#3B6D11" },
};

const PAYMENT_META = {
  paid: { label: "Paye", tone: "paid", color: "#3B6D11" },
  partial: { label: "Partiel", tone: "partial", color: "#185FA5" },
  unpaid: { label: "Impaye", tone: "unpaid", color: "#A32D2D" },
};

const STATUS_META = {
  paid: { label: "Paye", tone: "paid", color: "#3B6D11" },
  pending: { label: "Attente", tone: "pending", color: "#854F0B" },
  in_progress: { label: "En cours", tone: "in-progress", color: "#0C447C" },
  checked_in: { label: "En cours", tone: "in-progress", color: "#0C447C" },
  cancelled: { label: "Annule", tone: "cancelled", color: "#A32D2D" },
  confirmed: { label: "Confirme", tone: "confirmed", color: "#3B6D11" },
  no_show: { label: "No-show", tone: "no-show", color: "#A32D2D" },
  pending_payment: { label: "Pmt att.", tone: "payment-pending", color: "#854F0B" },
  ready: { label: "Pret", tone: "confirmed", color: "#3B6D11" },
  completed: { label: "Termine", tone: "paid", color: "#3B6D11" },
  refunded: { label: "Remb.", tone: "cancelled", color: "#A32D2D" },
};

function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function buildQuery(filters, page, search) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(PAGE_SIZE));
  if (search.trim()) params.set("search", search.trim());
  if (filters.type !== "all") params.set("type", filters.type);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.paymentStatus !== "all") params.set("payment_status", filters.paymentStatus);
  if (filters.ordering) params.set("ordering", filters.ordering);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  if (filters.room.trim()) params.set("room", filters.room.trim());
  return params.toString();
}

function formatDateShort(value) {
  if (!value || value === "-") return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(date);
}

function formatAmount(value) {
  const number = Number(value || 0);
  return `${number.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} XOF`;
}

function formatCompactAmount(value) {
  const number = Number(value || 0);
  if (number >= 1_000_000) return `${Math.round(number / 1_000_000)}M XOF`;
  if (number >= 1_000) return `${Math.round(number / 1_000)}K XOF`;
  return `${Math.round(number)} XOF`;
}

function normalizeType(operation) {
  return operation.operation_type || operation.type || "booking";
}

function getTypeMeta(operation) {
  return TYPE_META[normalizeType(operation)] || TYPE_META.booking;
}

function getStatusMeta(operation) {
  const raw = String(operation.status_code || operation.status || "").toLowerCase();
  return STATUS_META[raw] || { label: operation.status || "-", tone: "default", color: "#64748B" };
}

function getPaymentMeta(operation) {
  return PAYMENT_META[operation.payment_status] || PAYMENT_META.unpaid;
}

function truncate(value, max = 18) {
  const text = String(value || "-");
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function optionLabel(options, value) {
  return options.find((item) => item.value === value)?.label || value;
}

function KpiCard({ label, value, subLabel, icon, tone }) {
  return (
    <article className="ops-kpi">
      <div className="ops-kpi-head">
        <span>{label}</span>
        <i className={`ti ${icon} ops-kpi-icon ops-kpi-icon--${tone}`} aria-hidden="true" />
      </div>
      <strong className={`ops-kpi-value ops-kpi-value--${tone}`}>{value}</strong>
      <small>{subLabel}</small>
    </article>
  );
}

function MiniBar({ label, value, total, color }) {
  const width = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="ops-analytics-bar">
      <div className="ops-analytics-line">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="ops-progress">
        <span style={{ width: `${width}%`, background: color }} />
      </div>
    </div>
  );
}

function DotMetric({ label, value, color }) {
  return (
    <div className="ops-dot-metric">
      <span className="ops-dot" style={{ background: color }} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SkeletonRows() {
  return Array.from({ length: 5 }, (_, index) => (
    <tr key={`skeleton-${index}`} className="ops-skeleton-row">
      {Array.from({ length: 7 }, (__, cell) => (
        <td key={cell}>
          <span className="ops-skeleton" />
        </td>
      ))}
    </tr>
  ));
}

function getPageButtons(current, total) {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  return [...pages]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b)
    .reduce((items, page, index, pagesList) => {
      if (index > 0 && page - pagesList[index - 1] > 1) items.push("...");
      items.push(page);
      return items;
    }, []);
}

export function AllOperationsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [operations, setOperations] = useState([]);
  const [summary, setSummary] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const debouncedSearch = useDebounce(filters.search, 300);

  const query = useMemo(
    () => buildQuery(filters, currentPage, debouncedSearch),
    [filters, currentPage, debouncedSearch],
  );

  const stats = useMemo(() => {
    const byType = summary?.by_type || operations.reduce((acc, operation) => {
      const type = normalizeType(operation) === "day_use" ? "dayuse" : normalizeType(operation);
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    const byPaymentStatus = summary?.by_payment_status || operations.reduce((acc, operation) => {
      const key = operation.payment_status || "unpaid";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const byStatus = summary?.by_status || operations.reduce((acc, operation) => {
      const key = operation.status_code || operation.status || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const totalAmount = summary?.total_amount ?? operations.reduce((sum, operation) => sum + Number(operation.amount || 0), 0);
    const total = summary?.total_count ?? totalCount;

    return {
      total,
      bookings: summary?.bookings_count ?? byType.booking ?? 0,
      staysDayUse: summary?.stays_dayuse_count ?? (byType.stay || 0) + (byType.dayuse || 0),
      totalAmount,
      byType,
      byPaymentStatus,
      byStatus,
    };
  }, [operations, summary, totalCount]);

  const activeFilters = useMemo(() => {
    const chips = [];
    if (filters.search.trim()) chips.push({ key: "search", icon: "ti-search", label: filters.search.trim() });
    if (filters.type !== "all") chips.push({ key: "type", icon: "ti-layout-grid", label: optionLabel(TYPE_OPTIONS, filters.type) });
    if (filters.status !== "all") chips.push({ key: "status", icon: "ti-check", label: optionLabel(STATUS_OPTIONS, filters.status) });
    if (filters.paymentStatus !== "all") chips.push({ key: "paymentStatus", icon: "ti-credit-card", label: optionLabel(PAYMENT_OPTIONS, filters.paymentStatus) });
    if (filters.dateFrom) chips.push({ key: "dateFrom", icon: "ti-calendar", label: `Du ${filters.dateFrom}` });
    if (filters.dateTo) chips.push({ key: "dateTo", icon: "ti-calendar", label: `Au ${filters.dateTo}` });
    if (filters.room.trim()) chips.push({ key: "room", icon: "ti-bed", label: `Ch. ${filters.room.trim()}` });
    return chips;
  }, [filters]);

  function handleFilterChange(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
    setCurrentPage(1);
  }

  function removeFilter(key) {
    handleFilterChange(key, DEFAULT_FILTERS[key]);
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    setCurrentPage(1);
  }

  async function fetchOperations({ silent = false } = {}) {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const payload = await fetchJson(`/api/operations/all/?${query}`);
      setOperations(payload.results || []);
      setSummary(payload.summary || null);
      setTotalCount(payload.count || 0);
      setTotalPages(payload.total_pages || 1);
    } catch (requestError) {
      const message = requestError.message || "Impossible de charger les operations.";
      setError(message);
      toast.error(message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const payload = await fetchJson(`/api/operations/all/?${query}`);
        if (ignore) return;
        setOperations(payload.results || []);
        setSummary(payload.summary || null);
        setTotalCount(payload.count || 0);
        setTotalPages(payload.total_pages || 1);
      } catch (requestError) {
        if (!ignore) {
          const message = requestError.message || "Impossible de charger les operations.";
          setError(message);
          toast.error(message);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [query]);

  function openOperation(operation) {
    navigate(operation.detail_url || `/operations/${operation.entity_type}/${operation.id}`);
  }

  const pageButtons = getPageButtons(currentPage, totalPages || 1);

  return (
    <div className="all-ops-analytics-page">
      <header className="all-ops-header">
        <div>
          <span className="all-ops-eyebrow">FRONT OFFICE</span>
          <h1>Toutes les operations</h1>
          <p>Pilotage consolide des flux metier</p>
        </div>
        <div className="all-ops-header-actions">
          <button type="button" className="secondary-button compact" onClick={() => setShowAdvancedFilters((value) => !value)}>
            <i className="ti ti-filter" aria-hidden="true" />
            Filtres avances
          </button>
          <button type="button" className="secondary-button compact" onClick={() => fetchOperations()} disabled={loading}>
            <i className="ti ti-refresh" aria-hidden="true" />
            Actualiser
          </button>
        </div>
      </header>

      <section className="ops-kpi-grid">
        <KpiCard label="Operations" value={stats.total} subLabel="Flux consolides" icon="ti-layout-grid" tone="violet" />
        <KpiCard label="Reservations" value={stats.bookings} subLabel="Demandes et arrivees" icon="ti-calendar" tone="blue" />
        <KpiCard label="Sejours / Day use" value={stats.staysDayUse} subLabel="Occupations actives ou passees" icon="ti-home" tone="green" />
        <KpiCard label="Montant total" value={formatCompactAmount(stats.totalAmount)} subLabel="Perimetre filtre" icon="ti-coin" tone="teal" />
      </section>

      <section className="ops-main-filters">
        <div className="ops-search-field">
          <i className="ti ti-search" aria-hidden="true" />
          <input
            type="search"
            placeholder="Client, reference ou chambre..."
            value={filters.search}
            onChange={(event) => handleFilterChange("search", event.target.value)}
          />
        </div>
        <AppSelect value={filters.type} onChange={(event) => handleFilterChange("type", event.target.value)} name="operation_type">
          {TYPE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </AppSelect>
        <AppSelect value={filters.status} onChange={(event) => handleFilterChange("status", event.target.value)} name="operation_status">
          {STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </AppSelect>
        <AppSelect value={filters.paymentStatus} onChange={(event) => handleFilterChange("paymentStatus", event.target.value)} name="payment_status">
          {PAYMENT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </AppSelect>
        <AppSelect value={filters.ordering} onChange={(event) => handleFilterChange("ordering", event.target.value)} name="operation_ordering">
          {ORDERING_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </AppSelect>
      </section>

      {showAdvancedFilters ? (
        <section className="ops-advanced-filters">
          <label>
            <span>Du</span>
            <DatePicker
              value={filters.dateFrom}
              onChange={(event) => {
                handleFilterChange("dateFrom", event.target.value);
                if (filters.dateTo && event.target.value > filters.dateTo) handleFilterChange("dateTo", "");
              }}
              placeholder="Date debut"
              maxDate={filters.dateTo || undefined}
            />
          </label>
          <label>
            <span>Au</span>
            <DatePicker
              value={filters.dateTo}
              onChange={(event) => handleFilterChange("dateTo", event.target.value)}
              placeholder="Date fin"
              minDate={filters.dateFrom || undefined}
            />
          </label>
          <label>
            <span>Chambre</span>
            <input
              type="text"
              value={filters.room}
              placeholder="Numero"
              onChange={(event) => handleFilterChange("room", event.target.value)}
            />
          </label>
          <button type="button" className="secondary-button compact" onClick={resetFilters}>
            <i className="ti ti-filter-off" aria-hidden="true" />
            Reinitialiser les filtres
          </button>
        </section>
      ) : null}

      {activeFilters.length ? (
        <div className="ops-active-chips" aria-label="Filtres actifs">
          {activeFilters.map((chip) => (
            <button key={chip.key} type="button" className="ops-filter-chip" onClick={() => removeFilter(chip.key)}>
              <i className={`ti ${chip.icon}`} aria-hidden="true" />
              {chip.label}
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}

      <main className="ops-analytics-layout">
        <section className="ops-table-card">
          <div className="ops-table-header">
            <span>Flux operations</span>
            <strong>{totalCount} resultats</strong>
          </div>

          {error ? (
            <div className="ops-table-error" role="alert">
              <i className="ti ti-alert-circle" aria-hidden="true" />
              {error}
            </div>
          ) : null}

          <div className="ops-table-scroll">
            <table className="ops-table">
              <colgroup>
                <col className="col-type" />
                <col className="col-ref" />
                <col className="col-client" />
                <col className="col-room" />
                <col className="col-status" />
                <col className="col-amount" />
                <col className="col-payment" />
              </colgroup>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Reference</th>
                  <th>Client</th>
                  <th>Ch.</th>
                  <th>Statut</th>
                  <th>Montant</th>
                  <th>Paiement</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <SkeletonRows /> : operations.map((operation) => {
                  const typeMeta = getTypeMeta(operation);
                  const statusMeta = getStatusMeta(operation);
                  const paymentMeta = getPaymentMeta(operation);
                  return (
                    <tr key={`${operation.entity_type}-${operation.id}`} onClick={() => openOperation(operation)} tabIndex={0}>
                      <td>
                        <span className={`ops-type-badge ops-type-badge--${typeMeta.tone}`}>{typeMeta.short}</span>
                      </td>
                      <td>
                        <div className="ops-ref-main">{truncate(operation.reference, 18)}</div>
                        <div className="ops-ref-sub">#{operation.id} · {formatDateShort(operation.created_at)}</div>
                      </td>
                      <td title={operation.client_name || "-"}>{operation.client_name || "-"}</td>
                      <td>{operation.room_name && operation.room_name !== "-" ? operation.room_name : "—"}</td>
                      <td>
                        <span className={`ops-status-badge ops-status-badge--${statusMeta.tone}`}>{statusMeta.label}</span>
                      </td>
                      <td className={Number(operation.amount || 0) ? "ops-amount" : "ops-amount ops-amount--zero"}>
                        {formatAmount(operation.amount)}
                      </td>
                      <td>
                        <span className={`ops-payment-badge ops-payment-badge--${paymentMeta.tone}`}>{paymentMeta.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!loading && !operations.length ? (
            <div className="ops-empty-state">
              <i className="ti ti-inbox" aria-hidden="true" />
              <strong>Aucune operation trouvee</strong>
              <span>Modifiez vos filtres pour elargir la recherche.</span>
            </div>
          ) : null}

          <footer className="ops-table-footer">
            <span>Page {currentPage}/{totalPages || 1} · {totalCount} resultats</span>
            <div className="ops-page-buttons">
              <button type="button" onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))} disabled={loading || currentPage <= 1}>
                <i className="ti ti-chevron-left" aria-hidden="true" />
              </button>
              {pageButtons.map((page, index) => page === "..." ? (
                <span key={`ellipsis-${index}`} className="ops-page-ellipsis">...</span>
              ) : (
                <button
                  key={page}
                  type="button"
                  className={page === currentPage ? "active" : ""}
                  onClick={() => setCurrentPage(page)}
                  disabled={loading}
                >
                  {page}
                </button>
              ))}
              <button type="button" onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages || 1))} disabled={loading || currentPage >= totalPages}>
                <i className="ti ti-chevron-right" aria-hidden="true" />
              </button>
            </div>
          </footer>
        </section>

        <aside className="ops-analytics-panel">
          <article className="ops-analytics-card">
            <header>Repartition par type</header>
            <div>
              <MiniBar label="Paiements" value={stats.byType.payment || 0} total={stats.total} color="#7F77DD" />
              <MiniBar label="Reservations" value={stats.byType.booking || 0} total={stats.total} color="#185FA5" />
              <MiniBar label="Day use" value={stats.byType.dayuse || 0} total={stats.total} color="#BA7517" />
              <MiniBar label="Sejours" value={stats.byType.stay || 0} total={stats.total} color="#3B6D11" />
            </div>
          </article>

          <article className="ops-analytics-card">
            <header>Statuts paiement</header>
            <div>
              <DotMetric label="Paye" value={stats.byPaymentStatus.paid || 0} color="#3B6D11" />
              <DotMetric label="Partiel" value={stats.byPaymentStatus.partial || 0} color="#185FA5" />
              <DotMetric label="Impaye" value={stats.byPaymentStatus.unpaid || 0} color="#A32D2D" />
            </div>
          </article>

          <article className="ops-analytics-card">
            <header>Statuts operation</header>
            <div>
              {Object.entries(stats.byStatus || {}).length ? Object.entries(stats.byStatus).map(([statusKey, value]) => {
                const meta = STATUS_META[String(statusKey).toLowerCase()] || { label: statusKey, color: "#64748B" };
                return <DotMetric key={statusKey} label={meta.label} value={value} color={meta.color} />;
              }) : <DotMetric label="Aucun statut" value={0} color="#94A3B8" />}
            </div>
          </article>
        </aside>
      </main>
    </div>
  );
}
