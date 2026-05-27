import { useCallback, useEffect, useState } from "react";

import { postJson } from "../api/client";
import { cancelPayment, getPayment, updatePayment } from "../services/paymentsService";

function normalizePayment(payment) {
  if (!payment) {
    return null;
  }

  return {
    ...payment,
    statut: payment.statut || payment.status,
    statut_display: payment.statut_display || payment.status_label || payment.status,
    mode_paiement: payment.mode_paiement || payment.method || payment.payment_method,
    mode_paiement_display:
      payment.mode_paiement_display || payment.method_label || payment.payment_method || payment.method,
    type_paiement: payment.type_paiement || payment.payment_type,
    type_paiement_display: payment.type_paiement_display || payment.payment_type_label || payment.payment_type,
    montant: payment.montant ?? payment.amount,
    devise: payment.devise || payment.currency || "XOF",
    date: payment.date || payment.paid_at || payment.created_at,
    origine: payment.origine || payment.source || "",
    reference_externe: payment.reference_externe || payment.external_reference || "",
    notes_internes: payment.notes_internes || payment.notes || "",
    sejour_reference: payment.sejour_reference || payment.stay_reference,
    day_use_reference: payment.day_use_reference,
    encaissements: payment.encaissements || [],
    hotel_name: payment.hotel_name || payment.hotel?.name || "AFRIVO Default Hotel",
  };
}

function buildPatchPayload(form) {
  return {
    status: form.statut,
    method: form.mode_paiement,
    payment_type: form.type_paiement,
    amount: form.montant,
    currency: form.devise,
    paid_at: form.date,
    source: form.origine,
    external_reference: form.reference_externe,
    notes: form.notes_internes,
  };
}

function getErrorMessage(error, fallback) {
  const payload = error?.payload || {};
  return payload.detail || payload.error || error?.message || fallback;
}

export function usePaymentDetail(id) {
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPayment = useCallback(async () => {
    if (!id) {
      setPayment(null);
      setLoading(false);
      setError("Identifiant paiement manquant.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = await getPayment(id);
      setPayment(normalizePayment(payload));
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Impossible de charger ce paiement."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPayment();
  }, [fetchPayment]);

  const annuler = useCallback(async () => {
    if (!window.confirm("Confirmer l'annulation de ce paiement ?")) {
      return;
    }
    try {
      const payload = await cancelPayment(id);
      setPayment(normalizePayment(payload));
    } catch (requestError) {
      window.alert(getErrorMessage(requestError, "Erreur lors de l'annulation."));
    }
  }, [id]);

  const rembourser = useCallback(async () => {
    if (!window.confirm("Confirmer le remboursement de ce paiement ?")) {
      return;
    }
    try {
      const payload = await postJson(`/api/payments/${id}/refund/`, {});
      setPayment(normalizePayment(payload));
    } catch (requestError) {
      window.alert(getErrorMessage(requestError, "Erreur lors du remboursement."));
    }
  }, [id]);

  const patchPayment = useCallback(
    async (form) => {
      try {
        const payload = await updatePayment(id, buildPatchPayload(form));
        setPayment(normalizePayment(payload));
        return { success: true };
      } catch (requestError) {
        return {
          success: false,
          error: requestError?.payload || getErrorMessage(requestError, "Erreur de mise a jour."),
        };
      }
    },
    [id],
  );

  return { payment, loading, error, refetch: fetchPayment, annuler, rembourser, patchPayment };
}
