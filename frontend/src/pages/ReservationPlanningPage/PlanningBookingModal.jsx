import { useEffect, useMemo, useRef, useState } from "react";
import { fetchJson, postJson } from "../../api/client";
import { AppSelect } from "../../shared/components/AppSelect";
import { DatePicker } from "../../shared/components/DatePicker";
import "./PlanningBookingModal.css";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getTodayISO() {
  return new Date().toISOString().split("T")[0];
}

function fmtShortDate(iso) {
  if (!iso) return "–";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

function parseAmount(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value)
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function daysBetween(startISO, endISO) {
  if (!startISO || !endISO || endISO <= startISO) return 0;
  const start = new Date(`${startISO}T12:00:00`);
  const end = new Date(`${endISO}T12:00:00`);
  return Math.max(0, Math.round((end - start) / 86400000));
}

function formatAmount(amount) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount)} XOF`;
}

function initialBookingForm(prefill = {}) {
  return {
    guest_id: prefill.guestId != null ? String(prefill.guestId) : "",
    room_type_id: prefill.roomTypeId != null ? String(prefill.roomTypeId) : "",
    room_id: prefill.roomId != null ? String(prefill.roomId) : "",
    source: "walk_in",
    check_in_date: prefill.checkInDate ?? "",
    check_out_date: "",
    adults: 1,
    children: 0,
    notes: "",
  };
}

function validateBookingForm(form) {
  const errors = {};
  const today = getTodayISO();

  if (!form.guest_id) errors.guest_id = "Client requis.";
  if (!form.room_type_id) errors.room_type_id = "Type de chambre requis.";
  if (!form.check_in_date) {
    errors.check_in_date = "Date d'arrivée requise.";
  } else if (form.check_in_date < today) {
    errors.check_in_date = "La date d'arrivée ne peut pas être dans le passé.";
  }
  if (!form.check_out_date) {
    errors.check_out_date = "Date de départ requise.";
  } else if (form.check_in_date && form.check_out_date <= form.check_in_date) {
    errors.check_out_date = "La date de départ doit être après l'arrivée.";
  }
  if (Number(form.adults) < 1) errors.adults = "Au moins 1 adulte.";
  if (Number(form.children) < 0) errors.children = "Valeur invalide.";

  return errors;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function PlanningBookingModal({ prefill, onClose, onSuccess, isClosing }) {
  const [form, setForm] = useState(() => initialBookingForm(prefill));
  const [choices, setChoices] = useState(null);
  const [choicesLoading, setChoicesLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const firstFieldRef = useRef(null);

  // Load choices once on mount
  useEffect(() => {
    let cancelled = false;
    setChoicesLoading(true);
    fetchJson("/api/operations/choices/")
      .then((data) => {
        if (!cancelled) setChoices(data);
      })
      .catch(() => {
        if (!cancelled) setChoices({ guests: [], room_types: [], rooms: [], booking_sources: [] });
      })
      .finally(() => {
        if (!cancelled) setChoicesLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Pre-select room_type_id from prefill room if possible, after choices load
  useEffect(() => {
    if (!choices || !prefill?.roomId) return;
    const matchedRoom = choices.rooms?.find((r) => String(r.id) === String(prefill.roomId));
    setForm((f) => ({
      ...f,
      room_id: matchedRoom?.id != null ? String(matchedRoom.id) : f.room_id,
      room_type_id: matchedRoom?.room_type_id != null
        ? String(matchedRoom.room_type_id)
        : f.room_type_id,
    }));
  }, [choices, prefill?.roomId]);

  // Focus first interactive field
  useEffect(() => {
    const t = setTimeout(() => firstFieldRef.current?.focus?.(), 260);
    return () => clearTimeout(t);
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const availableRooms = useMemo(() => {
    if (!choices?.rooms) return [];
    return choices.rooms.filter(
      (r) => r.can_assign_booking && (!form.room_type_id || String(r.room_type_id) === String(form.room_type_id))
    );
  }, [choices, form.room_type_id]);

  const selectedRoomType = useMemo(() => {
    if (!choices?.room_types || !form.room_type_id) return null;
    return choices.room_types.find((rt) => String(rt.id) === String(form.room_type_id)) ?? null;
  }, [choices, form.room_type_id]);

  const estimatedNights = useMemo(
    () => daysBetween(form.check_in_date, form.check_out_date),
    [form.check_in_date, form.check_out_date]
  );

  const estimatedNightlyRate = useMemo(
    () => parseAmount(selectedRoomType?.base_price_per_night),
    [selectedRoomType]
  );

  const estimatedAmount = useMemo(() => {
    if (!estimatedNights || !estimatedNightlyRate) return 0;
    return estimatedNights * estimatedNightlyRate;
  }, [estimatedNights, estimatedNightlyRate]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => {
      const next = { ...f, [name]: value };
      if (name === "room_type_id") next.room_id = "";
      return next;
    });
    setErrors((prev) => {
      const { [name]: _, ...rest } = prev;
      return rest;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError("");
    const errs = validateBookingForm(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        guest_id: Number(form.guest_id),
        room_type_id: Number(form.room_type_id),
        room_id: form.room_id ? Number(form.room_id) : null,
        adults: Number(form.adults),
        children: Number(form.children),
        estimated_amount: estimatedAmount > 0 ? estimatedAmount.toFixed(2) : null,
      };
      await postJson("/api/operations/bookings/create/", payload);
      onSuccess();
    } catch (err) {
      const payload = err?.payload || {};
      if (payload.errors) {
        setErrors(payload.errors);
      }
      setServerError(payload.detail || err.message || "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  const today = getTodayISO();
  const headerDate = prefill?.checkInDate ? `Arrivée ${fmtShortDate(prefill.checkInDate)}` : "Nouvelle réservation";
  const headerRoom = prefill?.roomNumber ? `Chambre ${prefill.roomNumber}` : "Réservation rapide";

  const panelClass = [
    "pbm-panel",
    isClosing ? "pbm-panel--closing" : "pbm-panel--open",
  ].join(" ");

  const overlayClass = [
    "pbm-overlay",
    isClosing ? "pbm-overlay--closing" : "pbm-overlay--open",
  ].join(" ");

  return (
    <div className={overlayClass} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={panelClass} role="dialog" aria-modal="true" aria-labelledby="pbm-title">

        {/* ── Header ── */}
        <div className="pbm-header">
          <div className="pbm-header-left">
            <div className="pbm-header-icon" aria-hidden="true">
              <i className="ti ti-calendar-plus" />
            </div>
            <div>
              <p className="pbm-header-eyebrow">Planning</p>
              <p className="pbm-header-title" id="pbm-title">{headerRoom}</p>
              <p className="pbm-header-date">{headerDate}</p>
            </div>
          </div>
          <button type="button" className="pbm-close" onClick={onClose} aria-label="Fermer">
            <i className="ti ti-x" />
          </button>
        </div>

        {/* ── Server error ── */}
        {serverError && (
          <div className="pbm-error" role="alert">{serverError}</div>
        )}

        {/* ── Form ── */}
        {choicesLoading ? (
          <div className="pbm-loading">Chargement…</div>
        ) : (
          <form className="pbm-form" onSubmit={handleSubmit} noValidate>
            <div className="pbm-grid">

              {/* Client */}
              <div className="pbm-field pbm-field--full">
                <label className="pbm-label">
                  Client <span className="pbm-required">*</span>
                </label>
                <AppSelect
                  name="guest_id"
                  value={form.guest_id}
                  onChange={handleChange}
                  placeholder="Sélectionner un client"
                  ref={firstFieldRef}
                  disabled={submitting}
                >
                  <option value="">Sélectionner un client</option>
                  {(choices?.guests ?? []).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label || g.full_name || `${g.first_name ?? ""} ${g.last_name ?? ""}`.trim()}
                    </option>
                  ))}
                </AppSelect>
                {errors.guest_id && <span className="pbm-field-error">{errors.guest_id}</span>}
              </div>

              {/* Type de chambre */}
              <div className="pbm-field">
                <label className="pbm-label">
                  Type <span className="pbm-required">*</span>
                </label>
                <AppSelect
                  name="room_type_id"
                  value={form.room_type_id}
                  onChange={handleChange}
                  placeholder="Type de chambre"
                  disabled={submitting}
                >
                  <option value="">Type de chambre</option>
                  {(choices?.room_types ?? []).map((rt) => (
                    <option key={rt.id} value={rt.id}>{rt.label || rt.name}</option>
                  ))}
                </AppSelect>
                {errors.room_type_id && <span className="pbm-field-error">{errors.room_type_id}</span>}
              </div>

              {/* Chambre */}
              <div className="pbm-field">
                <label className="pbm-label">Chambre</label>
                <AppSelect
                  name="room_id"
                  value={form.room_id}
                  onChange={handleChange}
                  placeholder="Chambre (optionnel)"
                  disabled={submitting}
                >
                  <option value="">Chambre (optionnel)</option>
                  {availableRooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.label || `Chambre ${r.number}`}</option>
                  ))}
                </AppSelect>
                {errors.room_id && <span className="pbm-field-error">{errors.room_id}</span>}
              </div>

              {/* Arrivée */}
              <div className="pbm-field">
                <label className="pbm-label">
                  Arrivée <span className="pbm-required">*</span>
                </label>
                <DatePicker
                  name="check_in_date"
                  value={form.check_in_date}
                  onChange={handleChange}
                  minDate={today}
                  disabled={submitting}
                  required
                  className="pbm-date-trigger"
                  popoverClassName="pbm-date-popover"
                  popoverMinWidth={236}
                  matchTriggerWidth={false}
                />
                {errors.check_in_date && <span className="pbm-field-error">{errors.check_in_date}</span>}
              </div>

              {/* Départ */}
              <div className="pbm-field">
                <label className="pbm-label">
                  Départ <span className="pbm-required">*</span>
                </label>
                <DatePicker
                  name="check_out_date"
                  value={form.check_out_date}
                  onChange={handleChange}
                  minDate={form.check_in_date || today}
                  disabled={submitting || !form.check_in_date}
                  required
                  className="pbm-date-trigger"
                  popoverClassName="pbm-date-popover"
                  popoverMinWidth={236}
                  matchTriggerWidth={false}
                />
                {errors.check_out_date && <span className="pbm-field-error">{errors.check_out_date}</span>}
              </div>

              {/* Source */}
              <div className="pbm-field">
                <label className="pbm-label">Source</label>
                <AppSelect
                  name="source"
                  value={form.source}
                  onChange={handleChange}
                  disabled={submitting}
                >
                  {(choices?.booking_sources ?? []).map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </AppSelect>
              </div>

              {/* Montant estimé */}
              <div className="pbm-field">
                <label className="pbm-label">Montant prévisionnel</label>
                <div className="pbm-estimate-card" aria-live="polite">
                  <span className="pbm-estimate-value">
                    {estimatedAmount > 0 ? formatAmount(estimatedAmount) : "Non calculÃ©"}
                  </span>
                  <span className="pbm-estimate-meta">
                    {estimatedAmount > 0
                      ? `${formatAmount(estimatedNightlyRate)} x ${estimatedNights} nuit${estimatedNights > 1 ? "s" : ""}`
                      : "Type de chambre et dates requis"}
                  </span>
                </div>
              </div>

              {/* Adultes */}
              <div className="pbm-field">
                <label className="pbm-label">
                  Adultes <span className="pbm-required">*</span>
                </label>
                <input
                  type="number"
                  name="adults"
                  className="pbm-input"
                  value={form.adults}
                  onChange={handleChange}
                  min="1"
                  disabled={submitting}
                />
                {errors.adults && <span className="pbm-field-error">{errors.adults}</span>}
              </div>

              {/* Enfants */}
              <div className="pbm-field">
                <label className="pbm-label">Enfants</label>
                <input
                  type="number"
                  name="children"
                  className="pbm-input"
                  value={form.children}
                  onChange={handleChange}
                  min="0"
                  disabled={submitting}
                />
                {errors.children && <span className="pbm-field-error">{errors.children}</span>}
              </div>

              {/* Notes */}
              <div className="pbm-field pbm-field--full">
                <label className="pbm-label">Notes</label>
                <textarea
                  name="notes"
                  className="pbm-textarea"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Demandes particulières, remarques…"
                  rows={2}
                  disabled={submitting}
                />
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="pbm-footer">
              <button
                type="button"
                className="pbm-btn pbm-btn--ghost"
                onClick={onClose}
                disabled={submitting}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="pbm-btn pbm-btn--primary"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <i className="ti ti-loader-2 pbm-spin" aria-hidden="true" />
                    Création…
                  </>
                ) : (
                  <>
                    <i className="ti ti-check" aria-hidden="true" />
                    Créer la réservation
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
