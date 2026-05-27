export default function PayTabInfo({ payment }) {
  const rows = [
    { label: "Date", value: payment.formatted_date || payment.date || payment.paid_at },
    { label: "Devise", value: payment.devise || payment.currency || "XOF" },
    { label: "Reference", value: payment.reference },
    { label: "Ref. externe", value: payment.reference_externe || payment.external_reference || "-" },
    { label: "Origine", value: payment.origine || payment.source || "-" },
  ];

  return (
    <div className="pay-tab-info">
      <div className="pay-two-col">
        <div className="pay-section">
          <div className="pay-sec-label">Details transaction</div>
          {rows.map((field) => (
            <div key={field.label} className="pay-field-row">
              <span className="pay-field-lbl">{field.label}</span>
              <span className="pay-field-val">{field.value || "-"}</span>
            </div>
          ))}
        </div>
        <div className="pay-section">
          <div className="pay-sec-label">Notes internes</div>
          <div className="pay-note-box">
            {payment.notes_internes || payment.notes || <span className="pay-muted">Aucune note</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
