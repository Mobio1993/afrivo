import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { fetchJson, postJson } from "../../api/client";
import { AppSelect } from "../../components/AppSelect";
import { DatePicker } from "../../components/DatePicker";
import { DateTimePicker } from "../../components/DateTimePicker";
import "./OperationDetailPage.css";

const endpointMap = {
  bookings: "/api/operations/bookings/",
  stays: "/api/operations/stays/",
  "day-uses": "/api/operations/day-uses/",
  payments: "/api/operations/payments/",
};

function toDateTimeLocal(value) {
  if (!value || value === "-") {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (item) => String(item).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function EmptyStateCard({ title, description }) {
  return (
    <div className="empty-state-card">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function FieldGroup({ label, help, error, className = "", children }) {
  return (
    <label className={`form-field ${className}`.trim()}>
      <span className="form-label">{label}</span>
      {children}
      {help ? <span className="form-help">{help}</span> : null}
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}

function ValidationSummary({ title, items, ready }) {
  return (
    <div className={`validation-summary ${ready ? "ready" : "review"}`}>
      <strong>{title}</strong>
      <div className="validation-list">
        {items.map((item) => (
          <div key={item.label} className="validation-item">
            <span className={`validation-dot ${item.tone || "neutral"}`} />
            <div>
              <span className="validation-label">{item.label}</span>
              <span className="validation-value">{item.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getRequestError(error, fallback) {
  return (
    error.payload?.detail ||
    Object.values(error.payload?.errors || {}).flat()[0] ||
    error.message ||
    fallback
  );
}

function getActionConfirmation(action) {
  if (!action?.endpoint) {
    return "";
  }

  if (action.endpoint.endsWith("/confirm/")) {
    return "Confirmer cette reservation ? Elle passera en statut confirme et pourra etre prise en charge pour le check-in.";
  }
  if (action.endpoint.endsWith("/cancel/") && action.endpoint.includes("/bookings/")) {
    return "Annuler cette reservation ? Cette action interrompt sa prise en charge operationnelle.";
  }
  if (action.endpoint.endsWith("/refund/")) {
    return "Confirmer le remboursement de ce paiement ? Cette action modifie son statut financier.";
  }
  if (action.endpoint.endsWith("/cancel/") && action.endpoint.includes("/payments/")) {
    return "Annuler ce paiement ? Cette operation doit etre reservee aux encaissements saisis par erreur.";
  }
  if (action.endpoint.endsWith("/check-in/")) {
    return "Confirmer cette entree ? La transition mettra a jour immediatement le flux en exploitation.";
  }
  if (action.endpoint.endsWith("/check-out/")) {
    return "Confirmer cette sortie ? La transition cloturera le flux en cours.";
  }
  if (action.endpoint.endsWith("/complete-cleaning/")) {
    return "Confirmer la fin du nettoyage ? La chambre sera remise disponible dans l'inventaire.";
  }
  return "";
}

function getWorkflowConfirmation(workflowType) {
  if (workflowType === "booking_check_in") {
    return "Confirmer ce check-in guide ? Un sejour sera cree a partir de cette reservation.";
  }
  return "";
}

function validateEditForm(entityType, form) {
  const errors = {};

  if (entityType === "bookings") {
    if (!form.check_in_date) {
      errors.check_in_date = "Renseigne la date d'arrivee.";
    }
    if (!form.check_out_date) {
      errors.check_out_date = "Renseigne la date de depart.";
    }
    if (form.check_in_date && form.check_out_date && form.check_out_date <= form.check_in_date) {
      errors.check_out_date = "La date de depart doit etre posterieure a l'arrivee.";
    }
    if (Number(form.adults) < 1) {
      errors.adults = "Au moins un adulte est requis.";
    }
    if (Number(form.children) < 0) {
      errors.children = "Le nombre d'enfants ne peut pas etre negatif.";
    }
  }

  if (entityType === "stays") {
    if (!form.planned_check_out) {
      errors.planned_check_out = "Renseigne la date de depart attendue.";
    }
    if (Number(form.adults_count || form.adults) < 1) {
      errors.adults_count = "Au moins un adulte est requis.";
    }
    if (Number(form.children_count || form.children) < 0) {
      errors.children_count = "Le nombre d'enfants ne peut pas etre negatif.";
    }
  }

  if (entityType === "day-uses") {
    if (!form.room_id) {
      errors.room_id = "Selectionne la chambre concernee.";
    }
    if (form.package_price === "" || Number(form.package_price) < 0) {
      errors.package_price = "Renseigne une formule valide.";
    }
    if (!form.planned_entry_at) {
      errors.planned_entry_at = "Renseigne l'heure d'entree prevue.";
    }
    if (form.overtime_fee !== "" && Number(form.overtime_fee) < 0) {
      errors.overtime_fee = "Le supplement doit rester positif.";
    }
  }

  if (entityType === "payments") {
    if (!form.status) {
      errors.status = "Selectionne un statut.";
    }
    if (!form.method) {
      errors.method = "Selectionne un mode de paiement.";
    }
    if (form.amount === "" || Number(form.amount) <= 0) {
      errors.amount = "Le montant doit etre strictement positif.";
    }
    if (!form.paid_at) {
      errors.paid_at = "Renseigne la date et l'heure du paiement.";
    }
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

function validateRelatedPaymentForm(form) {
  const errors = {};
  if (!form.status) {
    errors.status = "Selectionne un statut.";
  }
  if (!form.method) {
    errors.method = "Selectionne un mode de paiement.";
  }
  if (form.amount === "" || Number(form.amount) <= 0) {
    errors.amount = "Le montant doit etre strictement positif.";
  }
  if (!form.paid_at) {
    errors.paid_at = "Renseigne la date et l'heure du paiement.";
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}

function validateWorkflowForm(workflowType, form) {
  const errors = {};
  if (workflowType === "booking_check_in" && !form.room_id) {
    errors.room_id = "Choisis la chambre a affecter avant de lancer le check-in.";
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}

export function OperationDetailPage() {
  const { entityType, entityId } = useParams();
  const [detail, setDetail] = useState(null);
  const [choices, setChoices] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [paymentForm, setPaymentForm] = useState({});
  const [workflowForms, setWorkflowForms] = useState({});
  const [status, setStatus] = useState({ loading: true, error: "", warning: "", success: "" });

  const [submitting, setSubmitting] = useState(false);

  const endpoint = useMemo(() => {
    const base = endpointMap[entityType];
    return base ? `${base}${entityId}/` : "";
  }, [entityId, entityType]);

  const editValidation = useMemo(() => validateEditForm(entityType, editForm), [editForm, entityType]);
  const relatedPaymentValidation = useMemo(() => validateRelatedPaymentForm(paymentForm), [paymentForm]);
  const workflowValidations = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(workflowForms).map(([type, fields]) => [type, validateWorkflowForm(type, fields || {})]),
      ),
    [workflowForms],
  );

  const editSummary = useMemo(() => {
    if (entityType === "bookings") {
      return [
        {
          label: "Periode",
          value: editForm.check_in_date && editForm.check_out_date ? `${editForm.check_in_date} au ${editForm.check_out_date}` : "Dates a completer",
          tone: editForm.check_in_date && editForm.check_out_date && !editValidation.errors.check_out_date ? "good" : "warn",
        },
        {
          label: "Occupation",
          value: `${editForm.adults || 0} adulte(s) / ${editForm.children || 0} enfant(s)`,
          tone: Number(editForm.adults) >= 1 ? "good" : "warn",
        },
        {
          label: "Hebergement",
          value: editForm.room_id ? "Chambre affectee" : "Chambre encore libre",
          tone: editForm.room_id ? "good" : "neutral",
        },
      ];
    }
    if (entityType === "stays") {
      return [
        {
          label: "Depart attendu",
          value: editForm.planned_check_out || "A preciser",
          tone: editForm.planned_check_out ? "good" : "warn",
        },
        {
          label: "Occupation",
          value: `${editForm.adults_count || editForm.adults || 0} adulte(s) / ${editForm.children_count || editForm.children || 0} enfant(s)`,
          tone: Number(editForm.adults_count || editForm.adults) >= 1 ? "good" : "warn",
        },
        {
          label: "Notes",
          value: editForm.notes ? "Notes renseignees" : "Aucune note complementaire",
          tone: editForm.notes ? "good" : "neutral",
        },
      ];
    }
    if (entityType === "day-uses") {
      return [
        {
          label: "Chambre",
          value: editForm.room_id ? "Chambre selectionnee" : "A preciser",
          tone: editForm.room_id ? "good" : "warn",
        },
        {
          label: "Formule",
          value: editForm.package_price ? `${editForm.package_price}` : "A renseigner",
          tone: editForm.package_price ? "good" : "warn",
        },
        {
          label: "Entree prevue",
          value: toDateTimeLocal(editForm.planned_entry_at) || "Horaire a completer",
          tone: editForm.planned_entry_at ? "good" : "warn",
        },
      ];
    }
    return [
      {
        label: "Statut, type et mode",
        value:
          editForm.status && editForm.method
            ? `${editForm.status} - ${editForm.payment_type || "partial"} - ${editForm.method}`
            : "A completer",
        tone: editForm.status && editForm.method ? "good" : "warn",
      },
      {
        label: "Montant",
        value: editForm.amount ? `${editForm.amount}` : "A renseigner",
        tone: editForm.amount && Number(editForm.amount) > 0 ? "good" : "warn",
      },
      {
        label: "Horodatage",
        value: toDateTimeLocal(editForm.paid_at) || "A completer",
        tone: editForm.paid_at ? "good" : "warn",
      },
    ];
  }, [editForm, editValidation.errors.check_out_date, entityType]);

  const relatedPaymentSummary = useMemo(
    () => [
      {
        label: "Statut, type et mode",
        value:
          paymentForm.status && paymentForm.method
            ? `${paymentForm.status} - ${paymentForm.payment_type || "partial"} - ${paymentForm.method}`
            : "A completer",
        tone: paymentForm.status && paymentForm.method ? "good" : "warn",
      },
      {
        label: "Montant",
        value: paymentForm.amount ? `${paymentForm.amount}` : "A renseigner",
        tone: paymentForm.amount && Number(paymentForm.amount) > 0 ? "good" : "warn",
      },
      {
        label: "Horodatage",
        value: paymentForm.paid_at || "A completer",
        tone: paymentForm.paid_at ? "good" : "warn",
      },
    ],
    [paymentForm],
  );

  async function loadEntityData() {
    const payload = await fetchJson(endpoint);
    setDetail(payload);
    setEditForm(payload.edit_form?.fields || {});
    setPaymentForm(payload.payment_form?.fields || {});
    setWorkflowForms(
      Object.fromEntries((payload.workflow_forms || []).map((item) => [item.type, item.fields || {}])),
    );
  }

  async function loadDetail() {
    if (!endpoint) {
      setStatus({ loading: false, error: "Type de fiche inconnu.", warning: "", success: "" });
      return;
    }

    const [payload, choicesPayload] = await Promise.all([
      fetchJson(endpoint),
      fetchJson("/api/operations/choices/"),
    ]);
    setDetail(payload);
    setChoices(choicesPayload);
    setEditForm(payload.edit_form?.fields || {});
    setPaymentForm(payload.payment_form?.fields || {});
    setWorkflowForms(
      Object.fromEntries((payload.workflow_forms || []).map((item) => [item.type, item.fields || {}])),
    );
  }

  useEffect(() => {
    setStatus({ loading: true, error: "", warning: "", success: "" });
    loadDetail()
      .catch((error) => {
        setStatus({
          loading: false,
          error: error.payload?.detail || error.message || "Impossible de charger la fiche detaillee.",
          warning: "",
          success: "",
        });
      })
      .finally(() => {
        setStatus((current) => ({ ...current, loading: false }));
      });
  }, [endpoint]);

  async function handleAction(action) {
    if (!action?.endpoint) {
      return;
    }

    const confirmationMessage = getActionConfirmation(action);
    if (confirmationMessage && !window.confirm(confirmationMessage)) {
      return;
    }

    setSubmitting(true);
    setStatus({ loading: false, error: "", warning: "", success: "" });
    try {
      const payload = await postJson(action.endpoint, {});
      setStatus({
        loading: false,
        error: "",
        warning: "",
        success: payload.message || "Action executee avec succes.",
      });
      await loadEntityData();
    } catch (error) {
      setStatus({
        loading: false,
        error: getRequestError(error, "Action impossible."),
        warning: "",
        success: "",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFormSubmit(event, actionEndpoint, body, successLabel, confirmationMessage = "", validation = { isValid: true }) {
    event.preventDefault();
    if (!validation.isValid) {
      setStatus({
        loading: false,
        error: "Le formulaire n'est pas encore pret a etre enregistre. Verifie les champs signales ci-dessous.",
        warning: "",
        success: "",
      });
      return;
    }
    if (confirmationMessage && !window.confirm(confirmationMessage)) {
      return;
    }

    setSubmitting(true);
    setStatus({ loading: false, error: "", warning: "", success: "" });
    try {
      const payload = await postJson(actionEndpoint, body);
      setStatus({
        loading: false,
        error: "",
        warning: "",
        success: payload.message || successLabel,
      });
      await loadEntityData();
    } catch (error) {
      setStatus({
        loading: false,
        error: getRequestError(error, "Enregistrement impossible."),
        warning: "",
        success: "",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (status.loading) {
    return <div className="status-box">Chargement de la fiche detaillee...</div>;
  }

  if (status.error && !detail) {
    return <div className="alert-box">{status.error}</div>;
  }

  if (!detail) {
    return <div className="empty-note">Aucune donnee detaillee disponible.</div>;
  }

  return (
    <div className="page-stack dashboard-shell operation-detail-page">
      <section className="dashboard-hero dashboard-hero-modern detail-hero detail-hero-modern">
        <div className="section-head">
          <div>
            <span className="eyebrow">Fiche detail</span>
            <h2>{detail.title}</h2>
            <p>{detail.subtitle}</p>
          </div>
          <div className="detail-status">{detail.status}</div>
        </div>

        <div className="detail-actions">
          <Link className="ghost-button light" to="/operations">
            Retour aux operations
          </Link>
          {(detail.context_actions || []).map((action) =>
            action.kind === "link" ? (
              <Link key={action.label} className={`secondary-button ${action.variant === "danger" ? "danger" : ""}`} to={action.path}>
                {action.label}
              </Link>
            ) : (
              <button
                key={action.label}
                type="button"
                className={`${action.variant === "primary" ? "primary-button" : "secondary-button"} ${action.variant === "danger" ? "danger" : ""}`}
                disabled={!action.enabled || submitting}
                onClick={() => handleAction(action)}
              >
                {submitting ? "En cours…" : action.label}
              </button>
            ),
          )}
        </div>
      </section>

      {status.error ? <div className="alert-box">{status.error}</div> : null}
      {status.warning ? <div className="warning-box">{status.warning}</div> : null}
      {status.success ? <div className="success-box">{status.success}</div> : null}

      <section className="card-grid dashboard-kpi-grid">
        {(detail.summary_cards || []).map((card) => (
          <article key={card.label} className="info-card dashboard-kpi-card">
            <span className="dashboard-card-label">{card.label}</span>
            <div className="metric dashboard-kpi-value">{card.value}</div>
            <p>{card.meta}</p>
          </article>
        ))}
      </section>

      <section className="dashboard-columns">
        <section className="list-panel dashboard-panel detail-sections">
          {detail.edit_form ? (
            <div className="detail-block detail-edit-block">
              <div className="panel-head">
                <div>
                  <h3>{detail.edit_form.title}</h3>
                  <p>Met a jour les informations de reference sans quitter le contexte operationnel de cette fiche.</p>
                </div>
              </div>
              <form
                className="form-grid detail-form"
                onSubmit={(event) => handleFormSubmit(event, detail.edit_form.endpoint, editForm, "Fiche mise a jour avec succes.", "", editValidation)}
              >
                {entityType === "bookings" ? (
                  <>
                    <FieldGroup label="Chambre" help="L'affectation peut rester ouverte si elle sera decidee plus tard.">
                      <AppSelect value={editForm.room_id || ""} onChange={(event) => setEditForm((current) => ({ ...current, room_id: event.target.value }))} name="edit_room_id">
                        <option value="">Choisir une chambre</option>
                        {(choices?.rooms || []).map((item) => (
                          <option key={item.id} value={item.id}>{item.label}</option>
                        ))}
                      </AppSelect>
                    </FieldGroup>
                    <FieldGroup label="Source" help="La source reste utile pour le suivi commercial.">
                      <AppSelect value={editForm.source || ""} onChange={(event) => setEditForm((current) => ({ ...current, source: event.target.value }))} name="edit_source">
                        {(choices?.booking_sources || []).map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </AppSelect>
                    </FieldGroup>
                    <FieldGroup label="Arrivee" help="Date de debut de sejour." error={editValidation.errors.check_in_date}>
                      <DatePicker value={editForm.check_in_date || ""} onChange={(event) => setEditForm((current) => ({ ...current, check_in_date: event.target.value }))} name="check_in_date" required placeholder="Choisir une date" />
                    </FieldGroup>
                    <FieldGroup label="Depart" help="La date de depart doit rester posterieure a l'arrivee." error={editValidation.errors.check_out_date}>
                      <DatePicker value={editForm.check_out_date || ""} onChange={(event) => setEditForm((current) => ({ ...current, check_out_date: event.target.value }))} name="check_out_date" minDate={editForm.check_in_date || ""} required placeholder="Choisir une date" />
                    </FieldGroup>
                    <FieldGroup label="Adultes" help="Utilise cette valeur pour l'occupation reelle." error={editValidation.errors.adults}>
                      <input type="number" min="1" value={editForm.adults || 1} onChange={(event) => setEditForm((current) => ({ ...current, adults: Number(event.target.value) }))} />
                    </FieldGroup>
                    <FieldGroup label="Enfants" help="Laisse 0 si aucun enfant n'est rattache a la reservation." error={editValidation.errors.children}>
                      <input type="number" min="0" value={editForm.children || 0} onChange={(event) => setEditForm((current) => ({ ...current, children: Number(event.target.value) }))} />
                    </FieldGroup>
                    <FieldGroup label="Montant estime" help="Aide a preparer le suivi d'encaissement.">
                      <input type="number" min="0" step="0.01" value={editForm.estimated_amount || ""} onChange={(event) => setEditForm((current) => ({ ...current, estimated_amount: event.target.value }))} />
                    </FieldGroup>
                    <FieldGroup label="Notes internes" help="Conserve ici les informations utiles a l'equipe." className="full-width">
                      <textarea className="full-width" value={editForm.notes || ""} onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes" />
                    </FieldGroup>
                  </>
                ) : null}

                {entityType === "stays" ? (
                  <>
                    <FieldGroup label="Depart attendu" help="Mets a jour la date cible si le sejour est prolonge ou raccourci." error={editValidation.errors.planned_check_out}>
                      <DateTimePicker value={toDateTimeLocal(editForm.planned_check_out)} onChange={(event) => setEditForm((current) => ({ ...current, planned_check_out: event.target.value }))} name="edit_planned_check_out" required placeholder="Choisir une date et une heure" />
                    </FieldGroup>
                    <FieldGroup label="Adultes" help="Occupation reelle en cours de sejour." error={editValidation.errors.adults_count}>
                      <input type="number" min="1" value={editForm.adults_count || editForm.adults || 1} onChange={(event) => setEditForm((current) => ({ ...current, adults: Number(event.target.value), adults_count: Number(event.target.value) }))} />
                    </FieldGroup>
                    <FieldGroup label="Enfants" help="Ajuste si la composition du sejour evolue." error={editValidation.errors.children_count}>
                      <input type="number" min="0" value={editForm.children_count || editForm.children || 0} onChange={(event) => setEditForm((current) => ({ ...current, children: Number(event.target.value), children_count: Number(event.target.value) }))} />
                    </FieldGroup>
                    <FieldGroup label="Motif du sejour" help="Conserve le contexte principal du passage du client.">
                      <input type="text" value={editForm.purpose_of_stay || ""} onChange={(event) => setEditForm((current) => ({ ...current, purpose_of_stay: event.target.value }))} />
                    </FieldGroup>
                    <FieldGroup label="Demandes speciales" help="Ajoute les preferences ou attentes a retenir pendant le sejour." className="full-width">
                      <textarea className="full-width" value={editForm.special_requests || ""} onChange={(event) => setEditForm((current) => ({ ...current, special_requests: event.target.value }))} placeholder="Demandes speciales" />
                    </FieldGroup>
                    <FieldGroup label="Notes et ajustements" help="Documente ici les exceptions, incidents ou ajustements du sejour." className="full-width">
                      <textarea className="full-width" value={editForm.notes || ""} onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes et ajustements" />
                    </FieldGroup>
                  </>
                ) : null}

                {entityType === "day-uses" ? (
                  <>
                    <FieldGroup label="Chambre" help="Garde la chambre a jour pour eviter les ecarts d'exploitation." error={editValidation.errors.room_id}>
                      <AppSelect value={editForm.room_id || ""} onChange={(event) => setEditForm((current) => ({ ...current, room_id: event.target.value }))} name="edit_day_use_room_id">
                        {(choices?.rooms || []).map((item) => (
                          <option key={item.id} value={item.id}>{item.label}</option>
                        ))}
                      </AppSelect>
                    </FieldGroup>
                    <FieldGroup label="Formule" help="Montant principal du day use." error={editValidation.errors.package_price}>
                      <input type="number" min="0" step="0.01" value={editForm.package_price || ""} onChange={(event) => setEditForm((current) => ({ ...current, package_price: event.target.value }))} />
                    </FieldGroup>
                    <FieldGroup label="Depassement" help="Regle applicable si l'occupation depasse le cadre initial.">
                      <AppSelect value={String(editForm.overtime_choice ?? "")} onChange={(event) => setEditForm((current) => ({ ...current, overtime_choice: Number(event.target.value) }))} name="edit_overtime_choice">
                        {(choices?.overtime_choices || []).map((item) => (
                          <option key={item.value} value={String(item.value)}>{item.label}</option>
                        ))}
                      </AppSelect>
                    </FieldGroup>
                    <FieldGroup label="Supplement" help="Laisse vide si aucun frais additionnel n'est prevu." error={editValidation.errors.overtime_fee}>
                      <input type="number" min="0" step="0.01" value={editForm.overtime_fee || ""} onChange={(event) => setEditForm((current) => ({ ...current, overtime_fee: event.target.value }))} />
                    </FieldGroup>
                    <FieldGroup label="Entree prevue" help="Horaire previsionnel d'accueil du client." error={editValidation.errors.planned_entry_at}>
                      <DateTimePicker value={toDateTimeLocal(editForm.planned_entry_at)} onChange={(event) => setEditForm((current) => ({ ...current, planned_entry_at: event.target.value }))} name="edit_planned_entry_at" placeholder="Choisir une date et une heure" />
                    </FieldGroup>
                    <FieldGroup label="Notes internes" help="Conserve ici toute consigne utile pour l'equipe." className="full-width">
                      <textarea className="full-width" value={editForm.notes || ""} onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes" />
                    </FieldGroup>
                  </>
                ) : null}

                {entityType === "payments" ? (
                  <>
                    <FieldGroup label="Statut" help="Mets a jour le statut financier reel du paiement." error={editValidation.errors.status}>
                      <AppSelect value={editForm.status || ""} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))} name="edit_payment_status">
                        {(choices?.payment_statuses || []).map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </AppSelect>
                    </FieldGroup>
                    <FieldGroup label="Mode de paiement" help="Le mode choisi sera repris dans les analyses financieres." error={editValidation.errors.method}>
                      <AppSelect value={editForm.method || ""} onChange={(event) => setEditForm((current) => ({ ...current, method: event.target.value }))} name="edit_payment_method">
                        {(choices?.payment_methods || []).map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </AppSelect>
                    </FieldGroup>
                    <FieldGroup label="Type de paiement" help="Identifie une avance, un paiement partiel ou un solde complet.">
                      <AppSelect value={editForm.payment_type || "partial"} onChange={(event) => setEditForm((current) => ({ ...current, payment_type: event.target.value }))} name="edit_payment_type">
                        {(choices?.payment_types || []).map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </AppSelect>
                    </FieldGroup>
                    <FieldGroup label="Montant" help="Le montant doit rester coherent avec l'operation reellement encaissee." error={editValidation.errors.amount}>
                      <input type="number" min="0" step="0.01" value={editForm.amount || ""} onChange={(event) => setEditForm((current) => ({ ...current, amount: event.target.value }))} />
                    </FieldGroup>
                    <FieldGroup label="Date et heure" help="Utilise l'horodatage reel du paiement ou de sa correction." error={editValidation.errors.paid_at}>
                      <DateTimePicker value={toDateTimeLocal(editForm.paid_at)} onChange={(event) => setEditForm((current) => ({ ...current, paid_at: event.target.value }))} name="edit_payment_paid_at" required placeholder="Choisir une date et une heure" />
                    </FieldGroup>
                    <FieldGroup label="Origine" help="Canal ou contexte de saisie du paiement.">
                      <input type="text" value={editForm.source || ""} onChange={(event) => setEditForm((current) => ({ ...current, source: event.target.value }))} />
                    </FieldGroup>
                    <FieldGroup label="Reference externe" help="Numero mobile money, terminal carte ou reference bancaire.">
                      <input type="text" value={editForm.external_reference || ""} onChange={(event) => setEditForm((current) => ({ ...current, external_reference: event.target.value }))} />
                    </FieldGroup>
                    <FieldGroup label="Devise" help="Devise de reference du paiement.">
                      <input type="text" value={editForm.currency || "XOF"} onChange={(event) => setEditForm((current) => ({ ...current, currency: event.target.value }))} />
                    </FieldGroup>
                    <FieldGroup label="Notes internes" help="Documente ici le motif d'un ajustement ou d'une regularisation." className="full-width">
                      <textarea className="full-width" value={editForm.notes || ""} onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes" />
                    </FieldGroup>
                  </>
                ) : null}

                <ValidationSummary title="Verification avant enregistrement" items={editSummary} ready={editValidation.isValid} />
                <button type="submit" className="primary-button full-width" disabled={submitting}>
                  {submitting ? "Enregistrement…" : "Enregistrer les modifications"}
                </button>
              </form>
            </div>
          ) : null}

          {(detail.workflow_forms || []).map((workflow) => (
            <div key={workflow.type} className="detail-block detail-workflow-block">
              <div className="panel-head">
                <div>
                  <h3>{workflow.title}</h3>
                  <p>Etape guidee pour executer cette transition metier de facon securisee.</p>
                </div>
              </div>
              <form
                className="form-grid detail-form"
                onSubmit={(event) =>
                  handleFormSubmit(
                    event,
                    workflow.endpoint,
                    workflowForms[workflow.type] || {},
                    "Workflow execute avec succes.",
                    getWorkflowConfirmation(workflow.type),
                    workflowValidations[workflow.type] || { isValid: true },
                  )
                }
              >
                {workflow.type === "booking_check_in" ? (
                  <>
                    <FieldGroup
                      label="Chambre de check-in"
                      help="Choisis une chambre disponible compatible avec le type reserve."
                      error={workflowValidations[workflow.type]?.errors?.room_id}
                      className="full-width"
                    >
                      <AppSelect
                        value={workflowForms[workflow.type]?.room_id || ""}
                        onChange={(event) =>
                          setWorkflowForms((current) => ({
                            ...current,
                            [workflow.type]: {
                              ...(current[workflow.type] || {}),
                              room_id: event.target.value,
                            },
                          }))
                        }
                        name={`workflow_${workflow.type}_room_id`}
                      >
                        <option value="">Choisir une chambre pour le check-in</option>
                        {(choices?.rooms || [])
                          .filter((room) => room.status_code === "available" && room.room_type_id === detail.room_type_id)
                          .map((item) => (
                            <option key={item.id} value={item.id}>{item.label}</option>
                          ))}
                      </AppSelect>
                    </FieldGroup>
                    <ValidationSummary
                      title="Verification avant check-in"
                      items={[
                        {
                          label: "Chambre",
                          value: workflowForms[workflow.type]?.room_id ? "Selection validee" : "A selectionner",
                          tone: workflowForms[workflow.type]?.room_id ? "good" : "warn",
                        },
                        {
                          label: "Reservation",
                          value: detail.status,
                          tone: "neutral",
                        },
                      ]}
                      ready={workflowValidations[workflow.type]?.isValid}
                    />
                    <button type="submit" className="primary-button full-width" disabled={submitting}>
                      {submitting ? "En cours…" : workflow.submit_label}
                    </button>
                  </>
                ) : null}
              </form>
            </div>
          ))}

          {(detail.sections || []).map((section) => (
            <div key={section.title} className="detail-block">
              <div className="panel-head">
                <div>
                  <h3>{section.title}</h3>
                </div>
              </div>
              <div className="table-like">
                {section.items.map((item) => (
                  <div key={`${section.title}-${item.label}`} className="table-card detail-info-card">
                    <div className="table-row"><strong>{item.label}</strong><span>{item.value}</span></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="dashboard-side-stack">
          <section className="list-panel dashboard-panel">
            <div className="panel-head">
              <div>
                <h3>Encaissements lies</h3>
                <p>Transactions financieres rattachees a ce flux pour controle et complement d'encaissement.</p>
              </div>
            </div>
            {detail.payment_form ? (
              <form
                className="form-grid compact-form detail-form"
                onSubmit={(event) => handleFormSubmit(event, detail.payment_form.endpoint, paymentForm, "Paiement enregistre avec succes.", "", relatedPaymentValidation)}
              >
                <FieldGroup label="Statut" help="Precise si le paiement est deja regle ou seulement en attente." error={relatedPaymentValidation.errors.status}>
                  <AppSelect value={paymentForm.status || "paid"} onChange={(event) => setPaymentForm((current) => ({ ...current, status: event.target.value }))} name="related_payment_status">
                    {(choices?.payment_statuses || []).map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </AppSelect>
                </FieldGroup>
                <FieldGroup label="Mode de paiement" help="Le mode choisi sera repris dans les rapports." error={relatedPaymentValidation.errors.method}>
                  <AppSelect value={paymentForm.method || "cash"} onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value }))} name="related_payment_method">
                    {(choices?.payment_methods || []).map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </AppSelect>
                </FieldGroup>
                <FieldGroup label="Type de paiement" help="Permet de distinguer avance, acompte partiel ou solde final.">
                  <AppSelect value={paymentForm.payment_type || "partial"} onChange={(event) => setPaymentForm((current) => ({ ...current, payment_type: event.target.value }))} name="related_payment_type">
                    {(choices?.payment_types || []).map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </AppSelect>
                </FieldGroup>
                <FieldGroup label="Montant" help="Le montant doit etre strictement positif." error={relatedPaymentValidation.errors.amount}>
                  <input type="number" min="0" step="0.01" value={paymentForm.amount || ""} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Montant" required />
                </FieldGroup>
                <FieldGroup label="Date et heure" help="Horodatage reel de l'encaissement." error={relatedPaymentValidation.errors.paid_at}>
                  <DateTimePicker value={paymentForm.paid_at || ""} onChange={(event) => setPaymentForm((current) => ({ ...current, paid_at: event.target.value }))} name="related_payment_paid_at" required placeholder="Choisir une date et une heure" />
                </FieldGroup>
                <FieldGroup label="Reference externe" help="Numero de transaction, mobile money ou reference bancaire.">
                  <input type="text" value={paymentForm.external_reference || ""} onChange={(event) => setPaymentForm((current) => ({ ...current, external_reference: event.target.value }))} />
                </FieldGroup>
                <FieldGroup label="Origine" help="Source ou canal de ce paiement.">
                  <input type="text" value={paymentForm.source || ""} onChange={(event) => setPaymentForm((current) => ({ ...current, source: event.target.value }))} />
                </FieldGroup>
                <FieldGroup label="Devise" help="Devise de reference de l'encaissement.">
                  <input type="text" value={paymentForm.currency || "XOF"} onChange={(event) => setPaymentForm((current) => ({ ...current, currency: event.target.value }))} />
                </FieldGroup>
                <FieldGroup label="Notes de paiement" help="Ajoute un commentaire si le paiement necessite un contexte particulier." className="full-width">
                  <textarea className="full-width" value={paymentForm.notes || ""} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes de paiement" />
                </FieldGroup>
                <ValidationSummary title="Verification avant ajout" items={relatedPaymentSummary} ready={relatedPaymentValidation.isValid} />
                <button type="submit" className="primary-button full-width" disabled={submitting}>{submitting ? "Enregistrement…" : "Ajouter un paiement"}</button>
              </form>
            ) : null}
              <div className="table-like">
                {(detail.related_records?.payments || []).map((payment) => (
                  <article key={payment.id} className="table-card detail-info-card">
                    <div className="table-row"><strong>Reference</strong><span>{payment.reference}</span></div>
                    <div className="table-row"><strong>Montant</strong><span>{payment.amount}</span></div>
                    <div className="table-row"><strong>Type</strong><span>{payment.payment_type}</span></div>
                    <div className="table-row"><strong>Mode</strong><span>{payment.method}</span></div>
                    <div className="table-row"><strong>Date</strong><span>{payment.paid_at}</span></div>
                    <div className="table-row"><strong>Facture</strong><span>{payment.invoice_reference || "-"}</span></div>
                    <div className="action-row">
                      <Link className="secondary-button" to={payment.detail_path}>Voir la fiche paiement</Link>
                    </div>
                  </article>
                ))}
              {!(detail.related_records?.payments || []).length ? (
                <EmptyStateCard
                  title="Aucun paiement rattache"
                  description="Les encaissements lies a cette fiche apparaitront ici des qu'ils seront enregistres."
                />
              ) : null}
            </div>
          </section>

          {(detail.related_records?.consumptions || []).length ? (
            <section className="list-panel dashboard-panel">
              <div className="panel-head">
                <div>
                  <h3>Consommations liees</h3>
                  <p>Historique des services rattaches a ce sejour pour preparer le folio et la facturation.</p>
                </div>
              </div>
              <div className="table-like">
                {(detail.related_records?.consumptions || []).map((consumption) => (
                  <article key={consumption.id} className="table-card detail-info-card">
                    <div className="table-row"><strong>Reference</strong><span>{consumption.reference}</span></div>
                    <div className="table-row"><strong>Service</strong><span>{consumption.service}</span></div>
                    <div className="table-row"><strong>Libelle</strong><span>{consumption.label}</span></div>
                    <div className="table-row"><strong>Montant</strong><span>{consumption.total_amount}</span></div>
                    <div className="table-row"><strong>Date</strong><span>{consumption.consumed_at}</span></div>
                    <div className="table-row"><strong>Statut</strong><span>{consumption.status}</span></div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {(detail.related_records?.invoices || []).length ? (
            <section className="list-panel dashboard-panel">
              <div className="panel-head">
                <div>
                  <h3>Factures liees</h3>
                  <p>Vue de synthese des factures deja preparees pour ce sejour.</p>
                </div>
              </div>
              <div className="table-like">
                {(detail.related_records?.invoices || []).map((invoice) => (
                  <article key={invoice.id} className="table-card detail-info-card">
                    <div className="table-row"><strong>Facture</strong><span>{invoice.reference}</span></div>
                    <div className="table-row"><strong>Emission</strong><span>{invoice.issued_at}</span></div>
                    <div className="table-row"><strong>Echeance</strong><span>{invoice.due_date}</span></div>
                    <div className="table-row"><strong>Total</strong><span>{invoice.total_amount}</span></div>
                    <div className="table-row"><strong>Paye</strong><span>{invoice.amount_paid}</span></div>
                    <div className="table-row"><strong>Solde</strong><span>{invoice.balance_due}</span></div>
                    <div className="table-row"><strong>Statut</strong><span>{invoice.status}</span></div>
                    <div className="table-row"><strong>Lignes</strong><span>{invoice.item_count}</span></div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="list-panel dashboard-panel">
            <div className="panel-head">
              <div>
                <h3>Liens contextuels</h3>
                <p>Acces rapide aux autres fiches utiles pour finaliser le traitement du dossier.</p>
              </div>
            </div>
            <div className="action-row detail-link-stack">
              {detail.related_records?.stay ? <Link className="secondary-button" to={detail.related_records.stay.detail_path}>Voir le sejour lie</Link> : null}
              {detail.related_records?.booking ? <Link className="secondary-button" to={detail.related_records.booking.detail_path}>Voir la reservation liee</Link> : null}
              {(detail.related_records?.links || []).map((item) => (
                <Link key={item.path} className="secondary-button" to={item.path}>
                  {item.label}
                </Link>
              ))}
              {!detail.related_records?.stay && !detail.related_records?.booking && !(detail.related_records?.links || []).length ? (
                <EmptyStateCard
                  title="Aucun lien contextuel supplementaire"
                  description="Cette fiche ne reference pas encore d'autre flux connexe necessitant une navigation rapide."
                />
              ) : null}
            </div>
          </section>
        </section>
      </section>

      <section className="list-panel dashboard-panel">
        <div className="panel-head">
          <div>
            <h3>Historique</h3>
            <p>Trace chronologique des actions et evenements utiles pour comprendre le parcours complet de ce flux.</p>
          </div>
        </div>
        <div className="activity-list">
          {(detail.timeline || []).map((item) => (
            <article key={item.id} className="activity-card">
              <div className="activity-badge">{item.label}</div>
              <div className="activity-content">
                <strong>{item.description}</strong>
                <p>{item.module}</p>
                <div className="activity-meta">
                  <span>{item.actor}</span>
                  <span>{item.created_at}</span>
                </div>
              </div>
            </article>
          ))}
          {!(detail.timeline || []).length ? (
            <EmptyStateCard
              title="Historique encore vide"
              description="Les prochaines transitions et interventions associees a cette fiche seront journalisees ici."
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
