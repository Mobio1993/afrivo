import { useCallback, useEffect, useState } from "react";

import { httpClient } from "../shared/api/httpClient";

const BASE = "/api/platform/command-center";

export function useVuePlateforme() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const response = await httpClient.get(`${BASE}/`);
      setData(response);
    } catch (err) {
      setError(err.payload?.detail || err.message || "Erreur de chargement de la console plateforme");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);
    const interval = window.setInterval(() => fetchData(true), 60000);
    return () => window.clearInterval(interval);
  }, [fetchData]);

  return { data, loading, error, refetch: () => fetchData(false) };
}
