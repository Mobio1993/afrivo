import { useEffect, useMemo, useState } from "react";

import MenuBrowser from "../../components/pos-restaurant/MenuBrowser";
import OrderPanel from "../../components/pos-restaurant/OrderPanel";
import { posApi } from "../../hooks/usePosApi";

export function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [menus, setMenus] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState("");

  const selectedOrder = useMemo(() => orders.find((order) => order.id === selectedId) || orders[0], [orders, selectedId]);

  async function load() {
    try {
      const [nextOrders, nextMenus] = await Promise.all([posApi.getOrders(), posApi.getMenus()]);
      setOrders(nextOrders);
      setMenus(nextMenus);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addItem(item) {
    if (!selectedOrder) return;
    await posApi.addItem(selectedOrder.id, { menu_item: item.id, quantite: 1 });
    await load();
  }

  async function sendToKitchen(orderId) {
    await posApi.sendToKitchen(orderId);
    await load();
  }

  async function generateBill(orderId) {
    await posApi.generateBill(orderId, {});
    await load();
  }

  return (
    <div className="pos-page">
      <div className="pos-page-header"><h2 className="pos-page-title">Commandes</h2></div>
      {error ? <div className="pos-error">{error}</div> : null}
      <div className="pos-workspace">
        <section className="pos-card">
          <h3 className="pos-section-title">Commandes ouvertes</h3>
          {orders.map((order) => (
            <button key={order.id} className={`pos-order-row ${selectedOrder?.id === order.id ? "active" : ""}`} type="button" onClick={() => setSelectedId(order.id)}>
              <span>{order.reference}</span>
              <b>Table {order.table_numero}</b>
            </button>
          ))}
        </section>
        <MenuBrowser menus={menus} onAddItem={addItem} />
        <OrderPanel order={selectedOrder} onSendToKitchen={sendToKitchen} onGenerateBill={generateBill} />
      </div>
    </div>
  );
}
