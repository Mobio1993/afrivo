const STATUS_FILTERS = [
  { value: "all", label: "Toutes" },
  { value: "available", label: "Disponibles" },
  { value: "occupied", label: "Occupees" },
  { value: "cleaning", label: "Nettoyage" },
  { value: "checkout", label: "Check-out" },
];

const SORT_OPTIONS = [
  { value: "number", label: "Numero" },
  { value: "status", label: "Statut" },
  { value: "price", label: "Tarif" },
  { value: "guest", label: "Client" },
  { value: "arrival", label: "Date arrivee" },
];

export default function RoomToolbar({ filters, onChange, roomTypes = [], floors = [] }) {
  const set = (key, value) => onChange((current) => ({ ...current, [key]: value }));
  return (
    <div className="hv-toolbar">
      <input
        className="hv-search"
        value={filters.search}
        onChange={(event) => set("search", event.target.value)}
        placeholder="Rechercher chambre ou client..."
      />
      <div className="hv-filter-row">
        {STATUS_FILTERS.map((filter) => (
          <button key={filter.value} type="button" className={`hv-chip ${filters.status === filter.value ? "active" : ""}`} onClick={() => set("status", filter.value)}>
            {filter.label}
          </button>
        ))}
      </div>
      <select className="hv-select" value={filters.roomType} onChange={(event) => set("roomType", event.target.value)}>
        <option value="all">Tous les types</option>
        {roomTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
      </select>
      <select className="hv-select" value={filters.floor} onChange={(event) => set("floor", event.target.value)}>
        <option value="all">Tous les etages</option>
        {floors.map((floor) => <option key={floor} value={floor}>Etage {floor}</option>)}
      </select>
      <select className="hv-select" value={filters.sortBy} onChange={(event) => set("sortBy", event.target.value)}>
        {SORT_OPTIONS.map((sort) => <option key={sort.value} value={sort.value}>Tri : {sort.label}</option>)}
      </select>
    </div>
  );
}
