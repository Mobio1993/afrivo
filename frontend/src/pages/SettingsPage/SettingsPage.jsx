import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { useAuth } from "../../auth/AuthContext";
import { hasPermission } from "../../auth/permissions";
import FontSizeControl from "../../components/settings/FontSizeControl";
import ThemeSelector from "../../components/settings/ThemeSelector";
import { getHotelSettings, getSettingsOptions, updateHotelSettings } from "../../services/settingsService";
import { AppSelect } from "../../shared/components/AppSelect";
import { useToast } from "../../shared/toast/ToastContext";
import "./SettingsPage.css";

const ACTIVE_SECTION_KEY = "afrivo.settings.activeSection";
const MAX_LOGO_SIZE = 2 * 1024 * 1024;

const DEFAULT_OPTIONS = {
  currencies: [],
  no_show_policies: [],
  cancellation_policies: [],
  payment_methods: [],
  timezones: [],
};

const DEFAULT_FORM = {
  hotel_name_display: "",
  hotel_name: "",
  logo_url: "",
  address: "",
  phone: "",
  email: "",
  currency: "XOF",
  timezone: "Atlantic/Reykjavik",
  total_rooms: 1,
  checkin_time: "14:00",
  checkout_time: "12:00",
  grace_period_minutes: 60,
  no_show_policy: "AUTO_AFTER_GRACE",
  cancellation_policy: "MODERATE",
  deposit_required: false,
  invoice_prefix: "INV",
  invoice_start_number: 1,
  tax_rate: "0.00",
  payment_methods: [],
  allow_negative_balance: false,
  require_payment_before_checkout: true,
  session_timeout_minutes: 60,
  require_delete_confirmation: true,
  enable_activity_log: true,
  primary_color: "#0f9d8a",
};

const NAV_ITEMS = [
  { id: "general", label: "Général", icon: "building", order: 1 },
  { id: "reservations", label: "Réservations", icon: "calendar", order: 2 },
  { id: "billing", label: "Facturation", icon: "receipt", order: 3, afterDivider: true },
  { id: "security", label: "Sécurité", icon: "shield-check", order: 4 },
  { id: "appearance", label: "Apparence", icon: "palette", order: 5 },
];

const SECTION_ORDER = NAV_ITEMS.map((item) => item.id);

const SECTION_FIELDS = {
  general: ["hotel_name_display", "address", "phone", "email", "currency", "timezone", "total_rooms"],
  reservations: ["checkin_time", "checkout_time", "grace_period_minutes", "no_show_policy", "cancellation_policy", "deposit_required"],
  billing: ["invoice_prefix", "invoice_start_number", "tax_rate", "payment_methods", "allow_negative_balance", "require_payment_before_checkout"],
  security: ["session_timeout_minutes", "require_delete_confirmation", "enable_activity_log"],
  appearance: ["primary_color", "hotel_name_display"],
};

const REQUIRED_FIELDS = {
  general: ["hotel_name_display", "currency", "timezone"],
  reservations: ["checkin_time", "checkout_time"],
  billing: ["invoice_prefix"],
  security: [],
  appearance: [],
};

function Icon({ name }) {
  return <i className={`ti ti-${name}`} aria-hidden="true" />;
}

function normalizeSettings(payload = {}) {
  return {
    ...DEFAULT_FORM,
    ...payload,
    checkin_time: (payload.checkin_time || DEFAULT_FORM.checkin_time).slice(0, 5),
    checkout_time: (payload.checkout_time || DEFAULT_FORM.checkout_time).slice(0, 5),
    payment_methods: Array.isArray(payload.payment_methods) ? payload.payment_methods : [],
    total_rooms: payload.total_rooms || DEFAULT_FORM.total_rooms,
  };
}

function fieldIsFilled(value) {
  return String(value ?? "").trim().length > 0;
}

function sectionIsValid(sectionId, form) {
  return (REQUIRED_FIELDS[sectionId] || []).every((field) => fieldIsFilled(form[field]));
}

function completionPercent(form) {
  const fields = Object.values(REQUIRED_FIELDS).flat();
  const filled = fields.filter((field) => fieldIsFilled(form[field])).length;
  return Math.round((filled / fields.length) * 100);
}

