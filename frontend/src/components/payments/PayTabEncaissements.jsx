function formatAmount(value) {
  return Number(value || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 });
}

export default function PayTabEncaissements({ payment }) {
  const encaissements = payment.encaissements || [];

  if (!encaissements.length) {
    return (
      <div className="pay-section pay-section-standalone">
        <div className="pay-sec-label">Encaissements lies</div>
        <div className="pay-empty-state">Aucun encaissement rattache a cette operation.</div>
      </div>
    );
  }

  return (
    <div className="pay-section pay-section-standalone">
      <div className="pay-sec-label">Encaissements lies ({encaissements.length})</div>
      {encaissements.map((encaissement) => (
        <div key={encaissement.id} className="pay-enc-row">
          <div>
            <div className="pay-enc-ref">{encaissement.reference}</div>
            <div className="pay-enc-date">{encaissement.date}</div>
          </div>
          <div className="pay-enc-right">
            <span className="pay-enc-mode">{encaissement.mode}</span>
            <span className="pay-enc-amount">{formatAmount(encaissement.montant)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
