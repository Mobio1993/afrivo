import { useCallback, useEffect, useState } from "react";

import { fetchJson, postJson } from "../api/client";

const BASE = "/api/rooms/housekeeping/tasks";

export function useHousekeeping() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const payload = await fetchJson(`${BASE}/dashboard/`);
      setData(payload);
    } catch (err) {
      setError(err.payload?.detail || err.message || "Erreur de chargement housekeeping");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(false);
    const interval = window.setInterval(() => fetchDashboard(true), 30000);
    return () => window.clearInterval(interval);
  }, [fetchDashboard]);

  const performAction = async (taskId, action, payload = {}) => {
    try {
      const result = await postJson(`${BASE}/${taskId}/action/${action}/`, payload);
      await fetchDashboard(true);
      return { success: true, data: result };
    } catch (err) {
      return {
        success: false,
        error: err.payload?.error || err.payload?.detail || err.message || `Erreur action : ${action}`,
      };
    }
  };

  return {
    data,
    loading,
    error,
    refetch: () => fetchDashboard(false),
    demarrer: (id) => performAction(id, "demarrer"),
    terminer: (id) => performAction(id, "terminer"),
    suspendre: (id) => performAction(id, "suspendre"),
    signalerProbleme: (id, probleme) => performAction(id, "signaler_probleme", { probleme }),
    assigner: (id, agent_id) => performAction(id, "assigner", { agent_id }),
  };
}
