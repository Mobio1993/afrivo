function fmt(value, currency = "XOF") {
  if (value == null) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num) + " " + currency;
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export function InvoicePdfPreview({ payload, onClose }) {
  if (!payload) return null;
  const { invoice, hotel, client, items, payments } = payload;
  const currency = invoice?.currency || "XOF";

  return (
    <div className="pdf-preview-overlay" onClick={onClose}>
      <div className="pdf-preview-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="pdf-preview-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Fermer
          </button>
          <button type="button" className="primary-button" onClick={() => window.print()}>
            Imprimer / PDF
          </button>
        </div>

        <div className="pdf-doc">
          <div className="pdf-header">
            <div className="pdf-hotel-block">
              <strong className="pdf-hotel-name">{hotel?.name || "Hôtel"}</strong>
              <span className="pdf-hotel-code">{hotel?.code}</span>
            </div>
            <div className="pdf-invoice-title-block">
              <span className="pdf-doc-type">FACTURE</span>
              <strong className="pdf-invoice-ref">{invoice?.reference}</strong>
              <span className="pdf-invoice-status">{invoice?.status_label}</span>
            </div>
          </div>

          <div className="pdf-meta-grid">
            <div className="pdf-meta-block">
              <span className="pdf-meta-label">Client</span>
              <strong>{client?.name || "—"}</strong>
              {client?.email && <span>{client.email}</span>}
              {client?.phone && <span>{client.phone}</span>}
            </div>
            <div className="pdf-meta-block">
              <span className="pdf-meta-label">Date d'émission</span>
              <strong>{fmtDate(invoice?.issued_at)}</strong>
              {invoice?.due_date && (
                <>
                  <span className="pdf-meta-label">Échéance</span>
                  <strong>{fmtDate(invoice.due_date)}</strong>
                </>
              )}
              {invoice?.stay_reference && (
                <>
                  <span className="pdf-meta-label">Séjour</span>
                  <strong>{invoice.stay_reference}</strong>
                </>
              )}
            </div>
          </div>

          <table className="pdf-items-table">
            <thead>
              <tr>
                <th>Libellé</th>
                <th>Qté</th>
                <th>P.U.</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {(items || []).map((item, i) => (
                <tr key={i}>
                  <td>
                    <strong>{item.label}</strong>
                    {item.description && <br />}
                    {item.description && <small>{item.description}</small>}
                  </td>
                  <td>{item.quantity}</td>
                  <td>{fmt(item.unit_price, currency)}</td>
                  <td>{fmt(item.line_total, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pdf-totals">
            <div className="pdf-total-row">
              <span>Sous-total</span>
              <span>{fmt(invoice?.subtotal_amount, currency)}</span>
            </div>
            {parseFloat(invoice?.discount_amount) > 0 && (
              <div className="pdf-total-row">
                <span>Remise</span>
                <span>- {fmt(invoice.discount_amount, currency)}</span>
              </div>
            )}
            {parseFloat(invoice?.tax_amount) > 0 && (
              <div className="pdf-total-row">
                <span>Taxes</span>
                <span>{fmt(invoice.tax_amount, currency)}</span>
              </div>
            )}
            <div className="pdf-total-row pdf-total-row--total">
              <span>Total</span>
              <strong>{fmt(invoice?.total_amount, currency)}</strong>
            </div>
            <div className="pdf-total-row pdf-total-row--paid">
              <span>Montant encaissé</span>
              <span>{fmt(invoice?.amount_paid, currency)}</span>
            </div>
            <div className="pdf-total-row pdf-total-row--balance">
              <span>Solde restant</span>
              <strong>{fmt(invoice?.balance_due, currency)}</strong>
            </div>
          </div>

          {payments && payments.length > 0 && (
            <div className="pdf-payments">
              <strong className="pdf-payments-title">Paiements enregistrés</strong>
              {payments.map((p, i) => (
                <div key={i} className="pdf-payment-row">
                  <span>{fmtDate(p.paid_at)} — {p.method_label}</span>
                  <span>{fmt(p.amount, currency)}</span>
                </div>
              ))}
            </div>
          )}

          {invoice?.notes && (
            <div className="pdf-notes">
              <strong>Notes</strong>
              <p>{invoice.notes}</p>
            </div>
          )}

          <div className="pdf-footer">
            <span>Généré le {fmtDate(new Date().toISOString())}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
