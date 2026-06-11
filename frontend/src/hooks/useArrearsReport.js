import { useEffect, useState } from "react";

import { getResource } from "../api/resources.js";

export function useArrearsReport(params = "") {
  const [report, setReport] = useState({ total_arrears: 0, results: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadReport() {
      setIsLoading(true);
      setError("");

      try {
        const data = await getResource(`/reports/arrears/${params}`);
        if (isMounted) setReport(data);
      } catch {
        if (isMounted) setError("Could not load arrears report.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadReport();

    return () => {
      isMounted = false;
    };
  }, [params, reloadKey]);

  return { report, isLoading, error, refetch: () => setReloadKey((key) => key + 1) };
}
