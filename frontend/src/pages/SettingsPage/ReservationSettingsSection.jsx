import { Field, SelectInput, TextInput, ToggleField } from "./SettingsFields";


export function ReservationSettingsSection({ form, options, errors, disabled, onChange }) {
  return (
    <section className="settings-section" id="settings-reservations">
      <div className="settings-section__head">
        <span className="eyebrow">Réservations</span>
        <h2>Règles de séjour</h2>
        <p>Paramètres qui encadrent les arrivées, départs, no-show et garanties de réservation.</p>
      </div>

      <div className="settings-group">
        <span className="settings-group__label">Horaires de séjour</span>
        <div className="settings-grid">
          <Field label="Heure check-in" name="checkin_time" error={errors.checkin_time}>
            <TextInput form={form} name="checkin_time" type="time" disabled={disabled} onChange={onChange} />
          </Field>
          <Field label="Heure check-out" name="checkout_time" error={errors.checkout_time}>
            <TextInput form={form} name="checkout_time" type="time" disabled={disabled} onChange={onChange} />
          </Field>
          <Field label="Durée de grâce (minutes)" name="grace_period_minutes" error={errors.grace_period_minutes}>
            <TextInput form={form} name="grace_period_minutes" type="number" disabled={disabled} onChange={onChange} />
          </Field>
        </div>
      </div>

      <div className="settings-group">
        <span className="settings-group__label">Politiques</span>
        <div className="settings-grid">
          <Field label="Politique no-show" name="no_show_policy" error={errors.no_show_policy}>
            <SelectInput form={form} name="no_show_policy" options={options.no_show_policies} disabled={disabled} onChange={onChange} />
          </Field>
          <Field label="Politique d'annulation" name="cancellation_policy" error={errors.cancellation_policy}>
            <SelectInput form={form} name="cancellation_policy" options={options.cancellation_policies} disabled={disabled} onChange={onChange} />
          </Field>
        </div>
      </div>

      <div className="settings-group">
        <span className="settings-group__label">Garantie</span>
        <div className="settings-toggle-grid">
          <ToggleField
            label="Acompte obligatoire"
            name="deposit_required"
            checked={form.deposit_required}
            disabled={disabled}
            onChange={onChange}
          />
        </div>
        {form.deposit_required && (
          <div className="settings-grid settings-deposit-reveal">
            <Field label="Pourcentage acompte (%)" name="deposit_percentage" error={errors.deposit_percentage}>
              <TextInput form={form} name="deposit_percentage" type="number" disabled={disabled} onChange={onChange} />
            </Field>
          </div>
        )}
      </div>
    </section>
  );
}
