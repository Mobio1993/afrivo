export default function KitchenTicketCard({ ticket, onStart, onReady }) {
  return (
    <article className="pos-kt-card">
      <div className="pos-kt-head">
        <span className="pos-kt-ref">{ticket.order_ref}</span>
        <span className="pos-kt-table">Table {ticket.table_num}</span>
      </div>
      <div className="pos-kt-items">
        {(ticket.items || []).map((item) => (
          <div key={item.id} className="pos-kt-item">
            <span className="pos-kt-qty">{item.quantite}x</span>
            <span>{item.item_nom}</span>
            {item.notes ? <span className="pos-kt-note">{item.notes}</span> : null}
          </div>
        ))}
      </div>
      <div className="pos-kt-footer">
        {ticket.statut === "nouveau" ? <button className="pos-btn pos-btn-primary" onClick={() => onStart(ticket.id)}>Demarrer</button> : null}
        {ticket.statut === "en_prep" ? <button className="pos-btn pos-btn-green" onClick={() => onReady(ticket.id)}>Pret</button> : null}
      </div>
    </article>
  );
}
