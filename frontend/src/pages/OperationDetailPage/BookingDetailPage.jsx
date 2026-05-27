import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { postJson } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { canPerformAction, hasPermission } from "../../auth/permissions";
import { AppSelect } from "../../shared/components/AppSelect";
import { ConfirmModal } from "../../shared/components/ConfirmModal";
import { DatePicker } from "../../shared/components/DatePicker";
import "./BookingDetailPage.css";

const STATUS_META = {
  confirmed: {
    label: "Confirmée",
    className: "booking-status--confirmed",
  },
  checked_in: {
    label: "Convertie en check-in",
    className: "booking-status--checked-in",
  },
  cancelled: {
    label: "Annulée",
    className: "booking-status--cancelled",
  },
  no_show: {
    label: "No-show",
    className: "booking-status--no-show",
  },
  pending: {
    label: "En attente",
    className: "booking-status--pending",
  },
};

const EMPTY_FORM = {
  room_id: "",
  source: "",
  check_in_date: "",
  check_out_date: "",
  adults: 1,
  children: 0,
  estimated_amount: "",
  notes: "",
};

function getTodayISO() {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  return today.toISOString().slice(0, 10);
}

function getSectionValue(detail, sectionTitle, label) {
  const section = (detail.sections || []).find((item) => item.title === sectionTitle);
  const row = (section?.items || []).find((item) => item.label === label);
  return row?.value && row.value !== "-" ? row.value : "";
}

