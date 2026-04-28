import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { fetchJson, postJson } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { hasPermission } from "../../auth/permissions";
import { AppSelect } from "../../components/AppSelect";
import { DatePicker } from "../../components/DatePicker";
import { DateTimePicker } from "../../components/DateTimePicker";
import "./OperationsPage.css";

const OPERATION_TABS = [
  { key: "booking", label: "Reservation" },
  { key: "stay", label: "Sejour" },
  { key: "day_use", label: "Day use" },
  { key: "payment", label: "Paiement" },
];

function initialBookingForm() {
  return {
    guest_id: "",
    room_type_id: "",
    room_id: "",
    source: "walk_in",
    check_in_date: "",
    check_out_date: "",
    adults: 1,
    children: 0,
    estimated_amount: "",
    notes: "",
  };
}

function initialDayUseForm() {
  return {
    guest_id: "",
    room_id: "",
    package_price: "",
    overtime_choice: 0,
    overtime_fee: "",
    planned_entry_at: "",
    notes: "",
  };
}

function initialStayForm() {
  return {
    guest_id: "",
    room_id: "",
    source: "walk_in",
    planned_check_in: "",
    actual_check_in: "",
    planned_check_out: "",
    adults_count: 1,
    children_count: 0,
    purpose_of_stay: "",
    special_requests: "",
    notes: "",
  };
}

function initialPaymentForm() {
  return {
    booking_id: "",
    stay_id: "",
    day_use_id: "",
    status: "paid",
    method: "cash",
    amount: "",
    paid_at: "",
    notes: "",
  };
}

