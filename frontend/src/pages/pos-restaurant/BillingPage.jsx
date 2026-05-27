import { useEffect, useState } from "react";

import BillSummary from "../../components/pos-restaurant/BillSummary";
import PaymentModal from "../../components/pos-restaurant/PaymentModal";
import { posApi } from "../../hooks/usePosApi";

export function BillingPage() {
  const [orders, setOrders] = useState([]);
  const [bill, setBill] = useState(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    posApi.getOrders().then(setOrders);
  }, []);

  async function generate(orderId) {
    setBill(await posApi.generateBill(orderId, {}));
  }

  return (
    <div className="pos-page">
      <div className="pos-page-header"><h2 className="pos-page-title">Facturation</h2></div>
      <div className="pos-two-col">
        <section className="pos-card">
          <h3 className="pos-section-title">Commandes</h3>
          {orders.map((order) => (
            <button key={order.id} type="button" className="pos-order-row" onClick={() => generate(order.id)}>
              <span>{order.reference}</span>
              <b>Table {order.table_numero}</b>
            </button>
          ))}
        </section>
        <BillSummary bill={bill} onPay={() => setPaying(true)} />
      </div>
      {paying ? (
        <PaymentModal
          bill={bill}
          onClose={() => setPaying(false)}
          onSuccess={() => setPaying(false)}
          processPayment={posApi.processPayment}
        />
      ) : null}
    </div>
  );
}
