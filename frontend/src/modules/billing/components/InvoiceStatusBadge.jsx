export function InvoiceStatusBadge({ status, size = "sm" }) {
  const config = {
    draft:          { label: "Brouillon",    cls: "badge--draft" },
    issued:         { label: "Emise",        cls: "badge--issued" },
    partially_paid: { label: "Partiel",      cls: "badge--partial" },
    paid:           { label: "Payee",        cls: "badge--paid" },
    cancelled:      { label: "Annulee",      cls: "badge--cancelled" },
  };
  const cfg = config[status] || { label: status, cls: "badge--draft" };
  return (
    <span className={`inv-status-badge inv-status-badge--${size} ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}
