export default function BillSummary({ bill, onPay }) {
  if (!bill) return <div className="pos-empty">Aucune facture selectionnee.</div>;
  return (
    <div className="pos-bill-card">
      <div className="pos-panel-head">
        <div>
          <span className="pos-muted">Facture</span>
          <h3>{bill.reference}</h3>
        </div>
        <span className="pos-pill pos-pill-reservee">{bill.statut}</span>
      </div>
      <div className="pos-bill-row"><span>Sous-total</span><b>{Number(bill.sous_total || 0).toLocaleString("fr-FR")} XOF</b></div>
      <div className="pos-bill-row"><span>Remise</span><b>{Number(bill.remise_montant || 0).toLocaleString("fr-FR")} XOF</b></div>
      <div className="pos-bill-row"><span>Taxes</span><b>{Number(bill.taxe_montant || 0).toLocaleString("fr-FR")} XOF</b></div>
      <div className="pos-bill-total"><span>Total</span><strong>{Number(bill.total || 0).toLocaleString("fr-FR")} XOF</strong></div>
      <button type="button" className="pos-btn pos-btn-primary" onClick={() => onPay?.(bill)}>Encaisser</button>
    </div>
  );
}
