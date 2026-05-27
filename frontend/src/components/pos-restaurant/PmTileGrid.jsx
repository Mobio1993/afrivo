import PmMenuTile from "./PmMenuTile";

export default function PmTileGrid({ items, isManager, onAdd, onEdit, onDelete, onToggle }) {
  if (!items.length) {
    return (
      <div className="pm-grid-empty">
        <strong>Aucun article dans cette categorie.</strong>
        {isManager ? <p>Creez votre premier article avec le bouton Nouvel article.</p> : null}
      </div>
    );
  }

  return (
    <div className="pm-tile-grid">
      {items.map((item) => (
        <PmMenuTile
          key={item.id}
          item={item}
          isManager={isManager}
          onAdd={onAdd}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
