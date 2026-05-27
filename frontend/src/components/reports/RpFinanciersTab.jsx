import RpBarChart from "./RpBarChart";

const MODE_COLORS = {
  cash: "#1D9E75",
  mobile_money: "#378ADD",
  card: "#7F77DD",
  transfer: "#EF9F27",
  cheque: "#888780",
  other: "#888780",
};

const MODE_LABELS = {
  cash: "Especes",
  mobile_money: "Mobile money",
  card: "Carte",
  transfer: "Virement",
  cheque: "Cheque",
  other: "Autre",
};

const ORIGIN_COLORS = {
  day_use: "#1D9E75",
  reservations: "#378ADD",
  sejours: "#7F77DD",
};

const ORIGIN_LABELS = {
  day_use: "Day use",
  reservations: "Reservations",
  sejours: "Sejours",
};

const fmt = (value) => Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 });

export default function RpFinanciersTab({ data }) {
  const modes = Object.entries(data.modes_paiement || {}).map(([key, value]) => ({
    label: MODE_LABELS[key] || key,
    value: value.montant || 0,
    count: value.count,
    color: MODE_COLORS[key] || "#888",
  }));
  const origins = Object.entries(data.origine_revenus || {}).map(([key, value]) => ({
    label: ORIGIN_LABELS[key] || key,
    value: value.montant || 0,
    count: value.count,
    color: ORIGIN_COLORS[key] || "#888",
  }));

  return (
    <div className="rp-tab-section">
      <div className="rp-fin-kpis">
        {[
          { label: "Montant encaisse", value: fmt(data.encaissements_total), color: "green" },
          { label: "Paiements valides", value: data.paiements_valides },
          { label: "Paiements en attente", value: data.paiements_en_attente },
          { label: "Montant rembourse", value: fmt(data.montant_rembourse), color: "red" },
          { label: "Ticket moyen", value: fmt(data.ticket_moyen) },
          { label: "RevPAR", value: fmt(data.revpar) },
        ].map((kpi) => (
          <div key={kpi.label} className="rp-fin-kpi">
            <div className="rp-kpi-lbl">{kpi.label}</div>
            <div className={`rp-kpi-val ${kpi.color ? `rp-kpi-${kpi.color}` : ""}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="rp-charts-row">
        <div className="rp-section">
          <div className="rp-sec-label">Modes de paiement</div>
          <div className="rp-sec-sub">Repartition des encaissements valides</div>
          <RpBarChart items={modes} />
        </div>
        <div className="rp-section">
          <div className="rp-sec-label">Origine des revenus</div>
          <div className="rp-sec-sub">Lecture des encaissements selon la source metier</div>
          <RpBarChart items={origins} />
        </div>
      </div>
    </div>
  );
}
