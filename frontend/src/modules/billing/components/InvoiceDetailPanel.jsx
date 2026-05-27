import { useState } from "react";

import { useAuth } from "../../../auth/AuthContext";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { InvoiceLineEditor } from "./InvoiceLineEditor";
import { PaymentPanel } from "./PaymentPanel";
import { InvoicePdfPreview } from "./InvoicePdfPreview";
import { getInvoicePdfPayload } from "../services/billingService";
import { printThermalReceipt } from "./ThermalPrint";

function fmt(value, currency = "XOF") {
  if (value == null) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return "—";
  return (
    new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num) + " " + currency
  );
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function TotalRow({ label, value, currency, bold, accent }) {
  return (
    <div className={`billing-total-row${bold ? " billing-total-row--bold" : ""}${accent ? ` billing-total-row--${accent}` : ""}`}>
      <span>{label}</span>
      <span>{fmt(value, currency)}</span>
    </div>
  );
}

export function InvoiceDetailPanel({
  invoice,
  loading,
  onEdit,
  onIssue,
  onCancel,
  onDuplicate,
  onAddPayment,
  canUpdate,
  canCreate,
  canDelete,
  openPaymentSignal = 0,
}) {
  const { user } = useAuth();
  const [pdfPayload, setPdfPayload] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [paymentOpenSignal, setPaymentOpenSignal] = useState(0);

  if (loading) {
    return (
      <div className="billing-detail-panel">
        <div className="billing-detail-skeleton">
          <div className="billing-skeleton-line w-60" />
          <div className="billing-skeleton-line w-40" />
          <div className="billing-skeleton-line w-75" />
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="billing-detail-panel billing-detail-empty">
        <div className="billing-detail-empty-icon">🧾</div>
        <strong>Sélectionnez une facture</strong>
        <p>Cliquez sur une facture dans la liste pour afficher son détail.</p>
      </div>
    );
  }

  const currency = invoice.currency || "XOF";
  const isDraft = invoice.status === "draft";
  const isIssued = invoice.status === "issued";
  const isPartial = invoice.status === "partially_paid";
  const isPaid = invoice.status === "paid";
  const isCancelled = invoice.status === "cancelled";
  const canPay = canCreate && (isIssued || isPartial);
  const canIssue = canUpdate && isDraft;
  const canCancelInv = canDelete && !isPaid && !isCancelled;
  const canEditInv = canUpdate && (isDraft || isIssued) && !isCancelled;

  const hotelConfig = {
    hotelName:    user?.hotel_name    || user?.hotel?.name    || "AFRIVO Hotel",
    hotelAddress: user?.hotel_address || user?.hotel?.address || "",
    hotelPhone:   user?.hotel_phone   || user?.hotel?.phone   || "",
    hotelEmail:   user?.hotel_email   || user?.hotel?.email   || "",
    currency:     invoice?.currency   || "XOF",
    footerNote:   "Merci de votre visite !",
  };

  async function handlePdf() {
    setLoadingPdf(true);
    try {
      const payload = await getInvoicePdfPayload(invoice.id);
      setPdfPayload(payload);
    } catch {
      // silent
    } finally {
      setLoadingPdf(false);
    }
  }

  function handleThermalPrint() {
    printThermalReceipt(invoice, hotelConfig);
  }

  return (
    <div className="billing-detail-panel">
      {pdfPayload && (
        <InvoicePdfPreview payload={pdfPayload} onClose={() => setPdfPayload(null)} />
      )}

      <div className="billing-detail-header">
        <div className="billing-detail-header-info">
          <div className="billing-detail-ref-row">
            <span className="billing-detail-ref">{invoice.reference}</span>
            <InvoiceStatusBadge status={invoice.status} size="md" />
          </div>
          <div className="billing-detail-client">
            {invoice.client_name || "Client inconnu"}
            {invoice.stay_reference && (
              <span className="billing-detail-stay"> · Séjour {invoice.stay_reference}</span>
            )}
            {invoice.reservation_reference && !invoice.stay_reference && (
              <span className="billing-detail-stay"> · Rés. {invoice.reservation_reference}</span>
            )}
          </div>
          <div className="billing-detail-dates">
            <span>Émise le {fmtDate(invoice.issued_at)}</span>
            {invoice.due_date && <span> · Échéance {fmtDate(invoice.due_date)}</span>}
            {invoice.issued_by_name && <span> · Par {invoice.issued_by_name}</span>}
          </div>
        </div>

        <div className="billing-detail-header-actions">
          {canEditInv && (
            <button type="button" className="secondary-button" onClick={onEdit}>
              Modifier
            </button>
          )}
          {canIssue && (
            <button type="button" className="primary-button" onClick={onIssue}>
              Émettre
            </button>
          )}
          {canPay && (
            <button
              type="button"
              className="primary-button billing-btn-pay"
              onClick={() => setPaymentOpenSignal((value) => value + 1)}
            >
              Encaisser le solde
            </button>
          )}
          {canCreate && (
            <button type="button" className="secondary-button" onClick={onDuplicate}>
              Dupliquer
            </button>
          )}
          <button
            type="button"
            className="secondary-button"
            onClick={handlePdf}
            disabled={loadingPdf}
          >
            {loadingPdf ? "..." : "PDF"}
          </button>
          <button
            type="button"
            className="invoice-thermal-btn"
            onClick={handleThermalPrint}
            title="Imprimer ticket thermique 80mm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Thermique
          </button>
          {canCancelInv && (
            <button
              type="button"
              className="secondary-button billing-btn-cancel"
              onClick={onCancel}
            >
              Annuler
            </button>
          )}
        </div>
      </div>

      <div className="billing-detail-body">
        <InvoiceLineEditor lines={invoice.items || []} onChange={() => {}} readOnly />

        <div className="billing-totals-block">
          <TotalRow label="Sous-total" value={invoice.subtotal_amount} currency={currency} />
          {parseFloat(invoice.discount_amount) > 0 && (
            <TotalRow label="Remise" value={invoice.discount_amount} currency={currency} />
          )}
          {parseFloat(invoice.tax_amount) > 0 && (
            <TotalRow label="Taxes" value={invoice.tax_amount} currency={currency} />
          )}
          <TotalRow label="Total" value={invoice.total_amount} currency={currency} bold />
          <TotalRow label="Encaissé" value={invoice.amount_paid} currency={currency} accent="green" />
          <TotalRow label="Solde restant" value={invoice.balance_due} currency={currency} bold accent={parseFloat(invoice.balance_due) > 0 ? "orange" : "green"} />
        </div>

        {invoice.notes && (
          <div className="billing-detail-notes">
            <strong>Notes</strong>
            <p>{invoice.notes}</p>
          </div>
        )}

        <PaymentPanel
          invoice={invoice}
          onAddPayment={onAddPayment}
          canCreate={canCreate}
          loading={false}
          openSignal={paymentOpenSignal + openPaymentSignal}
        />
      </div>
    </div>
  );
}
