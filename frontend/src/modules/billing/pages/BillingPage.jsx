import { useEffect, useState } from "react";

import { useAuth } from "../../../auth/AuthContext";
import { canPerformAction, hasPermission } from "../../../auth/permissions";
import { BillingSummaryCards } from "../components/BillingSummaryCards";
import { BillingWorkQueue } from "../components/BillingWorkQueue";
import { InvoiceListPanel } from "../components/InvoiceListPanel";
import { InvoiceDetailPanel } from "../components/InvoiceDetailPanel";
import { InvoiceForm } from "../components/InvoiceForm";
import { useBilling } from "../hooks/useBilling";
import { useToast } from "../../../shared/toast/ToastContext";
import "../styles/BillingPage.css";

export function BillingPage() {
  const { user } = useAuth();
  const toast = useToast();
  const canView = hasPermission(user, "billing", "view");
  const canCreate = canPerformAction(user, "billing.issue_invoice", { strict: false });
  const canUpdate = canPerformAction(user, "billing.validate_invoice", { strict: false });
  const canDelete = canPerformAction(user, "billing.cancel_invoice", { strict: false });

  const {
    invoices,
    invoiceDetail,
    dashboard,
    loadingList,
    loadingDetail,
    loadingDashboard,
    page,
    totalPages,
    totalCount,
    search,
    statusFilter,
    selectedId,
    error,
    setSearch,
    setStatusFilter,
    setPage,
    setSelectedId,
    handleCreate,
    handleCreateFromQueue,
    handleUpdate,
    handleIssue,
    handleCancel,
    handleDuplicate,
    handleAddPayment,
  } = useBilling();

  const [drawerMode, setDrawerMode] = useState(null); // null | "create" | "edit"
  const [cancelNote, setCancelNote] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [paymentOpenSignal, setPaymentOpenSignal] = useState(0);

  function showSuccess(msg) {
    setActionSuccess(msg);
    toast.success(msg);
    setTimeout(() => setActionSuccess(""), 3000);
  }

  function showError(msg) {
    setActionError(msg);
    toast.error(msg);
    setTimeout(() => setActionError(""), 5000);
  }

  useEffect(() => {
    if (error) toast.error(error);
  }, [error, toast]);

  async function onSaveForm(payload, isEdit) {
    try {
      if (isEdit && invoiceDetail) {
        await handleUpdate(invoiceDetail.id, payload);
      } else {
        await handleCreate(payload);
      }
      setDrawerMode(null);
    } catch (err) {
      throw err;
    }
  }

  async function onIssue() {
    if (!invoiceDetail) return;
    try {
      await handleIssue(invoiceDetail.id);
      showSuccess("Facture émise avec succès.");
    } catch (err) {
      showError(err?.payload?.detail || err?.message || "Erreur.");
    }
  }

  async function onCancel() {
    if (!invoiceDetail) return;
    try {
      await handleCancel(invoiceDetail.id, cancelNote);
      setShowCancelConfirm(false);
      setCancelNote("");
      showSuccess("Facture annulée.");
    } catch (err) {
      showError(err?.payload?.detail || err?.message || "Erreur.");
    }
  }

  async function onDuplicate() {
    if (!invoiceDetail) return;
    try {
      await handleDuplicate(invoiceDetail.id);
      showSuccess("Facture dupliquée.");
    } catch (err) {
      showError(err?.payload?.detail || err?.message || "Erreur.");
    }
  }

  async function onCreateFromQueue(item, options = {}) {
    try {
      await handleCreateFromQueue(item, options);
      showSuccess(options.issue ? "Facture creee et emise automatiquement." : "Facture creee automatiquement.");
    } catch (err) {
      showError(err?.payload?.detail || err?.message || "Creation automatique impossible.");
    }
  }

  async function onAddPayment(paymentPayload) {
    if (!invoiceDetail) return;
    await handleAddPayment(invoiceDetail.id, paymentPayload);
  }

  function onSelectInvoiceForPayment(invoiceId) {
    setSelectedId(invoiceId);
    setPaymentOpenSignal((value) => value + 1);
  }

  if (!canView) {
    return (
      <div className="billing-page">
        <div className="billing-access-denied">
          <strong>Accès refusé</strong>
          <p>Vous n'avez pas les droits pour accéder à la facturation.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="billing-page">
      <div className="billing-topbar">
        <div className="billing-topbar-title">
          <h1>Facturation</h1>
        </div>
        <div className="billing-topbar-actions" />
      </div>

      <BillingSummaryCards dashboard={dashboard} loading={loadingDashboard} />

      <BillingWorkQueue
        queue={dashboard?.work_queue}
        loading={loadingDashboard}
        canCreate={canCreate}
        onCreateInvoice={onCreateFromQueue}
        onSelectInvoice={onSelectInvoiceForPayment}
      />

      <div className="billing-split">
        <div className="billing-split-list">
          <InvoiceListPanel
            invoices={invoices}
            loading={loadingList}
            selectedId={selectedId}
            onSelect={setSelectedId}
            search={search}
            onSearch={setSearch}
            statusFilter={statusFilter}
            onStatusFilter={(v) => { setStatusFilter(v); setPage(1); }}
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={setPage}
            canCreate={canCreate}
            onCreate={() => setDrawerMode("create")}
          />
        </div>

        <div className="billing-split-detail">
          <InvoiceDetailPanel
            invoice={invoiceDetail}
            loading={loadingDetail}
            onEdit={() => setDrawerMode("edit")}
            onIssue={onIssue}
            onCancel={() => setShowCancelConfirm(true)}
            onDuplicate={onDuplicate}
            onAddPayment={onAddPayment}
            canUpdate={canUpdate}
            canCreate={canCreate}
            canDelete={canDelete}
            openPaymentSignal={paymentOpenSignal}
          />
        </div>
      </div>

      {drawerMode && (
        <div className="billing-drawer-overlay" role="dialog" aria-modal="true">
          <div className="billing-drawer">
            <div className="billing-drawer-head">
              <div className="billing-drawer-copy">
                <strong>{drawerMode === "create" ? "Nouvelle facture" : "Modifier la facture"}</strong>
              </div>
              <button
                type="button"
                className="billing-drawer-close"
                onClick={() => setDrawerMode(null)}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>
            <div className="billing-drawer-body">
              <InvoiceForm
                invoice={drawerMode === "edit" ? invoiceDetail : null}
                onSave={onSaveForm}
                onCancel={() => setDrawerMode(null)}
              />
            </div>
          </div>
        </div>
      )}

      {showCancelConfirm && (
        <div className="billing-drawer-overlay" role="dialog" aria-modal="true">
          <div className="billing-confirm-modal">
            <div className="billing-confirm-head">
              <strong>Annuler la facture {invoiceDetail?.reference} ?</strong>
              <p>Cette action ne peut pas être défaite pour une facture partiellement payée.</p>
            </div>
            <div className="billing-confirm-body">
              <label className="form-label">Note d'annulation</label>
              <textarea
                className="form-input form-textarea"
                rows={2}
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value)}
                placeholder="Raison de l'annulation..."
              />
            </div>
            <div className="billing-confirm-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => { setShowCancelConfirm(false); setCancelNote(""); }}
              >
                Retour
              </button>
              <button
                type="button"
                className="billing-btn-danger"
                onClick={onCancel}
              >
                Confirmer l'annulation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
