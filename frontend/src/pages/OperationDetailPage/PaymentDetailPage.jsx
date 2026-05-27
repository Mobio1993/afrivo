import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { canPerformAction } from "../../auth/permissions";
import PayKpiBar from "../../components/payments/PayKpiBar";
import PayTabCorrection from "../../components/payments/PayTabCorrection";
import PayTabEncaissements from "../../components/payments/PayTabEncaissements";
import PayTabInfo from "../../components/payments/PayTabInfo";
import PayTabNav from "../../components/payments/PayTabNav";
import PayTabRattachement from "../../components/payments/PayTabRattachement";
import PayTopBar from "../../components/payments/PayTopBar";
import { usePaymentDetail } from "../../hooks/usePaymentDetail";
import "../../styles/payment-detail.css";

const TABS = [
  { key: "info", label: "Informations" },
  { key: "rattachement", label: "Rattachement" },
  { key: "encaissements", label: "Encaissements" },
  { key: "corriger", label: "Corriger" },
];

export default function PaymentDetailPage({ paymentId }) {
  const params = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const id = paymentId || params.id || params.entityId;
  const { payment, loading, error, refetch, annuler, rembourser, patchPayment } = usePaymentDetail(id);
  const [activeTab, setActiveTab] = useState("info");
  const canCancelPayment = canPerformAction(user, "payments.cancel");
  const canRefundPayment = canPerformAction(user, "payments.refund");
  const canCorrectPayment = canPerformAction(user, "payments.correct");

  if (loading) {
    return <div className="pay-loading">Chargement du paiement...</div>;
  }

  if (error) {
    return <div className="pay-error">Erreur : {error}</div>;
  }

  if (!payment) {
    return null;
  }

  return (
    <div className="pay-detail-page">
      <PayTopBar
        payment={payment}
        onBack={() => navigate(-1)}
        onAnnuler={annuler}
        onRembourser={rembourser}
        onVoirReservation={() => payment.reservation_reference && navigate(`/operations/bookings/${payment.booking || payment.reservation || payment.reservation_reference}`)}
        onVoirFacture={() => payment.invoice_reference && navigate(`/facturation/${payment.invoice || payment.invoice_reference}`)}
        canAnnuler={canCancelPayment}
        canRembourser={canRefundPayment}
      />
      <PayKpiBar payment={payment} />
      <PayTabNav tabs={canCorrectPayment ? TABS : TABS.filter((tab) => tab.key !== "corriger")} active={activeTab} onChange={setActiveTab} />
      <div className="pay-tab-content">
        {activeTab === "info" ? <PayTabInfo payment={payment} /> : null}
        {activeTab === "rattachement" ? <PayTabRattachement payment={payment} /> : null}
        {activeTab === "encaissements" ? <PayTabEncaissements payment={payment} /> : null}
        {canCorrectPayment && activeTab === "corriger" ? (
          <PayTabCorrection payment={payment} onSuccess={refetch} patchPayment={patchPayment} />
        ) : null}
      </div>
    </div>
  );
}
