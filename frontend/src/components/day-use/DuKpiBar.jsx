export default function DuKpiBar({ dayUse }) {
  const fmt = (value) => Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 });
  const devise = dayUse.devise || dayUse.currency || "XOF";
  const total = Number(dayUse.montant_total || 0);
  const encaisse = Number(dayUse.montant_encaisse || 0);
  const solde = Number(dayUse.solde_restant || 0);
  const pct = total > 0 ? Math.min(Math.round((encaisse / total) * 100), 100) : 0;

  return (
    <div className="du-kpi-bar">
      <div className="du-kpi-cell">
        <div className="du-kpi-lbl">Montant total</div>
        <div className="du-kpi-val">{fmt(total)} <span className="du-kpi-cur">{devise}</span></div>
        <div className="du-kpi-sub">Formule + depassement</div>
      </div>
      <div className="du-kpi-cell">
        <div className="du-kpi-lbl">Montant encaisse</div>
        <div className="du-kpi-val du-kpi-green">{fmt(encaisse)}</div>
        <div className="du-progress"><div className="du-progress-fill" style={{ width: `${pct}%` }} /></div>
        <div className="du-kpi-sub">{pct}% encaisse</div>
      </div>
      <div className="du-kpi-cell">
        <div className="du-kpi-lbl">Solde restant</div>
        <div className={`du-kpi-val ${solde > 0 ? "du-kpi-red" : "du-kpi-green"}`}>{fmt(solde)}</div>
        <div className="du-kpi-sub">Reste a encaisser</div>
      </div>
      <div className="du-kpi-cell">
        <div className="du-kpi-lbl">Entree prevue</div>
        <div className="du-kpi-val du-kpi-mono">{dayUse.entree_prevue_formatted || "—"}</div>
        <div className="du-kpi-sub">Heure planifiee</div>
      </div>
    </div>
  );
}
