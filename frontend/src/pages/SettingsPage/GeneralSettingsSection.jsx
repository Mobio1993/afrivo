import { Field, SelectInput, TextInput } from "./SettingsFields";


export function GeneralSettingsSection({ form, options, errors, disabled, onChange }) {
  return (
    <section className="settings-section" id="settings-general">
      <div className="settings-section__head">
        <span className="eyebrow">Général</span>
        <h2>Identité de l'hôtel</h2>
        <p>Informations commerciales utilisées dans les écrans internes et les documents clients.</p>
      </div>

      <div className="settings-group">
        <span className="settings-group__label">Informations commerciales</span>
        <div className="settings-grid">
          <Field label="Nom affiché de l'hôtel" name="hotel_name_display" error={errors.hotel_name_display}>
            <TextInput form={form} name="hotel_name_display" disabled={disabled} onChange={onChange} />
          </Field>
          <Field label="Adresse" name="address" error={errors.address}>
            <TextInput form={form} name="address" disabled={disabled} onChange={onChange} />
          </Field>
          <Field label="Téléphone" name="phone" error={errors.phone}>
            <TextInput form={form} name="phone" disabled={disabled} onChange={onChange} />
          </Field>
          <Field label="Email" name="email" error={errors.email}>
            <TextInput form={form} name="email" type="email" disabled={disabled} onChange={onChange} />
          </Field>
        </div>
      </div>

      <div className="settings-group">
        <span className="settings-group__label">Localisation</span>
        <div className="settings-grid">
          <Field label="Devise" name="currency" error={errors.currency}>
            <SelectInput form={form} name="currency" options={options.currencies} disabled={disabled} onChange={onChange} />
          </Field>
          <Field label="Fuseau horaire" name="timezone" error={errors.timezone}>
            <SelectInput form={form} name="timezone" options={options.timezones} disabled={disabled} onChange={onChange} />
          </Field>
        </div>
      </div>
    </section>
  );
}
