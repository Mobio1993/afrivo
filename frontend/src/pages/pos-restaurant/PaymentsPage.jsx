import { useEffect, useState } from "react";

import { posApi } from "../../hooks/usePosApi";

export function PaymentsPage() {
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    posApi.getPayments().then(setPayments);
  }, []);

  return (
    <div className="pos-page">
      <div className="pos-page-header"><h2 className="pos-page-title">Paiements</h2></div>
      <section className="pos-card">
        {payments.map((payment) => (
          <div key={payment.id} className="pos-list-row">
            <span>{payment.reference}</span>
            <b>{Number(payment.montant || 0).toLocaleString("fr-FR")} XOF</b>
            <span className="pos-pill pos-pill-libre">{payment.mode}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
