import { useEffect, useRef, useState } from "react";
import type { UsageOverview } from "@/types/usage";

const POLL_INTERVAL_MS = 60000;
const REQUEST_TIMEOUT_MS = 15000;

export interface UsageDataState {
  data: UsageOverview | null;
  isLoading: boolean;
  error: string | null;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function useUsageData(days = 20): UsageDataState {
  const [data, setData] = useState<UsageOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const fetchData = async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);

        const params = new URLSearchParams({
          period: "day",
          start_date: formatDate(start),
          end_date: formatDate(end),
        });

        const response = await fetch(`/api/v1/usage/daily?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`API responded with ${response.status}`);
        }

        const json = (await response.json()) as UsageOverview;
        if (mountedRef.current) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        window.clearTimeout(timeout);
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    void fetchData();
    const interval = window.setInterval(fetchData, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
    };
  }, [days]);

  return { data, isLoading, error };
}
