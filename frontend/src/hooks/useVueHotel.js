import { useCallback, useEffect, useState } from "react";

import { fetchJson } from "../api/client";

const BASE = "/api/rooms/vue-hotel";

export function useVueHotel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const payload = await fetchJson(`${BASE}/`);
      setData(payload);
    } catch (err) {
      setError(err.payload?.detail || err.message || "Erreur de chargement Vue Hotel");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(false);
    const interval = window.setInterval(() => fetchDashboard(true), 30000);
    return () => window.clearInterval(interval);
  }, [fetchDashboard]);

  const getSuggestions = useCallback(async (params = {}) => {
    try {
      const query = new URLSearchParams(params);
      const suffix = query.toString() ? `?${query.toString()}` : "";
      const payload = await fetchJson(`${BASE}/${suffix}`);
      return payload.suggestions || [];
    } catch (err) {
      return [];
    }
  }, []);

  return {
    data,
    loading,
    error,
    refetch: () => fetchDashboard(false),
    getSuggestions,
  };
}
