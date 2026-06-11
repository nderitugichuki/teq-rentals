import { useEffect, useState } from "react";

import { listResource } from "../api/resources.js";

export function useResourceList(path, enabled = true, options = {}) {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadRows({ quiet = false } = {}) {
      if (!enabled) {
        setRows([]);
        setIsLoading(false);
        setError("");
        return;
      }

      if (!quiet) setIsLoading(true);
      setError("");

      try {
        const data = await listResource(path);
        if (isMounted) setRows(data);
      } catch {
        if (isMounted) setError("Could not load data from the backend.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadRows();
    const interval = options.pollMs
      ? window.setInterval(() => loadRows({ quiet: true }), options.pollMs)
      : null;

    return () => {
      isMounted = false;
      if (interval) window.clearInterval(interval);
    };
  }, [path, reloadKey, enabled, options.pollMs]);

  return { rows, isLoading, error, refetch: () => setReloadKey((key) => key + 1) };
}
