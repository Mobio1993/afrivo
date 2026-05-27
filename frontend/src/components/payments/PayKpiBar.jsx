const STATUS_COLORS = {
  paid: "#0F6E56",
  paye: "#0F6E56",
  cancelled: "#A32D2D",
  annule: "#A32D2D",
  refunded: "#633806",
  rembourse: "#633806",
  pending: "#185FA5",
  en_attente: "#185FA5",
};

function formatAmount(value) {
  return Number(value || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function PayKpiBar({ payment }) {
  const status = payment.statut || payment.status;
  const statusColor = STATUS_COLORS[status] || "var(--color-text-primary, #111827)";

  return (
    <div className="pay-kpi-bar">
      <div className="pay-kpi-cell">
        <div className="pay-kpi-lbl">Montant</div>
        <div className="pay-kpi-val pay-kpi-amount">
          {formatAmount(payment.montant ?? payment.amount)}
          <span className="pay-kpi-cur">{payment.devise || payment.currency || "XOF"}</span>
        </div>
      </div>
      <div className="pay-kpi-cell">
        <div className="pay-kpi-lbl">Statut</div>
        <div className="pay-kpi-val" style={{ color: statusColor }}>
          {payment.statut_display || payment.status_label || status}
        </div>
      </div>
      <div className="pay-kpi-cell">
        <div className="pay-kpi-lbl">Mode</div>
        <div className="pay-kpi-val">{payment.mode_paiement_display || payment.mode_paiement || "-"}</div>
      </div>
      <div className="pay-kpi-cell">
        <div className="pay-kpi-lbl">Type</div>
        <div className="pay-kpi-val pay-kpi-type">
          {payment.type_paiement_display || payment.type_paiement || "-"}
        </div>
      </div>
    </div>
  );
}
