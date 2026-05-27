export default function SmartRoomAssignment({
  choices,
  roomTypes = [],
  form,
  setForm,
  suggestions = [],
  submitting,
  onSubmit,
  onAssign,
}) {
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <section className="hv-panel">
      <div className="hv-panel-title">Affectation intelligente</div>
      <form className="hv-smart-form" onSubmit={onSubmit}>
        <select value={form?.guest || ""} onChange={(event) => set("guest", event.target.value)}>
          <option value="">Client optionnel</option>
          {(choices?.guests || []).map((guest) => <option key={guest.id} value={guest.id}>{guest.label}</option>)}
        </select>
        <select value={form?.room_type || ""} onChange={(event) => set("room_type", event.target.value)}>
          <option value="">Type de chambre</option>
          {roomTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
        </select>
        <input type="date" value={form?.check_in_date || ""} onChange={(event) => set("check_in_date", event.target.value)} />
        <input type="date" value={form?.check_out_date || ""} onChange={(event) => set("check_out_date", event.target.value)} />
        <button type="submit" disabled={submitting}>{submitting ? "Calcul..." : "Suggerer les chambres"}</button>
      </form>

      <div className="hv-suggestions">
        {suggestions.map((room) => (
          <article key={room.id} className="hv-suggestion">
            <div>
              <strong>Ch. {room.number}</strong>
              <span>{room.roomType}</span>
            </div>
            <div className="hv-score">{room.score}%</div>
            <ul>
              {(room.reasons || []).slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
            <button type="button" onClick={() => onAssign?.(room)}>Affecter</button>
          </article>
        ))}
      </div>
    </section>
  );
}
