export default function MenuBrowser({ menus = [], onAddItem }) {
  if (!menus.length) return <div className="pos-empty">Aucun menu actif.</div>;

  return (
    <div className="pos-menu-browser">
      {menus.map((menu) => (
        <section key={menu.id} className="pos-menu-block">
          <h3 className="pos-section-title">{menu.nom}</h3>
          {(menu.categories || []).map((category) => (
            <div key={category.id} className="pos-menu-category">
              <div className="pos-col-head">{category.nom}</div>
              <div className="pos-menu-items">
                {(category.items || []).map((item) => (
                  <button key={item.id} type="button" className="pos-menu-item" disabled={!item.disponible} onClick={() => onAddItem?.(item)}>
                    <span>
                      <strong>{item.nom}</strong>
                      <small>{item.temps_prep_min} min</small>
                    </span>
                    <b>{Number(item.prix || 0).toLocaleString("fr-FR")} XOF</b>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
