import { useRef } from "react";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";

const STATUS_FILTERS = [
  { value: "", label: "Toutes" },
  { value: "draft", label: "Brouillon" },
  { value: "issued", label: "Emises" },
  { value: "partially_paid", label: "Partiel" },
  { value: "paid", label: "Payees" },
  { value: "cancelled", label: "Annulees" },
];

function fmt(value) {
  if (value == null) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
}

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function InvoiceRow({ invoice, isActive, onClick }) {
  return (
    <button
      type="button"
      className={`billing-invoice-row${isActive ? " active" : ""}`}
      onClick={() => onClick(invoice.id)}
      aria-pressed={isActive}
    >
      <div className="billing-invoice-row-top">
        <span className="billing-invoice-row-ref">{invoice.reference}</span>
        <InvoiceStatusBadge status={invoice.status} />
      </div>
      <div className="billing-invoice-row-client">
        {invoice.client_name || "Client inconnu"}
      </div>
      <div className="billing-invoice-row-bottom">
        <span className="billing-invoice-row-amount">{fmt(invoice.total_amount)} XOF</span>
        <span className="billing-invoice-row-date">{fmtDate(invoice.issued_at)}</span>
      </div>
      {invoice.balance_due > 0 && invoice.status !== "cancelled" && invoice.status !== "draft" && (
        <div className="billing-invoice-row-balance">
          Solde : {fmt(invoice.balance_due)} XOF
        </div>
      )}
    </button>
  );
}

export function InvoiceListPanel({
  invoices,
  loading,
  selectedId,
  onSelect,
  search,
  onSearch,
  statusFilter,
  onStatusFilter,
  page,
  totalPages,
  totalCount,
  onPageChange,
  canCreate,
  onCreate,
}) {
  const filtersRef = useRef(null);
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0 });

  function onMouseDown(e) {
    const el = filtersRef.current;
    if (!el) return;
    drag.current = { active: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft };
    el.style.cursor = "grabbing";
  }

  function onMouseMove(e) {
    if (!drag.current.active) return;
    const el = filtersRef.current;
    if (!el) return;
    e.preventDefault();
    el.scrollLeft = drag.current.scrollLeft - (e.pageX - el.offsetLeft - drag.current.startX);
  }

  function onDragEnd() {
    drag.current.active = false;
    if (filtersRef.current) filtersRef.current.style.cursor = "";
  }

  return (
    <div className="billing-list-panel">
      <div className="billing-list-search">
        <input
          type="search"
          className="billing-search-input"
          placeholder="Référence, client, séjour..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          aria-label="Rechercher une facture"
        />
      </div>

      <div
        className="billing-list-filters"
        ref={filtersRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onDragEnd}
        onMouseLeave={onDragEnd}
      >
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={`billing-filter-chip${statusFilter === f.value ? " active" : ""}`}
            onClick={() => onStatusFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="billing-list-meta">
        <span>{loading ? "Chargement..." : `${totalCount} facture${totalCount !== 1 ? "s" : ""}`}</span>
      </div>

      <div className="billing-list-rows">
        {loading ? (
          <div className="billing-list-loading">Chargement...</div>
        ) : invoices.length === 0 ? (
          <div className="billing-list-empty">
            <span>Aucune facture</span>
            <p>Modifiez les filtres ou créez une nouvelle facture.</p>
          </div>
        ) : (
          invoices.map((inv) => (
            <InvoiceRow
              key={inv.id}
              invoice={inv}
              isActive={inv.id === selectedId}
              onClick={onSelect}
            />
          ))
        )}
      </div>

      <div className="billing-list-footer">
        {canCreate && (
          <div className="billing-list-footer-create">
            <button type="button" className="primary-button" onClick={onCreate}>
              + Nouvelle facture
            </button>
          </div>
        )}
        {totalPages > 1 && (
          <div className="billing-pagination">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              ←
            </button>
            <span>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
