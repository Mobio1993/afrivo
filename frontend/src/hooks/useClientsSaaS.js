import { useCallback, useEffect, useMemo, useState } from "react";

import { httpClient } from "../shared/api/httpClient";

const BASE = "/api/platform/clients-saas";

export function useClientsSaaS() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const response = await httpClient.get(`${BASE}/command-center/`);
      setData(response);
    } catch (err) {
      setError(err.payload?.detail || err.message || "Erreur de chargement des clients SaaS");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  const filteredClients = useMemo(() => {
    return (data?.clients || []).filter((client) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        (client.nom || "").toLowerCase().includes(q) ||
        (client.slug || "").toLowerCase().includes(q);

      const matchFilter =
        filter === "all"
          ? true
          : filter === "actives"
            ? client.statut_display === "Active"
            : filter === "suspendues"
              ? client.statut_display === "Suspendue"
              : filter === "attention"
                ? client.sante_statut !== "sain"
                : true;

      return matchSearch && matchFilter;
    });
  }, [data?.clients, filter, search]);

  const createClient = async (formData) => {
    try {
      const response = await httpClient.post("/api/platform/organizations/", {
        name: formData.nom,
        slug: formData.slug,
        status: formData.statut,
      });
      await fetchData(true);
      return { success: true, data: response };
    } catch (err) {
      const errors = err.payload?.errors;
      const firstError = errors ? Object.values(errors).flat()[0] : "";
      return {
        success: false,
        error: firstError || err.payload?.detail || err.message || "Erreur lors de la creation",
      };
    }
  };

  const updateClient = async (id, payload) => {
    try {
      const response = await httpClient.patch(`/api/platform/organizations/${id}/`, payload);
      await fetchData(true);
      return { success: true, data: response };
    } catch (err) {
      return { success: false, error: err.payload?.detail || err.message || "Erreur mise a jour" };
    }
  };

  const suspendClient = async (id) => {
    return updateClient(id, { status: "suspended" });
  };

  return {
    data,
    loading,
    error,
    search,
    setSearch,
    filter,
    setFilter,
    filteredClients,
    refetch: () => fetchData(false),
    createClient,
    updateClient,
    suspendClient,
  };
}
