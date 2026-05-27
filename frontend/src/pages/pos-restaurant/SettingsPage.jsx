export function SettingsPage() {
  return (
    <div className="pos-page">
      <div className="pos-page-header"><h2 className="pos-page-title">Parametres POS</h2></div>
      <section className="pos-card">
        <h3 className="pos-section-title">Configuration</h3>
        <p className="pos-muted">Restaurants, zones, tables, taxes, remises et raisons d'annulation sont exposes par le backend POS et administrables via Django Admin.</p>
      </section>
    </div>
  );
}
