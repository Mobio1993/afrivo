import { useCallback, useEffect, useState } from "react";

import {
  cancelDayUse,
  checkInDayUse,
  checkOutDayUse,
  getDayUse,
  recordDayUsePayment,
  updateDayUse,
} from "../services/dayUseService";

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  const normalized = String(value).replace(/\s/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePayment(item = {}) {
  return {
    id: item.id,
    reference: item.reference || `PAY-${item.id || ""}`,
    montant: item.montant ?? item.amount ?? 0,
    statut: item.statut || item.status || "",
    statut_display: item.statut_display || item.status_label || item.status || "",
    mode_paiement: item.mode_paiement || item.method || "",
    mode_paiement_display: item.mode_paiement_display || item.method_label || item.method || "",
    date: item.date || item.paid_at || "",
    type_paiement: item.type_paiement || item.payment_type || "day_use",
  };
}

function stepForStatus(status) {
  const map = {
    draft: 0,
    pending_payment: 1,
    ready: 1,
    in_progress: 2,
    overtime: 2,
    completed: 5,
    cancelled: -1,
    no_show: -1,
    cree: 0,
    paiement_attente: 1,
    en_attente: 1,
    entre: 2,
    sorti: 3,
    nettoyage: 4,
    termine: 5,
    annule: -1,
  };
  return map[String(status || "").toLowerCase()] ?? 1;
}

function unwrapDayUse(payload) {
  return payload?.day_use || payload || null;
}

function normalizeDayUse(payload) {
  const raw = unwrapDayUse(payload);
  if (!raw) {
    return null;
  }

  const payments = (raw.encaissements || raw.payments || payload?.payments || []).map(normalizePayment);
  const total = toNumber(raw.montant_total ?? raw.final_amount ?? raw.total_amount ?? raw.formule);
  const paid = toNumber(raw.montant_encaisse ?? raw.amount_paid);
  const solde = raw.solde_restant !== undefined ? toNumber(raw.solde_restant) : Math.max(total - paid, 0);
  const status = raw.statut || raw.status || "";

  return {
    ...raw,
    statut: status,
    statut_display: raw.statut_display || raw.status_label || status,
    client_name: raw.client_name || raw.guest_name || "—",
    client_email: raw.client_email || raw.guest_email || "",
    client_phone: raw.client_phone || raw.guest_phone || "",
    client_nationalite: raw.client_nationalite || raw.client_nationality || raw.guest_nationality || "",
    chambre_numero: raw.chambre_numero || raw.room || raw.room_number || "",
    chambre_type: raw.chambre_type || raw.room_type || "",
    chambre_statut: raw.chambre_statut || raw.room_status || "",
    chambre_etage: raw.chambre_etage || raw.room_floor || "",
    montant_total: total,
    montant_encaisse: paid,
    solde_restant: solde,
    encaissements: payments,
    stepper_step: Number.isInteger(raw.stepper_step) ? raw.stepper_step : stepForStatus(status),
    entree_prevue_formatted: raw.entree_prevue_formatted || raw.start_datetime || "",
    entree_prevue: raw.entree_prevue || raw.start_datetime || "",
    entree_reelle: raw.entree_reelle || raw.checked_in_at || "",
    sortie_reelle: raw.sortie_reelle || raw.checked_out_at || "",
    formule: raw.formule ?? raw.package_price ?? raw.final_amount ?? raw.total_amount ?? "",
    supplement: raw.supplement ?? raw.overtime_fee ?? raw.overtime_amount ?? "0",
    depassement: raw.depassement ?? raw.overtime_choice ?? "",
    notes_internes: raw.notes_internes ?? raw.notes ?? "",
  };
}

function messageFromError(error, fallback) {
  return error?.payload?.detail || error?.payload?.errors?.non_field_errors?.[0] || error?.message || fallback;
}

export function useDayUseDetail(id) {
  const [dayUse, setDayUse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState("");

  const refetch = useCallback(async () => {
    if (!id) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await getDayUse(id);
      setDayUse(normalizeDayUse(payload));
    } catch (err) {
      setError(messageFromError(err, "Impossible de charger ce day use"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const clearActionError = useCallback(() => {
    setActionError("");
  }, []);

  const runAction = useCallback(
    async (runner) => {
      setActionError("");
      try {
        const payload = await runner();
        setDayUse(normalizeDayUse(payload));
        await refetch();
        return { success: true };
      } catch (err) {
        const message = messageFromError(err, "Action impossible");
        setActionError(message);
        return { success: false, error: message };
      }
    },
    [refetch],
  );

  const patchDayUse = useCallback(
    async (form) => {
      try {
        const payload = await updateDayUse(id, {
          package_price: form.formule,
          overtime_fee: form.supplement,
          overtime_choice: form.depassement,
          start_datetime: form.entree_prevue,
          planned_entry_at: form.entree_prevue,
          notes: form.notes_internes,
        });
        setDayUse(normalizeDayUse(payload));
        await refetch();
        return { success: true };
      } catch (err) {
        return { success: false, error: messageFromError(err, "Erreur de mise a jour") };
      }
    },
    [id, refetch],
  );

  const ajouterPaiement = useCallback(
    async (form) => {
      try {
        const payload = await recordDayUsePayment(id, {
          amount: form.montant,
          status: form.statut === "en_attente" ? "pending" : "paid",
          method: form.mode_paiement,
          paid_at: form.date,
          external_reference: form.reference_externe,
          currency: form.devise,
          notes: form.notes_paiement,
        });
        setDayUse(normalizeDayUse(payload));
        await refetch();
        return { success: true };
      } catch (err) {
        return { success: false, error: messageFromError(err, "Erreur paiement") };
      }
    },
    [id, refetch],
  );

  return {
    dayUse,
    loading,
    error,
    actionError,
    clearActionError,
    refetch,
    effectuerEntree: () => runAction(() => checkInDayUse(id)),
    effectuerSortie: () => runAction(() => checkOutDayUse(id)),
    terminerNettoyage: () => refetch(),
    annuler: (reason = "Annulation depuis la fiche day use") => runAction(() => cancelDayUse(id, reason)),
    patchDayUse,
    ajouterPaiement,
  };
}
