export default function PmCatTabs({ categories, active, onChange, allCount }) {
  return (
    <div className="pm-cat-tabs">
      <button type="button" className={`pm-cat-tab ${active === "all" ? "active" : ""}`} onClick={() => onChange("all")}>
        Tout
        <span className="pm-cat-count">{allCount}</span>
      </button>
      {categories.map((cat) => (
        <button key={cat.id} type="button" className={`pm-cat-tab ${active === cat.id ? "active" : ""}`} onClick={() => onChange(cat.id)}>
          {cat.nom}
          <span className="pm-cat-count">{cat.items?.length || 0}</span>
        </button>
      ))}
    </div>
  );
}
