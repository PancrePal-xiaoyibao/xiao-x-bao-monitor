import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_SNAPSHOT,
  getErrorMessage,
  getMonitorUrl,
  isSnapshotUsable,
  LOCAL_SNAPSHOT_URL,
  normalizeMonitorSnapshot,
  resolveSnapshotWithFallback,
} from "@/lib/monitor-snapshot";
import type { MonitorApiSnapshot } from "@/data/site";

const POLL_INTERVAL_MS = 15000;
const REQUEST_TIMEOUT_MS = 10000;

export interface MonitorSnapshotState {
  snapshot: MonitorApiSnapshot;
  isLive: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  errorMessage: string | null;
  lastSuccessAt: string | null;
  targetSourceUrl: string;
  activeSourceUrl: string;
  hasUsableData: boolean;
  refresh: () => Promise<void>;
}

export function useMonitorSnapshot(): MonitorSnapshotState {
  const [snapshot, setSnapshot] = useState<MonitorApiSnapshot>(DEFAULT_SNAPSHOT);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSuccessAt, setLastSuccessAt] = useState<string | null>(null);
  const [activeSourceUrl, setActiveSourceUrl] = useState(getMonitorUrl());
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const targetSourceUrl = getMonitorUrl();
  const hasUsableData = isSnapshotUsable(snapshot);

  useEffect(() => {
    mountedRef.current = true;

    const runLoad = async ({ silent = false }: { silent?: boolean } = {}) => {
      const requestId = ++requestIdRef.current;

      if (!silent) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const targetUrl = getMonitorUrl();
        const result = await resolveSnapshotWithFallback({
          targetUrl,
          loadSnapshot: loadSnapshotFromUrl,
        });

        if (!isActiveRequest(requestId, mountedRef.current, requestIdRef.current)) return;

        setSnapshot(result.snapshot);
        setIsLive(result.isLive);
        setErrorMessage(result.errorMessage);
        setLastSuccessAt(new Date().toISOString());
        setActiveSourceUrl(result.activeSourceUrl);
      } catch (error) {
        if (!isActiveRequest(requestId, mountedRef.current, requestIdRef.current)) return;

        setIsLive(false);
        setErrorMessage(getErrorMessage(error));
      } finally {
        if (!isActiveRequest(requestId, mountedRef.current, requestIdRef.current)) return;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    };

    void runLoad();
    const interval = window.setInterval(() => {
      void runLoad({ silent: true });
    }, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
    };
  }, []);

  return {
    snapshot,
    isLive,
    isLoading,
    isRefreshing,
    errorMessage,
    lastSuccessAt,
    targetSourceUrl,
    activeSourceUrl,
    hasUsableData,
    refresh: async () => {
      const requestId = ++requestIdRef.current;
      setIsRefreshing(true);
      try {
        const targetUrl = getMonitorUrl();
        const result = await resolveSnapshotWithFallback({
          targetUrl,
          loadSnapshot: loadSnapshotFromUrl,
        });
        if (!isActiveRequest(requestId, mountedRef.current, requestIdRef.current)) return;

        setSnapshot(result.snapshot);
        setIsLive(result.isLive);
        setErrorMessage(result.errorMessage);
        setLastSuccessAt(new Date().toISOString());
        setActiveSourceUrl(result.activeSourceUrl);
      } catch (error) {
        if (!isActiveRequest(requestId, mountedRef.current, requestIdRef.current)) return;

        setIsLive(false);
        setErrorMessage(getErrorMessage(error));
      } finally {
        if (!isActiveRequest(requestId, mountedRef.current, requestIdRef.current)) return;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
  };
}

async function loadSnapshotFromUrl(url: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  const response = await fetch(url, {
    cache: "no-store",
    signal: controller.signal,
  }).finally(() => {
    window.clearTimeout(timeout);
  });
  if (!response.ok) {
    throw new Error(`Monitor API responded with ${response.status}`);
  }

  const raw = (await response.json()) as unknown;
  return normalizeMonitorSnapshot(raw);
}
function isActiveRequest(requestId: number, mounted: boolean, latestRequestId: number) {
  return mounted && requestId === latestRequestId;
}
