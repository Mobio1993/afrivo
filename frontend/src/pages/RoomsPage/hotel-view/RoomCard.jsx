const STATUS_META = {
  available: { label: "Disponible", className: "available" },
  occupied: { label: "Occupee", className: "occupied" },
  reserved: { label: "Reservee", className: "occupied" },
  cleaning: { label: "Nettoyage", className: "cleaning" },
  maintenance: { label: "Maintenance", className: "maintenance" },
  out_of_service: { label: "Bloquee", className: "blocked" },
};

const money = (value) => Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 });

export default function RoomCard({
  room,
  canOperate,
  activeRoomAction,
  formatDate,
  onOpen,
  onCheckIn,
  onCheckOut,
  onMarkClean,
  onMaintenance,
  canCheckIn = false,
  canCheckOut = false,
  canMarkClean = false,
  canMaintenance = false,
}) {
  const meta = STATUS_META[room.status] || STATUS_META.available;
  const progress = room.status === "cleaning" ? room.cleaningProgress : room.stayProgress;
  const isBusy = activeRoomAction?.roomId === room.id;

  return (
    <article className={`hv-room-card hv-status-${meta.className}`}>
      <header className="hv-room-card-head">
        <div>
          <div className="hv-room-number">{room.number}</div>
          <div className="hv-room-type">{room.roomType} - Etage {room.floor}</div>
        </div>
        <span className={`hv-status-pill hv-status-pill-${meta.className}`}>{room.statusLabel || meta.label}</span>
      </header>

      <div className="hv-room-guest">
        {room.guestName ? (
          <>
            <strong>{room.guestName}</strong>
            <span>{formatDate(room.arrivalDate)} - {formatDate(room.departureDate)} | Nuit {room.currentNight}/{room.totalNights}</span>
          </>
        ) : (
          <>
            <strong>Libre</strong>
            <span>Prete pour affectation</span>
          </>
        )}
      </div>

      <div className="hv-room-metrics">
        <div><span>Check-out</span><strong>{room.checkoutTime}</strong></div>
        <div><span>Temp.</span><strong>{room.temperature}C</strong></div>
        <div><span>Porte</span><strong className={room.doorState === "ouverte" ? "hv-warn" : ""}>{room.doorState}</strong></div>
        <div><span>Lumiere</span><strong>{room.lightState}</strong></div>
      </div>

      <div className="hv-money-row">
        <span>Solde restant</span>
        <strong className={room.balanceDue > 0 ? "hv-danger" : "hv-ok"}>{money(room.balanceDue)} XOF</strong>
      </div>
      <div className="hv-money-row">
        <span>Revenus lies</span>
        <strong>{money(room.revenue)} XOF</strong>
      </div>

      <div className="hv-progress">
        <div className="hv-progress-fill" style={{ width: `${progress || 0}%` }} />
      </div>

      <footer className="hv-card-actions">
        {canOperate && canCheckIn && room.status === "reserved" && <button type="button" onClick={() => onCheckIn?.(room.raw || room)} disabled={isBusy}>Check-in</button>}
        {canOperate && canCheckOut && room.status === "occupied" && <button type="button" onClick={() => onCheckOut?.(room.raw || room)} disabled={isBusy}>Check-out</button>}
        {canOperate && canMarkClean && room.status === "cleaning" && <button type="button" onClick={() => onMarkClean?.(room.raw || room)} disabled={isBusy}>Nettoyer</button>}
        {canOperate && canMaintenance && <button type="button" onClick={() => onMaintenance?.(room.raw || room)}>Maintenance</button>}
        <button type="button" className="hv-action-ghost" onClick={() => onOpen?.(room.raw || room)}>Voir detail</button>
      </footer>
    </article>
  );
}
