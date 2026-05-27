import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";

import { fetchJson, postJson } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { canPerformAction, hasPermission } from "../../auth/permissions";
import { AppSelect } from "../../shared/components/AppSelect";
import { ConfirmModal } from "../../shared/components/ConfirmModal";
import { DatePicker } from "../../shared/components/DatePicker";
import { DateTimePicker } from "../../shared/components/DateTimePicker";
import { useToast } from "../../shared/toast/ToastContext";
import "./OperationsPage.css";

const OPERATION_TABS = [
  { key: "booking", label: "Reservation" },
  { key: "stay", label: "Sejour" },
  { key: "day_use", label: "Day use" },
  { key: "payment", label: "Paiement" },
];

const statusMotion = {
  initial: { opacity: 0, y: -8, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.985 },
  transition: { duration: 0.18, ease: "easeOut" },
};

const tabPanelMotion = {
  initial: { opacity: 0, y: 24, scale: 0.992 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 210, damping: 26, mass: 0.9 },
  },
  exit: { opacity: 0, y: -12, scale: 0.992, transition: { duration: 0.16, ease: "easeIn" } },
};

const listMotion = {
  animate: { transition: { staggerChildren: 0.045 } },
};

const listItemMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.18, ease: "easeOut" } },
};

const sheetOverlayMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.18, ease: "easeOut" },
};

const bottomSheetMotion = {
  initial: { opacity: 0, y: 48, scale: 0.985 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 260, damping: 28, mass: 0.9 },
  },
  exit: { opacity: 0, y: 36, scale: 0.985, transition: { duration: 0.16, ease: "easeInOut" } },
};

const actionTapMotion = { scale: 0.98 };

const railTransition = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.75,
};

function getTodayISO() {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  return today.toISOString().slice(0, 10);
}

function getCreatedDetailPath(payload) {
  return (
    payload?.booking?.detail_path
    || payload?.stay?.detail_path
    || payload?.day_use?.detail_path
    || payload?.payment?.detail_path
    || payload?.detail_path
    || ""
  );
}

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
    advance_amount: "",
    advance_method: "cash",
    advance_reference: "",
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
    invoice_id: "",
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

function buildSubmitPayload(endpoint, form) {
  if (endpoint.includes("/bookings/create/")) {
    return {
      ...form,
      check_in_date: form.check_in_date,
      check_out_date: form.check_out_date,
    };
  }
  return form;
}

function getActionMeta(endpoint) {
  if (endpoint.includes("/bookings/") && endpoint.endsWith("/check-in/")) {
    return {
      title: "Confirmer le check-in",
      message: "Le sejour sera ouvert immediatement et la chambre attribuee au client.",
      variant: "default",
    };
  }
  if (endpoint.includes("/stays/") && endpoint.endsWith("/check-out/")) {
    return {
      title: "Confirmer le check-out",
      message: "Cette action cloture definitivement le sejour. Le passage du client sera marque comme termine.",
      variant: "danger",
    };
  }
  if (endpoint.includes("/day-use/") && endpoint.endsWith("/check-in/")) {
    return {
      title: "Confirmer l'entree day use",
      message: "Le flux day use passera en statut \"En cours\" des la confirmation.",
      variant: "default",
    };
  }
  if (endpoint.includes("/day-use/") && endpoint.endsWith("/check-out/")) {
    return {
      title: "Confirmer la sortie day use",
      message: "Le flux day use sera marque comme termine. Cette action est irreversible.",
      variant: "danger",
    };
  }
  return null;
}

