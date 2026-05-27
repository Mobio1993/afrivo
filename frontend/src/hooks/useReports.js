import { useCallback, useEffect, useState } from "react";

import { fetchJson } from "../api/client";

const BASE = "/api/reports/enhanced-stats/";

export function useReports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState("today");
  const [customRange, setCustomRange] = useState({ from: "", to: "" });

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ period });
      if (period === "custom") {
        if (customRange.from) {
          query.set("date_from", customRange.from);
        }
        if (customRange.to) {
          query.set("date_to", customRange.to);
        }
      }
      const payload = await fetchJson(`${BASE}?${query.toString()}`);
      setData(payload);
    } catch (requestError) {
      setError(requestError?.payload?.detail || requestError.message || "Erreur de chargement des rapports");
    } finally {
      setLoading(false);
    }
  }, [period, customRange]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    data,
    loading,
    error,
    period,
    setPeriod,
    customRange,
    setCustomRange,
    refetch,
  };
}
