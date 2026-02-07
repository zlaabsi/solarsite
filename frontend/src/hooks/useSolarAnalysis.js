import { useState, useCallback } from "react";
import { API_URL } from "../constants";

export default function useSolarAnalysis() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const analyze = useCallback(async (params) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      setData(result);
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const generate3D = useCallback(async (params) => {
    try {
      const res = await fetch(`${API_URL}/api/generate-3d`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  const analyzeImage = useCallback(async (file, lat, lon) => {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("latitude", lat);
    formData.append("longitude", lon);
    try {
      const res = await fetch(`${API_URL}/api/analyze-image`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  return { data, loading, error, analyze, generate3D, analyzeImage };
}
