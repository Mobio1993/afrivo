export default function PmMenuTile({ item, isManager, onAdd, onEdit, onDelete, onToggle }) {
  const hasImage = Boolean(item.image_url);
  const fmtPrix = (price) => `${Number(price || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} XOF`;

  return (
    <div className={`pm-tile ${!item.disponible ? "pm-tile-indispo" : ""}`}>
      <div className="pm-tile-img">
        {hasImage ? (
          <img src={item.image_url} alt={item.nom} className="pm-tile-img-src" />
        ) : (
          <div className="pm-tile-img-placeholder">
            <span className="pm-tile-placeholder-icon">IMG</span>
            <span>Aucune photo</span>
          </div>
        )}
        {!item.disponible ? <span className="pm-tile-badge-indispo">Indisponible</span> : null}
        {isManager ? (
          <div className="pm-tile-manager-overlay">
            <button type="button" className="pm-tile-action-btn" title={item.disponible ? "Desactiver" : "Activer"} onClick={() => onToggle(item.id)}>
              {item.disponible ? "On" : "Off"}
            </button>
            <button type="button" className="pm-tile-action-btn" title="Modifier" onClick={() => onEdit(item)}>
              Edit
            </button>
            <button type="button" className="pm-tile-action-btn pm-tile-action-danger" title="Supprimer" onClick={() => onDelete(item)}>
              Del
            </button>
          </div>
        ) : null}
      </div>
      <div className="pm-tile-body">
        <div className="pm-tile-name">{item.nom}</div>
        {item.description ? <div className="pm-tile-desc">{item.description}</div> : null}
        <div className="pm-tile-footer">
          <div>
            <div className="pm-tile-price">{fmtPrix(item.prix)}</div>
            {item.temps_prep_min > 0 ? <div className="pm-tile-time">{item.temps_prep_min} min</div> : null}
          </div>
          {item.disponible ? (
            <button type="button" className="pm-tile-add" onClick={() => onAdd(item)} aria-label={`Ajouter ${item.nom}`}>
              +
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
