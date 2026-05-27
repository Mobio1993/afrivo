import { useState } from "react";

import { posApi } from "../../hooks/usePosApi";

export function ReportsPage() {
  const [restaurantId, setRestaurantId] = useState("");
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setReport(await posApi.dailyReport(restaurantId));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="pos-page">
      <div className="pos-page-header"><h2 className="pos-page-title">Rapports POS</h2></div>
      <section className="pos-card pos-report-filter">
        <input className="pos-input" placeholder="ID restaurant optionnel" value={restaurantId} onChange={(event) => setRestaurantId(event.target.value)} />
        <button className="pos-btn pos-btn-primary" type="button" onClick={load}>Charger</button>
      </section>
      {error ? <div className="pos-error">{error}</div> : null}
      {report ? (
        <section className="pos-card">
          <div className="pos-list-row"><span>Date</span><b>{report.date}</b></div>
          <div className="pos-list-row"><span>Commandes payees</span><b>{report.nb_commandes}</b></div>
          <div className="pos-list-row"><span>CA</span><b>{Number(report.chiffre_affaires || 0).toLocaleString("fr-FR")} XOF</b></div>
        </section>
      ) : null}
    </div>
  );
}