function sectionPayload(form, sectionId) {
  const payload = {};
  (SECTION_FIELDS[sectionId] || []).forEach((field) => {
    payload[field] = form[field];
  });
  if ("total_rooms" in payload) payload.total_rooms = Number(payload.total_rooms || 1);
  if ("grace_period_minutes" in payload) payload.grace_period_minutes = Number(payload.grace_period_minutes || 0);
  if ("invoice_start_number" in payload) payload.invoice_start_number = Number(payload.invoice_start_number || 1);
  if ("session_timeout_minutes" in payload) payload.session_timeout_minutes = Number(payload.session_timeout_minutes || 60);
  if ("tax_rate" in payload) payload.tax_rate = Number(payload.tax_rate || 0).toFixed(2);
  return payload;
}

function appendFormData(formData, payload) {
  Object.entries(payload).forEach(([key, value]) => {
    formData.append(key, Array.isArray(value) ? JSON.stringify(value) : value);
  });
}

function flattenApiErrors(payload) {
  if (!payload || typeof payload !== "object") return "";
  return Object.entries(payload)
    .map(([field, messages]) => {
      const text = Array.isArray(messages) ? messages.join(" ") : String(messages);
      return field === "detail" ? text : `${field}: ${text}`;
    })
    .join(" ");
}

function initials(name) {
  return (name || "AF").trim().slice(0, 2).toUpperCase();
}

function SettingsField({ label, name, hint, error, touched, children }) {
  return (
    <label className={`settings-field${error && touched ? " settings-field--error" : ""}`}>
      <span>{label}</span>
      {children}
      {hint ? <em>{hint}</em> : null}
      {error && touched ? <small>{Array.isArray(error) ? error.join(" ") : error}</small> : null}
    </label>
  );
}

function TextInput({ form, name, type = "text", min, max, step, disabled, onChange, onBlur }) {
  return (
    <input
      type={type}
      name={name}
      value={form[name] ?? ""}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={onChange}
      onBlur={onBlur}
    />
  );
}

function SelectInput({ form, name, options, disabled, onChange, onBlur }) {
  return (
    <AppSelect name={name} value={form[name] ?? ""} disabled={disabled} onChange={onChange} onBlur={onBlur}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </AppSelect>
  );
}

function Toggle({ label, subLabel, name, checked, disabled, onChange }) {
  return (
    <label className={`settings-toggle${disabled ? " settings-toggle--disabled" : ""}`}>
      <span>
        <strong>{label}</strong>
        {subLabel ? <em>{subLabel}</em> : null}
      </span>
      <input type="checkbox" name={name} checked={Boolean(checked)} disabled={disabled} onChange={onChange} />
      <i aria-hidden="true" />
    </label>
  );
}

function SettingsCard({ icon, tone = "teal", title, badge, children }) {
  return (
    <section className="settings-card">
      <header className="settings-card__hd">
        <span className={`settings-card__icon settings-card__icon--${tone}`}><Icon name={icon} /></span>
        <h2>{title}</h2>
        {badge ? <span className={`settings-badge settings-badge--${badge === "Requis" ? "required" : "optional"}`}>{badge}</span> : null}
      </header>
      <div className="settings-card__body">{children}</div>
    </section>
  );
}

function buildSectionVariants(shouldReduceMotion) {
  if (shouldReduceMotion) {
    return {
      enter: { opacity: 1, y: 0 },
      center: { opacity: 1, y: 0 },
      exit: { opacity: 1, y: 0 },
    };
  }

  return {
    enter: (direction) => ({
      y: direction > 0 ? 20 : -20,
      opacity: 0,
    }),
    center: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.22, ease: "easeOut" },
    },
    exit: (direction) => ({
      y: direction > 0 ? -20 : 20,
      opacity: 0,
      transition: { duration: 0.15, ease: "easeIn" },
    }),
  };
}

