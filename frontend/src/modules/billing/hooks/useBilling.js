import { useCallback, useEffect, useRef, useState } from "react";

import {
  addPaymentToInvoice,
  cancelInvoice,
  createInvoice,
  createInvoiceFromDayUse,
  createInvoiceFromStay,
  duplicateInvoice,
  getBillingDashboard,
  getInvoice,
  issueInvoice,
  listInvoices,
  updateInvoice,
} from "../services/billingService";
import { useToast } from "../../../shared/toast/ToastContext";

function getBillingErrorMessage(error, fallback = "Erreur de chargement.") {
  if (error?.code === "SESSION_EXPIRED" || error?.status === 401) {
    return "Votre session a expire. Veuillez vous reconnecter.";
  }
  if (typeof error?.payload?.detail === "string") {
    return error.payload.detail;
  }
  return error?.message || fallback;
}

export function useBilling() {
  const toast = useToast();
  const [invoices, setInvoices] = useState([]);
  const [invoiceDetail, setInvoiceDetail] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const PAGE_SIZE = 20;
  const reqIdRef = useRef(0);
  const searchTimerRef = useRef(null);

  const fetchDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    try {
      const data = await getBillingDashboard("month");
      setDashboard(data);
    } catch {
      // silent
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  const fetchInvoices = useCallback(async (opts = {}) => {
    const reqId = ++reqIdRef.current;
    setLoadingList(true);
    setError("");
    try {
      const data = await listInvoices({
        page: opts.page ?? page,
        pageSize: PAGE_SIZE,
        search: opts.search ?? search,
        status: opts.status ?? statusFilter,
      });
      if (reqId !== reqIdRef.current) return;
      const results = Array.isArray(data) ? data : (data.results || []);
      setInvoices(results);
      setTotalCount(data.count ?? results.length);
      setTotalPages(Math.max(1, Math.ceil((data.count ?? results.length) / PAGE_SIZE)));
    } catch (err) {
      if (reqId !== reqIdRef.current) return;
      setError(getBillingErrorMessage(err));
    } finally {
      if (reqId === reqIdRef.current) setLoadingList(false);
    }
  }, [page, search, statusFilter]);

  const fetchDetail = useCallback(async (id) => {
    if (!id) {
      setInvoiceDetail(null);
      return;
    }
    setLoadingDetail(true);
    try {
      const data = await getInvoice(id);
      setInvoiceDetail(data);
    } catch {
      setInvoiceDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    fetchInvoices({ page, search, status: statusFilter });
  }, [page, statusFilter]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setPage(1);
      fetchInvoices({ page: 1, search, status: statusFilter });
    }, 350);
    return () => clearTimeout(searchTimerRef.current);
  }, [search]);

  useEffect(() => {
    fetchDetail(selectedId);
  }, [selectedId, fetchDetail]);

  function showSuccess(msg) {
    setSuccessMsg(msg);
    toast.success(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  }

  async function handleCreate(payload) {
    const data = await createInvoice(payload);
    await fetchInvoices({ page: 1, search: "", status: "" });
    setPage(1);
    setSearch("");
    setStatusFilter("");
    setSelectedId(data.id);
    await fetchDetail(data.id);
    fetchDashboard();
    showSuccess("Facture créée avec succès.");
    return data;
  }

  async function handleCreateFromQueue(item, options = {}) {
    let data = null;
    if (item.type === "stay") {
      data = await createInvoiceFromStay(item.source_id);
    } else if (item.type === "day_use") {
      data = await createInvoiceFromDayUse(item.source_id);
    } else {
      throw new Error("Ce dossier doit etre facture depuis sa fiche de sejour.");
    }
    if (options.issue) {
      data = await issueInvoice(data.id);
    }
    await fetchInvoices({ page: 1, search: "", status: "" });
    setPage(1);
    setSearch("");
    setStatusFilter("");
    setSelectedId(data.id);
    await fetchDetail(data.id);
    fetchDashboard();
    showSuccess(options.issue ? "Facture creee et emise automatiquement." : "Facture creee automatiquement.");
    return data;
  }

  async function handleUpdate(id, payload) {
    const data = await updateInvoice(id, payload);
    setInvoiceDetail(data);
    setInvoices((prev) => prev.map((inv) => (inv.id === id ? data : inv)));
    fetchDashboard();
    showSuccess("Facture mise à jour.");
    return data;
  }

  async function handleIssue(id) {
    const data = await issueInvoice(id);
    setInvoiceDetail(data);
    setInvoices((prev) => prev.map((inv) => (inv.id === id ? data : inv)));
    fetchDashboard();
    showSuccess("Facture émise.");
    return data;
  }

  async function handleCancel(id, note) {
    const data = await cancelInvoice(id, note);
    setInvoiceDetail(data);
    setInvoices((prev) => prev.map((inv) => (inv.id === id ? data : inv)));
    fetchDashboard();
    showSuccess("Facture annulée.");
    return data;
  }

  async function handleDuplicate(id) {
    const data = await duplicateInvoice(id);
    await fetchInvoices({ page: 1, search: "", status: "" });
    setPage(1);
    setSearch("");
    setStatusFilter("");
    setSelectedId(data.id);
    await fetchDetail(data.id);
    fetchDashboard();
    showSuccess("Facture dupliquée.");
    return data;
  }

  async function handleAddPayment(invoiceId, paymentPayload) {
    const data = await addPaymentToInvoice(invoiceId, paymentPayload);
    const updatedInvoice = data.invoice;
    setInvoiceDetail(updatedInvoice);
    setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? updatedInvoice : inv)));
    fetchDashboard();
    showSuccess("Paiement enregistré.");
    return data;
  }

  return {
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
    successMsg,
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
    refetchDetail: fetchDetail,
    refetchList: fetchInvoices,
  };
}
