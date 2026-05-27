const STATUS_CLASS = {
  disponible: "rt-room-dispo",
  occupee: "rt-room-occupe",
  nettoyage: "rt-room-nettoyage",
  maintenance: "rt-room-maint",
  hors_service: "rt-room-maint",
};

export default function RtHeatmap({ rooms = [], selectedRoom, onSelect }) {
  return (
    <div>
      <div className="rt-heatmap-grid">
        {rooms.map((room) => {
          const hasAlert = Boolean(room.derniere_alerte_msg);
          const cls = hasAlert ? "rt-room-alerte" : (STATUS_CLASS[room.etat_hotelier] || "rt-room-dispo");
          return (
            <button
              key={room.id}
              type="button"
              className={`rt-room-cell ${cls} ${selectedRoom?.id === room.id ? "rt-room-selected" : ""}`}
              onClick={() => onSelect(room)}
              title={`Chambre ${room.numero} - ${room.etat_hotelier_display}`}
            >
              <div className="rt-room-num">
                {room.numero}
                {hasAlert && <span className="rt-room-alert-icon">!</span>}
              </div>
              <div className="rt-room-status">{room.etat_hotelier_display}</div>
              <div className="rt-room-icons">
                {room.presence_detectee && <span className="rt-ri" title="Presence">P</span>}
                {room.porte_statut === "ouverte" && <span className="rt-ri rt-ri-warn" title="Porte ouverte">Porte {room.porte_duree_min}m</span>}
                {room.temperature !== null && <span className="rt-ri" title="Temperature">{room.temperature}°</span>}
                {room.lumiere_allumee && <span className="rt-ri" title="Lumiere allumee">Lum</span>}
                {!room.capteur_en_ligne && <span className="rt-ri rt-ri-error" title="Capteur hors ligne">HS</span>}
              </div>
            </button>
          );
        })}
      </div>
      <div className="rt-heatmap-legend">
        {[
          { cls: "rt-room-dispo", label: "Disponible" },
          { cls: "rt-room-occupe", label: "Occupee" },
          { cls: "rt-room-nettoyage", label: "Nettoyage" },
          { cls: "rt-room-alerte", label: "Alerte" },
          { cls: "rt-room-maint", label: "Maintenance" },
        ].map((item) => (
          <div key={item.cls} className="rt-leg-row">
            <div className={`rt-leg-dot ${item.cls}`} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