export function SettingsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const shouldReduceMotion = useReducedMotion();
  const colorInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [initialForm, setInitialForm] = useState(DEFAULT_FORM);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [activeSection, setActiveSection] = useState(() => localStorage.getItem(ACTIVE_SECTION_KEY) || "general");
  const [direction, setDirection] = useState(1);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
  const [removeLogo, setRemoveLogo] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [status, setStatus] = useState({ error: "", success: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isHotelAdminRole = ["admin", "hotel_admin"].includes(user?.role_code || user?.role);
  const canManageSettings = Boolean(user?.is_platform_admin)
    || isHotelAdminRole
    || hasPermission(user, "settings", "manage")
    || hasPermission(user, "settings", "update");

  const logoSrc = removeLogo ? "" : logoPreviewUrl || form.logo_url;
  const completion = useMemo(() => completionPercent(form), [form]);
  const sectionVariants = useMemo(() => buildSectionVariants(shouldReduceMotion), [shouldReduceMotion]);
  const hotelName = form.hotel_name_display || form.hotel_name || "Hôtel";
  const isDisabled = !canManageSettings || saving;

  useEffect(() => {
    if (status.error) toast.error(status.error);
  }, [status.error, toast]);

  useEffect(() => {
    if (status.success) toast.success(status.success);
  }, [status.success, toast]);

  async function loadSettings() {
    setLoading(true);
    setStatus({ error: "", success: "" });
    try {
      const [settingsPayload, optionsPayload] = await Promise.all([getHotelSettings(), getSettingsOptions()]);
      const normalized = normalizeSettings(settingsPayload);
      setForm(normalized);
      setInitialForm(normalized);
      setOptions({ ...DEFAULT_OPTIONS, ...optionsPayload });
    } catch (error) {
      setStatus({ error: error.message || "Impossible de charger les paramètres.", success: "" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    localStorage.setItem(ACTIVE_SECTION_KEY, activeSection);
  }, [activeSection]);

  useEffect(() => () => {
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
  }, [logoPreviewUrl]);

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: null }));
    setStatus({ error: "", success: "" });
  }

  function handleChange(event) {
    const { name, type, checked, value } = event.target;
    setField(name, type === "checkbox" ? checked : value);
  }

  function handleBlur(event) {
    const { name } = event.target;
    setTouched((current) => ({ ...current, [name]: true }));
    if (Object.values(REQUIRED_FIELDS).flat().includes(name) && !fieldIsFilled(form[name])) {
      setErrors((current) => ({ ...current, [name]: "Champ requis." }));
    }
  }

  function handlePaymentMethodToggle(method) {
    const selected = Array.isArray(form.payment_methods) ? form.payment_methods : [];
    const next = selected.includes(method) ? selected.filter((item) => item !== method) : [...selected, method];
    setField("payment_methods", next);
  }

  function validateSection(sectionId) {
    const nextErrors = {};
    const nextTouched = {};
    (REQUIRED_FIELDS[sectionId] || []).forEach((field) => {
      nextTouched[field] = true;
      if (!fieldIsFilled(form[field])) nextErrors[field] = "Champ requis.";
    });

    const session = Number(form.session_timeout_minutes || 0);
    const tax = Number(form.tax_rate || 0);
    const rooms = Number(form.total_rooms || 0);
    if (sectionId === "general" && rooms < 1) nextErrors.total_rooms = "Minimum 1 chambre.";
    if (sectionId === "billing" && (tax < 0 || tax > 100)) nextErrors.tax_rate = "Le taux doit être entre 0 et 100.";
    if (sectionId === "security" && (session < 5 || session > 480)) nextErrors.session_timeout_minutes = "Entre 5 et 480 minutes.";
    if (sectionId === "appearance" && !/^#[0-9a-fA-F]{6}$/.test(form.primary_color || "")) {
      nextErrors.primary_color = "Format attendu : #RRGGBB.";
    }

    setTouched((current) => ({ ...current, ...nextTouched }));
    setErrors((current) => ({ ...current, ...nextErrors }));
    return nextErrors;
  }

  function acceptLogoFile(file) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/svg+xml"].includes(file.type)) {
      setErrors((current) => ({ ...current, logo: "Format accepté : PNG, JPEG ou SVG." }));
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      setErrors((current) => ({ ...current, logo: "Le logo ne doit pas dépasser 2MB." }));
      return;
    }
    setLogoFile(file);
    setRemoveLogo(false);
    setLogoPreviewUrl((previousUrl) => {
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      return URL.createObjectURL(file);
    });
    setErrors((current) => ({ ...current, logo: null }));
  }

  function handleLogoInput(event) {
    acceptLogoFile(event.target.files?.[0]);
  }

  function handleLogoDrop(event) {
    event.preventDefault();
    if (!isDisabled) acceptLogoFile(event.dataTransfer.files?.[0]);
  }

  function removeSelectedLogo() {
    setLogoFile(null);
    setRemoveLogo(true);
    setLogoPreviewUrl((previousUrl) => {
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      return "";
    });
    if (logoInputRef.current) logoInputRef.current.value = "";
  }

  async function saveActiveSection() {
    if (!canManageSettings) return;
    const sectionErrors = validateSection(activeSection);
    if (Object.keys(sectionErrors).length) {
      setStatus({ error: "Merci de corriger les champs signalés.", success: "" });
      return;
    }

    setSaving(true);
    setStatus({ error: "", success: "" });
    try {
      const payload = sectionPayload(form, activeSection);
      let saved;
      if (activeSection === "appearance" && (logoFile || removeLogo)) {
        const formData = new FormData();
        appendFormData(formData, payload);
        if (logoFile) formData.append("logo", logoFile);
        if (removeLogo) formData.append("logo", "");
        saved = await updateHotelSettings(formData);
      } else {
        saved = await updateHotelSettings(payload);
      }
      const normalized = normalizeSettings(saved);
      setForm(normalized);
      setInitialForm(normalized);
      setLogoFile(null);
      setRemoveLogo(false);
      setLogoPreviewUrl((previousUrl) => {
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        return "";
      });
      setStatus({ error: "", success: "Paramètres enregistrés" });
    } catch (error) {
      setErrors(error.payload || {});
      setStatus({ error: flattenApiErrors(error.payload) || error.message || "Enregistrement impossible.", success: "" });
    } finally {
      setSaving(false);
    }
  }

  function submitPage(event) {
    event.preventDefault();
    saveActiveSection();
  }

  function handleNavClick(sectionId) {
    if (sectionId === activeSection) return;
    const currentIndex = SECTION_ORDER.indexOf(activeSection);
    const nextIndex = SECTION_ORDER.indexOf(sectionId);
    setDirection(nextIndex > currentIndex ? 1 : -1);
    setActiveSection(sectionId);
  }

  function renderGeneral() {
    return (
      <>
        <SettingsCard icon="building" title="Informations commerciales" badge="Requis">
          <div className="settings-form-grid">
            <SettingsField label="Nom affiché de l'hôtel" name="hotel_name_display" error={errors.hotel_name_display} touched={touched.hotel_name_display}>
              <TextInput form={form} name="hotel_name_display" disabled={isDisabled} onChange={handleChange} onBlur={handleBlur} />
            </SettingsField>
            <SettingsField label="Adresse" name="address" error={errors.address} touched={touched.address}>
              <TextInput form={form} name="address" disabled={isDisabled} onChange={handleChange} onBlur={handleBlur} />
            </SettingsField>
            <SettingsField label="Téléphone" name="phone" error={errors.phone} touched={touched.phone}>
              <TextInput form={form} name="phone" disabled={isDisabled} onChange={handleChange} onBlur={handleBlur} />
            </SettingsField>
            <SettingsField label="Email" name="email" error={errors.email} touched={touched.email}>
              <TextInput form={form} name="email" type="email" disabled={isDisabled} onChange={handleChange} onBlur={handleBlur} />
            </SettingsField>
          </div>
        </SettingsCard>

        <SettingsCard icon="world" tone="green" title="Localisation & devise" badge="Requis">
          <div className="settings-form-grid">
            <SettingsField label="Devise" name="currency" error={errors.currency} touched={touched.currency}>
              <SelectInput form={form} name="currency" options={options.currencies} disabled={isDisabled} onChange={handleChange} onBlur={handleBlur} />
            </SettingsField>
            <SettingsField label="Fuseau horaire" name="timezone" error={errors.timezone} touched={touched.timezone}>
              <SelectInput form={form} name="timezone" options={options.timezones} disabled={isDisabled} onChange={handleChange} onBlur={handleBlur} />
            </SettingsField>
            <SettingsField label="Capacité totale de chambres" name="total_rooms" hint="Utilisé pour le calcul du taux d'occupation." error={errors.total_rooms} touched={touched.total_rooms}>
              <TextInput form={form} name="total_rooms" type="number" min="1" disabled={isDisabled} onChange={handleChange} onBlur={handleBlur} />
            </SettingsField>
          </div>
        </SettingsCard>
      </>
    );
  }

  function renderReservations() {
    return (
      <>
        <SettingsCard icon="clock" title="Horaires de séjour" badge="Requis">
          <div className="settings-form-grid">
            <SettingsField label="Heure check-in" name="checkin_time" error={errors.checkin_time} touched={touched.checkin_time}>
              <TextInput form={form} name="checkin_time" type="time" disabled={isDisabled} onChange={handleChange} onBlur={handleBlur} />
            </SettingsField>
            <SettingsField label="Heure check-out" name="checkout_time" error={errors.checkout_time} touched={touched.checkout_time}>
              <TextInput form={form} name="checkout_time" type="time" disabled={isDisabled} onChange={handleChange} onBlur={handleBlur} />
            </SettingsField>
            <SettingsField label="Durée de grâce" name="grace_period_minutes" error={errors.grace_period_minutes} touched={touched.grace_period_minutes}>
              <TextInput form={form} name="grace_period_minutes" type="number" min="0" disabled={isDisabled} onChange={handleChange} onBlur={handleBlur} />
            </SettingsField>
          </div>
        </SettingsCard>

        <SettingsCard icon="file-description" tone="purple" title="Politiques">
          <div className="settings-form-grid">
            <SettingsField label="Politique no-show" name="no_show_policy" error={errors.no_show_policy} touched={touched.no_show_policy}>
              <SelectInput form={form} name="no_show_policy" options={options.no_show_policies} disabled={isDisabled} onChange={handleChange} onBlur={handleBlur} />
            </SettingsField>
            <SettingsField label="Politique d'annulation" name="cancellation_policy" error={errors.cancellation_policy} touched={touched.cancellation_policy}>
              <SelectInput form={form} name="cancellation_policy" options={options.cancellation_policies} disabled={isDisabled} onChange={handleChange} onBlur={handleBlur} />
            </SettingsField>
          </div>
        </SettingsCard>

        <SettingsCard icon="coin" tone="orange" title="Garantie">
          <div className="settings-toggle-grid">
            <Toggle label="Acompte obligatoire" name="deposit_required" checked={form.deposit_required} disabled={isDisabled} onChange={handleChange} />
          </div>
        </SettingsCard>
      </>
    );
  }

  function renderBilling() {
    const selected = Array.isArray(form.payment_methods) ? form.payment_methods : [];
    return (
      <>
        <SettingsCard icon="receipt" tone="blue" title="Numérotation" badge="Requis">
          <div className="settings-form-grid">
            <SettingsField label="Préfixe facture" name="invoice_prefix" hint="Ex: INV, FACT, FAC" error={errors.invoice_prefix} touched={touched.invoice_prefix}>
              <TextInput form={form} name="invoice_prefix" disabled={isDisabled} onChange={handleChange} onBlur={handleBlur} />
            </SettingsField>
            <SettingsField label="Numéro de départ" name="invoice_start_number" error={errors.invoice_start_number} touched={touched.invoice_start_number}>
              <TextInput form={form} name="invoice_start_number" type="number" min="1" disabled={isDisabled} onChange={handleChange} onBlur={handleBlur} />
            </SettingsField>
            <SettingsField label="Taux de taxe (%)" name="tax_rate" error={errors.tax_rate} touched={touched.tax_rate}>
              <TextInput form={form} name="tax_rate" type="number" min="0" max="100" step="0.01" disabled={isDisabled} onChange={handleChange} onBlur={handleBlur} />
            </SettingsField>
          </div>
        </SettingsCard>

        <SettingsCard icon="credit-card" tone="green" title="Modes de paiement acceptés">
          <div className="settings-payment-grid">
            {options.payment_methods.map((method) => (
              <button
                key={method.value}
                type="button"
                className={`settings-pay-method${selected.includes(method.value) ? " on" : ""}`}
                disabled={isDisabled}
                onClick={() => handlePaymentMethodToggle(method.value)}
              >
                <span>{selected.includes(method.value) ? <Icon name="check" /> : null}</span>
                {method.label}
              </button>
            ))}
          </div>
        </SettingsCard>

        <SettingsCard icon="settings" tone="orange" title="Règles financières">
          <div className="settings-toggle-grid">
            <Toggle label="Autoriser solde négatif" subLabel="Permet de finaliser sans paiement complet" name="allow_negative_balance" checked={form.allow_negative_balance} disabled={isDisabled} onChange={handleChange} />
            <Toggle label="Paiement obligatoire avant checkout" subLabel="Bloque le check-out si solde > 0" name="require_payment_before_checkout" checked={form.require_payment_before_checkout} disabled={isDisabled} onChange={handleChange} />
          </div>
        </SettingsCard>
      </>
    );
  }

  function renderSecurity() {
    return (
      <>
        <SettingsCard icon="lock" tone="red" title="Session" badge="Optionnel">
          <div className="settings-form-grid">
            <SettingsField label="Durée de session" name="session_timeout_minutes" hint={`Actuel : ${Number(form.session_timeout_minutes || 0).toLocaleString("fr-FR")} min. La session expire après cette durée d'inactivité.`} error={errors.session_timeout_minutes} touched={touched.session_timeout_minutes}>
              <TextInput form={form} name="session_timeout_minutes" type="number" min="5" max="480" disabled={isDisabled} onChange={handleChange} onBlur={handleBlur} />
            </SettingsField>
          </div>
        </SettingsCard>

        <SettingsCard icon="shield-check" tone="red" title="Confirmations & traçabilité">
          <div className="settings-toggle-grid">
            <Toggle label="Confirmation avant suppression" subLabel="Demande une confirmation avant toute suppression" name="require_delete_confirmation" checked={form.require_delete_confirmation} disabled={isDisabled} onChange={handleChange} />
            <Toggle label="Journal d'activité activé" subLabel="Enregistre toutes les actions critiques" name="enable_activity_log" checked={form.enable_activity_log} disabled={isDisabled} onChange={handleChange} />
          </div>
        </SettingsCard>
      </>
    );
  }

  function renderAppearance() {
    return (
      <>
        <SettingsCard icon="brush" tone="purple" title="Thème de l'interface">
          <ThemeSelector />
        </SettingsCard>

        <SettingsCard icon="palette" tone="purple" title="Identité visuelle" badge="Optionnel">
          <div className="settings-color-row">
            <span className="settings-color-swatch" style={{ background: form.primary_color || "var(--theme-primary)" }} />
            <SettingsField label="Couleur principale" name="primary_color" error={errors.primary_color} touched={touched.primary_color}>
              <TextInput form={form} name="primary_color" disabled={isDisabled} onChange={handleChange} onBlur={handleBlur} />
            </SettingsField>
            <button type="button" className="settings-secondary-btn" disabled={isDisabled} onClick={() => colorInputRef.current?.click()}>
              Modifier
            </button>
            <input ref={colorInputRef} className="settings-hidden-input" type="color" name="primary_color" value={form.primary_color || "#085041"} onChange={handleChange} />
          </div>
          <div className="settings-form-grid">
            <SettingsField label="Nom commercial affiché" name="hotel_name_display" error={errors.hotel_name_display} touched={touched.hotel_name_display}>
              <TextInput form={form} name="hotel_name_display" disabled={isDisabled} onChange={handleChange} onBlur={handleBlur} />
            </SettingsField>
          </div>
        </SettingsCard>

        <SettingsCard icon="photo" tone="purple" title="Logo">
          <input ref={logoInputRef} className="settings-hidden-input" type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={handleLogoInput} />
          <button
            type="button"
            className="settings-logo-drop"
            disabled={isDisabled}
            onClick={() => logoInputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleLogoDrop}
          >
            {logoSrc ? <img src={logoSrc} alt="" /> : <Icon name="upload" />}
            <span>{logoSrc ? "Cliquer pour remplacer le logo" : "Glisser-déposer ou cliquer pour choisir"}</span>
          </button>
          {errors.logo ? <p className="settings-inline-error">{errors.logo}</p> : null}
          {logoSrc ? (
            <button type="button" className="settings-danger-btn" disabled={isDisabled} onClick={removeSelectedLogo}>Supprimer</button>
          ) : null}
        </SettingsCard>

        <SettingsCard icon="typography" tone="purple" title="Typographie">
          <FontSizeControl />
        </SettingsCard>

        <SettingsCard icon="sparkles" tone="purple" title="Aperçu branding">
          <div className="settings-brand-preview">
            <div className="settings-brand-logo" style={{ background: form.primary_color || "var(--theme-primary)" }}>
              {logoSrc ? <img src={logoSrc} alt="" /> : initials(hotelName)}
            </div>
            <div>
              <strong>{hotelName}</strong>
              <span>{form.currency} · {form.timezone}</span>
            </div>
          </div>
        </SettingsCard>
      </>
    );
  }

  const renderSection = {
    general: renderGeneral,
    reservations: renderReservations,
    billing: renderBilling,
    security: renderSecurity,
    appearance: renderAppearance,
  }[activeSection];

  return (
    <form className="settings-page" onSubmit={submitPage}>
      <header className="settings-page-header">
        <div>
          <span>ADMINISTRATION</span>
          <h1>Paramètres</h1>
          <p>Configuration hôtel, facturation, sécurité et apparence.</p>
        </div>
        <button type="submit" className="settings-save-btn" disabled={!canManageSettings || saving || loading}>
          {saving ? <Icon name="loader-2" /> : <Icon name="device-floppy" />}
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </header>

      <section className="settings-hotel-bar">
        <div className="settings-hotel-logo" style={{ background: form.primary_color || "var(--theme-primary-light)" }}>
          {logoSrc ? <img src={logoSrc} alt="" /> : initials(hotelName)}
        </div>
        <div>
          <strong>{hotelName}</strong>
          <span>{form.hotel_name || "Workspace hôtel"}</span>
        </div>
        <span className={`settings-completion ${completion === 100 ? "done" : "pending"}`}>{completion}% configuré</span>
      </section>

      {loading ? <div className="settings-skeleton">Chargement des paramètres...</div> : null}
      {!canManageSettings ? <div className="settings-toast">Lecture seule. Seul l'administrateur de l'hôtel peut modifier ces paramètres.</div> : null}

      {!loading ? (
        <div className="settings-main-layout">
          <nav className="settings-vertical-nav" aria-label="Sections paramètres">
            {NAV_ITEMS.map((item) => (
              <div key={item.id} className={item.afterDivider ? "settings-nav-block" : undefined}>
                <motion.button
                  type="button"
                  className={`settings-nav-item${activeSection === item.id ? " on" : ""}`}
                  onClick={() => handleNavClick(item.id)}
                  animate={{ backgroundColor: activeSection === item.id ? "var(--theme-primary-light)" : "rgba(0, 0, 0, 0)" }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.15, ease: "easeOut" }}
                >
                  <motion.span
                    className="settings-nav-icon"
                    animate={{ scale: activeSection === item.id && !shouldReduceMotion ? [1, 1.08, 1] : 1 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                  >
                    <Icon name={item.icon} />
                  </motion.span>
                  <span className="settings-nav-label">{item.label}</span>
                  <span className="settings-nav-state">
                    {sectionIsValid(item.id, form) ? <Icon name="circle-check" /> : item.order}
                  </span>
                </motion.button>
              </div>
            ))}
          </nav>

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={activeSection}
              className="settings-section-stack"
              custom={direction}
              variants={sectionVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              {renderSection?.()}
            </motion.div>
          </AnimatePresence>
        </div>
      ) : null}
    </form>
  );
}
