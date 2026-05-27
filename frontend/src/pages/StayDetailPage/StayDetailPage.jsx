import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useNavigate, useParams } from "react-router-dom";

import { fetchJson, postJson } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { canPerformAction } from "../../auth/permissions";
import { ConfirmModal } from "../../shared/components/ConfirmModal";
import "./StayDetailPage.css";

const statusMotion = {
  initial: { opacity: 0, y: -8, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.985 },
  transition: { duration: 0.18, ease: "easeOut" },
};

const pageMotion = {
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

function formatDateTime(isoString) {
  if (!isoString || isoString === "-") return "-";
  try {
    return new Date(isoString).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

function formatDate(isoString) {
  if (!isoString || isoString === "-") return "-";
  try {
    return new Date(isoString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

function getSectionValue(sections, sectionTitle, itemLabel) {
  const section = (sections || []).find((s) => s.title === sectionTitle);
  const item = (section?.items || []).find((i) => i.label === itemLabel);
  return item?.value ?? "-";
}

function getInitials(fullName) {
  return (fullName || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0] || "")
    .join("")
    .toUpperCase();
}

function parseAmount(value) {
  const n = parseFloat(value);
  return Number.isNaN(n) ? 0 : n;
}

function formatAmount(value) {
  return parseAmount(value).toLocaleString("fr-FR") + " XOF";
}

function getStatusModifier(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("cours") || s.includes("actif") || s.includes("progress")) return "active";
  if (s.includes("termin") || s.includes("clos") || s.includes("check")) return "done";
  if (s.includes("annul") || s.includes("cancel")) return "cancelled";
  return "default";
}

export function StayDetailPage() {
  const { stayId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: "", success: "" });
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    variant: "default",
    endpoint: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const canPerformCheckOut = canPerformAction(user, "operations.check_out");
  const canCompleteCleaning = canPerformAction(user, "rooms.cleaning_complete");

  async function loadData() {
    const payload = await fetchJson(`/api/operations/stays/${stayId}/`);
    setData(payload);
  }

  useEffect(() => {
    setStatus({ loading: true, error: "", success: "" });
    loadData()
      .catch((err) => {
        setStatus({
          loading: false,
          error:
            err.payload?.detail ||
            err.message ||
            "Impossible de charger la fiche du séjour.",
          success: "",
        });
      })
      .finally(() => setStatus((c) => ({ ...c, loading: false })));
  }, [stayId]);

  async function executeAction(endpoint) {
    setSubmitting(true);
    setStatus({ loading: false, error: "", success: "" });
    try {
      const payload = await postJson(endpoint, {});
      setStatus({
        loading: false,
        error: "",
        success: payload.message || "Action effectuée avec succès.",
      });
      await loadData();
    } catch (err) {
      setStatus({
        loading: false,
        error:
          err.payload?.detail ||
          Object.values(err.payload?.errors || {}).flat()[0] ||
          err.message ||
          "Action impossible.",
        success: "",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function openConfirm({ title, message, variant = "default", endpoint }) {
    setConfirmModal({ isOpen: true, title, message, variant, endpoint });
  }

  function closeConfirm() {
    setConfirmModal({ isOpen: false, title: "", message: "", variant: "default", endpoint: "" });
  }

  if (status.loading) {
    return <div className="status-box">Chargement de la fiche...</div>;
  }

  if (status.error && !data) {
    return <div className="alert-box">{status.error}</div>;
  }

  if (!data) {
    return <div className="empty-state-card"><strong>Aucune donnée disponible.</strong></div>;
  }

  /* ── Extraction des données ── */
  const guest = data.guest || {};
  const room = data.room || {};
  const sections = data.sections || [];
  const payments = (data.related_records?.payments || []);
  const booking = data.related_records?.booking || null;

  const plannedCheckIn = getSectionValue(sections, "Prevu vs reel", "Arrivee prevue");
  const actualCheckIn = getSectionValue(sections, "Prevu vs reel", "Arrivee reelle");
  const plannedCheckOut = getSectionValue(sections, "Prevu vs reel", "Depart prevu");
  const actualCheckOut = getSectionValue(sections, "Prevu vs reel", "Depart reel");

  const source = getSectionValue(sections, "Sejour", "Origine");
  const adultsChildren = getSectionValue(sections, "Sejour", "Adultes / enfants");
  const adultsCount = adultsChildren !== "-"
    ? (adultsChildren.split("/")[0] || "?").trim()
    : "?";

  const roomStatusDisplay = getSectionValue(sections, "Chambre", "Statut actuel");
  const roomStatusIsClean = (roomStatusDisplay || "").toLowerCase().includes("nettoyage");

  /* ── Actions disponibles ── */
  const checkoutAction = (data.context_actions || []).find((a) =>
    a.endpoint?.includes("/check-out/"),
  );
  const checkoutEnabled = checkoutAction?.enabled === true;

  const cleaningAction = (data.context_actions || []).find((a) =>
    a.endpoint?.includes("/complete-cleaning/"),
  );
  const canCleaning = cleaningAction?.enabled === true;

  /* ── Retard check-out ── */
  let checkoutDelayHours = null;
  if (
    actualCheckOut && actualCheckOut !== "-" &&
    plannedCheckOut && plannedCheckOut !== "-"
  ) {
    const actual = new Date(actualCheckOut);
    const planned = new Date(plannedCheckOut);
    if (!Number.isNaN(actual.getTime()) && !Number.isNaN(planned.getTime()) && actual > planned) {
      checkoutDelayHours = Math.round((actual - planned) / (1000 * 60 * 60));
    }
  }

  /* ── Chips / Period ── */
  const periodChip =
    plannedCheckIn && plannedCheckIn !== "-"
      ? `${formatDate(plannedCheckIn)} → ${formatDate(plannedCheckOut)}`
      : "—";

  /* ── KPI cards (4 premières) ── */
  const kpiCards = (data.summary_cards || []).slice(0, 4);

  /* ── Solde restant depuis summary_cards ── */
  const soldeCard = (data.summary_cards || []).find((c) => c.label === "Solde restant");
  const soldeFormatted = soldeCard ? formatAmount(soldeCard.value) : "—";

  /* ── Total paiements ── */
  const paymentsTotal = payments.reduce((sum, p) => sum + parseAmount(p.amount), 0);

  /* ── Timeline ── */
  const timelineSteps = [
    {
      label: "Arrivée prévue",
      value: plannedCheckIn,
      tone: plannedCheckIn !== "-" ? "neutral" : "neutral",
    },
    {
      label: "Arrivée réelle",
      value: actualCheckIn,
      tone: actualCheckIn !== "-" ? "good" : "neutral",
    },
    {
      label: "Départ prévu",
      value: plannedCheckOut,
      tone: plannedCheckOut !== "-" ? "neutral" : "neutral",
    },
    {
      label: "Départ réel",
      value: actualCheckOut,
      tone: checkoutDelayHours ? "warn" : actualCheckOut !== "-" ? "good" : "neutral",
      badge: checkoutDelayHours ? `+${checkoutDelayHours}h de retard` : null,
    },
  ];

  /* ── Lignes infos séjour / chambre ── */
  const stayInfoRows = [
    { label: "N° chambre", value: room.number || "-" },
    { label: "Type", value: room.room_type || "-" },
    { label: "Étage", value: room.floor && room.floor !== "-" ? room.floor : "—" },
    { label: "Statut chambre", value: roomStatusDisplay, warn: roomStatusIsClean },
    { label: "Statut séjour", value: data.status || "-" },
    { label: "Adultes / Enfants", value: adultsChildren || "-" },
    { label: "Origine", value: source || "-" },
  ];

  const guestInitials = getInitials(guest.full_name);
  const statusMod = getStatusModifier(data.status);

  return (
    <motion.div className="page-stack dashboard-shell stay-detail-page" {...pageMotion}>

      {/* ── 1. Héro ── */}
      <section className="sdp-hero">
        <div className="sdp-hero-left">
          <div className="sdp-avatar" aria-hidden="true">{guestInitials}</div>
          <div className="sdp-hero-info">
            <div className="sdp-hero-refs">
              <span className="sdp-ref-tag">{data.reference}</span>
              {booking && (
                <>
                  <span className="sdp-ref-sep">·</span>
                  <span className="sdp-ref-tag sdp-ref-tag--secondary">{booking.reference}</span>
                </>
              )}
            </div>
            <h1 className="sdp-guest-name">{guest.full_name || "—"}</h1>
            <p className="sdp-subtitle">
              Chambre {room.number} {room.room_type}
              {adultsCount !== "?" ? ` · ${adultsCount} adulte(s)` : ""}
              {source && source !== "-" ? ` · ${source}` : ""}
            </p>
            <div className="sdp-chips">
              {guest.phone && guest.phone !== "-" && (
                <span className="sdp-chip">
                  <i className="ti ti-phone" aria-hidden="true" />
                  {guest.phone}
                </span>
              )}
              {guest.email && guest.email !== "-" && (
                <span className="sdp-chip">
                  <i className="ti ti-mail" aria-hidden="true" />
                  {guest.email}
                </span>
              )}
              <span className="sdp-chip">
                <i className="ti ti-calendar" aria-hidden="true" />
                {periodChip}
              </span>
            </div>
          </div>
        </div>
        <div className="sdp-hero-right">
          <span className={`sdp-status-badge sdp-status-badge--${statusMod}`}>
            {data.status}
          </span>
        </div>
      </section>

      {/* ── Alertes ── */}
      <AnimatePresence>
        {status.error ? (
          <motion.div key="err" className="alert-box" {...statusMotion}>
            {status.error}
          </motion.div>
        ) : null}
        {status.success ? (
          <motion.div key="ok" className="success-box" {...statusMotion}>
            {status.success}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ── 2. Barre d'actions ── */}
      <section className="sdp-actions">
        <button
          type="button"
          className="ops-btn ops-btn--ghost"
          onClick={() => navigate(-1)}
        >
          <i className="ti ti-arrow-left" aria-hidden="true" />
          Retour
        </button>

        {canPerformCheckOut && (
          <motion.button
            type="button"
            className="ops-btn ops-btn--danger"
            disabled={!checkoutEnabled || !canPerformCheckOut || submitting}
            onClick={() =>
              openConfirm({
                title: "Confirmer le check-out",
                message:
                  "Cette action clôture définitivement le séjour. Le passage du client sera marqué comme terminé.",
                variant: "danger",
                endpoint: `/api/operations/stays/${stayId}/check-out/`,
              })
            }
            whileTap={{ scale: 0.98 }}
            animate={{ scale: submitting ? 0.98 : 1 }}
          >
            <i className="ti ti-logout" aria-hidden="true" />
            {submitting ? "En cours…" : "Check-out"}
          </motion.button>
        )}

        {booking && (
          <Link className="ops-btn ops-btn--secondary" to={booking.detail_path}>
            <i className="ti ti-file-invoice" aria-hidden="true" />
            Voir la réservation
          </Link>
        )}

        {canCompleteCleaning && canCleaning && cleaningAction?.endpoint && (
          <motion.button
            type="button"
            className="ops-btn ops-btn--secondary"
            disabled={submitting}
            onClick={() =>
              openConfirm({
                title: "Terminer le nettoyage",
                message:
                  "Confirmer la fin du nettoyage ? La chambre sera remise disponible dans l'inventaire.",
                variant: "default",
                endpoint: cleaningAction.endpoint,
              })
            }
            whileTap={{ scale: 0.98 }}
          >
            <i className="ti ti-brush" aria-hidden="true" />
            Terminer nettoyage
          </motion.button>
        )}
      </section>

      {/* ── 3. Bande KPIs ── */}
      <section className="sdp-kpi-strip">
        {kpiCards.map((card, idx) => {
          const num = parseAmount(card.value);
          const isAmountPositive = num > 0;
          const greenValue = idx === 0 && isAmountPositive;
          return (
            <div key={card.label} className="sdp-kpi-card">
              <span className="sdp-kpi-label">{card.label}</span>
              <div
                className="sdp-kpi-value"
                style={greenValue ? { color: "#16a34a" } : undefined}
              >
                {formatAmount(card.value)}
              </div>
              {card.meta && <p className="sdp-kpi-meta">{card.meta}</p>}
            </div>
          );
        })}
      </section>

      {/* ── 4. Grille de cartes ── */}
      <section className="sdp-grid">

        {/* Chronologie */}
        <div className="sdp-card">
          <div className="sdp-card-head">
            <i className="ti ti-timeline" aria-hidden="true" />
            <h3>Chronologie du séjour</h3>
          </div>
          <div className="sdp-timeline">
            {timelineSteps.map((step, idx) => (
              <div
                key={step.label}
                className={`sdp-timeline-step sdp-timeline-step--${step.tone}`}
              >
                <div className="sdp-timeline-rail">
                  <div className={`sdp-timeline-dot sdp-timeline-dot--${step.tone}`} />
                  {idx < timelineSteps.length - 1 && (
                    <div className="sdp-timeline-line" />
                  )}
                </div>
                <div className="sdp-timeline-content">
                  <span className="sdp-timeline-label">{step.label}</span>
                  <span className="sdp-timeline-value">
                    {step.value && step.value !== "-"
                      ? formatDateTime(step.value)
                      : "—"}
                    {step.badge && (
                      <span className="sdp-timeline-badge">{step.badge}</span>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chambre & séjour */}
        <div className="sdp-card">
          <div className="sdp-card-head">
            <i className="ti ti-door-enter" aria-hidden="true" />
            <h3>Chambre &amp; séjour</h3>
          </div>
          <div className="sdp-info-table">
            {stayInfoRows.map((row) => (
              <div key={row.label} className="sdp-info-row">
                <span className="sdp-info-label">{row.label}</span>
                <span
                  className="sdp-info-value"
                  style={row.warn ? { color: "#d97706" } : undefined}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Encaissements — pleine largeur */}
        <div className="sdp-card sdp-card--full">
          <div className="sdp-card-head">
            <i className="ti ti-cash" aria-hidden="true" />
            <h3>Encaissements liés</h3>
          </div>

          {payments.length === 0 && (
            <div className="empty-state-card sdp-empty">
              <strong>Aucun encaissement</strong>
              <p>Les paiements liés à ce séjour apparaîtront ici.</p>
            </div>
          )}

          {payments.length > 0 && (
            <motion.div
              className="sdp-payments-list"
              variants={listMotion}
              initial="initial"
              animate="animate"
            >
              {payments.map((payment) => (
                <motion.div
                  key={payment.id}
                  className="sdp-payment-row"
                  variants={listItemMotion}
                >
                  <div className="sdp-payment-icon" aria-hidden="true">
                    <i className="ti ti-cash" />
                  </div>
                  <div className="sdp-payment-info">
                    <div className="sdp-payment-type">
                      {payment.payment_type} · {payment.method}
                    </div>
                    <div className="sdp-payment-ref">
                      {payment.reference} · {formatDateTime(payment.paid_at)}
                    </div>
                  </div>
                  <div className="sdp-payment-amount">{formatAmount(payment.amount)}</div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {payments.length > 0 && (
            <div className="sdp-payments-footer">
              <span>
                <strong>Total encaissé</strong>
                <span className="sdp-payments-total">
                  {paymentsTotal.toLocaleString("fr-FR")} XOF
                </span>
              </span>
              <span className="sdp-payments-sep" aria-hidden="true">·</span>
              <span>
                <strong>Solde restant</strong>
                <span className="sdp-payments-balance">{soldeFormatted}</span>
              </span>
            </div>
          )}
        </div>

      </section>

      {/* ── Modal de confirmation ── */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmLabel="Confirmer"
        cancelLabel="Annuler"
        confirmDisabled={submitting}
        onConfirm={() => {
          const { endpoint } = confirmModal;
          closeConfirm();
          executeAction(endpoint);
        }}
        onCancel={closeConfirm}
      />
    </motion.div>
  );
}
