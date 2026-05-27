import { useState } from "react";

export default function VhSmartAssign({ suggestions = [], onAssign }) {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ client: "", type_chambre: "", arrivee: "", depart: "" });

  return (
    <div className="vh-smart-assign">
      <div className="vh-sec-label">Affectation intelligente</div>
      <div className="vh-sa-sub">Suggestions scorees selon disponibilite, type, tarif et contraintes operationnelles.</div>
      <div className="vh-sa-form">
        <div className="vh-sa-row">
          <label className="vh-fg">
            <span className="vh-form-lbl">Client</span>
            <select value={form.client} onChange={(event) => setForm((current) => ({ ...current, client: event.target.value }))}>
              <option value="">Client optionnel</option>
            </select>
          </label>
          <label className="vh-fg">
            <span className="vh-form-lbl">Type de chambre</span>
            <select value={form.type_chambre} onChange={(event) => setForm((current) => ({ ...current, type_chambre: event.target.value }))}>
              <option value="">Tous les types</option>
              <option value="standard">Standard</option>
              <option value="superieur">Superieure</option>
            </select>
          </label>
        </div>
        <div className="vh-sa-row">
          <label className="vh-fg">
            <span className="vh-form-lbl">Arrivee</span>
            <input type="date" value={form.arrivee} onChange={(event) => setForm((current) => ({ ...current, arrivee: event.target.value }))} />
          </label>
          <label className="vh-fg">
            <span className="vh-form-lbl">Depart</span>
            <input type="date" value={form.depart} onChange={(event) => setForm((current) => ({ ...current, depart: event.target.value }))} />
          </label>
        </div>
        <button type="button" className="vh-btn-primary" onClick={() => setSubmitted(true)}>Suggerer les chambres</button>
      </div>

      {submitted && suggestions.length > 0 ? (
        <div className="vh-suggestions">
          {suggestions.map((suggestion, index) => (
            <div key={suggestion.chambre_id} className={`vh-suggestion-row ${index === 0 ? "vh-sug-best" : ""}`}>
              <div className="vh-sug-rank">{suggestion.rang || index + 1}</div>
              <div className="vh-sug-info">
                <div className="vh-sug-name">Chambre {suggestion.chambre_numero} - {suggestion.type_chambre}</div>
                <div className="vh-sug-meta">
                  Score {suggestion.score}/100 · {(suggestion.reasons || []).slice(0, 2).join(" · ") || "Disponible"}
                </div>
              </div>
              <span className={`vh-pill ${index === 0 ? "vh-pill-g" : index === 1 ? "vh-pill-b" : "vh-pill-gr"}`}>
                {index === 0 ? "Recommandee" : index === 1 ? "Alternative" : "Option"}
              </span>
              <button type="button" className={`vh-btn-xs ${index === 0 ? "vh-btn-g" : ""}`} onClick={() => onAssign?.(suggestion)}>Affecter</button>
            </div>
          ))}
        </div>
      ) : null}
      {submitted && suggestions.length === 0 ? <div className="vh-empty">Aucune chambre disponible selon ces criteres</div> : null}
    </div>
  );
}
