import { Link } from "react-router-dom";

function formatAmount(value, currency = "XOF") {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isNaN(amount) ? 0 : amount);
}

function QueueMeta({ label, value }) {
  return (
    <div className="billing-workqueue-meta-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function BillingWorkQueue({ queue, loading, canCreate = false, onCreateInvoice, onSelectInvoice }) {
  if (loading) {
    return (
      <section className="billing-workqueue billing-workqueue--loading">
        <div className="billing-workqueue-skeleton" />
        <div className="billing-workqueue-skeleton" />
      </section>
    );
  }

  const items = queue?.items || [];
  const totalCount = queue?.total_count || 0;

  return (
    <section className="billing-workqueue">
      <div className="billing-workqueue-head">
        <div>
          <span className="billing-workqueue-eyebrow">Assistant facturation</span>
          <h2>A traiter</h2>
        </div>
        <span className={`billing-workqueue-count ${totalCount > 0 ? "is-active" : ""}`}>
          {totalCount} dossier(s)
        </span>
      </div>

      <div className="billing-workqueue-meta">
        <QueueMeta label="Sejours sans facture" value={queue?.stays_without_invoice_count || 0} />
        <QueueMeta label="Consommations" value={queue?.unbilled_consumptions_count || 0} />
        <QueueMeta label="Day use" value={queue?.day_uses_to_invoice_count || 0} />
        <QueueMeta label="A encaisser" value={queue?.unpaid_invoices_count || 0} />
      </div>

      {items.length ? (
        <div className="billing-workqueue-list">
          {items.map((item) => (
            <article key={item.id} className={`billing-workqueue-item billing-workqueue-item--${item.type}`}>
              <div className="billing-workqueue-item-main">
                <span className="billing-workqueue-type">{item.label}</span>
                <strong>{item.reference}</strong>
                <p>{item.client} · Chambre {item.room}</p>
              </div>
              <div className="billing-workqueue-item-side">
                <strong>{formatAmount(item.amount)}</strong>
                <span>{item.reason}</span>
                {canCreate && ["stay", "day_use"].includes(item.type) ? (
                  <div className="billing-workqueue-actions">
                    <button
                      type="button"
                      className="billing-workqueue-link"
                      onClick={() => onCreateInvoice?.(item)}
                    >
                      Creer facture
                    </button>
                    <button
                      type="button"
                      className="billing-workqueue-link billing-workqueue-link--primary"
                      onClick={() => onCreateInvoice?.(item, { issue: true })}
                    >
                      Creer + emettre
                    </button>
                  </div>
                ) : item.type === "invoice_payment" ? (
                  <button
                    type="button"
                    className="billing-workqueue-link billing-workqueue-link--primary"
                    onClick={() => onSelectInvoice?.(item.source_id)}
                  >
                    Encaisser
                  </button>
                ) : item.action_path ? (
                  <Link className="billing-workqueue-link" to={item.action_path}>
                    {item.action_label}
                  </Link>
                ) : (
                  <span className="billing-workqueue-muted">{item.action_label}</span>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="billing-workqueue-empty">
          <strong>Aucun dossier en attente</strong>
          <p>Les sejours, consommations, day use et factures a encaisser apparaitront ici automatiquement.</p>
        </div>
      )}
    </section>
  );
}
