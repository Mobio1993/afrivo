export default function DuEncaissementsCard({ dayUse, onAdd, canAdd = false }) {
  const encaissements = dayUse.encaissements || [];

  return (
    <div className="du-card">
      <div className="du-sec-label">
        Encaissements lies
        {encaissements.length > 0 && <span className="du-count-badge">{encaissements.length}</span>}
      </div>

      {encaissements.length === 0 ? (
        <div className="du-empty-state">Aucun paiement rattache</div>
      ) : (
        encaissements.map((enc) => (
          <div key={enc.id} className="du-enc-row">
            <div>
              <div className="du-enc-ref">{enc.reference}</div>
              <div className="du-enc-date">{enc.date || "—"}</div>
            </div>
            <div className="du-enc-right">
              <span className="du-enc-mode">{enc.mode_paiement_display || enc.mode_paiement || "—"}</span>
              <span className="du-enc-amount">{Number(enc.montant || 0).toLocaleString("fr-FR")}</span>
            </div>
          </div>
        ))
      )}

      {canAdd ? (
        <button className="du-btn-add-enc" onClick={onAdd} type="button">+ Ajouter un paiement</button>
      ) : null}
    </div>
  );
}
