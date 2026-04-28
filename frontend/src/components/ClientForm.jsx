import { useEffect, useMemo, useRef, useState } from "react";

import { AppSelect } from "./AppSelect";
import { DatePicker } from "./DatePicker";

const initialFormState = {
  first_name: "",
  middle_name: "",
  last_name: "",
  gender: "",
  client_type: "individual",
  marital_status: "",
  date_of_birth: "",
  place_of_birth: "",
  profession: "",
  phone: "",
  secondary_phone: "",
  email: "",
  nationality: "",
  country: "",
  city: "",
  address: "",
  identity_document_type: "",
  identity_document_number: "",
  document_issue_date: "",
  document_expiry_date: "",
  document_issue_place: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  emergency_contact_relationship: "",
  notes: "",
  is_active: true,
};

const genderOptions = [
  { value: "", label: "Non renseigne" },
  { value: "male", label: "Homme" },
  { value: "female", label: "Femme" },
  { value: "other", label: "Autre" },
];

const clientTypeOptions = [
  { value: "individual", label: "Individuel" },
  { value: "company", label: "Entreprise" },
  { value: "vip", label: "VIP" },
  { value: "corporate", label: "Corporate" },
];

const maritalStatusOptions = [
  { value: "", label: "Non renseigne" },
  { value: "single", label: "Celibataire" },
  { value: "married", label: "Marie(e)" },
  { value: "divorced", label: "Divorce(e)" },
  { value: "widowed", label: "Veuf(ve)" },
  { value: "other", label: "Autre" },
];

const identityDocumentOptions = [
  { value: "", label: "Aucun document" },
  { value: "national_id", label: "Carte nationale d'identite" },
  { value: "passport", label: "Passeport" },
  { value: "residence_permit", label: "Titre de sejour" },
  { value: "driver_license", label: "Permis de conduire" },
  { value: "other", label: "Autre" },
];

const fieldOrder = [
  "first_name",
  "middle_name",
  "last_name",
  "phone",
  "secondary_phone",
  "email",
  "date_of_birth",
  "identity_document_type",
  "identity_document_number",
  "document_issue_date",
  "document_expiry_date",
  "nationality",
  "country",
  "city",
  "address",
  "emergency_contact_name",
  "emergency_contact_phone",
  "notes",
];

function normalizeInitialValue(value) {
  if (value === "-" || value === null || value === undefined) {
    return "";
  }
  return value;
}

