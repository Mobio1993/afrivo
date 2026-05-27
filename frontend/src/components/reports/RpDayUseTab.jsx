const fmt = (value) => Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 });

export default function RpDayUseTab({ data }) {
  const dayUseRevenue = data.origine_revenus?.day_use?.montant || 0;
  const dayUsePayments = data.origine_revenus?.day_use?.count || 0;

  return (
    <div className="rp-tab-section">
      <div className="rp-fin-kpis">
        {[
          { label: "Day use crees", value: data.day_use_count },
          { label: "Revenus day use", value: fmt(dayUseRevenue), color: "green" },
          { label: "Paiements day use", value: dayUsePayments },
          { label: "Ticket moyen", value: fmt(dayUseRevenue / Math.max(dayUsePayments, 1)) },
        ].map((kpi) => (
          <div key={kpi.label} className="rp-fin-kpi">
            <div className="rp-kpi-lbl">{kpi.label}</div>
            <div className={`rp-kpi-val ${kpi.color ? `rp-kpi-${kpi.color}` : ""}`}>{kpi.value}</div>
          </div>
        ))}
      </div>
      <div className="rp-section">
        <div className="rp-sec-label">Activite day use</div>
        <div className="rp-empty">Les indicateurs day use se mettent a jour avec la periode selectionnee.</div>
      </div>
    </div>
  );
}
