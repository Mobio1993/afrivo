import { useEffect, useState } from "react";

import KitchenBoard from "../../components/pos-restaurant/KitchenBoard";
import { posApi } from "../../hooks/usePosApi";

export function KitchenPage() {
  const [tickets, setTickets] = useState([]);

  async function load() {
    setTickets(await posApi.getKitchenTickets());
  }

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 15000);
    return () => window.clearInterval(interval);
  }, []);

  async function handleStart(id) {
    await posApi.startTicket(id);
    await load();
  }

  async function handleReady(id) {
    await posApi.readyTicket(id);
    await load();
  }

  return (
    <div className="pos-page">
      <div className="pos-page-header"><h2 className="pos-page-title">Cuisine</h2></div>
      <KitchenBoard tickets={tickets} onStart={handleStart} onReady={handleReady} />
    </div>
  );
}
