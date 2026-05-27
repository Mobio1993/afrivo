import { Field, TextInput, ToggleField } from "./SettingsFields";


export function SecuritySettingsSection({ form, errors, disabled, onChange }) {
  return (
    <section className="settings-section" id="settings-security">
      <div className="settings-section__head">
        <span className="eyebrow">Sécurité</span>
        <h2>Protections opérationnelles</h2>
        <p>Règles de session, confirmation et traçabilité des actions sensibles.</p>
      </div>

      <div className="settings-group">
        <span className="settings-group__label">Session</span>
        <div className="settings-grid">
          <Field label="Durée de session (minutes)" name="session_timeout_minutes" error={errors.session_timeout_minutes}>
            <TextInput form={form} name="session_timeout_minutes" type="number" disabled={disabled} onChange={onChange} />
          </Field>
        </div>
      </div>

      <div className="settings-group">
        <span className="settings-group__label">Confirmations et traçabilité</span>
        <div className="settings-toggle-grid">
          <ToggleField
            label="Confirmation avant suppression"
            name="require_delete_confirmation"
            checked={form.require_delete_confirmation}
            disabled={disabled}
            onChange={onChange}
          />
          <ToggleField
            label="Journal d'activité activé"
            name="enable_activity_log"
            checked={form.enable_activity_log}
            disabled={disabled}
            onChange={onChange}
          />
        </div>
      </div>
    </section>
  );
}
