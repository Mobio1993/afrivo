import RtGauge from "./RtGauge";
import RtLed from "./RtLed";
import RtTimeline from "./RtTimeline";

export default function RtDetailPanel({ room }) {
  if (!room) {
    return (
      <div className="rt-detail-empty">
        <div className="rt-detail-empty-icon">CH</div>
        <div>Selectionnez une chambre pour voir son detail IoT</div>
      </div>
    );
  }

  return (
    <div className="rt-detail-panel">
      <div className="rt-detail-header">
        <div>
          <div className="rt-detail-ref">Chambre {room.numero}</div>
          <div className="rt-detail-sub">{room.type_chambre_display}{room.etage ? ` - ${room.etage}` : " - Etage non renseigne"}</div>
        </div>
        <div className="rt-detail-status">
          <span className={`rt-pill ${
            room.etat_hotelier === "disponible" ? "rt-pill-g"
              : room.etat_hotelier === "occupee" ? "rt-pill-b"
              : room.etat_hotelier === "nettoyage" ? "rt-pill-a"
              : "rt-pill-gr"
          }`}>{room.etat_hotelier_display}</span>
        </div>
      </div>

      {room.derniere_alerte_msg && (
        <div className={`rt-detail-alert ${room.derniere_alerte_niveau === "critique" ? "rt-al-critical" : "rt-al-warning"}`}>
          <span>!</span>
          <span>{room.derniere_alerte_msg}</span>
        </div>
      )}

      <div className="rt-detail-grid">
        <div className="rt-detail-card">
          <div className="rt-dc-title">Identite</div>
          {[
            { label: "Chambre", value: room.numero },
            { label: "Type", value: room.type_chambre_display },
            { label: "Etage", value: room.etage || "Non renseigne", muted: !room.etage },
            { label: "Derniere activite", value: room.derniere_activite },
          ].map((field) => (
            <div key={field.label} className="rt-dc-row">
              <span className="rt-dc-lbl">{field.label}</span>
              <span className={`rt-dc-val ${field.muted ? "rt-dc-muted" : ""}`}>{field.value}</span>
            </div>
          ))}
        </div>

        <div className="rt-detail-card">
          <div className="rt-dc-title">IoT temps reel</div>
          <div className="rt-dc-row"><span className="rt-dc-lbl">Presence</span><span className={`rt-dc-val ${room.presence_detectee ? "rt-dc-blue" : "rt-dc-muted"}`}>{room.presence_detectee ? "Detectee" : "Aucune"}</span></div>
          <div className="rt-dc-row"><span className="rt-dc-lbl">Porte</span><span className={`rt-dc-val ${room.porte_statut === "ouverte" && room.porte_duree_min > 10 ? "rt-dc-red" : room.porte_statut === "ouverte" ? "rt-dc-amber" : "rt-dc-green"}`}>{room.porte_statut === "ouverte" ? `Ouverte - ${room.porte_duree_min} min` : "Fermee"}</span></div>
          <div className="rt-dc-row"><span className="rt-dc-lbl">Climatisation</span><span className="rt-dc-val rt-led-value"><RtLed status={room.clim_allumee ? "on" : "off"} />{room.clim_allumee ? "Allumee" : "Eteinte"}</span></div>
          <div className="rt-dc-row"><span className="rt-dc-lbl">Lumiere</span><span className="rt-dc-val rt-led-value"><RtLed status={room.lumiere_allumee ? "on" : "off"} />{room.lumiere_allumee ? "Allumee" : "Eteinte"}</span></div>
          <div className="rt-dc-row"><span className="rt-dc-lbl">Capteur</span><span className={`rt-dc-val rt-led-value ${room.capteur_en_ligne ? "rt-dc-green" : "rt-dc-red"}`}><RtLed status={room.capteur_en_ligne ? "online" : "offline"} />{room.capteur_en_ligne ? "En ligne" : "Hors ligne"}</span></div>
        </div>
      </div>

      <div className="rt-gauges-row">
        <RtGauge value={room.temperature} min={15} max={40} label="Temperature" unit="°C" thresholds={{ warn: 26, critical: 30 }} />
        <RtGauge value={room.humidite} min={0} max={100} label="Humidite" unit="%" thresholds={{ warn: 70, critical: 85 }} />
      </div>

      <div className="rt-detail-section">
        <div className="rt-sec-label">Historique recent</div>
        <RtTimeline events={room.historique || []} />
      </div>
    </div>
  );
}
