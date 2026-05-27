import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchJson, postJson, sendFormData, sendJson } from "../api/client";

const BASE = "/api/pos";

function list(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.results || [];
}

export function usePosMenu() {
  const [categories, setCategories] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orderItems, setOrderItems] = useState([]);

  const fetchMenu = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [categoryPayload, tablePayload] = await Promise.all([
        fetchJson(`${BASE}/categories/`),
        fetchJson(`${BASE}/tables/`),
      ]);
      setCategories(list(categoryPayload));
      setTables(list(tablePayload));
    } catch (err) {
      setError(err.payload?.detail || err.message || "Erreur de chargement du menu");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  const addToOrder = (item) => {
    if (!item.disponible) return;
    setOrderItems((prev) => {
      const existing = prev.find((entry) => entry.id === item.id);
      if (existing) {
        return prev.map((entry) => (entry.id === item.id ? { ...entry, quantite: entry.quantite + 1 } : entry));
      }
      return [...prev, { ...item, quantite: 1 }];
    });
  };

  const removeFromOrder = (itemId) => {
    setOrderItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const updateQty = (itemId, delta) => {
    setOrderItems((prev) =>
      prev
        .map((item) => (item.id === itemId ? { ...item, quantite: item.quantite + delta } : item))
        .filter((item) => item.quantite > 0),
    );
  };

  const clearOrder = () => setOrderItems([]);

  const orderTotal = useMemo(
    () => orderItems.reduce((sum, item) => sum + Number(item.prix || 0) * item.quantite, 0),
    [orderItems],
  );

  const createItem = async (formData) => {
    const result = await sendFormData(`${BASE}/menu-items/`, "POST", formData);
    await fetchMenu(true);
    return result;
  };

  const updateItem = async (id, formData) => {
    const result = await sendFormData(`${BASE}/menu-items/${id}/`, "PATCH", formData);
    await fetchMenu(true);
    return result;
  };

  const deleteItem = async (id) => {
    await sendJson(`${BASE}/menu-items/${id}/`, "DELETE");
    await fetchMenu(true);
  };

  const toggleItem = async (id) => {
    await postJson(`${BASE}/menu-items/${id}/toggle/`, {});
    await fetchMenu(true);
  };

  const createCategory = async (data) => {
    await postJson(`${BASE}/categories/`, data);
    await fetchMenu(true);
  };

  const sendToKitchen = async (tableId) => {
    if (!tableId) {
      throw new Error("Selectionnez une table avant l'envoi en cuisine.");
    }
    const order = await postJson(`${BASE}/tables/${tableId}/open_order/`, {});
    for (const item of orderItems) {
      await postJson(`${BASE}/orders/${order.id}/add_item/`, {
        menu_item: item.id,
        quantite: item.quantite,
      });
    }
    await postJson(`${BASE}/orders/${order.id}/send_to_kitchen/`, {});
    clearOrder();
    await fetchMenu(true);
    return order.id;
  };

  return {
    categories,
    tables,
    loading,
    error,
    refetch: fetchMenu,
    orderItems,
    addToOrder,
    removeFromOrder,
    updateQty,
    clearOrder,
    orderTotal,
    createItem,
    updateItem,
    deleteItem,
    toggleItem,
    createCategory,
    sendToKitchen,
  };
}
