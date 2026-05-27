import RtLed from "./RtLed";

const STATUS_PILL = {
  disponible: "rt-pill-g",
  occupee: "rt-pill-b",
  nettoyage: "rt-pill-a",
  maintenance: "rt-pill-gr",
  hors_service: "rt-pill-gr",
};

export default function RtRoomTable({ rooms = [], selectedRoom, onSelect }) {
  return (
    <div className="rt-table-wrap">
      <table className="rt-table">
        <thead>
          <tr>
            <th>Chambre</th>
            <th>Etat hotelier</th>
            <th>Presence</th>
            <th>Porte</th>
            <th>Temp.</th>
            <th>Hum.</th>
            <th>Lumiere</th>
            <th>Clim.</th>
            <th>Capteur</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => {
            const tempAlert = room.temperature !== null && room.temperature > 28;
            return (
              <tr
                key={room.id}
                className={`${room.derniere_alerte_msg ? "rt-tr-alert" : ""} ${selectedRoom?.id === room.id ? "rt-tr-selected" : ""}`}
                onClick={() => onSelect(room)}
              >
                <td>
                  <strong>{room.numero}</strong>
                  <div className="rt-td-sub">{room.type_chambre_display}</div>
                  <div className="rt-td-sub">{room.etage || "Etage -"}</div>
                </td>
                <td><span className={`rt-pill ${STATUS_PILL[room.etat_hotelier] || "rt-pill-gr"}`}>{room.etat_hotelier_display}</span></td>
                <td><span className={`rt-pill ${room.presence_detectee ? "rt-pill-b" : "rt-pill-gr"}`}>{room.presence_detectee ? "Detectee" : "Aucune"}</span></td>
                <td>
                  {room.porte_statut === "ouverte" ? (
                    <span className={`rt-pill ${room.porte_duree_min > 10 ? "rt-pill-r" : "rt-pill-a"}`}>Ouverte {room.porte_duree_min}min</span>
                  ) : <span className="rt-pill rt-pill-gr">Fermee</span>}
                </td>
                <td className={`rt-td-sensor ${tempAlert ? "rt-td-alert" : ""}`}>{room.temperature !== null ? `${room.temperature}°C` : "-"}</td>
                <td className="rt-td-sensor">{room.humidite !== null ? `${room.humidite}%` : "-"}</td>
                <td><RtLed status={room.lumiere_allumee ? "on" : "off"} title={room.lumiere_allumee ? "Lumiere allumee" : "Lumiere eteinte"} /></td>
                <td><RtLed status={room.clim_allumee ? "on" : "off"} title={room.clim_allumee ? "Climatisation allumee" : "Climatisation eteinte"} /></td>
                <td>
                  <RtLed status={room.capteur_en_ligne ? "online" : "offline"} title={room.capteur_en_ligne ? "Capteur en ligne" : "Capteur hors ligne"} />
                  {!room.capteur_en_ligne && <span className="rt-td-hs">HS</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="rt-led-legend">
        <div className="rt-leg-row"><RtLed status="on" /> Actif / Allume</div>
        <div className="rt-leg-row"><RtLed status="off" /> Inactif / Eteint</div>
        <div className="rt-leg-row"><RtLed status="offline" /> Hors ligne</div>
        <div className="rt-leg-row"><RtLed status="warning" /> Alerte</div>
      </div>
    </div>
  );
}
