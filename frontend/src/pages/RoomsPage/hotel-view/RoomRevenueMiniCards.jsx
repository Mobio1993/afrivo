const money = (value) => Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 });

export default function RoomRevenueMiniCards({ rooms = [] }) {
  const topRooms = [...rooms].sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  const max = Math.max(...topRooms.map((room) => room.revenue), 1);
  return (
    <section className="hv-panel">
      <div className="hv-panel-title">Revenus par chambre aujourd'hui</div>
      <div className="hv-revenue-list">
        {topRooms.map((room) => (
          <article key={room.id} className="hv-revenue-card">
            <div>
              <strong>Ch. {room.number}</strong>
              <span>{room.roomType}</span>
            </div>
            <b>{money(room.revenue)} XOF</b>
            <div className="hv-revenue-bar"><div style={{ width: `${Math.round((room.revenue / max) * 100)}%` }} /></div>
          </article>
        ))}
      </div>
    </section>
  );
}