function FieldGroup({ label, help, error, required = false, className = "", children }) {
  return (
    <label className={`form-field ${className}`.trim()}>
      <span className="form-label">
        {label}
        {required ? (
          <span className="required-mark" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
      </span>
      {children}
      {help ? <span className="form-help">{help}</span> : null}
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}

function FieldSection({ title, description, children }) {
  return (
    <section className="clients-form-section full-width">
      <div className="clients-form-section__header">
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <div className="clients-form-section__grid">{children}</div>
    </section>
  );
}

function ValidationSummary({ items, ready }) {
  return (
    <div className={`validation-summary ${ready ? "ready" : "review"}`}>
      <strong>{ready ? "Formulaire pret a etre enregistre" : "Points a verifier avant enregistrement"}</strong>
      <div className="validation-list">
        {items.map((item) => (
          <div key={item.label} className="validation-item">
            <span className={`validation-dot ${item.tone}`} />
            <div className="validation-copy">
              <span className="validation-label">{item.label}</span>
              <span className="validation-value">{item.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildFormState(initialData) {
  if (!initialData) {
    return initialFormState;
  }

  return {
    first_name: normalizeInitialValue(initialData.first_name),
    middle_name: normalizeInitialValue(initialData.middle_name),
    last_name: normalizeInitialValue(initialData.last_name),
    gender: normalizeInitialValue(initialData.gender),
    client_type: normalizeInitialValue(initialData.client_type) || "individual",
    marital_status: normalizeInitialValue(initialData.marital_status),
    date_of_birth: normalizeInitialValue(initialData.date_of_birth),
    place_of_birth: normalizeInitialValue(initialData.place_of_birth),
    profession: normalizeInitialValue(initialData.profession),
    phone: normalizeInitialValue(initialData.phone),
    secondary_phone: normalizeInitialValue(initialData.secondary_phone),
    email: normalizeInitialValue(initialData.email),
    nationality: normalizeInitialValue(initialData.nationality),
    country: normalizeInitialValue(initialData.country),
    city: normalizeInitialValue(initialData.city),
    address: normalizeInitialValue(initialData.address),
    identity_document_type: normalizeInitialValue(initialData.identity_document_type),
    identity_document_number: normalizeInitialValue(initialData.identity_document_number),
    document_issue_date: normalizeInitialValue(initialData.document_issue_date),
    document_expiry_date: normalizeInitialValue(initialData.document_expiry_date),
    document_issue_place: normalizeInitialValue(initialData.document_issue_place),
    emergency_contact_name: normalizeInitialValue(initialData.emergency_contact_name),
    emergency_contact_phone: normalizeInitialValue(initialData.emergency_contact_phone),
    emergency_contact_relationship: normalizeInitialValue(initialData.emergency_contact_relationship),
    notes: normalizeInitialValue(initialData.notes),
    is_active: initialData.is_active ?? true,
  };
}

function normalizeServerErrors(errors) {
  return Object.fromEntries(
    Object.entries(errors || {}).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
}

function validateForm(form) {
  const errors = {};

  if (!form.first_name.trim()) {
    errors.first_name = "Le prenom est obligatoire.";
  }
  if (!form.last_name.trim()) {
    errors.last_name = "Le nom est obligatoire.";
  }
  if (![form.phone, form.secondary_phone, form.email, form.identity_document_number].some((value) => value.trim())) {
    errors.phone = "Renseigne au moins un telephone, un email ou un numero de piece.";
  }
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = "Adresse email invalide.";
  }
  if (form.secondary_phone.trim() && form.secondary_phone.trim() === form.phone.trim()) {
    errors.secondary_phone = "Le telephone secondaire doit etre different du telephone principal.";
  }
  if (form.identity_document_number.trim() && !form.identity_document_type) {
    errors.identity_document_type = "Le type de piece est obligatoire lorsque le numero est renseigne.";
  }
  if (form.document_issue_date && form.document_expiry_date && form.document_expiry_date <= form.document_issue_date) {
    errors.document_expiry_date = "La date d'expiration doit etre posterieure a la date d'emission.";
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

export function ClientForm({ mode, initialData, submitting, serverErrors, onCancel, onSubmit }) {
  const [form, setForm] = useState(initialFormState);
  const fieldRefs = useRef({});

  useEffect(() => {
    setForm(buildFormState(initialData));
  }, [initialData]);

  const validation = useMemo(() => validateForm(form), [form]);
  const normalizedErrors = useMemo(() => normalizeServerErrors(serverErrors), [serverErrors]);
  const mergedErrors = { ...normalizedErrors, ...validation.errors };

  const summaryItems = useMemo(
    () => [
      {
        label: "Identite",
        value:
          [form.first_name.trim(), form.middle_name.trim(), form.last_name.trim()].filter(Boolean).join(" ") ||
          "Nom complet a renseigner",
        tone: form.first_name.trim() && form.last_name.trim() ? "good" : "warn",
      },
      {
        label: "Profil",
        value: clientTypeOptions.find((item) => item.value === form.client_type)?.label || "Type a confirmer",
        tone: form.client_type ? "good" : "warn",
      },
      {
        label: "Contact",
        value:
          form.phone.trim() ||
          form.secondary_phone.trim() ||
          form.email.trim() ||
          "Au moins un moyen de contact ou une piece est attendu",
        tone: [form.phone, form.secondary_phone, form.email, form.identity_document_number].some((value) => value.trim())
          ? "good"
          : "warn",
      },
      {
        label: "Piece d'identite",
        value:
          form.identity_document_type && form.identity_document_number.trim()
            ? `${identityDocumentOptions.find((item) => item.value === form.identity_document_type)?.label || "Document"} - ${form.identity_document_number}`
            : "Aucune piece renseignée",
        tone: form.identity_document_number.trim() && form.identity_document_type ? "good" : "warn",
      },
      {
        label: "Urgence",
        value: form.emergency_contact_name.trim() || "Contact d'urgence non renseigne",
        tone: form.emergency_contact_name.trim() ? "good" : "warn",
      },
    ],
    [form],
  );

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function focusField(fieldName) {
    const field = fieldRefs.current[fieldName];
    if (field && typeof field.focus === "function") {
      field.focus();
    }
  }

  useEffect(() => {
    const firstServerErrorField = fieldOrder.find((fieldName) => normalizedErrors[fieldName]);
    if (firstServerErrorField) {
      focusField(firstServerErrorField);
    }
  }, [normalizedErrors]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validation.isValid) {
      const firstInvalidField = fieldOrder.find((fieldName) => validation.errors[fieldName]);
      if (firstInvalidField) {
        focusField(firstInvalidField);
      }
      return;
    }
    await onSubmit(form);
  }

  return (
    <form className="form-grid detail-form" onSubmit={handleSubmit}>
      <div className="clients-form-note full-width">
        <strong>{mode === "edit" ? "Mise a jour de la fiche client" : "Creation d'une nouvelle fiche client"}</strong>
        <p>
          La fiche client est structuree en blocs metier pour faciliter la reception, limiter les doublons
          et preparer les futurs modules de sejour, consommation, facturation et satisfaction.
        </p>
      </div>

      <FieldSection
        title="1. Identite"
        description="Informations civiles de base, utiles pour l'accueil, le controle et la recherche client."
      >
        <FieldGroup label="Prenom" help="Prenom principal du client." error={mergedErrors.first_name} required>
          <input
            ref={(element) => {
              fieldRefs.current.first_name = element;
            }}
            className={mergedErrors.first_name ? "is-invalid" : ""}
            aria-invalid={Boolean(mergedErrors.first_name)}
            value={form.first_name}
            onChange={(event) => updateField("first_name", event.target.value)}
            placeholder="Prenom"
          />
        </FieldGroup>

        <FieldGroup label="Autres prenoms" help="Deuxieme prenom ou prenom usuel si necessaire." error={mergedErrors.middle_name}>
          <input
            ref={(element) => {
              fieldRefs.current.middle_name = element;
            }}
            className={mergedErrors.middle_name ? "is-invalid" : ""}
            aria-invalid={Boolean(mergedErrors.middle_name)}
            value={form.middle_name}
            onChange={(event) => updateField("middle_name", event.target.value)}
            placeholder="Autres prenoms"
          />
        </FieldGroup>

        <FieldGroup label="Nom" help="Nom de famille ou nom principal." error={mergedErrors.last_name} required>
          <input
            ref={(element) => {
              fieldRefs.current.last_name = element;
            }}
            className={mergedErrors.last_name ? "is-invalid" : ""}
            aria-invalid={Boolean(mergedErrors.last_name)}
            value={form.last_name}
            onChange={(event) => updateField("last_name", event.target.value)}
            placeholder="Nom"
          />
        </FieldGroup>

        <FieldGroup label="Type de client" help="Permet de distinguer un client standard, VIP ou entreprise.">
          <AppSelect value={form.client_type} onChange={(event) => updateField("client_type", event.target.value)} name="client_type">
            {clientTypeOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </AppSelect>
        </FieldGroup>

        <FieldGroup label="Genre" help="Information optionnelle pour la civilite.">
          <AppSelect value={form.gender} onChange={(event) => updateField("gender", event.target.value)} name="gender">
            {genderOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </AppSelect>
        </FieldGroup>

        <FieldGroup label="Date de naissance" help="Format YYYY-MM-DD." error={mergedErrors.date_of_birth}>
          <DatePicker
            ref={(element) => {
              fieldRefs.current.date_of_birth = element;
            }}
            className={mergedErrors.date_of_birth ? "is-invalid" : ""}
            aria-invalid={Boolean(mergedErrors.date_of_birth)}
            value={form.date_of_birth}
            onChange={(event) => updateField("date_of_birth", event.target.value)}
            name="date_of_birth"
            placeholder="Choisir une date"
          />
        </FieldGroup>

        <FieldGroup label="Lieu de naissance" help="Ville ou localite de naissance." error={mergedErrors.place_of_birth}>
          <input
            ref={(element) => {
              fieldRefs.current.place_of_birth = element;
            }}
            className={mergedErrors.place_of_birth ? "is-invalid" : ""}
            aria-invalid={Boolean(mergedErrors.place_of_birth)}
            value={form.place_of_birth}
            onChange={(event) => updateField("place_of_birth", event.target.value)}
            placeholder="Lieu de naissance"
          />
        </FieldGroup>

        <FieldGroup label="Nationalite" help="Nationalite utile pour l'accueil et les obligations administratives.">
          <input
            ref={(element) => {
              fieldRefs.current.nationality = element;
            }}
            value={form.nationality}
            onChange={(event) => updateField("nationality", event.target.value)}
            placeholder="Nationalite"
          />
        </FieldGroup>

        <FieldGroup label="Situation matrimoniale" help="Optionnel, utile pour certaines fiches administratives.">
          <AppSelect value={form.marital_status} onChange={(event) => updateField("marital_status", event.target.value)} name="marital_status">
            {maritalStatusOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </AppSelect>
        </FieldGroup>

        <FieldGroup label="Profession" help="Profession ou activite principale du client.">
          <input
            value={form.profession}
            onChange={(event) => updateField("profession", event.target.value)}
            placeholder="Profession"
          />
        </FieldGroup>
      </FieldSection>

      <FieldSection
        title="2. Coordonnees"
        description="Coordonnees utiles pour la confirmation des sejours, la communication et la prevention des doublons."
      >
        <FieldGroup
          label="Telephone principal"
          help="Au moins un telephone, un email ou une piece doit etre renseigne."
          error={mergedErrors.phone}
        >
          <input
            ref={(element) => {
              fieldRefs.current.phone = element;
            }}
            className={mergedErrors.phone ? "is-invalid" : ""}
            aria-invalid={Boolean(mergedErrors.phone)}
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            placeholder="Telephone principal"
          />
        </FieldGroup>

        <FieldGroup label="Telephone secondaire" help="Numero alternatif si disponible." error={mergedErrors.secondary_phone}>
          <input
            ref={(element) => {
              fieldRefs.current.secondary_phone = element;
            }}
            className={mergedErrors.secondary_phone ? "is-invalid" : ""}
            aria-invalid={Boolean(mergedErrors.secondary_phone)}
            value={form.secondary_phone}
            onChange={(event) => updateField("secondary_phone", event.target.value)}
            placeholder="Telephone secondaire"
          />
        </FieldGroup>

        <FieldGroup label="Email" help="Adresse email du client, si disponible." error={mergedErrors.email}>
          <input
            ref={(element) => {
              fieldRefs.current.email = element;
            }}
            className={mergedErrors.email ? "is-invalid" : ""}
            aria-invalid={Boolean(mergedErrors.email)}
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            placeholder="Email"
          />
        </FieldGroup>

        <FieldGroup label="Ville" help="Ville de residence ou de facturation.">
          <input
            ref={(element) => {
              fieldRefs.current.city = element;
            }}
            value={form.city}
            onChange={(event) => updateField("city", event.target.value)}
            placeholder="Ville"
          />
        </FieldGroup>

        <FieldGroup label="Pays" help="Pays de residence ou de rattachement.">
          <input
            ref={(element) => {
              fieldRefs.current.country = element;
            }}
            value={form.country}
            onChange={(event) => updateField("country", event.target.value)}
            placeholder="Pays"
          />
        </FieldGroup>

        <FieldGroup label="Actif" help="Permet de desactiver une fiche sans la supprimer.">
          <AppSelect value={form.is_active ? "true" : "false"} onChange={(event) => updateField("is_active", event.target.value === "true")} name="is_active">
            <option value="true">Actif</option>
            <option value="false">Inactif</option>
          </AppSelect>
        </FieldGroup>

        <FieldGroup label="Adresse" help="Adresse complete ou principale du client." className="full-width" error={mergedErrors.address}>
          <textarea
            ref={(element) => {
              fieldRefs.current.address = element;
            }}
            className={mergedErrors.address ? "is-invalid" : ""}
            aria-invalid={Boolean(mergedErrors.address)}
            value={form.address}
            onChange={(event) => updateField("address", event.target.value)}
            placeholder="Adresse"
          />
        </FieldGroup>
      </FieldSection>

      <FieldSection
        title="3. Piece d'identite"
        description="Informations documentaires optionnelles mais importantes pour le controle d'identite et les obligations hotelieres."
      >
        <FieldGroup label="Type de piece" help="Le type est requis si un numero de piece est saisi." error={mergedErrors.identity_document_type}>
          <AppSelect
            ref={(element) => {
              fieldRefs.current.identity_document_type = element;
            }}
            aria-invalid={Boolean(mergedErrors.identity_document_type)}
            value={form.identity_document_type}
            onChange={(event) => updateField("identity_document_type", event.target.value)}
            name="identity_document_type"
            invalid={Boolean(mergedErrors.identity_document_type)}
          >
            {identityDocumentOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </AppSelect>
        </FieldGroup>

        <FieldGroup label="Numero de piece" help="Le controle anti-doublon fort reste applique sur ce champ." error={mergedErrors.identity_document_number}>
          <input
            ref={(element) => {
              fieldRefs.current.identity_document_number = element;
            }}
            className={mergedErrors.identity_document_number ? "is-invalid" : ""}
            aria-invalid={Boolean(mergedErrors.identity_document_number)}
            value={form.identity_document_number}
            onChange={(event) => updateField("identity_document_number", event.target.value)}
            placeholder="Numero de piece"
          />
        </FieldGroup>

        <FieldGroup label="Date d'emission" help="Date de delivrance du document." error={mergedErrors.document_issue_date}>
          <DatePicker
            ref={(element) => {
              fieldRefs.current.document_issue_date = element;
            }}
            className={mergedErrors.document_issue_date ? "is-invalid" : ""}
            aria-invalid={Boolean(mergedErrors.document_issue_date)}
            value={form.document_issue_date}
            onChange={(event) => updateField("document_issue_date", event.target.value)}
            name="document_issue_date"
            placeholder="Choisir une date"
          />
        </FieldGroup>

        <FieldGroup label="Date d'expiration" help="Doit etre posterieure a la date d'emission." error={mergedErrors.document_expiry_date}>
          <DatePicker
            ref={(element) => {
              fieldRefs.current.document_expiry_date = element;
            }}
            className={mergedErrors.document_expiry_date ? "is-invalid" : ""}
            aria-invalid={Boolean(mergedErrors.document_expiry_date)}
            value={form.document_expiry_date}
            onChange={(event) => updateField("document_expiry_date", event.target.value)}
            name="document_expiry_date"
            minDate={form.document_issue_date}
            placeholder="Choisir une date"
          />
        </FieldGroup>

        <FieldGroup label="Lieu d'emission" help="Autorite ou lieu de delivrance du document." className="full-width">
          <input
            value={form.document_issue_place}
            onChange={(event) => updateField("document_issue_place", event.target.value)}
            placeholder="Lieu d'emission"
          />
        </FieldGroup>
      </FieldSection>

      <FieldSection
        title="4. Contact d'urgence"
        description="Informations utiles en cas d'incident ou de besoin de coordination pendant le sejour."
      >
        <FieldGroup label="Nom du contact" help="Personne a prevenir si necessaire." error={mergedErrors.emergency_contact_name}>
          <input
            ref={(element) => {
              fieldRefs.current.emergency_contact_name = element;
            }}
            className={mergedErrors.emergency_contact_name ? "is-invalid" : ""}
            aria-invalid={Boolean(mergedErrors.emergency_contact_name)}
            value={form.emergency_contact_name}
            onChange={(event) => updateField("emergency_contact_name", event.target.value)}
            placeholder="Nom du contact"
          />
        </FieldGroup>

        <FieldGroup label="Telephone d'urgence" help="Numero de contact d'urgence." error={mergedErrors.emergency_contact_phone}>
          <input
            ref={(element) => {
              fieldRefs.current.emergency_contact_phone = element;
            }}
            className={mergedErrors.emergency_contact_phone ? "is-invalid" : ""}
            aria-invalid={Boolean(mergedErrors.emergency_contact_phone)}
            value={form.emergency_contact_phone}
            onChange={(event) => updateField("emergency_contact_phone", event.target.value)}
            placeholder="Telephone d'urgence"
          />
        </FieldGroup>

        <FieldGroup label="Lien avec le client" help="Ex. parent, conjoint, collegue.">
          <input
            value={form.emergency_contact_relationship}
            onChange={(event) => updateField("emergency_contact_relationship", event.target.value)}
            placeholder="Lien avec le client"
          />
        </FieldGroup>
      </FieldSection>

      <FieldSection
        title="5. Informations complementaires"
        description="Zone libre pour les preferences, remarques d'accueil ou informations utiles aux futurs modules."
      >
        <FieldGroup label="Notes" help="Informations utiles pour l'accueil ou le suivi interne." className="full-width" error={mergedErrors.notes}>
          <textarea
            ref={(element) => {
              fieldRefs.current.notes = element;
            }}
            className={mergedErrors.notes ? "is-invalid" : ""}
            aria-invalid={Boolean(mergedErrors.notes)}
            value={form.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            placeholder="Notes internes"
          />
        </FieldGroup>
      </FieldSection>

      {mergedErrors.non_field_errors ? (
        <div className="alert-box full-width">
          {Array.isArray(mergedErrors.non_field_errors)
            ? mergedErrors.non_field_errors.join(" ")
            : mergedErrors.non_field_errors}
        </div>
      ) : null}

      <ValidationSummary items={summaryItems} ready={validation.isValid} />

      <div className="action-row full-width">
        <button type="submit" className="primary-button" disabled={submitting || !validation.isValid}>
          {submitting ? "Enregistrement..." : mode === "edit" ? "Mettre a jour le client" : "Creer le client"}
        </button>
        <button type="button" className="secondary-button" onClick={onCancel} disabled={submitting}>
          Annuler
        </button>
      </div>
    </form>
  );
}
