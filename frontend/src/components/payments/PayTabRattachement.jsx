export default function PayTabRattachement({ payment }) {
  const fields = [
    { label: "Reservation", value: payment.reservation_reference, isLink: true },
    { label: "Facture", value: payment.invoice_reference, isLink: true },
    { label: "Client", value: payment.client_name },
    { label: "Sejour", value: payment.sejour_reference || payment.stay_reference },
    { label: "Day use", value: payment.day_use_reference },
  ];

  return (
    <div className="pay-section pay-section-standalone">
      <div className="pay-sec-label">Rattachement metier</div>
      {fields.map((field) => (
        <div key={field.label} className="pay-field-row">
          <span className="pay-field-lbl">{field.label}</span>
          {field.value ? (
            field.isLink ? (
              <span className="pay-link-badge">{field.value}</span>
            ) : (
              <span className="pay-field-val">{field.value}</span>
            )
          ) : (
            <span className="pay-muted">-</span>
          )}
        </div>
      ))}
    </div>
  );
}
