const LEVEL_COLORS = {
  critique: "#A32D2D",
  warning: "#EF9F27",
  info: "#378ADD",
  ok: "#1D9E75",
};

export default function RtTimeline({ events = [] }) {
  if (!events.length) {
    return <div className="rt-timeline-empty">Aucun evenement recent</div>;
  }
  return (
    <div className="rt-timeline">
      {events.map((event, index) => (
        <div key={`${event.message}-${index}`} className="rt-tl-item">
          <div className="rt-tl-left">
            <div className="rt-tl-dot" style={{ background: LEVEL_COLORS[event.niveau] || "#888" }} />
            {index < events.length - 1 && <div className="rt-tl-line" />}
          </div>
          <div className="rt-tl-content">
            <div className="rt-tl-msg">{event.message}</div>
            <div className="rt-tl-time">{event.time}{event.iso ? ` - ${event.iso}` : ""}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