function EmptyStateCard({ title, description }) {
  return (
    <div className="empty-state-card">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function ReadOnlyActionNotice({ title, description }) {
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

function getActionConfirmation(endpoint) {
  if (endpoint.includes("/bookings/") && endpoint.endsWith("/check-in/")) {
    return "Confirmer le check-in de cette reservation ? Le sejour sera ouvert immediatement.";
  }
  if (endpoint.includes("/stays/") && endpoint.endsWith("/check-out/")) {
    return "Confirmer le check-out de ce sejour ? Cette transition cloture le passage du client.";
  }
  if (endpoint.includes("/day-use/") && endpoint.endsWith("/check-in/")) {
    return "Confirmer l'entree de ce day use ? Le flux passera en cours.";
  }
  if (endpoint.includes("/day-use/") && endpoint.endsWith("/check-out/")) {
    return "Confirmer la sortie de ce day use ? Le flux sera considere comme termine.";
  }
  return "";
}

function validateBookingForm(form) {
  const errors = {};
  if (!form.guest_id) {
    errors.guest_id = "Selectionne le client avant de valider.";
  }
  if (!form.room_type_id) {
    errors.room_type_id = "Selectionne le type de chambre attendu.";
  }
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
  if (form.estimated_amount !== "" && Number(form.estimated_amount) < 0) {
    errors.estimated_amount = "Le montant estime doit rester positif.";
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}

function validateDayUseForm(form) {
  const errors = {};
  if (!form.guest_id) {
    errors.guest_id = "Selectionne le client concerne.";
  }
  if (!form.room_id) {
    errors.room_id = "Choisis la chambre qui sera occupee.";
  }
  if (form.package_price === "" || Number(form.package_price) < 0) {
    errors.package_price = "Renseigne une formule valide.";
  }
  if (form.overtime_fee !== "" && Number(form.overtime_fee) < 0) {
    errors.overtime_fee = "Le supplement doit rester positif.";
  }
  if (!form.planned_entry_at) {
    errors.planned_entry_at = "Renseigne l'heure d'entree prevue.";
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}

function validateStayForm(form) {
  const errors = {};
  if (!form.guest_id) {
    errors.guest_id = "Selectionne le client concerne.";
  }
  if (!form.room_id) {
    errors.room_id = "Choisis la chambre qui sera occupee.";
  }
  if (Number(form.adults_count) < 1) {
    errors.adults_count = "Au moins un adulte est requis.";
  }
  if (Number(form.children_count) < 0) {
    errors.children_count = "Le nombre d'enfants ne peut pas etre negatif.";
  }
  if (form.planned_check_out && form.actual_check_in && form.planned_check_out < form.actual_check_in) {
    errors.planned_check_out = "Le depart prevu doit etre posterieur a l'entree reelle.";
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}

function validatePaymentForm(form) {
  const errors = {};
  const attachments = [form.booking_id, form.stay_id, form.day_use_id].filter(Boolean).length;
  if (attachments !== 1) {
    errors.attachment = "Rattache le paiement a un seul flux : reservation, sejour ou day use.";
  }
  if (form.amount === "" || Number(form.amount) <= 0) {
    errors.amount = "Le montant doit etre strictement positif.";
  }
  if (!form.paid_at) {
    errors.paid_at = "Renseigne la date et l'heure du paiement.";
  }
  if (!form.method) {
    errors.method = "Selectionne un mode de paiement.";
  }
  if (!form.status) {
    errors.status = "Selectionne un statut de paiement.";
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}

export function OperationsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("booking");
  const [choices, setChoices] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [stays, setStays] = useState([]);
  const [dayUses, setDayUses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [search, setSearch] = useState("");
  const [bookingForm, setBookingForm] = useState(initialBookingForm());
  const [stayForm, setStayForm] = useState(initialStayForm());
  const [dayUseForm, setDayUseForm] = useState(initialDayUseForm());
  const [paymentForm, setPaymentForm] = useState(initialPaymentForm());
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [submittingStay, setSubmittingStay] = useState(false);
  const [submittingDayUse, setSubmittingDayUse] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [status, setStatus] = useState({ error: "", warning: "", success: "", loading: true });
  const canViewOperations = hasPermission(user, "operations", "view");
  const canCreateOperations = hasPermission(user, "operations", "create");
  const canUpdateOperations = hasPermission(user, "operations", "update");

  const availableRoomsForBooking = useMemo(() => {
    const roomTypeId = Number(bookingForm.room_type_id);
    return (choices?.rooms || []).filter(
      (room) => room.can_assign_booking && (!roomTypeId || room.room_type_id === roomTypeId),
    );
  }, [choices, bookingForm.room_type_id]);
  const availableRoomsForStay = useMemo(
    () => (choices?.rooms || []).filter((room) => room.can_open_stay),
    [choices],
  );
  const availableRoomsForDayUse = useMemo(
    () => (choices?.rooms || []).filter((room) => room.can_open_day_use),
    [choices],
  );

  const bookingValidation = useMemo(() => validateBookingForm(bookingForm), [bookingForm]);
  const stayValidation = useMemo(() => validateStayForm(stayForm), [stayForm]);
  const dayUseValidation = useMemo(() => validateDayUseForm(dayUseForm), [dayUseForm]);
  const paymentValidation = useMemo(() => validatePaymentForm(paymentForm), [paymentForm]);

  const bookingSummary = useMemo(() => {
    const roomTypeLabel = (choices?.room_types || []).find((item) => String(item.id) === String(bookingForm.room_type_id))?.label;
    const roomLabel = availableRoomsForBooking.find((item) => String(item.id) === String(bookingForm.room_id))?.label;
    return [
      {
        label: "Client",
        value: bookingForm.guest_id ? "Selection validee" : "A selectionner",
        tone: bookingForm.guest_id ? "good" : "warn",
      },
      {
        label: "Periode",
        value: bookingForm.check_in_date && bookingForm.check_out_date
          ? `${bookingForm.check_in_date} au ${bookingForm.check_out_date}`
          : "Dates a completer",
        tone: bookingForm.check_in_date && bookingForm.check_out_date && !bookingValidation.errors.check_out_date ? "good" : "warn",
      },
      {
        label: "Hebergement",
        value: roomLabel || roomTypeLabel || "Type ou chambre a preciser",
        tone: bookingForm.room_type_id ? "good" : "warn",
      },
      {
        label: "Montant previsionnel",
        value: bookingForm.estimated_amount ? `${bookingForm.estimated_amount}` : "Non renseigne",
        tone: bookingForm.estimated_amount ? "good" : "neutral",
      },
    ];
  }, [availableRoomsForBooking, bookingForm, bookingValidation.errors.check_out_date, choices?.room_types]);

  const dayUseSummary = useMemo(() => {
    const roomLabel = (choices?.rooms || []).find((item) => String(item.id) === String(dayUseForm.room_id))?.label;
    return [
      {
        label: "Client",
        value: dayUseForm.guest_id ? "Selection validee" : "A selectionner",
        tone: dayUseForm.guest_id ? "good" : "warn",
      },
      {
        label: "Chambre",
        value: roomLabel || "A preciser",
        tone: dayUseForm.room_id ? "good" : "warn",
      },
      {
        label: "Tarification",
        value: dayUseForm.package_price ? `${dayUseForm.package_price}` : "Formule a renseigner",
        tone: dayUseForm.package_price ? "good" : "warn",
      },
      {
        label: "Entree prevue",
        value: dayUseForm.planned_entry_at || "Horaire a completer",
        tone: dayUseForm.planned_entry_at ? "good" : "warn",
      },
    ];
  }, [choices?.rooms, dayUseForm]);

  const staySummary = useMemo(() => {
    const roomLabel = (choices?.rooms || []).find((item) => String(item.id) === String(stayForm.room_id))?.label;
    return [
      {
        label: "Client",
        value: stayForm.guest_id ? "Selection validee" : "A selectionner",
        tone: stayForm.guest_id ? "good" : "warn",
      },
      {
        label: "Chambre",
        value: roomLabel || "A preciser",
        tone: stayForm.room_id ? "good" : "warn",
      },
      {
        label: "Presence reelle",
        value: stayForm.actual_check_in || "Immediate si laisse vide",
        tone: "good",
      },
      {
        label: "Depart prevu",
        value: stayForm.planned_check_out || "A preciser plus tard",
        tone: stayForm.planned_check_out ? "good" : "neutral",
      },
    ];
  }, [choices?.rooms, stayForm]);

  const paymentSummary = useMemo(() => {
    const attachments = [paymentForm.booking_id, paymentForm.stay_id, paymentForm.day_use_id].filter(Boolean).length;
    let relatedLabel = "Rattachement a preciser";
    if (paymentForm.booking_id) {
      relatedLabel = "Reservation selectionnee";
    }
    if (paymentForm.stay_id) {
      relatedLabel = "Sejour selectionne";
    }
    if (paymentForm.day_use_id) {
      relatedLabel = "Day use selectionne";
    }
    return [
      {
        label: "Flux rattache",
        value: relatedLabel,
        tone: attachments === 1 ? "good" : "warn",
      },
      {
        label: "Montant",
        value: paymentForm.amount ? `${paymentForm.amount}` : "A renseigner",
        tone: paymentForm.amount && Number(paymentForm.amount) > 0 ? "good" : "warn",
      },
      {
        label: "Statut et mode",
        value: paymentForm.status && paymentForm.method ? `${paymentForm.status} - ${paymentForm.method}` : "A completer",
        tone: paymentForm.status && paymentForm.method ? "good" : "warn",
      },
      {
        label: "Horodatage",
        value: paymentForm.paid_at || "Date et heure a renseigner",
        tone: paymentForm.paid_at ? "good" : "warn",
      },
    ];
  }, [paymentForm]);
  const visibleTabs = useMemo(
    () => (canViewOperations || canCreateOperations ? OPERATION_TABS : []),
    [canCreateOperations, canViewOperations],
  );

  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(visibleTabs[0].key);
    }
  }, [activeTab, visibleTabs]);

  async function refreshData(currentSearch = search) {
    const requests = [
      { key: "choices", request: fetchJson("/api/operations/choices/") },
      {
        key: "bookings",
        request: fetchJson(`/api/operations/bookings/?search=${encodeURIComponent(currentSearch)}`),
      },
      { key: "stays", request: fetchJson("/api/operations/stays/") },
      { key: "dayUses", request: fetchJson("/api/operations/day-uses/") },
      { key: "payments", request: fetchJson("/api/operations/payments/") },
    ];
    const settledResults = await Promise.allSettled(requests.map((item) => item.request));
    const failedKeys = [];

    settledResults.forEach((result, index) => {
      const { key } = requests[index];
      if (result.status === "rejected") {
        failedKeys.push(key);
        return;
      }

      const payload = result.value;
      if (key === "choices") {
        setChoices(payload);
      }
      if (key === "bookings") {
        setBookings(payload.results || []);
      }
      if (key === "stays") {
        setStays(payload.results || []);
      }
      if (key === "dayUses") {
        setDayUses(payload.results || []);
      }
      if (key === "payments") {
        setPayments(payload.results || []);
      }
    });

    if (failedKeys.length === requests.length) {
      throw new Error("Impossible de charger le module operations pour le moment.");
    }

    return failedKeys;
  }

  useEffect(() => {
    if (!canViewOperations) {
      setStatus({
        error: "Vous n'avez pas les droits suffisants pour acceder a ce module.",
        warning: "",
        success: "",
        loading: false,
      });
      return;
    }
    refreshData()
      .then((failedKeys) => {
        if (failedKeys.length) {
          setStatus((current) => ({
            ...current,
            warning: "Certaines donnees operations sont indisponibles temporairement. L'ecran affiche les informations chargees.",
          }));
        }
      })
      .catch(() => {
        setStatus({
          error: "Impossible de charger le module operations pour le moment.",
          warning: "",
          success: "",
          loading: false,
        });
      })
      .finally(() => {
        setStatus((current) => ({ ...current, loading: false }));
      });
  }, [canViewOperations]);

  useEffect(() => {
    if (!canViewOperations) {
      return;
    }
    fetchJson(`/api/operations/bookings/?search=${encodeURIComponent(search)}`)
      .then((payload) => setBookings(payload.results || []))
      .catch(() => null);
  }, [canViewOperations, search]);

  async function handleSubmit(event, endpoint, form, resetFn, validation, invalidMessage, setSubmittingFn) {
    event.preventDefault();
    if (!canCreateOperations) {
      setStatus({
        error: "Vous n'avez pas les droits suffisants pour creer ce flux.",
        warning: "",
        success: "",
        loading: false,
      });
      return;
    }
    if (!validation.isValid) {
      setStatus({
        error: invalidMessage,
        warning: "",
        success: "",
        loading: false,
      });
      return;
    }
    setSubmittingFn(true);
    setStatus({ error: "", warning: "", success: "", loading: false });
    try {
      const payload = await postJson(endpoint, form);
      const failedKeys = await refreshData(search);
      setStatus({
        error: "",
        warning: failedKeys.length
          ? "L'operation a reussi, mais certaines listes n'ont pas pu etre rafraichies completement."
          : "",
        success: payload.message || "Operation enregistree avec succes.",
        loading: false,
      });
      resetFn();
    } catch (error) {
      setStatus({
        error: getRequestError(error, "Operation impossible."),
        warning: "",
        success: "",
        loading: false,
      });
    } finally {
      setSubmittingFn(false);
    }
  }

  async function handleAction(endpoint) {
    if (!canUpdateOperations) {
      setStatus({
        error: "Vous n'avez pas les droits suffisants pour executer cette action.",
        warning: "",
        success: "",
        loading: false,
      });
      return;
    }
    const confirmationMessage = getActionConfirmation(endpoint);
    if (confirmationMessage && !window.confirm(confirmationMessage)) {
      return;
    }

    setSubmittingAction(true);
    setStatus({ error: "", warning: "", success: "", loading: false });
    try {
      const payload = await postJson(endpoint, {});
      const failedKeys = await refreshData(search);
      setStatus({
        error: "",
        warning: failedKeys.length
          ? "L'action a reussi, mais certaines listes n'ont pas pu etre rafraichies completement."
          : "",
        success: payload.message || "Action metier executee avec succes.",
        loading: false,
      });
    } catch (error) {
      setStatus({
        error: getRequestError(error, "Action impossible."),
        warning: "",
        success: "",
        loading: false,
      });
    } finally {
      setSubmittingAction(false);
    }
  }

  return (
    <div className="page-stack dashboard-shell operations-page">
      <section className="dashboard-hero dashboard-hero-modern operations-hero">
        <div className="section-head">
          <div className="dashboard-hero-copy">
            <span className="eyebrow">Operations React</span>
            <h2>Poste de travail reception</h2>
            <p>
              Cree les principaux flux metier, retrouve rapidement une fiche
              et lance les transitions utiles sans quitter l'espace React.
            </p>
          </div>
          <div className="dashboard-hero-side">
            <div className="dashboard-hero-aside">
              <article className="dashboard-aside-card">
                <strong>Reservations</strong>
                <div className="dashboard-aside-value">{bookings.length}</div>
                <p>Resultats visibles dans la recherche en cours.</p>
              </article>
              <article className="dashboard-aside-card">
                <strong>Day use / Sejours</strong>
                <div className="dashboard-aside-value">{dayUses.length + stays.length}</div>
                <p>Flux actifs accessibles sans repasser par l'admin.</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      {status.loading ? <div className="status-box">Chargement de l'espace operations...</div> : null}
      {status.error ? <div className="alert-box">{status.error}</div> : null}
      {status.warning ? <div className="warning-box">{status.warning}</div> : null}
      {status.success ? <div className="success-box">{status.success}</div> : null}

      <section className="list-panel dashboard-panel operations-tabs-panel">
        <div className="report-tabs">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`report-tab-button ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {!visibleTabs.length ? (
        <EmptyStateCard
          title="Aucune action operations autorisee"
          description="Votre profil n'a pas encore les permissions necessaires pour utiliser ce poste de travail."
        />
      ) : null}

      {visibleTabs.length && activeTab === "booking" ? (
        <section className="dashboard-columns">
          <section className="list-panel dashboard-panel operations-form-panel">
            <div className="panel-head">
              <div>
                <h3>Nouvelle reservation</h3>
                <p>Enregistre une nouvelle reservation avec les informations essentielles de sejour.</p>
              </div>
            </div>
            {canCreateOperations ? (
              <form
                className="form-grid detail-form"
                onSubmit={(event) =>
                  handleSubmit(
                    event,
                    "/api/operations/bookings/create/",
                    bookingForm,
                    () => setBookingForm(initialBookingForm()),
                    bookingValidation,
                    "La reservation n'est pas prete a etre enregistree. Verifie les champs signales ci-dessous.",
                    setSubmittingBooking,
                  )
                }
              >
              <FieldGroup label="Client" help="Le dossier sera rattache au client selectionne." error={bookingValidation.errors.guest_id}>
                <AppSelect value={bookingForm.guest_id} onChange={(event) => setBookingForm((current) => ({ ...current, guest_id: event.target.value }))} name="booking_guest_id" required>
                  <option value="">Choisir un client</option>
                  {(choices?.guests || []).map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </AppSelect>
              </FieldGroup>
              <FieldGroup label="Type de chambre" help="Le type de chambre permet de cadrer la disponibilite attendue." error={bookingValidation.errors.room_type_id}>
                <AppSelect value={bookingForm.room_type_id} onChange={(event) => setBookingForm((current) => ({ ...current, room_type_id: event.target.value, room_id: "" }))} name="booking_room_type_id" required>
                  <option value="">Choisir un type de chambre</option>
                  {(choices?.room_types || []).map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </AppSelect>
              </FieldGroup>
              <FieldGroup label="Chambre attribuee" help="Optionnel a ce stade. L'attribution peut rester ouverte jusqu'au check-in.">
                <AppSelect value={bookingForm.room_id} onChange={(event) => setBookingForm((current) => ({ ...current, room_id: event.target.value }))} name="booking_room_id">
                  <option value="">Choisir une chambre</option>
                  {availableRoomsForBooking.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </AppSelect>
              </FieldGroup>
              <FieldGroup label="Source" help="La source aide au suivi commercial et a l'analyse des canaux.">
                <AppSelect value={bookingForm.source} onChange={(event) => setBookingForm((current) => ({ ...current, source: event.target.value }))} name="booking_source">
                  {(choices?.booking_sources || []).map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </AppSelect>
              </FieldGroup>
              <FieldGroup label="Arrivee" help="Date prevue de debut de sejour." error={bookingValidation.errors.check_in_date}>
                <DatePicker value={bookingForm.check_in_date} onChange={(event) => setBookingForm((current) => ({ ...current, check_in_date: event.target.value }))} name="check_in_date" required placeholder="Choisir une date" />
              </FieldGroup>
              <FieldGroup label="Depart" help="La date de depart doit etre posterieure a l'arrivee." error={bookingValidation.errors.check_out_date}>
                <DatePicker value={bookingForm.check_out_date} onChange={(event) => setBookingForm((current) => ({ ...current, check_out_date: event.target.value }))} name="check_out_date" minDate={bookingForm.check_in_date} required placeholder="Choisir une date" />
              </FieldGroup>
              <FieldGroup label="Adultes" help="Utilise cette valeur pour preparer l'occupation et la tarification." error={bookingValidation.errors.adults}>
                <input type="number" min="1" value={bookingForm.adults} onChange={(event) => setBookingForm((current) => ({ ...current, adults: Number(event.target.value) }))} placeholder="Adultes" />
              </FieldGroup>
              <FieldGroup label="Enfants" help="Laisse 0 si la reservation ne concerne que des adultes." error={bookingValidation.errors.children}>
                <input type="number" min="0" value={bookingForm.children} onChange={(event) => setBookingForm((current) => ({ ...current, children: Number(event.target.value) }))} placeholder="Enfants" />
              </FieldGroup>
              <FieldGroup label="Montant estime" help="Optionnel, utile pour anticiper l'encaissement." error={bookingValidation.errors.estimated_amount}>
                <input type="number" min="0" step="0.01" value={bookingForm.estimated_amount} onChange={(event) => setBookingForm((current) => ({ ...current, estimated_amount: event.target.value }))} placeholder="Montant estime" />
              </FieldGroup>
              <FieldGroup label="Notes internes" help="Ajoute ici les informations de contexte utiles a la reception." className="full-width">
                <textarea value={bookingForm.notes} onChange={(event) => setBookingForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes" />
              </FieldGroup>
              <ValidationSummary title="Verification avant creation" items={bookingSummary} ready={bookingValidation.isValid} />
                <button type="submit" className="primary-button full-width" disabled={submittingBooking}>{submittingBooking ? "Creation…" : "Creer la reservation"}</button>
              </form>
            ) : (
              <ReadOnlyActionNotice
                title="Creation non autorisee"
                description="Votre profil peut consulter les reservations, mais ne peut pas en creer depuis ce poste de travail."
              />
            )}
          </section>

          <section className="list-panel dashboard-panel">
            <div className="panel-head">
              <div>
                <h3>Reservations recentes</h3>
                <p>Retrouve une reservation recente et ouvre sa fiche en un clic.</p>
              </div>
            </div>
            <input className="filter-input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher par reference, client ou chambre" />
            <div className="table-like">
              {bookings.map((item) => (
                <article key={item.id} className="table-card detail-info-card">
                  <div className="table-row"><strong>Reference</strong><span>{item.reference}</span></div>
                  <div className="table-row"><strong>Client</strong><span>{item.guest}</span></div>
                  <div className="table-row"><strong>Type</strong><span>{item.room_type}</span></div>
                  <div className="table-row"><strong>Chambre</strong><span>{item.room}</span></div>
                  <div className="table-row"><strong>Statut</strong><span>{item.status}</span></div>
                  <div className="table-row"><strong>Sejour</strong><span>{item.check_in_date} au {item.check_out_date}</span></div>
                  <div className="action-row">
                    {canUpdateOperations ? (
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={!item.can_check_in || submittingAction}
                        onClick={() => handleAction(`/api/operations/bookings/${item.id}/check-in/`)}
                      >
                        {submittingAction ? "En cours…" : "Check-in"}
                      </button>
                    ) : null}
                    <Link className="secondary-button" to={item.detail_path}>
                      Voir la fiche
                    </Link>
                  </div>
                </article>
              ))}
              {!bookings.length ? (
                <EmptyStateCard
                  title="Aucune reservation a afficher"
                  description={
                    search
                      ? "Aucune reservation ne correspond a votre recherche actuelle. Elargissez les mots-clefs ou creez une nouvelle reservation."
                      : "Les reservations enregistrees apparaitront ici pour consultation et suivi rapide."
                  }
                />
              ) : null}
            </div>
          </section>
        </section>
      ) : null}

      {visibleTabs.length && activeTab === "stay" ? (
        <section className="dashboard-columns">
          <section className="list-panel dashboard-panel operations-form-panel">
            <div className="panel-head">
              <div>
                <h3>Nouveau sejour direct</h3>
                <p>Ouvre un sejour reel sans reservation prealable pour un walk-in ou une prise en charge immediate.</p>
              </div>
            </div>
            {canCreateOperations ? (
              <form
                className="form-grid detail-form"
                onSubmit={(event) =>
                  handleSubmit(
                    event,
                    "/api/operations/stays/create/",
                    stayForm,
                    () => setStayForm(initialStayForm()),
                    stayValidation,
                    "Le sejour n'est pas encore pret a etre ouvert. Verifie les champs signales ci-dessous.",
                    setSubmittingStay,
                  )
                }
              >
              <FieldGroup label="Client" help="Le sejour reel doit toujours etre rattache a un client." error={stayValidation.errors.guest_id}>
                <AppSelect value={stayForm.guest_id} onChange={(event) => setStayForm((current) => ({ ...current, guest_id: event.target.value }))} name="stay_guest_id" required>
                  <option value="">Choisir un client</option>
                  {(choices?.guests || []).map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </AppSelect>
              </FieldGroup>
              <FieldGroup label="Chambre" help="Choisis une chambre disponible a affecter immediatement." error={stayValidation.errors.room_id}>
                <AppSelect value={stayForm.room_id} onChange={(event) => setStayForm((current) => ({ ...current, room_id: event.target.value }))} name="stay_room_id" required>
                  <option value="">Choisir une chambre</option>
                  {availableRoomsForStay.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </AppSelect>
              </FieldGroup>
              <FieldGroup label="Origine" help="Permet de distinguer un walk-in, une saisie manuelle ou un autre canal.">
                <AppSelect value={stayForm.source} onChange={(event) => setStayForm((current) => ({ ...current, source: event.target.value }))} name="stay_source">
                  {(choices?.stay_sources || []).map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </AppSelect>
              </FieldGroup>
            <FieldGroup label="Arrivee prevue" help="Optionnel si l'entree reelle est immediate.">
              <DateTimePicker value={stayForm.planned_check_in} onChange={(event) => setStayForm((current) => ({ ...current, planned_check_in: event.target.value }))} name="stay_planned_check_in" placeholder="Choisir une date et une heure" />
            </FieldGroup>
            <FieldGroup label="Entree reelle" help="Laisse vide pour utiliser l'heure courante a l'ouverture." error={stayValidation.errors.actual_check_in}>
              <DateTimePicker value={stayForm.actual_check_in} onChange={(event) => setStayForm((current) => ({ ...current, actual_check_in: event.target.value }))} name="stay_actual_check_in" placeholder="Choisir une date et une heure" />
            </FieldGroup>
            <FieldGroup label="Depart prevu" help="Peut rester vide si la date de sortie n'est pas encore definie." error={stayValidation.errors.planned_check_out}>
              <DateTimePicker value={stayForm.planned_check_out} onChange={(event) => setStayForm((current) => ({ ...current, planned_check_out: event.target.value }))} name="stay_planned_check_out" placeholder="Choisir une date et une heure" />
            </FieldGroup>
              <FieldGroup label="Adultes" help="Occupation reelle du sejour." error={stayValidation.errors.adults_count}>
                <input type="number" min="1" value={stayForm.adults_count} onChange={(event) => setStayForm((current) => ({ ...current, adults_count: Number(event.target.value) }))} />
              </FieldGroup>
              <FieldGroup label="Enfants" help="Laisse 0 si aucun enfant n'est rattache." error={stayValidation.errors.children_count}>
                <input type="number" min="0" value={stayForm.children_count} onChange={(event) => setStayForm((current) => ({ ...current, children_count: Number(event.target.value) }))} />
              </FieldGroup>
              <FieldGroup label="Motif du sejour" help="Documente le contexte de venue si utile.">
                <input type="text" value={stayForm.purpose_of_stay} onChange={(event) => setStayForm((current) => ({ ...current, purpose_of_stay: event.target.value }))} placeholder="Business, transit, famille..." />
              </FieldGroup>
              <FieldGroup label="Demandes speciales" help="Informations utiles pour l'accueil et l'exploitation." className="full-width">
                <textarea value={stayForm.special_requests} onChange={(event) => setStayForm((current) => ({ ...current, special_requests: event.target.value }))} placeholder="Demandes speciales" />
              </FieldGroup>
              <FieldGroup label="Notes internes" help="Consignes reception, contexte ou incident d'ouverture." className="full-width">
                <textarea value={stayForm.notes} onChange={(event) => setStayForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes" />
              </FieldGroup>
              <ValidationSummary title="Verification avant ouverture" items={staySummary} ready={stayValidation.isValid} />
                <button type="submit" className="primary-button full-width" disabled={submittingStay}>{submittingStay ? "Ouverture…" : "Ouvrir le sejour"}</button>
              </form>
            ) : (
              <ReadOnlyActionNotice
                title="Ouverture non autorisee"
                description="Votre profil peut consulter les sejours, mais ne peut pas ouvrir un sejour direct depuis cette vue."
              />
            )}
          </section>

          <section className="list-panel dashboard-panel">
            <div className="panel-head">
              <div>
                <h3>Sejours recents</h3>
                <p>Distingue rapidement les dates prevues et reelles depuis la liste des sejours ouverts ou termines.</p>
              </div>
            </div>
            <div className="table-like">
              {stays.slice(0, 8).map((item) => (
                <article key={item.id} className="table-card detail-info-card">
                  <div className="table-row"><strong>Reference</strong><span>{item.reference}</span></div>
                  <div className="table-row"><strong>Client</strong><span>{item.guest}</span></div>
                  <div className="table-row"><strong>Chambre</strong><span>{item.room}</span></div>
                  <div className="table-row"><strong>Origine</strong><span>{item.source}</span></div>
                  <div className="table-row"><strong>Prevu</strong><span>{item.planned_check_out !== "-" ? item.planned_check_out : item.expected_check_out_date}</span></div>
                  <div className="table-row"><strong>Reel</strong><span>{item.actual_check_out}</span></div>
                  <div className="action-row">
                    <Link className="secondary-button" to={item.detail_path}>
                      Voir la fiche
                    </Link>
                  </div>
                </article>
              ))}
              {!stays.length ? (
                <EmptyStateCard
                  title="Aucun sejour recent"
                  description="Les sejours ouverts depuis check-in ou en direct apparaitront ici avec leur suivi operationnel."
                />
              ) : null}
            </div>
          </section>
        </section>
      ) : null}

      {visibleTabs.length && activeTab === "day_use" ? (
        <section className="list-panel dashboard-panel operations-form-panel">
          <div className="panel-head">
            <div>
              <h3>Nouveau day use</h3>
              <p>Prepare un nouveau day use avec sa chambre, sa formule et son horaire d'entree.</p>
            </div>
          </div>
          {canCreateOperations ? (
            <form
              className="form-grid detail-form"
              onSubmit={(event) =>
                handleSubmit(
                  event,
                  "/api/operations/day-use/create/",
                  dayUseForm,
                  () => setDayUseForm(initialDayUseForm()),
                  dayUseValidation,
                  "Le day use n'est pas encore pret a etre enregistre. Verifie les champs signales ci-dessous.",
                  setSubmittingDayUse,
                )
              }
            >
            <FieldGroup label="Client" help="Le client day use doit etre identifie avant l'encaissement." error={dayUseValidation.errors.guest_id}>
              <AppSelect value={dayUseForm.guest_id} onChange={(event) => setDayUseForm((current) => ({ ...current, guest_id: event.target.value }))} name="day_use_guest_id" required>
                <option value="">Choisir un client</option>
                {(choices?.guests || []).map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </AppSelect>
            </FieldGroup>
            <FieldGroup label="Chambre" help="Choisis une chambre disponible adaptee au flux day use." error={dayUseValidation.errors.room_id}>
              <AppSelect value={dayUseForm.room_id} onChange={(event) => setDayUseForm((current) => ({ ...current, room_id: event.target.value }))} name="day_use_room_id" required>
                <option value="">Choisir une chambre</option>
                {availableRoomsForDayUse.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </AppSelect>
            </FieldGroup>
            <FieldGroup label="Formule fixe" help="Montant principal facture pour le day use." error={dayUseValidation.errors.package_price}>
              <input type="number" min="0" step="0.01" value={dayUseForm.package_price} onChange={(event) => setDayUseForm((current) => ({ ...current, package_price: event.target.value }))} placeholder="Formule fixe" required />
            </FieldGroup>
            <FieldGroup label="Depassement" help="Choisis la regle de depassement a appliquer si necessaire.">
              <AppSelect value={String(dayUseForm.overtime_choice)} onChange={(event) => setDayUseForm((current) => ({ ...current, overtime_choice: Number(event.target.value) }))} name="day_use_overtime_choice">
                {(choices?.overtime_choices || []).map((item) => (
                  <option key={item.value} value={String(item.value)}>{item.label}</option>
                ))}
              </AppSelect>
            </FieldGroup>
            <FieldGroup label="Supplement" help="Laisse vide si aucun frais complementaire n'est prevu." error={dayUseValidation.errors.overtime_fee}>
              <input type="number" min="0" step="0.01" value={dayUseForm.overtime_fee} onChange={(event) => setDayUseForm((current) => ({ ...current, overtime_fee: event.target.value }))} placeholder="Frais de depassement" />
            </FieldGroup>
            <FieldGroup label="Entree prevue" help="Horaire previsionnel d'accueil du client." error={dayUseValidation.errors.planned_entry_at}>
              <DateTimePicker value={dayUseForm.planned_entry_at} onChange={(event) => setDayUseForm((current) => ({ ...current, planned_entry_at: event.target.value }))} name="day_use_planned_entry_at" required placeholder="Choisir une date et une heure" />
            </FieldGroup>
            <FieldGroup label="Notes internes" help="Informations utiles pour l'accueil ou l'exploitation." className="full-width">
              <textarea value={dayUseForm.notes} onChange={(event) => setDayUseForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes" />
            </FieldGroup>
            <ValidationSummary title="Verification avant creation" items={dayUseSummary} ready={dayUseValidation.isValid} />
              <button type="submit" className="primary-button full-width" disabled={submittingDayUse}>{submittingDayUse ? "Creation…" : "Creer le day use"}</button>
            </form>
          ) : (
            <ReadOnlyActionNotice
              title="Creation non autorisee"
              description="Votre profil peut suivre les day use, mais ne peut pas en creer depuis cette interface."
            />
          )}

          <div className="panel-head follow-up-head">
            <div>
              <h3>Day use recents</h3>
              <p>Retrouve rapidement les derniers day use et poursuis leur traitement depuis leur fiche.</p>
            </div>
          </div>
          <div className="table-like">
            {dayUses.slice(0, 6).map((item) => (
              <article key={item.id} className="table-card detail-info-card">
                <div className="table-row"><strong>Reference</strong><span>{item.reference}</span></div>
                <div className="table-row"><strong>Client</strong><span>{item.guest}</span></div>
                <div className="table-row"><strong>Statut</strong><span>{item.status}</span></div>
                <div className="table-row"><strong>Paye</strong><span>{item.paid_amount} / {item.total_amount}</span></div>
                <div className="action-row">
                  <Link className="secondary-button" to={item.detail_path}>
                    Voir la fiche
                  </Link>
                </div>
              </article>
            ))}
            {!dayUses.length ? (
              <EmptyStateCard
                title="Aucun day use recent"
                description="Les day use crees apparaitront ici pour faciliter l'encaissement, l'entree et la sortie."
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {visibleTabs.length && activeTab === "payment" ? (
        <section className="list-panel dashboard-panel operations-form-panel">
          <div className="panel-head">
            <div>
              <h3>Nouveau paiement</h3>
              <p>Enregistre un encaissement ou un ajustement sur reservation, sejour ou day use.</p>
            </div>
          </div>
          {canCreateOperations ? (
            <form
              className="form-grid detail-form"
              onSubmit={(event) =>
                handleSubmit(
                  event,
                  "/api/operations/payments/create/",
                  paymentForm,
                  () => setPaymentForm(initialPaymentForm()),
                  paymentValidation,
                  "Le paiement n'est pas pret a etre enregistre. Verifie le rattachement, le montant et l'horodatage.",
                  setSubmittingPayment,
                )
              }
            >
            <FieldGroup label="Reservation" help="Choisis ce champ seulement si le paiement concerne une reservation.">
              <AppSelect value={paymentForm.booking_id} onChange={(event) => setPaymentForm((current) => ({ ...current, booking_id: event.target.value, stay_id: "", day_use_id: "" }))} name="payment_booking_id">
                <option value="">Reservation optionnelle</option>
                {(choices?.bookings || []).map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </AppSelect>
            </FieldGroup>
            <FieldGroup label="Sejour" help="A utiliser a la place de la reservation si le paiement concerne un sejour en cours.">
              <AppSelect value={paymentForm.stay_id} onChange={(event) => setPaymentForm((current) => ({ ...current, booking_id: "", stay_id: event.target.value, day_use_id: "" }))} name="payment_stay_id">
                <option value="">Sejour optionnel</option>
                {(choices?.stays || []).map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </AppSelect>
            </FieldGroup>
            <FieldGroup label="Day use" help="A utiliser uniquement si l'encaissement est lie a un day use.">
              <AppSelect value={paymentForm.day_use_id} onChange={(event) => setPaymentForm((current) => ({ ...current, booking_id: "", stay_id: "", day_use_id: event.target.value }))} name="payment_day_use_id">
                <option value="">Day use optionnel</option>
                {(choices?.day_uses || []).map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </AppSelect>
            </FieldGroup>
            <FieldGroup label="Statut" help="Indique si le paiement est deja regle ou encore en attente." error={paymentValidation.errors.status}>
              <AppSelect value={paymentForm.status} onChange={(event) => setPaymentForm((current) => ({ ...current, status: event.target.value }))} name="payment_status">
                {(choices?.payment_statuses || []).map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </AppSelect>
            </FieldGroup>
            <FieldGroup label="Mode de paiement" help="Le mode choisi sera repris dans les rapports financiers." error={paymentValidation.errors.method}>
              <AppSelect value={paymentForm.method} onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value }))} name="payment_method">
                {(choices?.payment_methods || []).map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </AppSelect>
            </FieldGroup>
            <FieldGroup label="Montant" help="Le montant doit etre strictement positif." error={paymentValidation.errors.amount}>
              <input type="number" min="0" step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} placeholder="Montant" required />
            </FieldGroup>
            <FieldGroup label="Date et heure" help="Utilise l'horodatage reel de l'encaissement." error={paymentValidation.errors.paid_at}>
              <DateTimePicker value={paymentForm.paid_at} onChange={(event) => setPaymentForm((current) => ({ ...current, paid_at: event.target.value }))} name="payment_paid_at" required placeholder="Choisir une date et une heure" />
            </FieldGroup>
            <FieldGroup label="Notes internes" help="Precision utile pour un ecart, un ajustement ou un commentaire comptable." className="full-width" error={paymentValidation.errors.attachment}>
              <textarea value={paymentForm.notes} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes" />
            </FieldGroup>
            <ValidationSummary title="Verification avant enregistrement" items={paymentSummary} ready={paymentValidation.isValid} />
              <button type="submit" className="primary-button full-width" disabled={submittingPayment}>{submittingPayment ? "Enregistrement…" : "Enregistrer le paiement"}</button>
            </form>
          ) : (
            <ReadOnlyActionNotice
              title="Enregistrement non autorise"
              description="Votre profil peut consulter les paiements, mais ne peut pas en enregistrer de nouveaux depuis cette vue."
            />
          )}

          <div className="panel-head follow-up-head">
            <div>
              <h3>Paiements recents</h3>
              <p>Accede aux derniers paiements pour controle, correction ou remboursement.</p>
            </div>
          </div>
          <div className="table-like">
            {payments.slice(0, 8).map((item) => (
              <article key={item.id} className="table-card detail-info-card">
                <div className="table-row"><strong>Reference</strong><span>{item.reference}</span></div>
                <div className="table-row"><strong>Montant</strong><span>{item.amount}</span></div>
                <div className="table-row"><strong>Mode</strong><span>{item.method}</span></div>
                <div className="table-row"><strong>Statut</strong><span>{item.status}</span></div>
                <div className="action-row">
                  <Link className="secondary-button" to={item.detail_path}>
                    Voir la fiche
                  </Link>
                </div>
              </article>
            ))}
            {!payments.length ? (
              <EmptyStateCard
                title="Aucun paiement recent"
                description="Les paiements enregistres dans l'application seront affiches ici avec un acces direct a leur fiche detail."
              />
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="dashboard-columns dashboard-columns-equal dashboard-lower-grid">
        <section className="list-panel dashboard-panel">
          <div className="panel-head">
            <div>
              <h3>Sejours en cours</h3>
              <p>Surveille les sejours actifs et cloture-les depuis ce poste de travail.</p>
            </div>
          </div>
          <div className="table-like">
            {stays.map((item) => (
              <article key={item.id} className="table-card detail-info-card">
                <div className="table-row"><strong>Reference</strong><span>{item.reference}</span></div>
                <div className="table-row"><strong>Client</strong><span>{item.guest}</span></div>
                <div className="table-row"><strong>Chambre</strong><span>{item.room}</span></div>
                <div className="table-row"><strong>Arrivee reelle</strong><span>{item.actual_check_in}</span></div>
                <div className="table-row"><strong>Depart prevu</strong><span>{item.planned_check_out !== "-" ? item.planned_check_out : item.expected_check_out_date}</span></div>
                <div className="table-row"><strong>Occupants</strong><span>{item.number_of_guests}</span></div>
                <div className="action-row">
                  {canUpdateOperations ? (
                    <button
                      type="button"
                      className="secondary-button danger"
                      disabled={!item.can_check_out}
                      onClick={() => handleAction(`/api/operations/stays/${item.id}/check-out/`)}
                    >
                      Check-out
                    </button>
                  ) : null}
                  <Link className="secondary-button" to={item.detail_path}>
                    Voir la fiche
                  </Link>
                </div>
              </article>
            ))}
            {!stays.length ? (
              <EmptyStateCard
                title="Aucun sejour actif a traiter"
                description="Les sejours ouverts apparaitront ici des qu'un check-in est effectue."
              />
            ) : null}
          </div>
        </section>

        <section className="list-panel dashboard-panel">
          <div className="panel-head">
            <div>
              <h3>Suivi day use</h3>
              <p>Poursuis les entrees et sorties day use sans changer d'ecran ni perdre le contexte.</p>
            </div>
          </div>
          <div className="table-like">
            {dayUses.map((item) => (
              <article key={item.id} className="table-card detail-info-card">
                <div className="table-row"><strong>Reference</strong><span>{item.reference}</span></div>
                <div className="table-row"><strong>Client</strong><span>{item.guest}</span></div>
                <div className="table-row"><strong>Chambre</strong><span>{item.room}</span></div>
                <div className="table-row"><strong>Statut</strong><span>{item.status}</span></div>
                <div className="table-row"><strong>Paye</strong><span>{item.paid_amount} / {item.total_amount}</span></div>
                {canUpdateOperations ? (
                  <div className="action-row dual">
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={!item.can_check_in}
                      onClick={() => handleAction(`/api/operations/day-use/${item.id}/check-in/`)}
                    >
                      Entree
                    </button>
                    <button
                      type="button"
                      className="secondary-button danger"
                      disabled={!item.can_check_out}
                      onClick={() => handleAction(`/api/operations/day-use/${item.id}/check-out/`)}
                    >
                      Sortie
                    </button>
                  </div>
                ) : null}
                <div className="action-row">
                  <Link className="secondary-button" to={item.detail_path}>
                    Voir la fiche
                  </Link>
                </div>
              </article>
            ))}
            {!dayUses.length ? (
              <EmptyStateCard
                title="Aucun day use actif"
                description="Lorsqu'un day use sera en attente d'entree ou de sortie, il apparaitra ici avec ses actions rapides."
              />
            ) : null}
          </div>
        </section>
      </section>
    </div>
  );
}