function validateBookingForm(form) {
  const errors = {};
  const todayISO = getTodayISO();
  if (!form.guest_id) {
    errors.guest_id = "Selectionne le client avant de valider.";
  }
  if (!form.room_type_id) {
    errors.room_type_id = "Selectionne le type de chambre attendu.";
  }
  if (!form.check_in_date) {
    errors.check_in_date = "Renseigne la date d'arrivee.";
  }
  if (form.check_in_date && form.check_in_date < todayISO) {
    errors.check_in_date = "La date d'arrivee ne peut pas etre anterieure a aujourd'hui.";
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
  if (form.advance_amount === "" || Number(form.advance_amount) <= 0) {
    errors.advance_amount = "Une avance est requise avant confirmation.";
  }
  if (form.advance_amount !== "" && form.estimated_amount !== "" && Number(form.advance_amount) > Number(form.estimated_amount)) {
    errors.advance_amount = "L'avance ne peut pas depasser le montant estime.";
  }
  if (!form.advance_method) {
    errors.advance_method = "Selectionne le mode de paiement de l'avance.";
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

function formatDateTime(isoString) {
  if (!isoString || isoString === "-") return "-";
  try {
    return new Date(isoString).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

function formatDate(isoString) {
  if (!isoString || isoString === "-") return "-";
  try {
    return new Date(isoString).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch {
    return isoString;
  }
}

export function OperationsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const todayISO = useMemo(() => getTodayISO(), []);
  const [activeTab, setActiveTab] = useState("booking");
  const [choices, setChoices] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [stays, setStays] = useState([]);
  const [dayUses, setDayUses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [search, setSearch] = useState("");
  const [bookingDateFrom, setBookingDateFrom] = useState("");
  const [bookingDateTo, setBookingDateTo] = useState("");
  const [bookingForm, setBookingForm] = useState(initialBookingForm());
  const [stayForm, setStayForm] = useState(initialStayForm());
  const [dayUseForm, setDayUseForm] = useState(initialDayUseForm());
  const [paymentForm, setPaymentForm] = useState(initialPaymentForm());
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [submittingStay, setSubmittingStay] = useState(false);
  const [submittingDayUse, setSubmittingDayUse] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [paymentFluxTab, setPaymentFluxTab] = useState("stay");
  const [paymentDue, setPaymentDue] = useState(null);
  const [paymentDueLoading, setPaymentDueLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", variant: "default", endpoint: "" });
  const [status, setStatus] = useState({ error: "", warning: "", success: "", loading: true });
  const canViewOperations = hasPermission(user, "operations", "view");
  const canCreateOperations = hasPermission(user, "operations", "create");
  const canUpdateOperations = hasPermission(user, "operations", "update");
  const canRecordPayment = canPerformAction(user, "payments.record");
  const canCheckIn = canPerformAction(user, "operations.check_in");
  const canCheckOut = canPerformAction(user, "operations.check_out");
  const canCancelOperation = canPerformAction(user, "operations.cancel");
  const [showBookingsSheet, setShowBookingsSheet] = useState(false);
  const [showStaysSheet, setShowStaysSheet] = useState(false);
  const [staySearch, setStaySearch] = useState("");

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
      {
        label: "Avance",
        value: bookingForm.advance_amount ? `${bookingForm.advance_amount}` : "A encaisser",
        tone: bookingForm.advance_amount && !bookingValidation.errors.advance_amount ? "good" : "warn",
      },
    ];
  }, [availableRoomsForBooking, bookingForm, bookingValidation.errors.advance_amount, bookingValidation.errors.check_out_date, choices?.room_types]);

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
    const params = new URLSearchParams(location.search);
    const action = params.get("action");
    const clientId = params.get("client_id");
    const roomId = params.get("room_id");
    const checkInDate = params.get("check_in_date");
    const validTabs = new Set(OPERATION_TABS.map((tab) => tab.key));

    if (action && validTabs.has(action)) {
      setActiveTab(action);
    }

    if (!clientId && !roomId && !checkInDate) {
      return;
    }

    if (!action || action === "booking") {
      setBookingForm((current) => ({
        ...current,
        ...(clientId    ? { guest_id: clientId }           : {}),
        ...(roomId      ? { room_id: roomId }               : {}),
        ...(checkInDate ? { check_in_date: checkInDate }    : {}),
      }));
    }
    if (action === "stay") {
      setStayForm((current) => ({ ...current, ...(clientId ? { guest_id: clientId } : {}) }));
    }
    if (action === "day_use") {
      setDayUseForm((current) => ({ ...current, ...(clientId ? { guest_id: clientId } : {}) }));
    }
  }, [location.search]);

  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(visibleTabs[0].key);
    }
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    const stayId    = paymentForm.stay_id;
    const bookingId = paymentForm.booking_id;
    const dayUseId  = paymentForm.day_use_id;

    let endpoint = null;
    let entityType = null;

    if (stayId) {
      endpoint = `/api/operations/stays/${stayId}/`;
      entityType = "stay";
    } else if (bookingId) {
      endpoint = `/api/operations/bookings/${bookingId}/`;
      entityType = "booking";
    } else if (dayUseId) {
      endpoint = `/api/operations/day-uses/${dayUseId}/`;
      entityType = "day_use";
    }

    if (!endpoint) {
      setPaymentDue(null);
      return;
    }

    let cancelled = false;
    setPaymentDueLoading(true);

    fetchJson(endpoint)
      .then((data) => {
        if (cancelled) return;
        /* summary_cards contiennent les valeurs financières sous forme de strings "125000.00" */
        const byLabel = {};
        (data.summary_cards || []).forEach((c) => {
          byLabel[c.label] = Number(c.value) || 0;
        });

        let total = 0, paid = 0, remaining = 0;
        const activeInvoice = (data.related_records?.invoices || []).find((invoice) =>
          ["draft", "issued", "partially_paid"].includes(invoice.status_code) && Number(invoice.balance_due) > 0
        );

        if (entityType === "booking") {
          total     = byLabel["Montant estime"] || 0;
          paid      = byLabel["Montant encaisse"] || 0;
          remaining = Math.max(0, total - paid);
        } else if (entityType === "stay") {
          paid      = byLabel["Montant encaisse"] || 0;
          remaining = byLabel["Solde restant"] || 0;
          total     = paid + remaining;
        } else {
          total     = byLabel["Montant total"] || 0;
          paid      = byLabel["Montant encaisse"] || 0;
          remaining = byLabel["Solde"] || 0;
        }

        const labelPrefix = entityType === "stay" ? "Séjour"
          : entityType === "booking" ? "Réservation"
          : "Day use";

        setPaymentDue({
          total,
          paid,
          remaining,
          label: `${labelPrefix} ${data.reference || ""}`.trim(),
          invoice: activeInvoice || null,
        });
        setPaymentForm((current) => {
          const stillSameFlow =
            (entityType === "stay" && String(current.stay_id) === String(stayId)) ||
            (entityType === "booking" && String(current.booking_id) === String(bookingId)) ||
            (entityType === "day_use" && String(current.day_use_id) === String(dayUseId));
          if (!stillSameFlow) return current;
          return { ...current, invoice_id: activeInvoice?.id || "" };
        });
      })
      .catch(() => {
        if (!cancelled) setPaymentDue(null);
      })
      .finally(() => {
        if (!cancelled) setPaymentDueLoading(false);
      });

    return () => { cancelled = true; };
  }, [paymentForm.stay_id, paymentForm.booking_id, paymentForm.day_use_id]);

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
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (bookingDateFrom) params.set("date_from", bookingDateFrom);
    if (bookingDateTo) params.set("date_to", bookingDateTo);
    fetchJson(`/api/operations/bookings/?${params}`)
      .then((payload) => setBookings(payload.results || []))
      .catch(() => null);
  }, [canViewOperations, search, bookingDateFrom, bookingDateTo]);

  useEffect(() => {
    if (status.error) toast.error(status.error);
  }, [status.error, toast]);

  useEffect(() => {
    if (status.warning) toast.warning(status.warning);
  }, [status.warning, toast]);

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
      const payload = await postJson(endpoint, buildSubmitPayload(endpoint, form));
      const failedKeys = await refreshData(search);
      const successMessage = payload.message || "Operation enregistree avec succes.";
      const actionPath = getCreatedDetailPath(payload);
      toast.success(successMessage, actionPath ? { actionLabel: "Voir →", actionPath } : undefined);
      setStatus({
        error: "",
        warning: failedKeys.length
          ? "L'operation a reussi, mais certaines listes n'ont pas pu etre rafraichies completement."
          : "",
        success: "",
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

  async function executeAction(endpoint) {
    setSubmittingAction(true);
    setStatus({ error: "", warning: "", success: "", loading: false });
    try {
      const payload = await postJson(endpoint, {});
      const failedKeys = await refreshData(search);
      const successMessage = payload.message || "Action metier executee avec succes.";
      const actionPath = getCreatedDetailPath(payload);
      toast.success(successMessage, actionPath ? { actionLabel: "Voir →", actionPath } : undefined);
      setStatus({
        error: "",
        warning: failedKeys.length
          ? "L'action a reussi, mais certaines listes n'ont pas pu etre rafraichies completement."
          : "",
        success: "",
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

  function handleAction(endpoint) {
    if (!canUpdateOperations) {
      setStatus({
        error: "Vous n'avez pas les droits suffisants pour executer cette action.",
        warning: "",
        success: "",
        loading: false,
      });
      return;
    }
    const meta = getActionMeta(endpoint);
    if (meta) {
      setConfirmModal({ isOpen: true, ...meta, endpoint });
      return;
    }
    executeAction(endpoint);
  }

  const FLUX_CONFIG = {
    booking: {
      icon: "ti-calendar-plus",
      label: "Réservation",
      sub: "Nouvelle + liste",
      colorClass: "ops-flux--teal",
      kpis: [
        { n: bookings.length, l: "résultats" },
        { n: stays.length, l: "séjours actifs", color: "#16a34a" },
      ],
    },
    stay: {
      icon: "ti-door-enter",
      label: "Séjour",
      sub: "Check-in direct",
      colorClass: "ops-flux--green",
      kpis: [
        { n: stays.length, l: "séjours actifs" },
        { n: bookings.length, l: "réservations" },
      ],
    },
    day_use: {
      icon: "ti-clock",
      label: "Day use",
      sub: "Entrée / sortie",
      colorClass: "ops-flux--amber",
      kpis: [
        { n: dayUses.length, l: "day use actifs" },
      ],
    },
    payment: {
      icon: "ti-cash",
      label: "Paiement",
      sub: "Encaissement",
      colorClass: "ops-flux--gray",
      kpis: [
        { n: payments.length, l: "paiements" },
      ],
    },
  };

  return (
    <div className="page-stack dashboard-shell operations-page">

      {/* ── STATUS BOXES ── */}
      <AnimatePresence>
        {status.loading ? <motion.div key="loading" className="status-box" {...statusMotion}>Chargement de l'espace operations...</motion.div> : null}
      </AnimatePresence>

      {!visibleTabs.length ? (
        <EmptyStateCard
          title="Aucune action operations autorisee"
          description="Votre profil n'a pas encore les permissions necessaires pour utiliser ce poste de travail."
        />
      ) : (

        /* ── LAYOUT PRINCIPAL : rail gauche + zone contenu ── */
        <div className="ops-layout">

          {/* ── RAIL GAUCHE FIXE 80px ── */}
          <nav className="ops-rail" aria-label="Flux opérationnels">
            {visibleTabs.map((tab) => {
              const cfg = FLUX_CONFIG[tab.key];
              if (!cfg) return null;
              const isActive = activeTab === tab.key;
              const count = tab.key === "booking" ? bookings.length
                          : tab.key === "stay"    ? stays.length
                          : tab.key === "day_use" ? dayUses.length
                          : payments.length;
              return (
                <motion.button
                  key={tab.key}
                  type="button"
                  className={[
                    "ops-rail-item",
                    isActive ? "ops-rail-item--active" : "",
                    isActive ? cfg.colorClass : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => setActiveTab(tab.key)}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={cfg.label}
                  whileTap={actionTapMotion}
                  animate={{ scale: isActive ? 1.02 : 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                >
                  {isActive ? (
                    <>
                      <motion.span
                        className={`ops-rail-active-bg ${cfg.colorClass}`}
                        layoutId="ops-rail-active-bg"
                        transition={railTransition}
                        aria-hidden="true"
                      />
                      <motion.span
                        className={`ops-rail-active-line ${cfg.colorClass}`}
                        layoutId="ops-rail-active-line"
                        transition={railTransition}
                        aria-hidden="true"
                      />
                    </>
                  ) : null}
                  <motion.div
                    className="ops-rail-icon"
                    animate={{ y: isActive ? -1 : 0, scale: isActive ? 1.08 : 1 }}
                    transition={railTransition}
                  >
                    <i className={`ti ${cfg.icon}`} aria-hidden="true" />
                  </motion.div>
                  <motion.span
                    className="ops-rail-label"
                    animate={{ opacity: isActive ? 1 : 0.72, y: isActive ? -1 : 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                    {cfg.label}
                  </motion.span>
                  <AnimatePresence mode="popLayout">
                    {count > 0 && (
                      <motion.span
                        key={`${tab.key}-${count}`}
                        className="ops-rail-count"
                        initial={{ opacity: 0, scale: 0.7, y: -4 }}
                        animate={{ opacity: 1, scale: isActive ? 1.08 : 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.7, y: -4 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                      >
                        {count}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </nav>

          {/* ── ZONE CONTENU ── */}
          <div className="ops-content">

            {/* ── HEADER CONTEXTUEL ── */}
            {/* ── ONGLET RÉSERVATION ── */}
            <AnimatePresence mode="wait">
            {activeTab === "booking" ? (
              <motion.div key="booking" className="ops-flux-body" {...tabPanelMotion}>
                <section className="list-panel dashboard-panel operations-form-panel">
                  <div className="ops-booking-header">

                    {/* Moitié gauche — fond sombre */}
                    <div className="ops-bh-dark">
                      <div className="ops-bh-glow" aria-hidden="true" />
                      <div className="ops-bh-eyebrow">
                        <i className="ti ti-calendar-plus" aria-hidden="true" />
                        Flux réservation
                      </div>
                      <h3 className="ops-bh-title">Nouvelle réservation</h3>
                      <p className="ops-bh-sub">
                        Enregistre les informations essentielles du séjour
                        et rattache le dossier client.
                      </p>
                      <div className="ops-bh-badges">
                        <span className="ops-bh-badge ops-bh-badge--amber">
                          {bookings.filter((b) =>
                            ["pending", "en_attente", "confirmed"].includes(b.status)
                          ).length} en attente
                        </span>
                        <span className="ops-bh-badge ops-bh-badge--green">
                          {stays.length} actif{stays.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    {/* Moitié droite — fond clair */}
                    <div className="ops-bh-light">
                      <div className="ops-bh-icon">
                        <i className="ti ti-calendar-plus" aria-hidden="true" />
                      </div>
                      <div className="ops-bh-stat">
                        <div className="ops-bh-stat-n">{bookings.length}</div>
                        <div className="ops-bh-stat-l">réservations</div>
                      </div>
                      <motion.button
                        type="button"
                        className="ops-bh-trigger"
                        onClick={() => setShowBookingsSheet(true)}
                        aria-label="Voir les réservations récentes"
                      >
                        <i className="ti ti-table" aria-hidden="true" />
                        Voir tout
                      </motion.button>
                    </div>

                  </div>
                  {canCreateOperations ? (
                    <form
                      className="form-grid detail-form ops-booking-split-form"
                      onSubmit={(event) =>
                        handleSubmit(
                          event,
                          "/api/operations/bookings/create/",
                          bookingForm,
                          () => setBookingForm(initialBookingForm()),
                          bookingValidation,
                          "La réservation n'est pas prête à être enregistrée.",
                          setSubmittingBooking,
                        )
                      }
                    >
                      {/* ── COLONNE GAUCHE : champs ── */}
                      <div className="ops-bsf-fields">
                        <div className="ops-bsf-row">
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
                        </div>
                        <div className="ops-bsf-row">
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
                        </div>
                        <div className="ops-bsf-row">
                          <FieldGroup label="Arrivee" help="La reservation est possible uniquement a partir d'aujourd'hui." error={bookingValidation.errors.check_in_date}>
                            <DatePicker
                              value={bookingForm.check_in_date}
                              onChange={(event) =>
                                setBookingForm((current) => ({
                                  ...current,
                                  check_in_date: event.target.value,
                                }))
                              }
                              minDate={todayISO}
                              name="booking_check_in_date"
                              required
                              aria-invalid={Boolean(bookingValidation.errors.check_in_date)}
                              placeholder="Choisir une date"
                            />
                          </FieldGroup>
                          <FieldGroup label="Depart" help="La date de depart doit etre posterieure a l'arrivee." error={bookingValidation.errors.check_out_date}>
                            <DatePicker
                              value={bookingForm.check_out_date}
                              onChange={(event) =>
                                setBookingForm((current) => ({
                                  ...current,
                                  check_out_date: event.target.value,
                                }))
                              }
                              minDate={bookingForm.check_in_date || todayISO}
                              name="booking_check_out_date"
                              required
                              aria-invalid={Boolean(bookingValidation.errors.check_out_date)}
                              placeholder="Choisir une date"
                            />
                          </FieldGroup>
                        </div>
                        <div className="ops-bsf-row ops-bsf-row--3">
                          <FieldGroup label="Adultes" help="Utilise cette valeur pour preparer l'occupation et la tarification." error={bookingValidation.errors.adults}>
                            <input type="number" min="1" value={bookingForm.adults} onChange={(event) => setBookingForm((current) => ({ ...current, adults: Number(event.target.value) }))} placeholder="Adultes" />
                          </FieldGroup>
                          <FieldGroup label="Enfants" help="Laisse 0 si la reservation ne concerne que des adultes." error={bookingValidation.errors.children}>
                            <input type="number" min="0" value={bookingForm.children} onChange={(event) => setBookingForm((current) => ({ ...current, children: Number(event.target.value) }))} placeholder="Enfants" />
                          </FieldGroup>
                          <FieldGroup label="Montant estime" help="Optionnel, utile pour anticiper l'encaissement." error={bookingValidation.errors.estimated_amount}>
                            <input type="number" min="0" step="0.01" value={bookingForm.estimated_amount} onChange={(event) => setBookingForm((current) => ({ ...current, estimated_amount: event.target.value }))} placeholder="Montant estime" />
                          </FieldGroup>
                        </div>
                        <div className="ops-bsf-row ops-bsf-row--3">
                          <FieldGroup label="Avance a payer" help="Cette avance generera automatiquement une facture et un paiement." error={bookingValidation.errors.advance_amount}>
                            <input type="number" min="1" step="0.01" value={bookingForm.advance_amount} onChange={(event) => setBookingForm((current) => ({ ...current, advance_amount: event.target.value }))} placeholder="Avance" />
                          </FieldGroup>
                          <FieldGroup label="Mode avance" help="Mode d'encaissement de l'avance." error={bookingValidation.errors.advance_method}>
                            <AppSelect value={bookingForm.advance_method} onChange={(event) => setBookingForm((current) => ({ ...current, advance_method: event.target.value }))} name="booking_advance_method">
                              {(choices?.payment_methods || []).map((item) => (
                                <option key={item.value} value={item.value}>{item.label}</option>
                              ))}
                            </AppSelect>
                          </FieldGroup>
                          <FieldGroup label="Reference avance" help="Optionnel : numero mobile money, recu, virement...">
                            <input type="text" value={bookingForm.advance_reference} onChange={(event) => setBookingForm((current) => ({ ...current, advance_reference: event.target.value }))} placeholder="Reference" />
                          </FieldGroup>
                        </div>
                        <FieldGroup label="Notes internes" help="Ajoute ici les informations de contexte utiles a la reception.">
                          <textarea value={bookingForm.notes} onChange={(event) => setBookingForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes" />
                        </FieldGroup>
                      </div>

                      {/* ── COLONNE DROITE : checklist + submit ── */}
                      <div className="ops-bsf-sidebar">

                        <div className="ops-bsf-check-title">Vérification</div>

                        <div className="ops-bsf-check-list">
                          {bookingSummary.map((item) => (
                            <div key={item.label} className={`ops-bsf-check-item ops-bsf-check-item--${item.tone}`}>
                              <i
                                className={`ti ${item.tone === "good" ? "ti-circle-check" : "ti-circle-dashed"}`}
                                aria-hidden="true"
                              />
                              <div>
                                <div className="ops-bsf-check-label">{item.label}</div>
                                <div className="ops-bsf-check-value">{item.value}</div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="ops-bsf-spacer" />

                        <motion.button
                          type="submit"
                          className="ops-bsf-submit"
                          disabled={submittingBooking}
                          whileTap={actionTapMotion}
                          animate={{ scale: submittingBooking ? 0.98 : 1 }}
                        >
                          <i className="ti ti-plus" aria-hidden="true" />
                          {submittingBooking ? "Enregistrement…" : "Créer"}
                        </motion.button>

                      </div>
                    </form>
                  ) : (
                    <ReadOnlyActionNotice
                      title="Creation non autorisee"
                      description="Votre profil peut consulter les reservations, mais ne peut pas en creer depuis ce poste de travail."
                    />
                  )}
                </section>

              </motion.div>
            ) : null}

            {/* ── ONGLET SÉJOUR ── */}
            {activeTab === "stay" ? (
              <motion.div key="stay" className="ops-flux-body" {...tabPanelMotion}>
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
                      <motion.article key={item.id} className="table-card detail-info-card" {...listItemMotion}>
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
                      </motion.article>
                    ))}
                    {!stays.length ? (
                      <EmptyStateCard
                        title="Aucun sejour recent"
                        description="Les sejours ouverts depuis check-in ou en direct apparaitront ici avec leur suivi operationnel."
                      />
                    ) : null}
                  </div>
                </section>
              </motion.div>
            ) : null}

            {/* ── ONGLET DAY USE ── */}
            {activeTab === "day_use" ? (
              <motion.div key="day_use" className="ops-flux-body" {...tabPanelMotion}>
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
                </section>

                <section className="list-panel dashboard-panel">
                  <div className="panel-head">
                    <div>
                      <h3>Day use recents</h3>
                      <p>Retrouve rapidement les derniers day use et poursuis leur traitement depuis leur fiche.</p>
                    </div>
                  </div>
                  <div className="table-like">
                    {dayUses.slice(0, 6).map((item) => (
                      <motion.article key={item.id} className="table-card detail-info-card" {...listItemMotion}>
                        <div className="table-row"><strong>Reference</strong><span>{item.reference}</span></div>
                        <div className="table-row"><strong>Client</strong><span>{item.guest}</span></div>
                        <div className="table-row"><strong>Statut</strong><span>{item.status}</span></div>
                        <div className="table-row"><strong>Paye</strong><span>{item.paid_amount} / {item.total_amount}</span></div>
                        <div className="action-row">
                          <Link className="secondary-button" to={item.detail_path}>
                            Voir la fiche
                          </Link>
                        </div>
                      </motion.article>
                    ))}
                    {!dayUses.length ? (
                      <EmptyStateCard
                        title="Aucun day use recent"
                        description="Les day use crees apparaitront ici pour faciliter l'encaissement, l'entree et la sortie."
                      />
                    ) : null}
                  </div>
                </section>
              </motion.div>
            ) : null}

            {/* ── ONGLET PAIEMENT ── */}
            {activeTab === "payment" ? (
              <motion.div key="payment" className="ops-flux-body" {...tabPanelMotion}>
                <section className="list-panel dashboard-panel operations-form-panel">

                  <div className="ops-pay-shell">

                    {/* ── HEADER ── */}
                    <div className="ops-pay-header">
                      <div className="ops-pay-header-bar" aria-hidden="true" />
                      <div className="ops-pay-header-copy">
                        <div className="ops-pay-header-eyebrow">Flux paiement</div>
                        <h3 className="ops-pay-header-title">Encaissement rapide</h3>
                      </div>
                      <div className="ops-pay-header-right">
                        <span className="ops-pay-header-badge ops-pay-header-badge--warn">
                          {payments.filter((p) =>
                            ["pending", "en_attente"].includes((p.status || "").toLowerCase())
                          ).length} en attente
                        </span>
                        <span className="ops-pay-header-badge ops-pay-header-badge--ok">
                          {payments.length} récents
                        </span>
                      </div>
                    </div>

                    {/* ── BODY SPLIT ── */}
                    <div className="ops-pay-body">

                      {/* ── COLONNE GAUCHE : formulaire ── */}
                      <div className="ops-pay-form-col">
                        {canCreateOperations ? (
                          <form
                            id="ops-pay-form-el"
                            className="ops-pay-form"
                            onSubmit={(event) =>
                              handleSubmit(
                                event,
                                "/api/operations/payments/create/",
                                paymentForm,
                                () => setPaymentForm(initialPaymentForm()),
                                paymentValidation,
                                "Le paiement n'est pas prêt à être enregistré.",
                                setSubmittingPayment,
                              )
                            }
                          >

                            {/* ── 1. Rattachement ── */}
                            <div className="ops-pay-section">
                              <div className="ops-pay-section-label">Rattacher à</div>
                              <div className="ops-pay-flux-tabs">
                                {[
                                  { key: "stay",    label: "Séjour"      },
                                  { key: "booking", label: "Réservation" },
                                  { key: "day_use", label: "Day use"     },
                                ].map((tab) => (
                                  <button
                                    key={tab.key}
                                    type="button"
                                    className={[
                                      "ops-pay-flux-tab",
                                      paymentFluxTab === tab.key ? "ops-pay-flux-tab--active" : "",
                                    ].filter(Boolean).join(" ")}
                                    onClick={() => setPaymentFluxTab(tab.key)}
                                  >
                                    {tab.label}
                                  </button>
                                ))}
                              </div>

                              {paymentFluxTab === "stay" && (
                                <FieldGroup label="" error={paymentValidation.errors.stay_id}>
                                  <AppSelect value={paymentForm.stay_id} onChange={(event) => setPaymentForm((current) => ({ ...current, booking_id: "", stay_id: event.target.value, day_use_id: "", invoice_id: "" }))} name="payment_stay_id">
                                    <option value="">Séjour optionnel</option>
                                    {(choices?.stays || []).map((item) => (
                                      <option key={item.id} value={item.id}>{item.label}</option>
                                    ))}
                                  </AppSelect>
                                </FieldGroup>
                              )}
                              {paymentFluxTab === "booking" && (
                                <FieldGroup label="" error={paymentValidation.errors.booking_id}>
                                  <AppSelect value={paymentForm.booking_id} onChange={(event) => setPaymentForm((current) => ({ ...current, booking_id: event.target.value, stay_id: "", day_use_id: "", invoice_id: "" }))} name="payment_booking_id">
                                    <option value="">Réservation optionnelle</option>
                                    {(choices?.bookings || []).map((item) => (
                                      <option key={item.id} value={item.id}>{item.label}</option>
                                    ))}
                                  </AppSelect>
                                </FieldGroup>
                              )}
                              {paymentFluxTab === "day_use" && (
                                <FieldGroup label="" error={paymentValidation.errors.day_use_id}>
                                  <AppSelect value={paymentForm.day_use_id} onChange={(event) => setPaymentForm((current) => ({ ...current, booking_id: "", stay_id: "", day_use_id: event.target.value, invoice_id: "" }))} name="payment_day_use_id">
                                    <option value="">Day use optionnel</option>
                                    {(choices?.day_uses || []).map((item) => (
                                      <option key={item.id} value={item.id}>{item.label}</option>
                                    ))}
                                  </AppSelect>
                                </FieldGroup>
                              )}
                              {paymentValidation.errors.attachment && (
                                <div className="ops-pay-field-error">{paymentValidation.errors.attachment}</div>
                              )}

                              {/* ── Solde restant dû ── */}
                              {paymentDueLoading && (
                                <div className="ops-pdue-loading">
                                  <i className="ti ti-loader-2 ops-pdue-spin" aria-hidden="true" />
                                  Chargement du solde…
                                </div>
                              )}

                              {!paymentDueLoading && paymentDue && (
                                <div className="ops-pdue-block">

                                  <div className="ops-pdue-info">
                                    <i className="ti ti-receipt" aria-hidden="true" />
                                    <span className="ops-pdue-info-text">
                                      {paymentDue.label} · Total{" "}
                                      <strong>{paymentDue.total.toLocaleString("fr-FR")} XOF</strong>
                                      {paymentDue.paid > 0 && (
                                        <> · Encaissé{" "}
                                          <strong className="ops-pdue-paid">
                                            {paymentDue.paid.toLocaleString("fr-FR")} XOF
                                          </strong>
                                        </>
                                      )}
                                      {" "} · Solde dû{" "}
                                      <strong className={paymentDue.remaining <= 0 ? "ops-pdue-zero" : "ops-pdue-remaining"}>
                                        {Math.max(0, paymentDue.remaining).toLocaleString("fr-FR")} XOF
                                      </strong>
                                    </span>
                                  </div>
                                  <div className={`ops-pdue-invoice ${paymentDue.invoice ? "ops-pdue-invoice--linked" : "ops-pdue-invoice--auto"}`}>
                                    <i className={`ti ${paymentDue.invoice ? "ti-file-check" : "ti-file-plus"}`} aria-hidden="true" />
                                    {paymentDue.invoice ? (
                                      <span>
                                        Paiement rattache a la facture <strong>{paymentDue.invoice.reference}</strong>
                                        {" · Solde facture "}
                                        <strong>{Number(paymentDue.invoice.balance_due || 0).toLocaleString("fr-FR")} XOF</strong>
                                      </span>
                                    ) : (
                                      <span>
                                        Aucune facture active detectee : une facture d'avance sera creee automatiquement et liee au paiement.
                                      </span>
                                    )}
                                  </div>

                                  {paymentDue.remaining > 0 && (
                                    <div className="ops-pdue-shortcuts">
                                      {[
                                        { label: "Acompte 30%", value: Math.round(paymentDue.remaining * 0.30), variant: "neutral" },
                                        { label: "50%",          value: Math.round(paymentDue.remaining * 0.50), variant: "neutral" },
                                        {
                                          label: `Solde complet · ${paymentDue.remaining.toLocaleString("fr-FR")} XOF`,
                                          value: paymentDue.remaining,
                                          variant: "primary",
                                        },
                                      ].map((shortcut) => (
                                        <button
                                          key={shortcut.label}
                                          type="button"
                                          className={`ops-pdue-shortcut ops-pdue-shortcut--${shortcut.variant}`}
                                          onClick={() => setPaymentForm((current) => ({ ...current, amount: String(shortcut.value) }))}
                                          disabled={submittingPayment}
                                        >
                                          {shortcut.label}
                                        </button>
                                      ))}
                                    </div>
                                  )}

                                  {paymentDue.remaining > 0 && Number(paymentForm.amount) > 0 && (
                                    <div className={`ops-pdue-simulation ${
                                      Number(paymentForm.amount) >= paymentDue.remaining
                                        ? "ops-pdue-simulation--zero"
                                        : "ops-pdue-simulation--partial"
                                    }`}>
                                      <i
                                        className={`ti ${
                                          Number(paymentForm.amount) >= paymentDue.remaining
                                            ? "ti-circle-check"
                                            : "ti-info-circle"
                                        }`}
                                        aria-hidden="true"
                                      />
                                      Après ce paiement : solde ={" "}
                                      <strong>
                                        {Math.max(0, paymentDue.remaining - Number(paymentForm.amount)).toLocaleString("fr-FR")} XOF
                                      </strong>
                                      {Number(paymentForm.amount) >= paymentDue.remaining
                                        ? " · Soldé ✓"
                                        : " · Paiement partiel"}
                                    </div>
                                  )}

                                  {paymentDue.remaining <= 0 && (
                                    <div className="ops-pdue-simulation ops-pdue-simulation--zero">
                                      <i className="ti ti-circle-check" aria-hidden="true" />
                                      Ce {paymentDue.label.toLowerCase()} est déjà soldé.
                                    </div>
                                  )}

                                </div>
                              )}
                            </div>

                            {/* ── 2. Montant ── */}
                            <div className="ops-pay-section">
                              <div className="ops-pay-amount-wrap">
                                <span className="ops-pay-amount-currency">XOF</span>
                                <input
                                  type="number"
                                  className={[
                                    "ops-pay-amount-input",
                                    paymentValidation.errors.amount ? "ops-pay-amount-input--error" : "",
                                  ].filter(Boolean).join(" ")}
                                  value={paymentForm.amount}
                                  onChange={(e) => setPaymentForm((c) => ({ ...c, amount: e.target.value }))}
                                  placeholder="0"
                                  min="0.01"
                                  step="any"
                                  disabled={submittingPayment}
                                  aria-invalid={Boolean(paymentValidation.errors.amount)}
                                  aria-label="Montant"
                                />
                              </div>
                              {paymentValidation.errors.amount && (
                                <div className="ops-pay-field-error">{paymentValidation.errors.amount}</div>
                              )}
                            </div>

                            {/* ── 3. Mode de paiement ── */}
                            <div className="ops-pay-section">
                              <div className="ops-pay-section-label">Mode de paiement *</div>
                              <div className="ops-pay-mode-grid">
                                {[
                                  { value: "cash",         label: "Espèces",  icon: "ti-cash"          },
                                  { value: "card",         label: "CB",       icon: "ti-credit-card"   },
                                  { value: "mobile_money", label: "Mobile",   icon: "ti-device-mobile" },
                                  { value: "transfer",     label: "Virement", icon: "ti-building-bank" },
                                ].map((mode) => (
                                  <button
                                    key={mode.value}
                                    type="button"
                                    className={[
                                      "ops-pay-mode-btn",
                                      paymentForm.method === mode.value ? "ops-pay-mode-btn--active" : "",
                                    ].filter(Boolean).join(" ")}
                                    onClick={() => setPaymentForm((c) => ({ ...c, method: mode.value }))}
                                    disabled={submittingPayment}
                                  >
                                    <i className={`ti ${mode.icon}`} aria-hidden="true" />
                                    {mode.label}
                                  </button>
                                ))}
                              </div>
                              {paymentValidation.errors.method && (
                                <div className="ops-pay-field-error">{paymentValidation.errors.method}</div>
                              )}
                            </div>

                            {/* ── 4. Date + Statut ── */}
                            <div className="ops-pay-row-2">
                              <FieldGroup label="Date et heure *" error={paymentValidation.errors.paid_at}>
                                <DateTimePicker value={paymentForm.paid_at} onChange={(event) => setPaymentForm((current) => ({ ...current, paid_at: event.target.value }))} name="payment_paid_at" required placeholder="Choisir une date et une heure" />
                              </FieldGroup>
                              <FieldGroup label="Statut" error={paymentValidation.errors.status}>
                                <AppSelect value={paymentForm.status} onChange={(event) => setPaymentForm((current) => ({ ...current, status: event.target.value }))} name="payment_status">
                                  {(choices?.payment_statuses || []).map((item) => (
                                    <option key={item.value} value={item.value}>{item.label}</option>
                                  ))}
                                </AppSelect>
                              </FieldGroup>
                            </div>

                            {/* ── 5. Notes ── */}
                            <FieldGroup
                              label="Notes internes"
                              help="Précision utile pour un écart, ajustement ou commentaire comptable."
                              error={paymentValidation.errors.notes}
                            >
                              <textarea value={paymentForm.notes} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes" />
                            </FieldGroup>

                          </form>
                        ) : (
                          <ReadOnlyActionNotice
                            title="Enregistrement non autorisé"
                            description="Votre profil peut consulter les paiements, mais ne peut pas en créer."
                          />
                        )}
                      </div>

                      {/* ── COLONNE DROITE : récapitulatif + submit ── */}
                      <div className="ops-pay-sidebar">

                        <div className="ops-pay-sidebar-title">Récapitulatif</div>

                        <div className="ops-pay-recap-card">
                          {paymentSummary.map((item) => (
                            <div
                              key={item.label}
                              className={`ops-pay-recap-row ops-pay-recap-row--${item.tone}`}
                            >
                              <span className="ops-pay-recap-label">{item.label}</span>
                              <span className="ops-pay-recap-value">
                                <i
                                  className={`ti ${item.tone === "good" ? "ti-circle-check" : "ti-circle-dashed"}`}
                                  aria-hidden="true"
                                />
                                {item.value}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="ops-pay-sidebar-sep" />

                        <div className="ops-pay-sidebar-title">Récents</div>
                        <div className="ops-pay-recent-list">
                          {payments.slice(0, 4).map((p) => (
                            <div key={p.id} className="ops-pay-recent-row">
                              <span className="ops-pay-recent-ref">{p.reference || p.id}</span>
                              <span className="ops-pay-recent-amount">
                                {Number(p.amount || 0).toLocaleString("fr-FR")} XOF
                              </span>
                            </div>
                          ))}
                          {!payments.length && (
                            <div className="ops-pay-recent-empty">Aucun paiement récent</div>
                          )}
                        </div>

                        <div className="ops-pay-sidebar-spacer" />

                        <button
                          type="submit"
                          form="ops-pay-form-el"
                          className="ops-pay-submit"
                          disabled={submittingPayment}
                        >
                          {submittingPayment ? (
                            <>
                              <i className="ti ti-loader-2 ops-pay-spin" aria-hidden="true" />
                              Enregistrement…
                            </>
                          ) : (
                            <>
                              <i className="ti ti-plus" aria-hidden="true" />
                              Enregistrer le paiement
                            </>
                          )}
                        </button>

                      </div>
                    </div>

                  </div>

                </section>
              </motion.div>
            ) : null}
            </AnimatePresence>

            {/* ── BANDE INFÉRIEURE : SÉJOURS EN COURS + SUIVI DAY USE ── */}
            <section className="dashboard-columns dashboard-columns-equal dashboard-lower-grid dashboard-lower-grid--single">
              <div className="ops-lower-panel">
                <div className="ops-lower-head">
                  <div className="ops-lower-title">Séjours en cours</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="ops-lower-count">
                      {stays.length} actif{stays.length !== 1 ? "s" : ""}
                    </span>
                    <button
                      type="button"
                      className="ops-sheet-trigger ops-sheet-trigger--stays"
                      onClick={() => setShowStaysSheet(true)}
                      aria-label="Voir tous les séjours en cours"
                    >
                      <i className="ti ti-table" aria-hidden="true" />
                      Voir les séjours
                    </button>
                  </div>
                </div>

                <div className="ops-lower-list">
                  {stays.slice(0, 2).map((item) => {
                    const isOverdue = item.planned_check_out &&
                      item.planned_check_out !== "-" &&
                      item.planned_check_out < new Date().toISOString();
                    return (
                      <motion.div
                        key={item.id}
                        className={`ops-stay-row ${isOverdue ? "ops-stay-row--overdue" : ""}`}
                        {...listItemMotion}
                      >
                        <div className="ops-stay-info">
                          <div className="ops-stay-name">{item.guest}</div>
                          <div className="ops-stay-meta">
                            <i
                              className={`ti ${isOverdue ? "ti-alert-circle" : "ti-clock"}`}
                              aria-hidden="true"
                            />
                            {isOverdue ? "En retard — " : "Départ prévu "}
                            {item.planned_check_out && item.planned_check_out !== "-"
                              ? new Date(item.planned_check_out).toLocaleString("fr-FR", {
                                  day: "2-digit", month: "2-digit",
                                  hour: "2-digit", minute: "2-digit",
                                })
                              : "—"}
                          </div>
                        </div>
                        <div className="ops-stay-right">
                          <span className="ops-room-tag">{item.room}</span>
                          <div className="ops-stay-actions">
                            {canUpdateOperations ? (
                              <motion.button
                                type="button"
                                className="ops-btn ops-btn--danger"
                                disabled={!item.can_check_out || submittingAction}
                                onClick={() =>
                                  handleAction(`/api/operations/stays/${item.id}/check-out/`)
                                }
                                whileTap={actionTapMotion}
                                animate={{ scale: submittingAction ? 0.98 : 1 }}
                              >
                                Check-out
                              </motion.button>
                            ) : null}
                            <Link className="ops-btn ops-btn--ghost" to={item.detail_path}>
                              Fiche
                            </Link>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}

                  {stays.length > 2 && (
                    <button
                      type="button"
                      className="ops-show-more-btn"
                      onClick={() => setShowStaysSheet(true)}
                    >
                      <i className="ti ti-dots" aria-hidden="true" />
                      {stays.length - 2} séjour{stays.length - 2 > 1 ? "s" : ""} de plus — voir tout
                    </button>
                  )}

                  {!stays.length ? (
                    <div className="ops-lower-empty">
                      <i className="ti ti-moon" aria-hidden="true" />
                      Aucun séjour actif à traiter
                    </div>
                  ) : null}
                </div>
              </div>

            </section>

          </div>
        </div>
      )}

      {/* ── CONFIRM MODAL — INCHANGÉ ── */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmLabel="Confirmer"
        cancelLabel="Annuler"
        onConfirm={() => {
          const { endpoint } = confirmModal;
          setConfirmModal({ isOpen: false, title: "", message: "", variant: "default", endpoint: "" });
          executeAction(endpoint);
        }}
        onCancel={() => setConfirmModal({ isOpen: false, title: "", message: "", variant: "default", endpoint: "" })}
      />

      <AnimatePresence>
      {showBookingsSheet ? (
        <>
          <motion.div
            className="ops-sheet-overlay"
            onClick={() => setShowBookingsSheet(false)}
            aria-hidden="true"
            {...sheetOverlayMotion}
          />

          <motion.div
            className="ops-bottom-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Réservations récentes"
            {...bottomSheetMotion}
          >
            <div className="ops-sheet-handle-area">
              <div className="ops-sheet-handle" aria-hidden="true" />
            </div>

            <div className="ops-sheet-head">
              <div className="ops-sheet-title">
                <i className="ti ti-table" aria-hidden="true" />
                Réservations récentes
                <span className="ops-sheet-badge">{bookings.length}</span>
              </div>
              <button
                type="button"
                className="ops-sheet-close"
                onClick={() => setShowBookingsSheet(false)}
                aria-label="Fermer"
              >
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>

            <div className="ops-sheet-search-wrap">
              <i className="ti ti-search ops-sheet-search-ico" aria-hidden="true" />
              <input
                className="ops-sheet-search"
                type="search"
                placeholder="Référence, client ou chambre…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className="ops-sheet-date-filters">
                <div className="ops-sheet-date-filter-group">
                  <span className="ops-sheet-date-filter-label">Arrivée du</span>
                  <DatePicker
                    value={bookingDateFrom}
                    onChange={(e) => {
                      setBookingDateFrom(e.target.value);
                      if (bookingDateTo && e.target.value > bookingDateTo) setBookingDateTo("");
                    }}
                    placeholder="Date début"
                    maxDate={bookingDateTo || undefined}
                  />
                </div>
                <div className="ops-sheet-date-filter-group">
                  <span className="ops-sheet-date-filter-label">au</span>
                  <DatePicker
                    value={bookingDateTo}
                    onChange={(e) => setBookingDateTo(e.target.value)}
                    placeholder="Date fin"
                    minDate={bookingDateFrom || undefined}
                  />
                </div>
                {(bookingDateFrom || bookingDateTo) && (
                  <button
                    type="button"
                    className="ops-sheet-date-clear"
                    onClick={() => { setBookingDateFrom(""); setBookingDateTo(""); }}
                    aria-label="Effacer les filtres de date"
                  >
                    <i className="ti ti-x" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            <div className="ops-sheet-table-wrap">
              <table className="ops-sheet-table">
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Client</th>
                    <th>Chambre</th>
                    <th>Période</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((item) => (
                    <motion.tr key={item.id} {...listItemMotion}>
                      <td>
                        <span className="ops-sheet-ref">{item.reference}</span>
                      </td>
                      <td>
                        <span className="ops-sheet-name">{item.guest}</span>
                      </td>
                      <td>
                        {item.room
                          ? `Ch. ${item.room}${item.room_type ? ` · ${item.room_type}` : ""}`
                          : item.room_type || "—"}
                      </td>
                      <td>
                        {item.check_in_date && item.check_out_date
                          ? `${item.check_in_date} → ${item.check_out_date}`
                          : "—"}
                      </td>
                      <td>
                        <span className={`ops-sheet-status ops-sheet-status--${item.status}`}>
                          {item.status_display || item.status}
                        </span>
                      </td>
                      <td>
                        <div className="ops-sheet-actions">
                          {canUpdateOperations ? (
                            <motion.button
                              type="button"
                              className="ops-sheet-btn ops-sheet-btn--primary"
                              disabled={item.can_check_in === false || submittingAction}
                              onClick={() => {
                                handleAction(`/api/operations/bookings/${item.id}/check-in/`);
                                setShowBookingsSheet(false);
                              }}
                              whileTap={actionTapMotion}
                              animate={{ scale: submittingAction ? 0.98 : 1 }}
                            >
                              Check-in
                            </motion.button>
                          ) : null}
                          <Link
                            className="ops-sheet-btn"
                            to={item.detail_path}
                            onClick={() => setShowBookingsSheet(false)}
                          >
                            Fiche
                          </Link>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>

              {!bookings.length ? (
                <div className="ops-sheet-empty">
                  <i className="ti ti-inbox" aria-hidden="true" />
                  Aucune réservation trouvée
                </div>
              ) : null}
            </div>

            <div className="ops-sheet-foot">
              <span className="ops-sheet-foot-count">
                {bookings.length} réservation{bookings.length !== 1 ? "s" : ""} chargée{bookings.length !== 1 ? "s" : ""}
              </span>
              <button
                type="button"
                className="ops-sheet-btn"
                onClick={() => setShowBookingsSheet(false)}
              >
                Fermer
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
      </AnimatePresence>

      <AnimatePresence>
      {showStaysSheet ? (
        <>
          <motion.div
            className="ops-sheet-overlay"
            onClick={() => setShowStaysSheet(false)}
            aria-hidden="true"
            {...sheetOverlayMotion}
          />

          <motion.div
            className="ops-bottom-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Séjours en cours"
            {...bottomSheetMotion}
          >
            <div className="ops-sheet-handle-area">
              <div className="ops-sheet-handle" aria-hidden="true" />
            </div>

            <div className="ops-sheet-head">
              <div className="ops-sheet-title">
                <i className="ti ti-door-enter" aria-hidden="true" />
                Séjours en cours
                <span className="ops-sheet-badge ops-sheet-badge--green">
                  {stays.length}
                </span>
              </div>
              <button
                type="button"
                className="ops-sheet-close"
                onClick={() => setShowStaysSheet(false)}
                aria-label="Fermer"
              >
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>

            <div className="ops-sheet-search-wrap">
              <i className="ti ti-search ops-sheet-search-ico" aria-hidden="true" />
              <input
                className="ops-sheet-search"
                type="search"
                placeholder="Nom du client, chambre ou référence…"
                value={staySearch}
                onChange={(e) => setStaySearch(e.target.value)}
              />
            </div>

            <div className="ops-sheet-table-wrap">
              <table className="ops-sheet-table">
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Client</th>
                    <th>Chambre</th>
                    <th>Arrivée réelle</th>
                    <th>Départ prévu</th>
                    <th>Occupants</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stays
                    .filter((item) =>
                      !staySearch ||
                      (item.guest || "").toLowerCase().includes(staySearch.toLowerCase()) ||
                      String(item.room || "").includes(staySearch) ||
                      (item.reference || "").toLowerCase().includes(staySearch.toLowerCase())
                    )
                    .map((item) => {
                      const isOverdue = item.planned_check_out &&
                        item.planned_check_out !== "-" &&
                        item.planned_check_out < new Date().toISOString();
                      return (
                        <motion.tr key={item.id} className={isOverdue ? "ops-sheet-row--overdue" : ""} {...listItemMotion}>
                          <td>
                            <span className="ops-sheet-ref">{item.reference}</span>
                          </td>
                          <td>
                            <span className="ops-sheet-name">{item.guest}</span>
                          </td>
                          <td>Ch. {item.room}</td>
                          <td>
                            {item.actual_check_in && item.actual_check_in !== "-"
                              ? new Date(item.actual_check_in).toLocaleString("fr-FR", {
                                  day: "2-digit", month: "2-digit", year: "numeric",
                                  hour: "2-digit", minute: "2-digit",
                                })
                              : "—"}
                          </td>
                          <td className={isOverdue ? "ops-sheet-cell--overdue" : ""}>
                            {item.planned_check_out && item.planned_check_out !== "-"
                              ? new Date(item.planned_check_out).toLocaleString("fr-FR", {
                                  day: "2-digit", month: "2-digit", year: "numeric",
                                  hour: "2-digit", minute: "2-digit",
                                })
                              : "—"}
                            {isOverdue && (
                              <span className="ops-sheet-overdue-badge">En retard</span>
                            )}
                          </td>
                          <td>{item.adults_count ?? item.occupants ?? "—"}</td>
                          <td>
                            <span className={`ops-sheet-status ${isOverdue ? "ops-sheet-status--overdue" : "ops-sheet-status--active"}`}>
                              {isOverdue ? "En retard" : "En cours"}
                            </span>
                          </td>
                          <td>
                            <div className="ops-sheet-actions">
                              {canUpdateOperations ? (
                                <motion.button
                                  type="button"
                                  className="ops-sheet-btn ops-sheet-btn--danger"
                                  disabled={!item.can_check_out || submittingAction}
                                  onClick={() => {
                                    handleAction(`/api/operations/stays/${item.id}/check-out/`);
                                    setShowStaysSheet(false);
                                  }}
                                  whileTap={actionTapMotion}
                                  animate={{ scale: submittingAction ? 0.98 : 1 }}
                                >
                                  Check-out
                                </motion.button>
                              ) : null}
                              <Link
                                className="ops-sheet-btn"
                                to={item.detail_path}
                                onClick={() => setShowStaysSheet(false)}
                              >
                                Fiche
                              </Link>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                </tbody>
              </table>

              {!stays.length ? (
                <div className="ops-sheet-empty">
                  <i className="ti ti-moon" aria-hidden="true" />
                  Aucun séjour actif en ce moment
                </div>
              ) : null}
            </div>

            <div className="ops-sheet-foot">
              <span className="ops-sheet-foot-count">
                <i className="ti ti-door-enter" aria-hidden="true" />
                {stays.length} séjour{stays.length !== 1 ? "s" : ""} actif{stays.length !== 1 ? "s" : ""}
              </span>
              <button
                type="button"
                className="ops-sheet-btn"
                onClick={() => setShowStaysSheet(false)}
              >
                Fermer
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
      </AnimatePresence>
    </div>
  );
}
