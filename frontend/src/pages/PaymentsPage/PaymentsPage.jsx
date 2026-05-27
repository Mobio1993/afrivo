import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { hasPermission } from "../../auth/permissions";
import { getPaymentSummary, listPayments } from "../../services/paymentsService";
import { AppSelect } from "../../shared/components/AppSelect";
import "../../modules/billing/styles/BillingPage.css";
import "./PaymentsPage.css";

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { value: "", label: "Tous statuts" },
  { value: "paid", label: "Paye" },
  { value: "pending", label: "En attente" },
  { value: "refunded", label: "Rembourse" },
];

const METHOD_FILTERS = [
  { value: "", label: "Tous modes" },
  { value: "cash", label: "Especes" },
  { value: "mobile_money", label: "Mobile money" },
  { value: "card", label: "Carte bancaire" },
  { value: "transfer", label: "Virement" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Autre" },
];

const ORDERING_OPTIONS = [
  { value: "-paid_at", label: "Date ↓" },
  { value: "paid_at", label: "Date ↑" },
  { value: "-amount", label: "Montant ↓" },
  { value: "amount", label: "Montant ↑" },
  { value: "client__name", label: "Client A-Z" },
];

const STATUS_META = {
  paid: { label: "Paye", bg: "#EAF3DE", color: "#3B6D11", dot: "#3B6D11" },
  pending: { label: "Attente", bg: "#FAEEDA", color: "#854F0B", dot: "#854F0B" },
  refunded: { label: "Rembourse", bg: "#FCEBEB", color: "#A32D2D", dot: "#A32D2D" },
  cancelled: { label: "Annule", bg: "#FCEBEB", color: "#A32D2D", dot: "#A32D2D" },
};

const METHOD_META = {
  cash: { label: "Especes", bg: "var(--bg-soft)", color: "var(--text-soft)", border: "var(--border-soft)", bar: "var(--theme-primary)" },
  mobile_money: { label: "Mobile money", bg: "#EEEDFE", color: "#3C3489", border: "transparent", bar: "#3C3489" },
  card: { label: "Carte", bg: "#E6F1FB", color: "#0C447C", border: "transparent", bar: "#185FA5" },
  transfer: { label: "Virement", bg: "#EAF3DE", color: "#3B6D11", border: "transparent", bar: "#3B6D11" },
  bank_transfer: { label: "Virement", bg: "#EAF3DE", color: "#3B6D11", border: "transparent", bar: "#3B6D11" },
  cheque: { label: "Cheque", bg: "#FAEEDA", color: "#854F0B", border: "transparent", bar: "#BA7517" },
  other: { label: "Autre", bg: "var(--bg-soft)", color: "var(--text-soft)", border: "var(--border-soft)", bar: "#64748B" },
};

const CURRENCY_COLORS = {
  XOF: "#185FA5",
  EUR: "#854F0B",
  USD: "#3B6D11",
};

function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function formatAmountCompact(value, currency = "XOF") {
  const number = Number(value || 0);
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M ${currency}`;
  if (number >= 1_000) return `${Math.round(number / 1_000)}K ${currency}`;
  return `${Math.round(number).toLocaleString("fr-FR")} ${currency}`;
}

function formatAmountFull(value, currency = "XOF") {
  const number = Number(value || 0);
  return `${number.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} ${currency}`;
}

function formatDateShort(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeMethod(payment) {
  const method = payment.method || payment.payment_method || "other";
  return method === "bank_transfer" ? "transfer" : method;
}

function getClientName(payment) {
  return payment.client_name || payment.client?.full_name || payment.client?.name || "-";
}

function getPageButtons(current, total) {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  return [...pages]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b)
    .reduce((items, page, index, list) => {
      if (index > 0 && page - list[index - 1] > 1) items.push("...");
      items.push(page);
      return items;
    }, []);
}

function KpiCard({ icon, tone, value, label }) {
  return (
    <article className="payments-kpi-card">
      <span className={`payments-kpi-icon payments-kpi-icon--${tone}`}>
        <i className={`ti ${icon}`} aria-hidden="true" />
      </span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </article>
  );
}

function MethodBadge({ method }) {
  const meta = METHOD_META[method] || METHOD_META.other;
  return (
    <span
      className="payments-mode-badge"
      style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}
    >
      {meta.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status || "-", bg: "var(--bg-soft)", color: "var(--text-soft)" };
  return (
    <span className="payments-status-badge" style={{ background: meta.bg, color: meta.color }}>
      {meta.label}
    </span>
  );
}

function MiniBar({ label, value, total, color }) {
  const width = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="payments-mini-bar">
      <div className="payments-mini-line">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="payments-progress">
        <span style={{ width: `${width}%`, background: color }} />
      </div>
    </div>
  );
}

function DotMetric({ label, value, color }) {
  return (
    <div className="payments-dot-metric">
      <span className="payments-dot" style={{ background: color }} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SkeletonRows() {
  return Array.from({ length: 5 }, (_, row) => (
    <tr key={row} className="payments-skeleton-row">
      {Array.from({ length: 6 }, (__, cell) => (
        <td key={cell}>
          <span className="payments-skeleton" />
        </td>
      ))}
    </tr>
  ));
}

export function PaymentsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canView = hasPermission(user, "payments", "view");
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    method: "",
    ordering: "-paid_at",
  });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ count: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const debouncedSearch = useDebounce(filters.search, 300);

  const stats = useMemo(() => {
    const totals = summary?.totals || {};
    const byMethod = (summary?.by_method || []).reduce((acc, item) => {
      const method = item.method === "bank_transfer" ? "transfer" : item.method || "other";
      acc[method] = item.count || 0;
      return acc;
    }, {});

    // Le backend ne renvoie pas encore ces deux repartitions: elles refletent la page chargee.
    const byStatus = payments.reduce((acc, payment) => {
      const key = payment.status || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const byCurrency = payments.reduce((acc, payment) => {
      const key = payment.currency || "XOF";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return {
      confirmedAmount: totals.confirmed_amount || 0,
      pendingAmount: totals.pending_amount || 0,
      refundedAmount: totals.refunded_amount || 0,
      paymentCount: totals.payment_count ?? pagination.count,
      byMethod,
      byStatus,
      byCurrency,
    };
  }, [payments, pagination.count, summary]);

  const methodTotal = Object.values(stats.byMethod).reduce((sum, value) => sum + value, 0);
  const totalPages = pagination.totalPages || 1;
  const pageButtons = getPageButtons(page, totalPages);

  function handleFilterChange(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  function refreshPayments() {
    setRefreshKey((value) => value + 1);
  }

  useEffect(() => {
    if (!canView) return undefined;
    let ignore = false;

    async function loadPayments() {
      setLoading(true);
      setError("");
      try {
        const requestFilters = {
          page,
          pageSize: PAGE_SIZE,
          search: debouncedSearch,
          status: filters.status,
          method: filters.method,
          ordering: filters.ordering,
        };
        const [paymentPayload, summaryPayload] = await Promise.all([
          listPayments(requestFilters),
          getPaymentSummary({
            search: debouncedSearch,
            status: filters.status,
            method: filters.method,
          }),
        ]);

        if (ignore) return;
        const count = paymentPayload.count || 0;
        const pageSize = paymentPayload.page_size || PAGE_SIZE;
        setPayments(paymentPayload.results || []);
        setPagination({
          count,
          totalPages: Math.max(1, paymentPayload.total_pages || Math.ceil(count / pageSize) || 1),
        });
        setSummary(summaryPayload);
      } catch (requestError) {
        if (!ignore) setError(requestError.message || "Impossible de charger les paiements.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadPayments();
    return () => {
      ignore = true;
    };
  }, [canView, debouncedSearch, filters.method, filters.ordering, filters.status, page, refreshKey]);

  if (!canView) {
    return (
      <div className="billing-page">
        <div className="billing-access-denied">
          <strong>Acces refuse</strong>
          <p>Vous n'avez pas les droits pour acceder aux paiements.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="billing-page payments-page">
      <header className="payments-page-header">
        <div>
          <span className="payments-eyebrow">CAISSE</span>
          <h1>Paiements</h1>
          <p>Encaissements, moyens de paiement, remboursements et suivi caisse.</p>
        </div>
        <div className="payments-header-actions">
          <button type="button" className="payments-btn payments-btn--secondary" onClick={refreshPayments} disabled={loading}>
            <i className="ti ti-refresh" aria-hidden="true" />
            Actualiser
          </button>
          <button type="button" className="payments-btn payments-btn--primary" onClick={() => navigate("/operations?tab=payment")}>
            <i className="ti ti-plus" aria-hidden="true" />
            Nouveau paiement
          </button>
        </div>
      </header>

      <section className="payments-kpi-grid">
        <KpiCard icon="ti-circle-check" tone="green" value={formatAmountCompact(stats.confirmedAmount)} label="Confirmes" />
        <KpiCard icon="ti-clock" tone="orange" value={formatAmountCompact(stats.pendingAmount)} label="En attente" />
        <KpiCard icon="ti-arrow-back" tone="red" value={formatAmountCompact(stats.refundedAmount)} label="Rembourses" />
        <KpiCard icon="ti-receipt" tone="violet" value={stats.paymentCount || 0} label="Paiements" />
      </section>

      <section className="payments-filter-bar">
        <div className="payments-search-field">
          <i className="ti ti-search" aria-hidden="true" />
          <input
            type="search"
            value={filters.search}
            onChange={(event) => handleFilterChange("search", event.target.value)}
            placeholder="Reference, client, facture..."
          />
        </div>
        <AppSelect value={filters.status} onChange={(event) => handleFilterChange("status", event.target.value)} name="payment_status">
          {STATUS_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </AppSelect>
        <AppSelect value={filters.method} onChange={(event) => handleFilterChange("method", event.target.value)} name="payment_method">
          {METHOD_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </AppSelect>
        <AppSelect value={filters.ordering} onChange={(event) => handleFilterChange("ordering", event.target.value)} name="payment_ordering">
          {ORDERING_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </AppSelect>
      </section>

      <main className="payments-analytics-layout">
        <section className="payments-table-card">
          <div className="payments-table-title">
            <span>Encaissements</span>
            <strong>{pagination.count} resultats</strong>
          </div>

          {error ? (
            <div className="payments-error" role="alert">
              <i className="ti ti-alert-circle" aria-hidden="true" />
              {error}
            </div>
          ) : null}

          <div className="payments-table-scroll">
            <table className="payments-data-table">
              <colgroup>
                <col className="col-ref" />
                <col className="col-client" />
                <col className="col-amount" />
                <col className="col-mode" />
                <col className="col-status" />
                <col className="col-date" />
              </colgroup>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Client</th>
                  <th>Montant</th>
                  <th>Mode</th>
                  <th>Statut</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <SkeletonRows /> : payments.map((payment) => {
                  const method = normalizeMethod(payment);
                  return (
                    <tr key={payment.id} onClick={() => navigate(`/operations/payments/${payment.id}`)}>
                      <td>
                        <div className="payments-ref-main" title={payment.reference}>{payment.reference || "-"}</div>
                        <div className="payments-ref-sub">#{payment.id}</div>
                      </td>
                      <td title={getClientName(payment)}>{getClientName(payment)}</td>
                      <td className="payments-amount">{formatAmountFull(payment.amount, payment.currency)}</td>
                      <td><MethodBadge method={method} /></td>
                      <td><StatusBadge status={payment.status} /></td>
                      <td className="payments-date">{formatDateShort(payment.paid_at || payment.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!loading && !payments.length ? (
            <div className="payments-empty">
              <i className="ti ti-inbox" aria-hidden="true" />
              <strong>Aucun paiement trouve</strong>
              <span>Modifiez vos filtres.</span>
            </div>
          ) : null}

          <footer className="payments-table-footer">
            <span>Page {page}/{totalPages} · {pagination.count} paiements</span>
            <div className="payments-pagination">
              <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={loading || page <= 1}>
                <i className="ti ti-chevron-left" aria-hidden="true" />
              </button>
              {pageButtons.map((item, index) => item === "..." ? (
                <span key={`ellipsis-${index}`} className="payments-page-ellipsis">...</span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={item === page ? "active" : ""}
                  onClick={() => setPage(item)}
                  disabled={loading}
                >
                  {item}
                </button>
              ))}
              <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={loading || page >= totalPages}>
                <i className="ti ti-chevron-right" aria-hidden="true" />
              </button>
            </div>
          </footer>
        </section>

        <aside className="payments-analytics-panel">
          <article className="payments-analytics-card">
            <header>Par mode de paiement</header>
            <div>
              {Object.entries(stats.byMethod).length ? Object.entries(stats.byMethod).map(([method, value]) => {
                const meta = METHOD_META[method] || METHOD_META.other;
                return <MiniBar key={method} label={meta.label} value={value} total={methodTotal} color={meta.bar} />;
              }) : <MiniBar label="Aucun mode" value={0} total={1} color="#64748B" />}
            </div>
          </article>

          <article className="payments-analytics-card">
            <header>Par statut</header>
            <div>
              {["paid", "pending", "refunded"].map((status) => {
                const meta = STATUS_META[status];
                return <DotMetric key={status} label={meta.label} value={stats.byStatus[status] || 0} color={meta.dot} />;
              })}
            </div>
          </article>

          <article className="payments-analytics-card">
            <header>Par devise</header>
            <div>
              {Object.entries(stats.byCurrency).length ? Object.entries(stats.byCurrency).map(([currency, value]) => (
                <DotMetric key={currency} label={currency} value={value} color={CURRENCY_COLORS[currency] || "#94A3B8"} />
              )) : <DotMetric label="XOF" value={0} color={CURRENCY_COLORS.XOF} />}
            </div>
          </article>
        </aside>
      </main>
    </div>
  );
}
