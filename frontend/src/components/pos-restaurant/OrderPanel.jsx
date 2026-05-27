export default function OrderPanel({ order, onSendToKitchen, onGenerateBill }) {
  if (!order) return <div className="pos-empty">Selectionnez une commande.</div>;
  const total = (order.items || []).reduce((sum, item) => sum + Number(item.sous_total || 0), 0);

  return (
    <aside className="pos-order-panel">
      <div className="pos-panel-head">
        <div>
          <span className="pos-muted">Commande</span>
          <h3>{order.reference}</h3>
        </div>
        <span className="pos-pill pos-pill-occupee">Table {order.table_numero}</span>
      </div>
      <div className="pos-order-items">
        {(order.items || []).map((item) => (
          <div key={item.id} className="pos-order-item">
            <span>{item.quantite} x {item.item_nom}</span>
            <b>{Number(item.sous_total || 0).toLocaleString("fr-FR")}</b>
          </div>
        ))}
      </div>
      <div className="pos-order-total">
        <span>Total</span>
        <strong>{total.toLocaleString("fr-FR")} XOF</strong>
      </div>
      <div className="pos-action-row">
        <button type="button" className="pos-btn pos-btn-primary" onClick={() => onSendToKitchen(order.id)}>Envoyer cuisine</button>
        <button type="button" className="pos-btn" onClick={() => onGenerateBill(order.id)}>Facture</button>
      </div>
    </aside>
  );
}
