import { Field, TextInput, ToggleField } from "./SettingsFields";


export function BillingSettingsSection({ form, options, errors, disabled, onChange, onPaymentMethodToggle }) {
  const selectedMethods = Array.isArray(form.payment_methods) ? form.payment_methods : [];

  return (
    <section className="settings-section" id="settings-billing">
      <div className="settings-section__head">
        <span className="eyebrow">Facturation</span>
        <h2>Règles de paiement</h2>
        <p>Configuration des factures, taxes et moyens d'encaissement acceptés.</p>
      </div>

      <div className="settings-group">
        <span className="settings-group__label">Numérotation</span>
        <div className="settings-grid">
          <Field label="Préfixe facture" name="invoice_prefix" error={errors.invoice_prefix}>
            <TextInput form={form} name="invoice_prefix" disabled={disabled} onChange={onChange} />
          </Field>
          <Field label="Numéro de départ" name="invoice_start_number" error={errors.invoice_start_number}>
            <TextInput form={form} name="invoice_start_number" type="number" disabled={disabled} onChange={onChange} />
          </Field>
          <Field label="Taux de taxe (%)" name="tax_rate" error={errors.tax_rate}>
            <TextInput form={form} name="tax_rate" type="number" disabled={disabled} onChange={onChange} />
          </Field>
        </div>
      </div>

      <div className="settings-group">
        <span className="settings-group__label">Modes de paiement</span>
        <div className="settings-methods">
          <div className="settings-methods__grid">
            {options.payment_methods.map((method) => (
              <label key={method.value} className="settings-method">
                <input
                  type="checkbox"
                  checked={selectedMethods.includes(method.value)}
                  onChange={() => onPaymentMethodToggle(method.value)}
                  disabled={disabled}
                />
                <span>{method.label}</span>
              </label>
            ))}
          </div>
          {errors.payment_methods ? (
            <small>{Array.isArray(errors.payment_methods) ? errors.payment_methods.join(" ") : errors.payment_methods}</small>
          ) : null}
        </div>
      </div>

      <div className="settings-group">
        <span className="settings-group__label">Règles financières</span>
        <div className="settings-toggle-grid">
          <ToggleField
            label="Autoriser solde négatif"
            name="allow_negative_balance"
            checked={form.allow_negative_balance}
            disabled={disabled}
            onChange={onChange}
          />
          <ToggleField
            label="Paiement obligatoire avant checkout"
            name="require_payment_before_checkout"
            checked={form.require_payment_before_checkout}
            disabled={disabled}
            onChange={onChange}
          />
        </div>
      </div>
    </section>
  );
}
