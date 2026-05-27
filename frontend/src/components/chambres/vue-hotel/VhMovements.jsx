export default function VhMovements({ departs = [], arrivees = [] }) {
  return (
    <div className="vh-movements">
      <div className="vh-mov-col">
        <div className="vh-sec-label">
          Departs prevus aujourd'hui
          <span className="vh-badge-count">{departs.length}</span>
        </div>
        {departs.length === 0 ? <div className="vh-empty">Aucun depart prevu aujourd'hui</div> : null}
        {departs.map((depart, index) => (
          <div key={`${depart.chambre_numero}-${index}`} className={`vh-co-row ${depart.statut === "retard" ? "vh-co-late" : "vh-co-today"}`}>
            <span className="vh-co-room">Ch. {depart.chambre_numero}</span>
            <span className="vh-co-client">{depart.client_nom}</span>
            {depart.solde_du > 0 ? <span className="vh-pill vh-pill-r">{Number(depart.solde_du).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} XOF</span> : null}
            <span className={`vh-pill ${depart.statut === "retard" ? "vh-pill-r" : "vh-pill-a"}`}>
              {depart.statut === "retard" ? "En retard" : "Prevus"}
            </span>
            <span className="vh-co-time">{depart.heure_prevue}</span>
          </div>
        ))}
      </div>

      <div className="vh-mov-col">
        <div className="vh-sec-label">
          Arrivees attendues aujourd'hui
          <span className="vh-badge-count">{arrivees.length}</span>
        </div>
        {arrivees.length === 0 ? <div className="vh-empty">Aucune arrivee prevue aujourd'hui</div> : null}
        {arrivees.map((arrivee, index) => (
          <div key={`${arrivee.booking_id || arrivee.chambre_numero}-${index}`} className="vh-ar-row">
            <span className="vh-ar-room">Ch. {arrivee.chambre_numero}</span>
            <div className="vh-ar-info">
              <div className="vh-ar-client">{arrivee.client_nom}</div>
              <div className="vh-ar-type">{arrivee.type_chambre} · {arrivee.nb_nuits} nuit{arrivee.nb_nuits > 1 ? "s" : ""}</div>
            </div>
            <span className={`vh-pill ${arrivee.chambre_prete ? "vh-pill-g" : "vh-pill-a"}`}>
              {arrivee.chambre_prete ? "Chambre prete" : arrivee.affectee ? "A preparer" : "Non affectee"}
            </span>
            <span className="vh-ar-time">{arrivee.heure_prevue}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
