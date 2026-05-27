import { useCallback, useEffect, useMemo, useState } from "react";

import { httpClient } from "../shared/api/httpClient";

const BASE = "/api/platform/modules";

function formatApiError(error, fallback) {
  const data = error?.data || error?.response?.data;
  if (!data) return error?.message || fallback;
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;
  if (data.error) return data.error;
  if (data.message) return data.message;
  return Object.values(data).flat().join(" ") || fallback;
}

export function useModules() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const payload = await httpClient.get(`${BASE}/command-center/`);
      setData(payload);
    } catch (requestError) {
      setError(formatApiError(requestError, "Erreur de chargement des modules"));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  const filteredModules = useMemo(() => {
    const modules = data?.modules || [];
    const q = search.trim().toLowerCase();

    return modules.filter((module) => {
      const matchSearch =
        !q ||
        [module.name, module.code, module.description]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));

      const matchFilter =
        filter === "all"
          ? true
          : filter === "actifs"
            ? module.statut_display === "Actif"
            : filter === "inactifs"
              ? module.statut_display === "Inactif"
              : filter === "attention"
                ? module.sante_statut === "attention"
                : true;

      return matchSearch && matchFilter;
    });
  }, [data?.modules, filter, search]);

  const createModule = async (formData) => {
    try {
      const response = await httpClient.post(`${BASE}/`, formData);
      await fetchData(true);
      return { success: true, data: response };
    } catch (requestError) {
      return {
        success: false,
        error: formatApiError(requestError, "Erreur lors de la creation"),
      };
    }
  };

  const updateModule = async (id, payload) => {
    try {
      const response = await httpClient.patch(`${BASE}/${id}/`, payload);
      await fetchData(true);
      return { success: true, data: response };
    } catch (requestError) {
      return {
        success: false,
        error: formatApiError(requestError, "Erreur mise a jour"),
      };
    }
  };

  const toggleModule = async (id) => {
    const module = data?.modules?.find((item) => item.id === id);
    const nextActive = !Boolean(module?.is_active);
    return updateModule(id, { is_active: nextActive });
  };

  return {
    data,
    loading,
    error,
    search,
    setSearch,
    filter,
    setFilter,
    filteredModules,
    refetch: () => fetchData(false),
    createModule,
    updateModule,
    toggleModule,
  };
}
