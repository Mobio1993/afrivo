export default function PmOrderCart({
  items,
  total,
  tables = [],
  selectedTableId,
  onTableChange,
  onRemove,
  onUpdateQty,
  onClear,
  onSend,
}) {
  const fmtPrix = (value) => `${Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} XOF`;

  return (
    <div className="pm-cart">
      <div className="pm-cart-head">
        <span className="pm-cart-title">Commande</span>
        <select className="pm-cart-table-select" value={selectedTableId || ""} onChange={(event) => onTableChange(event.target.value)}>
          <option value="">Table</option>
          {tables.map((table) => (
            <option key={table.id} value={table.id}>
              Table {table.numero} - {table.statut}
            </option>
          ))}
        </select>
      </div>
      {items.length === 0 ? (
        <div className="pm-cart-empty">
          <p>Aucun article selectionne</p>
          <p className="pm-cart-empty-hint">Cliquez sur une tuile pour ajouter</p>
        </div>
      ) : (
        <div className="pm-cart-items">
          {items.map((item) => (
            <div key={item.id} className="pm-cart-item">
              <div className="pm-cart-thumb">
                {item.image_url ? <img src={item.image_url} alt={item.nom} className="pm-cart-thumb-img" /> : <span>IMG</span>}
              </div>
              <div className="pm-cart-item-info">
                <span className="pm-cart-item-name">{item.nom}</span>
                <span className="pm-cart-item-sub">{fmtPrix(Number(item.prix || 0) * item.quantite)}</span>
              </div>
              <div className="pm-cart-qty-ctrl">
                <button type="button" className="pm-qty-btn" onClick={() => onUpdateQty(item.id, -1)}>-</button>
                <span className="pm-qty-val">{item.quantite}</span>
                <button type="button" className="pm-qty-btn" onClick={() => onUpdateQty(item.id, 1)}>+</button>
              </div>
              <button type="button" className="pm-cart-remove" onClick={() => onRemove(item.id)} aria-label={`Supprimer ${item.nom}`}>
                x
              </button>
            </div>
          ))}
        </div>
      )}
      {items.length > 0 ? (
        <>
          <div className="pm-cart-total">
            <span>Total</span>
            <span>{fmtPrix(total)}</span>
          </div>
          <div className="pm-cart-btns">
            <button type="button" className="pm-btn pm-btn-primary pm-btn-full" onClick={onSend} disabled={!selectedTableId}>
              Envoyer en cuisine
            </button>
            <button type="button" className="pm-btn pm-btn-full" onClick={onClear}>
              Annuler la commande
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
