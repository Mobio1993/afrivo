export default function VhRoomCard({ room, onCheckout, onCheckin, onMarkClean, onBlock, onOpen }) {
  const status = room.statut;
  const isOccupe = status === "occupied";
  const isDispo = status === "available" || status === "reserved";
  const isNettoyage = status === "cleaning";
  const isMaint = status === "out_of_service";
  const cardClass = isOccupe ? "vh-rc-occupe" : isNettoyage ? "vh-rc-nettoyage" : isMaint ? "vh-rc-maint" : "vh-rc-dispo";
  const badgeClass = isOccupe ? "vh-rb-r" : isNettoyage ? "vh-rb-a" : isMaint ? "vh-rb-gr" : "vh-rb-g";
  const fmt = (n) => Number(n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 });

  return (
    <div className={`vh-room-card ${cardClass}`}>
      <div className="vh-rc-head">
        <span className="vh-rc-num">{room.numero}</span>
        <span className={`vh-rc-badge ${badgeClass} ${room.depart_aujourd_hui ? "vh-rb-depart" : ""}`}>
          {room.depart_aujourd_hui && isOccupe ? "DEPART AUJOURD'HUI" : room.etat_hotelier_display?.toUpperCase()}
        </span>
      </div>

      <div className="vh-rc-body">
        <div className="vh-rc-type">{room.type_chambre_display} · {room.etage ? `Etage ${room.etage}` : "Etage -"}</div>
        <div className="vh-rc-client">
          {room.client_nom || (isDispo ? "Libre" : isNettoyage ? room.tache_hk_active?.agent || "Nettoyage non assigne" : "-")}
        </div>

        <div className="vh-rc-iot">
          {room.temperature !== null && room.temperature !== undefined ? (
            <span className={`vh-iot ${room.temperature > 28 ? "vh-iot-alert" : ""}`}>{room.temperature}°C</span>
          ) : null}
          {room.lumiere_allumee ? <span className="vh-iot">Lumiere ON</span> : <span className="vh-iot">Lumiere OFF</span>}
          {room.presence_detectee ? <span className="vh-iot">Presence</span> : null}
          {room.porte_ouverte ? (
            <span className={`vh-iot ${room.porte_duree_min > 10 ? "vh-iot-alert" : "vh-iot-warn"}`}>Porte {room.porte_duree_min || 1}min</span>
          ) : (
            <span className="vh-iot">Porte fermee</span>
          )}
        </div>

        {isOccupe && room.sejour_actif ? (
          <div className="vh-rc-sejour">
            <div className="vh-sejour-label">
              Nuit {room.sejour_nuit_actuelle || "-"} / {room.sejour_total_nuits || "-"} · Depart {room.sejour_date_depart || "-"}
            </div>
            <div className="vh-sejour-bar">
              <div className="vh-sejour-fill" style={{ width: `${room.sejour_progression_pct || 0}%`, background: room.depart_aujourd_hui ? "#EF9F27" : "#1D9E75" }} />
            </div>
          </div>
        ) : null}

        {isNettoyage && room.tache_hk_active ? (
          <div className="vh-rc-sejour">
            <div className="vh-sejour-label">Nettoyage {room.tache_hk_active.duree_min}/{room.tache_hk_active.temps_estime || 30} min</div>
            <div className="vh-sejour-bar">
              <div className="vh-sejour-fill" style={{ width: `${room.tache_hk_active.progression_pct || 0}%`, background: "#EF9F27" }} />
            </div>
          </div>
        ) : null}

        <div className="vh-rc-metrics">
          <span className={`vh-rc-solde ${room.solde_statue === "impaye" ? "vh-solde-r" : room.solde_statue === "partiel" ? "vh-solde-a" : "vh-solde-g"}`}>
            {room.solde_statue === "solde" ? "Solde" : `Solde : ${fmt(room.solde_du)} XOF`}
          </span>
          <span className="vh-rc-tarif">{fmt(room.tarif_base)} XOF</span>
        </div>

        <div className="vh-rc-footer">
          {isOccupe ? (
            <>
              <button type="button" className="vh-btn-xs vh-btn-r" onClick={() => onCheckout?.(room)}>Check-out</button>
              <button type="button" className="vh-btn-xs" onClick={() => onOpen?.(room)}>Prolonger</button>
              <button type="button" className="vh-btn-xs" onClick={() => onOpen?.(room)}>Facture</button>
            </>
          ) : null}
          {isDispo ? (
            <>
              <button type="button" className="vh-btn-xs vh-btn-g" onClick={() => onCheckin?.(room)}>Check-in</button>
              <button type="button" className="vh-btn-xs" onClick={() => onBlock?.(room)}>Bloquer</button>
            </>
          ) : null}
          {isNettoyage ? <button type="button" className="vh-btn-xs vh-btn-g" onClick={() => onMarkClean?.(room)}>Propre</button> : null}
          <button type="button" className="vh-btn-xs" onClick={() => onOpen?.(room)}>Voir detail</button>
        </div>
      </div>
    </div>
  );
}
