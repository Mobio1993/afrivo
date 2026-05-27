export default function HotelsFilters({ filters, onChange, onSubmit }) {
  const set = (key, value) => onChange({ ...filters, [key]: value, page: 1 });
  const activeCount = ["q", "status", "license_status", "city", "country"].filter((key) => filters[key]).length;
  const reset = () => onChange({ q: "", status: "", license_status: "", city: "", country: "", page: 1 });

  return (
    <form className="sr-filterbar" onSubmit={onSubmit}>
      <input
        className="sr-input"
        value={filters.q || ""}
        onChange={(event) => set("q", event.target.value)}
        placeholder="Rechercher hotel, organisation, ville..."
      />
      <select className="sr-input" value={filters.status || ""} onChange={(event) => set("status", event.target.value)}>
        <option value="">Tous statuts hotel</option>
        <option value="active">Actifs</option>
        <option value="inactive">Suspendus</option>
      </select>
      <select className="sr-input" value={filters.license_status || ""} onChange={(event) => set("license_status", event.target.value)}>
        <option value="">Tous statuts licence</option>
        <option value="active">Active</option>
        <option value="trial">Essai</option>
        <option value="suspended">Suspendue</option>
        <option value="expired">Expiree</option>
      </select>
      <input className="sr-input" value={filters.city || ""} onChange={(event) => set("city", event.target.value)} placeholder="Ville" />
      <input className="sr-input" value={filters.country || ""} onChange={(event) => set("country", event.target.value)} placeholder="Pays" />
      <span className="sr-filter-count">{activeCount ? `${activeCount} filtre(s)` : "Aucun filtre"}</span>
      <button className="sr-btn sr-btn-outline" type="button" onClick={reset}>Reinitialiser</button>
      <button className="sr-btn" type="submit">Filtrer</button>
    </form>
  );
}
