const FIELD_LABELS = {
  hotel_name_display: "Nom de l'hôtel",
  currency: "Devise",
  timezone: "Fuseau horaire",
  checkin_time: "Heure check-in",
  checkout_time: "Heure check-out",
  invoice_prefix: "Préfixe facture",
};


export function SettingsContextPanel({ activeSection, form, requiredFields }) {
  const sectionDef = requiredFields.find((s) => s.id === activeSection);
  const initials = (form.hotel_name_display || form.hotel_name || "AF").slice(0, 2).toUpperCase();
  const brandMeta = [form.currency, form.timezone].filter(Boolean).join(" · ") || "—";

  return (
    <div className="settings-context-panel">
      <div className="settings-context-card">
        <p className="settings-context-card__title">Champs requis</p>
        {!sectionDef || sectionDef.fields.length === 0 ? (
          <p className="settings-context-empty">Tous les champs sont optionnels.</p>
        ) : (
          <ul className="settings-check-list">
            {sectionDef.fields.map((field) => {
              const filled = Boolean(String(form[field] || "").trim());
              return (
                <li key={field} className={`settings-check-item${filled ? " ok" : " missing"}`}>
                  <span className={`settings-check-icon${filled ? " ok" : " missing"}`}>
                    {filled ? "✓" : "!"}
                  </span>
                  <span>{FIELD_LABELS[field] || field}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="settings-context-card">
        <p className="settings-context-card__title">Aperçu branding</p>
        <div className="settings-brand-preview">
          <div
            className="settings-brand-avatar"
            style={{ background: form.primary_color || "#0f9d8a" }}
          >
            {initials}
          </div>
          <div className="settings-brand-info">
            <strong className="settings-brand-name">
              {form.hotel_name_display || form.hotel_name || "Hotel"}
            </strong>
            <span className="settings-brand-meta">{brandMeta}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
