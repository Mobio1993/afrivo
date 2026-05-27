const STATUS_PILL = {
  paid: "rp-ps-green",
  pending: "rp-ps-amber",
  cancelled: "rp-ps-red",
  refunded: "rp-ps-purple",
};

const MODE_PILL = {
  cash: "rp-ps-green",
  mobile_money: "rp-ps-blue",
  card: "rp-ps-purple",
  transfer: "rp-ps-amber",
  cheque: "rp-ps-amber",
};

export default function RpDetailTable({ items = [] }) {
  return (
    <div className="rp-section rp-detail-section">
      <div className="rp-sec-label">Liste detaillee</div>
      <div className="rp-sec-sub">Lecture detaillee des elements sur la periode selectionnee</div>

      {items.length === 0 ? (
        <div className="rp-empty">Aucun paiement sur cette periode</div>
      ) : (
        <div className="rp-table-wrap">
          <table className="rp-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Statut</th>
                <th>Mode</th>
                <th>Montant</th>
                <th>Relation</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={`${item.reference}-${index}`}>
                  <td className="rp-td-mono">{item.reference}</td>
                  <td>
                    <span className={`rp-pill ${STATUS_PILL[item.statut] || "rp-ps-green"}`}>
                      {item.statut_display || item.statut}
                    </span>
                  </td>
                  <td>
                    <span className={`rp-pill ${MODE_PILL[item.mode] || "rp-ps-green"}`}>
                      {item.mode_display || item.mode}
                    </span>
                  </td>
                  <td className="rp-td-amount">{Number(item.montant || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })}</td>
                  <td className="rp-td-relation">{item.relation}</td>
                  <td className="rp-td-mono">{item.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
