import { useCallback, useEffect, useState } from "react";

import {
  loadSuperRootResource,
  superRootMaintenanceApi,
} from "../superRootApiRegistry";

export function useSuperRootResource(endpoint) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await loadSuperRootResource(endpoint);
      setData(payload);
    } catch (err) {
      setError(err.payload?.detail || err.message || "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, reload: load };
}

export async function runSuperRootMaintenance(action, dryRun = true, confirmation = null) {
  return superRootMaintenanceApi.runMaintenance(action, dryRun, confirmation);
}
