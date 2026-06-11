import { useEffect, useState } from "react";

import { getResource } from "../api/resources.js";

export function useReport(path) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadReport() {
      setIsLoading(true);
      setError("");

      try {
        const report = await getResource(path);
        if (isMounted) setData(report);
      } catch {
        if (isMounted) setError("Could not load report.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadReport();

    return () => {
      isMounted = false;
    };
  }, [path, reloadKey]);

  return { data, isLoading, error, refetch: () => setReloadKey((key) => key + 1) };
}

