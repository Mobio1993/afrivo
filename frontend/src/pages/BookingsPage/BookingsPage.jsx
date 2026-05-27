import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { fetchJson, postJson } from "../../api/client";
import { AppSelect } from "../../shared/components/AppSelect";
import { DatePicker } from "../../shared/components/DatePicker";
import { useToast } from "../../shared/toast/ToastContext";
import "./BookingsPage.css";

const STATUS_OPTIONS = [
  { value: "", label: "Tous les statuts" },
  { value: "pending", label: "En attente" },
  { value: "confirmed", label: "Confirmees" },
  { value: "checked_in", label: "Check-in fait" },
  { value: "cancelled", label: "Annulees" },
  { value: "no_show", label: "No-show" },
];

function buildQuery(filters) {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.status) params.set("status", filters.status);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  return params.toString();
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getStatusTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("confirm")) return "confirmed";
  if (normalized.includes("attente")) return "pending";
  if (normalized.includes("annul")) return "cancelled";
  if (normalized.includes("no-show")) return "no-show";
  if (normalized.includes("check")) return "checked-in";
  return "default";
}

function SummaryCard({ label, value, tone = "default" }) {
  return (
    <article className={`bookings-summary-card bookings-summary-card--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export function BookingsPage() {
  const toast = useToast();
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    dateFrom: "",
    dateTo: "",
  });
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");

  const query = useMemo(() => buildQuery(filters), [filters]);

  const summary = useMemo(() => {
    const total = bookings.length;
    const confirmed = bookings.filter((item) => getStatusTone(item.status) === "confirmed").length;
    const pending = bookings.filter((item) => getStatusTone(item.status) === "pending").length;
    const ready = bookings.filter((item) => item.can_check_in !== false).length;
    return { total, confirmed, pending, ready };
  }, [bookings]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function loadBookings({ silent = false } = {}) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const payload = await fetchJson(`/api/operations/bookings/${query ? `?${query}` : ""}`);
      setBookings(payload.results || []);
    } catch (requestError) {
      const message = requestError.message || "Impossible de charger les reservations.";
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
      setError("");
      try {
        const payload = await fetchJson(`/api/operations/bookings/${query ? `?${query}` : ""}`);
        if (!ignore) setBookings(payload.results || []);
      } catch (requestError) {
        if (!ignore) {
          const message = requestError.message || "Impossible de charger les reservations.";
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

  async function checkInBooking(booking) {
    setActionLoading(booking.id);
    setError("");
    try {
      await postJson(`/api/operations/bookings/${booking.id}/check-in/`, {});
      toast.success(`Check-in effectue pour ${booking.reference}.`);
      await loadBookings({ silent: true });
    } catch (requestError) {
      const message = requestError.message || "Le check-in n'a pas pu etre effectue.";
      setError(message);
      toast.error(message);
    } finally {
      setActionLoading("");
    }
  }

  return (
    <div className="page-stack bookings-page">
      <section className="bookings-summary-grid">
        <SummaryCard label="Reservations chargees" value={summary.total} tone="total" />
        <SummaryCard label="Confirmees" value={summary.confirmed} tone="confirmed" />
        <SummaryCard label="En attente" value={summary.pending} tone="pending" />
        <SummaryCard label="Eligibles check-in" value={summary.ready} tone="ready" />
      </section>

      <section className="bookings-toolbar">
        <div className="bookings-search">
          <i className="ti ti-search" aria-hidden="true" />
          <input
            type="search"
            placeholder="Reference, client ou chambre..."
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
          />
        </div>
        <AppSelect value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} name="booking_status">
          {STATUS_OPTIONS.map((item) => (
            <option key={item.value || "all"} value={item.value}>{item.label}</option>
          ))}
        </AppSelect>
        <DatePicker
          value={filters.dateFrom}
          onChange={(event) => {
            updateFilter("dateFrom", event.target.value);
            if (filters.dateTo && event.target.value > filters.dateTo) updateFilter("dateTo", "");
          }}
          placeholder="Arrivee du"
          maxDate={filters.dateTo || undefined}
        />
        <DatePicker
          value={filters.dateTo}
          onChange={(event) => updateFilter("dateTo", event.target.value)}
          placeholder="Arrivee au"
          minDate={filters.dateFrom || undefined}
        />
        <Link className="primary-button bookings-create-link" to="/operations">
          <i className="ti ti-plus" aria-hidden="true" />
          Nouvelle reservation
        </Link>
      </section>

      <section className="bookings-table-panel">
        <div className="bookings-table-head">
          <div>
            <h2>Liste des reservations</h2>
            <p>{loading ? "Chargement..." : `${bookings.length} reservation${bookings.length > 1 ? "s" : ""} affichee${bookings.length > 1 ? "s" : ""}`}</p>
          </div>
          <button type="button" className="secondary-button" onClick={() => loadBookings()} disabled={loading}>
            <i className="ti ti-refresh" aria-hidden="true" />
            Actualiser
          </button>
        </div>

        <div className="bookings-table-scroll">
          <table className="bookings-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Client</th>
                <th>Chambre</th>
                <th>Periode</th>
                <th>Source</th>
                <th>Montant</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id}>
                  <td><strong className="bookings-reference">{booking.reference}</strong></td>
                  <td>{booking.guest}</td>
                  <td>
                    <span className="bookings-room">{booking.room && booking.room !== "-" ? `Ch. ${booking.room}` : "Non attribuee"}</span>
                    <small>{booking.room_type}</small>
                  </td>
                  <td>
                    <span>{formatDate(booking.check_in_date)}</span>
                    <small>au {formatDate(booking.check_out_date)}</small>
                  </td>
                  <td>{booking.source || "-"}</td>
                  <td><strong>{booking.estimated_amount || "0 XOF"}</strong></td>
                  <td>
                    <span className={`bookings-status bookings-status--${getStatusTone(booking.status)}`}>
                      {booking.status}
                    </span>
                  </td>
                  <td>
                    <div className="bookings-actions">
                      <Link className="secondary-button compact" to={booking.detail_path || `/operations/bookings/${booking.id}`}>
                        Fiche
                      </Link>
                      <button
                        type="button"
                        className="primary-button compact"
                        disabled={booking.can_check_in === false || actionLoading === booking.id}
                        onClick={() => checkInBooking(booking)}
                      >
                        {actionLoading === booking.id ? "..." : "Check-in"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && !bookings.length ? (
          <div className="bookings-empty">
            <i className="ti ti-calendar-off" aria-hidden="true" />
            <strong>Aucune reservation trouvee</strong>
            <span>Modifie les filtres ou cree une nouvelle reservation depuis le poste Operations.</span>
          </div>
        ) : null}
      </section>
    </div>
  );
}
