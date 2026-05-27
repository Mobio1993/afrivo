import { AppSelect } from "../../shared/components/AppSelect";


export function Field({ label, name, children, error }) {
  return (
    <label className="settings-field">
      <span>{label}</span>
      {children}
      {error ? <small>{Array.isArray(error) ? error.join(" ") : error}</small> : null}
    </label>
  );
}

export function TextInput({ form, name, type = "text", disabled, onChange }) {
  return (
    <input
      type={type}
      name={name}
      value={form[name] ?? ""}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

export function SelectInput({ form, name, options = [], disabled, onChange }) {
  return (
    <AppSelect name={name} value={form[name] ?? ""} onChange={onChange} disabled={disabled}>
      {!options.length ? <option value={form[name] ?? ""}>Chargement...</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </AppSelect>
  );
}

export function ToggleField({ label, name, checked, disabled, onChange }) {
  return (
    <label className={`settings-toggle${disabled ? " settings-toggle--disabled" : ""}`}>
      <span className="settings-toggle__label">{label}</span>
      <span className="settings-toggle__track">
        <input
          type="checkbox"
          name={name}
          checked={Boolean(checked)}
          onChange={onChange}
          disabled={disabled}
        />
        <span className="settings-toggle__thumb" aria-hidden="true" />
      </span>
    </label>
  );
}