function parseAmount(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (!value) {
    return 0;
  }
  const normalized = String(value)
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatFullAmount(value) {
  return `${Math.round(parseAmount(value)).toLocaleString("fr-FR")} XOF`;
}

function formatCompactAmount(value) {
  const amount = parseAmount(value);
  if (amount >= 1000000) {
    return `${(amount / 1000000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}M XOF`;
  }
  if (amount >= 1000) {
    return `${Math.round(amount / 1000).toLocaleString("fr-FR")}K XOF`;
  }
  return `${Math.round(amount).toLocaleString("fr-FR")} XOF`;
}

function formatDate(value) {
  if (!value || value === "-") {
    return "—";
  }
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value || value === "-") {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function daysBetween(start, end) {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 0;
  }
  return Math.max(0, Math.round((endDate - startDate) / 86400000));
}

function getInitials(name) {
  const letters = String(name || "")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return letters || "CL";
}

function getRequestError(error, fallback) {
  const errors = error.payload?.errors;
  if (errors) {
    return Object.values(errors).flat()[0] || fallback;
  }
  return error.payload?.detail || error.message || fallback;
}

function DetailLine({ label, value, tone = "" }) {
  return (
    <div className="booking-detail-line">
      <span>{label}</span>
      <strong className={tone ? `booking-detail-line__value--${tone}` : ""}>{value || "—"}</strong>
    </div>
  );
}

function Chip({ icon, children }) {
  return (
    <span className="booking-identity-chip">
      <i className={`ti ${icon}`} aria-hidden="true" />
      {children}
    </span>
  );
}

function Field({ label, error, help, className = "", children }) {
  return (
    <label className={`booking-form-field ${className}`.trim()}>
      <span>{label}</span>
      {children}
      {error ? <em>{error}</em> : null}
      {help ? <small>{help}</small> : null}
    </label>
  );
}

export function BookingDetailPage({ detail, choices, onReload }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const todayISO = useMemo(() => getTodayISO(), []);
  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState({ error: "", success: "" });
  const [submitting, setSubmitting] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const statusMeta = STATUS_META[detail.status_code] || {
    label: detail.status || "En attente",
    className: "booking-status--pending",
  };
  const guest = detail.guest || {};
  const room = detail.room || {};
  const payments = detail.related_records?.payments || [];
  const invoices = detail.related_records?.invoices || [];
  const stayPath = detail.stay_detail_path || detail.related_records?.stay?.detail_path || "";
  const invoiceReference = detail.invoice_reference || invoices[0]?.reference || "";
  const nationality = guest.nationality || getSectionValue(detail, "Client", "Nationalite") || "—";
  const roomType = room.room_type || getSectionValue(detail, "Hebergement", "Type de chambre") || "Non affecté";
  const roomNumber = room.number || getSectionValue(detail, "Hebergement", "Chambre affectee") || "Non affectée";
  const nights = daysBetween(detail.check_in_date, detail.check_out_date);
  const estimatedAmount = parseAmount(detail.estimated_amount);
  const paidAmount = parseAmount(detail.paid_amount);
  const remainingAmount = parseAmount(detail.remaining_balance);
  const collectionRate = estimatedAmount > 0 ? Math.min(100, Math.round((paidAmount / estimatedAmount) * 100)) : 0;
  const collectionLabel = collectionRate >= 100 ? "Complet" : collectionRate >= 50 ? "Partiel" : "A encaisser";
  const canUpdate = hasPermission(user, "operations", "update");
  const canDelete = hasPermission(user, "operations", "delete");
  const canCheckIn = canPerformAction(user, "operations.check_in");
  const canCancel = canPerformAction(user, "operations.cancel");
  const canNoShow = canPerformAction(user, "operations.no_show");

  useEffect(() => {
    setForm({
      ...EMPTY_FORM,
      ...(detail.edit_form?.fields || {}),
    });
    setStatus({ error: "", success: "" });
  }, [detail]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  const errors = useMemo(() => {
    const nextErrors = {};
    if (!form.check_in_date) {
      nextErrors.check_in_date = "La date d'arrivée est obligatoire.";
    } else if (form.check_in_date < todayISO) {
      nextErrors.check_in_date = "La date d'arrivée ne peut pas être antérieure à aujourd'hui.";
    }
    if (!form.check_out_date) {
      nextErrors.check_out_date = "La date de départ est obligatoire.";
    } else if (form.check_in_date && form.check_out_date <= form.check_in_date) {
      nextErrors.check_out_date = "La date de départ doit rester postérieure à l'arrivée.";
    }
    if (Number(form.adults || 0) < 1) {
      nextErrors.adults = "Au moins un adulte est requis.";
    }
    if (Number(form.children || 0) < 0) {
      nextErrors.children = "Le nombre d'enfants ne peut pas être négatif.";
    }
    if (Number(form.estimated_amount || 0) < 0) {
      nextErrors.estimated_amount = "Le montant doit être positif.";
    }
    return nextErrors;
  }, [form, todayISO]);

  const roomOptions = useMemo(() => {
    const currentRoomId = String(detail.room_id || "");
    return (choices?.rooms || []).filter((item) => {
      const sameRoom = String(item.id) === currentRoomId;
      const compatibleType = !detail.room_type_id || Number(item.room_type_id) === Number(detail.room_type_id);
      return sameRoom || (item.can_assign_booking && compatibleType);
    });
  }, [choices, detail.room_id, detail.room_type_id]);

  const verificationItems = [
    {
      label: "Période",
      value: form.check_in_date && form.check_out_date ? `${formatDate(form.check_in_date)} au ${formatDate(form.check_out_date)}` : "A compléter",
      ready: Boolean(form.check_in_date && form.check_out_date && !errors.check_in_date && !errors.check_out_date),
    },
    {
      label: "Occupation",
      value: `${form.adults || 0} adulte(s) / ${form.children || 0} enfant(s)`,
      ready: Number(form.adults || 0) >= 1 && Number(form.children || 0) >= 0,
    },
    {
      label: "Hébergement",
      value: form.room_id ? "Chambre affectée" : "Non affectée",
      ready: Boolean(form.room_id),
    },
  ];

  async function saveBooking(event) {
    event.preventDefault();
    if (Object.keys(errors).length > 0) {
      setStatus({ error: "Vérifie les champs signalés avant d'enregistrer.", success: "" });
      return;
    }
    setSubmitting(true);
    setStatus({ error: "", success: "" });
    try {
      const payload = {
        ...form,
        adults: Number(form.adults || 1),
        children: Number(form.children || 0),
        estimated_amount: String(form.estimated_amount || "0"),
      };
      const response = await postJson(detail.edit_form.endpoint, payload);
      setStatus({ error: "", success: response.message || "Réservation mise à jour." });
      await onReload?.();
    } catch (error) {
      setStatus({ error: getRequestError(error, "Impossible d'enregistrer la réservation."), success: "" });
    } finally {
      setSubmitting(false);
    }
  }

  function openAction(action) {
    setConfirmAction(action);
  }

  async function confirmCurrentAction() {
    if (!confirmAction?.endpoint) {
      return;
    }
    setSubmitting(true);
    setStatus({ error: "", success: "" });
    try {
      const response = await postJson(confirmAction.endpoint, {});
      setStatus({ error: "", success: response.message || confirmAction.success || "Action exécutée." });
      setConfirmAction(null);
      await onReload?.();
    } catch (error) {
      setStatus({ error: getRequestError(error, "Action impossible."), success: "" });
    } finally {
      setSubmitting(false);
    }
  }

  const actionBase = `/api/operations/bookings/${detail.id || detail.edit_form?.endpoint?.match(/bookings\/(\d+)/)?.[1]}/`;

  return (
    <div className="booking-detail-page">
      <div className="booking-detail-topbar">
        <button type="button" className="booking-back-button" onClick={() => navigate(-1)}>
          <i className="ti ti-arrow-left" aria-hidden="true" />
          Retour aux opérations
        </button>
        <div className="booking-breadcrumb">Réservations / {detail.reference}</div>
        <span className={`booking-status-badge ${statusMeta.className}`}>{statusMeta.label}</span>
      </div>

      {status.error ? <div className="booking-page-message booking-page-message--error">{status.error}</div> : null}
      {status.success ? <div className="booking-page-message booking-page-message--success">{status.success}</div> : null}

      <section className="booking-identity-card">
        <div className="booking-avatar">{getInitials(guest.full_name)}</div>
        <div className="booking-identity-main">
          <span className="booking-reference">{detail.reference}</span>
          <h1>{guest.full_name || "Client non renseigné"}</h1>
          <div className="booking-identity-chips">
            <Chip icon="ti-bed">{roomNumber} · {roomType}</Chip>
            <Chip icon="ti-calendar">{formatDate(detail.check_in_date)} → {formatDate(detail.check_out_date)} · {nights} nuit{nights > 1 ? "s" : ""}</Chip>
            <Chip icon="ti-users">{detail.adults || 0} adultes / {detail.children || 0} enfants</Chip>
            <Chip icon="ti-map-pin">{detail.source || "—"} · {nationality}</Chip>
            <Chip icon="ti-phone">{guest.phone || "—"}</Chip>
          </div>
        </div>
        <span className={`booking-status-badge booking-identity-status ${statusMeta.className}`}>{statusMeta.label}</span>
      </section>

      <section className="booking-financial-card">
        <div className="booking-financial-item">
          <span>Estimé</span>
          <strong>{formatCompactAmount(estimatedAmount)}</strong>
          <small>XOF</small>
        </div>
        <div className="booking-financial-item">
          <span>Encaissé</span>
          <strong className={paidAmount > 0 ? "amount-positive" : "amount-negative"}>{formatCompactAmount(paidAmount)}</strong>
          <small>XOF{remainingAmount <= 0 && estimatedAmount > 0 ? " · Complet" : ""}</small>
        </div>
        <div className="booking-financial-item">
          <span>Solde</span>
          <strong className={remainingAmount <= 0 ? "amount-positive" : "amount-negative"}>{formatCompactAmount(remainingAmount)}</strong>
          <small>XOF{remainingAmount <= 0 ? " · Soldé" : ""}</small>
        </div>
        <div className="booking-financial-progress">
          <span>Taux d'encaissement</span>
          <div className="booking-progress-track">
            <div className={`booking-progress-fill booking-progress-fill--${collectionRate >= 100 ? "full" : collectionRate >= 50 ? "mid" : "low"}`} style={{ width: `${collectionRate}%` }} />
          </div>
          <small>{collectionRate}% · {collectionLabel}</small>
        </div>
      </section>

      {(detail.alerts || []).map((alert) => (
        <div key={alert} className="booking-alert">
          <i className="ti ti-alert-circle" aria-hidden="true" />
          <span>{alert}</span>
        </div>
      ))}

      <div className="booking-main-grid">
        <main className="booking-main-column">
          <div className="booking-info-grid">
            <section className="booking-card">
              <header>
                <i className="ti ti-user" aria-hidden="true" />
                <span>Client</span>
              </header>
              <div className="booking-client-mini">
                <div className="booking-mini-avatar">{getInitials(guest.full_name)}</div>
                <div>
                  <strong>{guest.full_name || "—"}</strong>
                  <small>{guest.email || "—"}</small>
                </div>
              </div>
              <DetailLine label="Téléphone" value={guest.phone} />
              <DetailLine label="Nationalité" value={nationality} />
            </section>

            <section className="booking-card">
              <header>
                <i className="ti ti-calendar" aria-hidden="true" />
                <span>Réservation</span>
                <span className={`booking-status-badge booking-card-status ${statusMeta.className}`}>{statusMeta.label}</span>
              </header>
              <DetailLine label="Arrivée" value={formatDate(detail.check_in_date)} />
              <DetailLine label="Départ" value={formatDate(detail.check_out_date)} />
              <DetailLine label="Durée" value={`${nights} nuit${nights > 1 ? "s" : ""}`} />
              <DetailLine label="Statut" value={statusMeta.label} tone={detail.status_code} />
              <DetailLine label="Notes" value={detail.notes || "—"} />
            </section>
          </div>

          <section className="booking-card booking-edit-card">
            <header>
              <i className="ti ti-edit" aria-hidden="true" />
              <span>Modifier la réservation</span>
            </header>
            <form onSubmit={saveBooking} className={submitting ? "booking-form booking-form--loading" : "booking-form"}>
              <div className="booking-form-grid">
                <Field label="Chambre" help="Peut rester ouvert si décidé plus tard.">
                  <AppSelect value={form.room_id || ""} onChange={(event) => updateField("room_id", event.target.value)} name="booking_room">
                    <option value="">Non affectée</option>
                    {roomOptions.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </AppSelect>
                </Field>
                <Field label="Source" help="Utile pour le suivi commercial.">
                  <AppSelect value={form.source || ""} onChange={(event) => updateField("source", event.target.value)} name="booking_source">
                    {(choices?.booking_sources || []).map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </AppSelect>
                </Field>
                <Field label="Arrivée" error={errors.check_in_date}>
                  <DatePicker value={form.check_in_date || ""} onChange={(event) => updateField("check_in_date", event.target.value)} name="booking_check_in" minDate={todayISO} placeholder="Choisir une date" />
                </Field>
                <Field label="Départ" error={errors.check_out_date} help="Doit rester postérieure à l'arrivée.">
                  <DatePicker value={form.check_out_date || ""} onChange={(event) => updateField("check_out_date", event.target.value)} name="booking_check_out" placeholder="Choisir une date" />
                </Field>
                <Field label="Adultes" error={errors.adults} help="Utilise cette valeur pour l'occupation réelle.">
                  <input type="number" min="1" value={form.adults || 1} onChange={(event) => updateField("adults", event.target.value)} />
                </Field>
                <Field label="Enfants" error={errors.children} help="Laisse 0 si aucun enfant.">
                  <input type="number" min="0" value={form.children || 0} onChange={(event) => updateField("children", event.target.value)} />
                </Field>
                <Field label="Montant estimé" className="booking-form-field--full" error={errors.estimated_amount} help="Aide à préparer le suivi d'encaissement.">
                  <input type="number" min="0" step="1" value={form.estimated_amount || ""} onChange={(event) => updateField("estimated_amount", event.target.value)} />
                </Field>
                <Field label="Notes internes" className="booking-form-field--full" help="Conserve ici les informations utiles à l'équipe.">
                  <textarea rows="3" value={form.notes || ""} onChange={(event) => updateField("notes", event.target.value)} placeholder="Notes internes" />
                </Field>
              </div>

              <div className="booking-verification">
                <h3>
                  <i className="ti ti-shield-check" aria-hidden="true" />
                  Vérification avant enregistrement
                </h3>
                {verificationItems.map((item) => (
                  <div key={item.label} className="booking-verification-row">
                    <span className={item.ready ? "booking-dot booking-dot--ready" : "booking-dot booking-dot--warn"} />
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>

              <button type="submit" className="booking-save-button" disabled={submitting || !canUpdate}>
                {submitting ? "Enregistrement..." : "Enregistrer les modifications"}
              </button>
            </form>
          </section>
        </main>

        <aside className="booking-side-column">
          <section className="booking-card booking-actions-card">
            <header>
              <i className="ti ti-bolt" aria-hidden="true" />
              <span>Actions</span>
            </header>
            <button type="button" className="booking-action-button booking-action-button--primary" disabled={!detail.can_check_in || !canCheckIn || submitting} onClick={() => openAction({ endpoint: `${actionBase}check-in/`, title: "Effectuer le check-in", message: "Convertir cette réservation en séjour maintenant ?", confirmLabel: "Effectuer le check-in", success: "Check-in effectué." })}>
              <i className="ti ti-login" aria-hidden="true" />
              Effectuer le check-in
            </button>
            <button type="button" className="booking-action-button" disabled={detail.status_code !== "pending" || !canUpdate || submitting} onClick={() => openAction({ endpoint: `${actionBase}confirm/`, title: "Confirmer la réservation", message: "Confirmer cette réservation ?", confirmLabel: "Confirmer", success: "Réservation confirmée." })}>
              <i className="ti ti-circle-check" aria-hidden="true" />
              Confirmer la réservation
            </button>
            {stayPath ? (
              <Link className="booking-action-button" to={stayPath}>
                <i className="ti ti-arrow-right" aria-hidden="true" />
                Voir le séjour lié
              </Link>
            ) : null}
            <button type="button" className="booking-action-button booking-action-button--danger" disabled={!(canCancel || canDelete) || !["pending", "confirmed"].includes(detail.status_code) || submitting} onClick={() => openAction({ endpoint: `${actionBase}cancel/`, title: "Annuler la réservation", message: "Annuler cette réservation ? Cette action sera journalisée.", confirmLabel: "Annuler la réservation", variant: "danger", success: "Réservation annulée." })}>
              <i className="ti ti-x" aria-hidden="true" />
              Annuler la réservation
            </button>
            <button type="button" className="booking-action-button booking-action-button--danger" disabled={!canNoShow || detail.status_code !== "confirmed" || submitting} onClick={() => openAction({ endpoint: `${actionBase}no-show/`, title: "Marquer no-show", message: "Marquer cette réservation comme no-show ?", confirmLabel: "Marquer no-show", variant: "danger", success: "Réservation marquée no-show." })}>
              <i className="ti ti-user-off" aria-hidden="true" />
              Marquer no-show
            </button>
          </section>

          <section className="booking-card booking-payments-card">
            <header>
              <i className="ti ti-receipt" aria-hidden="true" />
              <span>Encaissements</span>
            </header>
            {payments.length ? payments.map((payment) => (
              <div key={payment.id || payment.reference} className="booking-payment-row">
                <span className="booking-payment-icon"><i className="ti ti-cash" aria-hidden="true" /></span>
                <div>
                  <strong>{payment.payment_type || payment.type || "Paiement"} · {payment.method || "—"}</strong>
                  <small>{payment.reference} · {formatDateTime(payment.paid_at)}</small>
                </div>
                <b>{formatCompactAmount(payment.amount)}</b>
              </div>
            )) : <p className="booking-empty-note">Aucun paiement rattaché</p>}
          </section>

          <section className="booking-card booking-links-card">
            <header>
              <i className="ti ti-link" aria-hidden="true" />
              <span>Liens contextuels</span>
            </header>
            {stayPath ? (
              <Link to={stayPath}>
                <i className="ti ti-home" aria-hidden="true" />
                Voir le séjour lié
              </Link>
            ) : null}
            {invoiceReference ? (
              <Link to="/billing">
                <i className="ti ti-file-invoice" aria-hidden="true" />
                Voir la facture {invoiceReference}
              </Link>
            ) : null}
            {!stayPath && !invoiceReference ? <p className="booking-empty-note">Aucun lien disponible</p> : null}
          </section>
        </aside>
      </div>

      <ConfirmModal
        isOpen={Boolean(confirmAction)}
        title={confirmAction?.title || ""}
        message={confirmAction?.message || ""}
        confirmLabel={confirmAction?.confirmLabel || "Confirmer"}
        variant={confirmAction?.variant || "default"}
        confirmDisabled={submitting}
        onCancel={() => setConfirmAction(null)}
        onConfirm={confirmCurrentAction}
      />
    </div>
  );
}
