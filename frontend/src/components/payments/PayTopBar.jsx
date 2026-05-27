function getStatusClass(status) {
  return `pay-status-${status || "unknown"}`;
}

export default function PayTopBar({
  payment,
  onBack,
  onAnnuler,
  onRembourser,
  onVoirReservation,
  onVoirFacture,
  canAnnuler = false,
  canRembourser = false,
}) {
  const status = payment.statut || payment.status;
  const isAnnule = status === "annule" || status === "cancelled";
  const isRembourse = status === "rembourse" || status === "refunded";

  return (
    <div className="pay-top-bar">
      <div className="pay-top-left">
        <button className="pay-btn-icon" onClick={onBack} title="Retour" type="button">
          <i className="ti ti-arrow-left" aria-hidden="true" />
        </button>
        <div>
          <div className="pay-top-ref">{payment.reference}</div>
          <div className="pay-top-hotel">{payment.hotel_name || "AFRIVO Default Hotel"}</div>
        </div>
        <span className={`pay-status-pill ${getStatusClass(status)}`}>
          {payment.statut_display || payment.status_label || status}
        </span>
      </div>
      <div className="pay-top-actions">
        {canRembourser ? (
          <button className="pay-btn" onClick={onRembourser} disabled={isAnnule || isRembourse} type="button">
            <i className="ti ti-arrow-back-up" aria-hidden="true" />
            Rembourser
          </button>
        ) : null}
        <button className="pay-btn" onClick={onVoirReservation} disabled={!payment.reservation_reference} type="button">
          <i className="ti ti-calendar" aria-hidden="true" />
          Reservation
        </button>
        <button className="pay-btn" onClick={onVoirFacture} disabled={!payment.invoice_reference} type="button">
          <i className="ti ti-receipt" aria-hidden="true" />
          Facture
        </button>
        {canAnnuler ? (
          <button className="pay-btn pay-btn-danger" onClick={onAnnuler} disabled={isAnnule} type="button">
            <i className="ti ti-x" aria-hidden="true" />
            Annuler
          </button>
        ) : null}
      </div>
    </div>
  );
}
