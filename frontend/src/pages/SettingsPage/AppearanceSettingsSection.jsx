import { Field, TextInput } from "./SettingsFields";


export function AppearanceSettingsSection({ form, errors, disabled, onChange, onLogoChange, logoPreviewUrl }) {
  const previewLogo = logoPreviewUrl || form.logo_url;

  return (
    <section className="settings-section" id="settings-appearance">
      <div className="settings-section__head">
        <span className="eyebrow">Apparence</span>
        <h2>Signature visuelle</h2>
        <p>Éléments visibles dans l'expérience hôtel et les futurs documents commerciaux.</p>
      </div>

      <div className="settings-group">
        <span className="settings-group__label">Identité visuelle</span>
        <div className="settings-grid">
          <Field label="Couleur principale" name="primary_color" error={errors.primary_color}>
            <div className="settings-color-input">
              <input
                type="color"
                name="primary_color"
                value={form.primary_color || "#0f9d8a"}
                onChange={onChange}
                disabled={disabled}
                aria-label="Couleur principale"
              />
              <TextInput form={form} name="primary_color" disabled={disabled} onChange={onChange} />
            </div>
          </Field>
          <Field label="Nom commercial affiché" name="hotel_name_display" error={errors.hotel_name_display}>
            <TextInput form={form} name="hotel_name_display" disabled={disabled} onChange={onChange} />
          </Field>
        </div>
      </div>

      <div className="settings-group">
        <span className="settings-group__label">Logo</span>
        <Field label="Fichier logo" name="logo" error={errors.logo}>
          <input type="file" name="logo" accept="image/*" onChange={onLogoChange} disabled={disabled} />
        </Field>
      </div>

      <div className="settings-preview">
        <div className="settings-preview__logo" style={{ background: form.primary_color || "#0f9d8a" }}>
          {previewLogo
            ? <img src={previewLogo} alt="" />
            : (form.hotel_name_display || form.hotel_name || "AF").slice(0, 2).toUpperCase()}
        </div>
        <div>
          <span>Aperçu</span>
          <strong>{form.hotel_name_display || form.hotel_name || "Hôtel"}</strong>
        </div>
      </div>
    </section>
  );
}
