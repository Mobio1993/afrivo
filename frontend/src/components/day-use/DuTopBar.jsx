export default function DuTopBar({
  dayUse,
  onBack,
  onEntree,
  onSortie,
  onNettoyage,
  onAnnuler,
  canEntree = false,
  canSortie = false,
  canNettoyage = false,
  canAnnuler = false,
}) {
  const statut = dayUse.statut || "";
  const isAnnule = ["cancelled", "annule", "no_show"].includes(statut);
  const isEntre = ["in_progress", "overtime", "completed", "entre", "sorti", "nettoyage", "termine"].includes(statut);
  const isSorti = ["completed", "sorti", "nettoyage", "termine"].includes(statut);

  return (
    <div className="du-topbar">
      <div className="du-topbar-left">
        <button className="du-btn-icon" onClick={onBack} type="button" aria-label="Retour">&lt;</button>
        <div>
          <div className="du-topbar-ref">{dayUse.reference}</div>
          <div className="du-topbar-sub">Day Use - {dayUse.hotel_name || "AFRIVO Default Hotel"}</div>
        </div>
        <span className={`du-status-pill du-status-${statut}`}>
          {dayUse.statut_display || statut}
        </span>
      </div>
      <div className="du-topbar-actions">
        {canEntree ? (
          <button className="du-btn du-btn-primary" onClick={onEntree} disabled={isAnnule || isEntre} type="button">
            Effectuer l'entree
          </button>
        ) : null}
        {canSortie ? (
          <button className="du-btn" onClick={onSortie} disabled={isAnnule || !isEntre || isSorti} type="button">
            Effectuer la sortie
          </button>
        ) : null}
        {canNettoyage ? (
          <button className="du-btn" onClick={onNettoyage} disabled={isAnnule || !isSorti} type="button">
            Verifier nettoyage
          </button>
        ) : null}
        {canAnnuler ? (
          <button className="du-btn du-btn-danger" onClick={onAnnuler} disabled={isAnnule} type="button">
            Annuler
          </button>
        ) : null}
      </div>
    </div>
  );
}
