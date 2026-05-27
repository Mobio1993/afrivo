import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../auth/AuthContext";
import PmCatTabs from "../../components/pos-restaurant/PmCatTabs";
import PmCategoryFormModal from "../../components/pos-restaurant/PmCategoryFormModal";
import PmConfirmModal from "../../components/pos-restaurant/PmConfirmModal";
import PmItemFormModal from "../../components/pos-restaurant/PmItemFormModal";
import PmOrderCart from "../../components/pos-restaurant/PmOrderCart";
import PmTileGrid from "../../components/pos-restaurant/PmTileGrid";
import { usePosMenu } from "../../hooks/usePosMenu";
import "../../styles/pos-menu.css";

function canManageMenu(user) {
  const role = String(user?.profile?.role || user?.role_code || user?.role || "").toLowerCase();
  return Boolean(user?.is_staff || user?.is_superuser || role === "manager_restaurant" || role === "manager" || role === "admin");
}

function errorMessage(error) {
  const payload = error?.payload;
  if (!payload) return error?.message || "Erreur lors de la sauvegarde.";
  if (payload.error) return payload.error;
  if (payload.detail) return payload.detail;
  if (typeof payload === "object") return Object.values(payload).flat().join(" ");
  return "Erreur lors de la sauvegarde.";
}

export function MenuPage() {
  const { user } = useAuth();
  const {
    categories,
    tables,
    loading,
    error,
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
  } = usePosMenu();

  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showCatForm, setShowCatForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [selectedTableId, setSelectedTableId] = useState("");

  const isManager = canManageMenu(user);

  useEffect(() => {
    if (!selectedTableId && tables.length) {
      const freeTable = tables.find((table) => table.statut === "libre") || tables[0];
      setSelectedTableId(String(freeTable.id));
    }
  }, [selectedTableId, tables]);

  const allItems = useMemo(() => categories.flatMap((category) => category.items || []), [categories]);
  const filteredItems = useMemo(() => {
    const byCategory = activeCat === "all" ? allItems : categories.find((category) => category.id === activeCat)?.items || [];
    const q = search.trim().toLowerCase();
    if (!q) return byCategory;
    return byCategory.filter((item) => `${item.nom} ${item.description || ""}`.toLowerCase().includes(q));
  }, [activeCat, allItems, categories, search]);

  function showFeedback(type, msg) {
    setFeedback({ type, msg });
    window.setTimeout(() => setFeedback(null), 3500);
  }

  async function handleItemFormSubmit(formData) {
    try {
      if (editingItem) {
        await updateItem(editingItem.id, formData);
        showFeedback("success", "Article mis a jour.");
      } else {
        await createItem(formData);
        showFeedback("success", "Article cree avec succes.");
      }
      setShowItemForm(false);
      setEditingItem(null);
    } catch (err) {
      showFeedback("error", errorMessage(err));
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    try {
      await deleteItem(confirmDelete.id);
      showFeedback("success", "Article supprime.");
    } catch (err) {
      showFeedback("error", errorMessage(err));
    } finally {
      setConfirmDelete(null);
    }
  }

  async function handleSendToKitchen() {
    try {
      await sendToKitchen(selectedTableId);
      showFeedback("success", "Commande envoyee en cuisine.");
    } catch (err) {
      showFeedback("error", errorMessage(err));
    }
  }

  return (
    <div className="pm-page">
      {feedback ? <div className={`pm-feedback pm-feedback-${feedback.type}`}>{feedback.msg}</div> : null}
      <div className="pm-header">
        <div className="pm-header-left">
          <h2 className="pm-title">Menu</h2>
          {isManager ? (
            <div className="pm-header-actions">
              <button type="button" className="pm-btn pm-btn-primary" onClick={() => { setEditingItem(null); setShowItemForm(true); }}>
                Nouvel article
              </button>
              <button type="button" className="pm-btn" onClick={() => setShowCatForm(true)}>Categorie</button>
            </div>
          ) : null}
        </div>
        <input className="pm-search" type="text" placeholder="Rechercher un article..." value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <PmCatTabs categories={categories} active={activeCat} onChange={setActiveCat} allCount={allItems.length} />
      {loading ? <div className="pm-loading">Chargement du menu...</div> : null}
      {error ? <div className="pm-error">{error}</div> : null}
      {!loading && !error ? (
        <div className="pm-layout">
          <PmTileGrid
            items={filteredItems}
            isManager={isManager}
            onAdd={addToOrder}
            onEdit={(item) => { setEditingItem(item); setShowItemForm(true); }}
            onDelete={setConfirmDelete}
            onToggle={toggleItem}
          />
          <PmOrderCart
            items={orderItems}
            total={orderTotal}
            tables={tables}
            selectedTableId={selectedTableId}
            onTableChange={setSelectedTableId}
            onRemove={removeFromOrder}
            onUpdateQty={updateQty}
            onClear={clearOrder}
            onSend={handleSendToKitchen}
          />
        </div>
      ) : null}
      {showItemForm ? (
        <PmItemFormModal item={editingItem} categories={categories} onClose={() => setShowItemForm(false)} onSubmit={handleItemFormSubmit} />
      ) : null}
      {showCatForm ? (
        <PmCategoryFormModal
          onClose={() => setShowCatForm(false)}
          onSubmit={async (data) => {
            await createCategory(data);
            setShowCatForm(false);
            showFeedback("success", "Categorie creee.");
          }}
        />
      ) : null}
      {confirmDelete ? (
        <PmConfirmModal
          title="Supprimer cet article ?"
          message={`"${confirmDelete.nom}" sera definitivement supprime. Cette action est irreversible.`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={handleConfirmDelete}
          danger
        />
      ) : null}
    </div>
  );
}
