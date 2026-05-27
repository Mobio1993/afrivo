function fmt(value, currency = "XOF") {
  if (value == null) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
}

function Card({ label, value, sub, accent }) {
  return (
    <div className={`billing-summary-card ${accent ? `billing-summary-card--${accent}` : ""}`}>
      <span className="billing-summary-label">{label}</span>
      <strong className="billing-summary-value">{value}</strong>
      {sub ? <span className="billing-summary-sub">{sub}</span> : null}
    </div>
  );
}

export function BillingSummaryCards({ dashboard, loading }) {
  if (loading) {
    return (
      <div className="billing-summary-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="billing-summary-card billing-summary-card--skeleton" />
        ))}
      </div>
    );
  }

  const totals = dashboard?.totals || {};
  const unpaid = dashboard?.unpaid_stats || {};
  const currency = "XOF";

  const invoiced = totals.total_invoiced ?? 0;
  const paid = totals.total_paid ?? 0;
  const balance = totals.total_balance ?? 0;
  const count = totals.invoice_count ?? 0;
  const unpaidCount = unpaid.count ?? 0;
  const unpaidBalance = unpaid.total_balance ?? 0;

  return (
    <div className="billing-summary-grid">
      <Card
        label="Factures actives"
        value={count}
        sub="Total factures non annulees"
        accent="neutral"
      />
      <Card
        label="Montant facture"
        value={fmt(invoiced, currency)}
        sub="Toutes factures actives"
        accent="blue"
      />
      <Card
        label="Montant encaisse"
        value={fmt(paid, currency)}
        sub={`Solde restant : ${fmt(balance, currency)}`}
        accent="green"
      />
      <Card
        label="Impayees"
        value={unpaidCount}
        sub={`Solde : ${fmt(unpaidBalance, currency)}`}
        accent={unpaidCount > 0 ? "orange" : "neutral"}
      />
    </div>
  );
}
