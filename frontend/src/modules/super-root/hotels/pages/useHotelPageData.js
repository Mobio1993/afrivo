import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export function useHotelPageData(loader) {
  const { hotelId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await loader(hotelId));
    } catch (err) {
      setError(err.payload?.detail || err.message || "Chargement hotel impossible.");
    } finally {
      setLoading(false);
    }
  }, [hotelId, loader]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { hotelId, data, loading, error, reload, setData };
}
