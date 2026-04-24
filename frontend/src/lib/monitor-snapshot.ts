import type { MonitorApiSnapshot } from "../data/site.js";

export const DEFAULT_MONITOR_URL = "/api/v1/monitor/snapshot";
export const LOCAL_SNAPSHOT_URL = "/monitor-fallback.json";

export const DEFAULT_SNAPSHOT: MonitorApiSnapshot = {
  tokenUsage: 0,
  requestCount: 0,
  rmbCost: 0,
  activeModel: "",
  provider: "",
  readmeSource: "",
  updatedAt: "",
};

export function getMonitorUrl() {
  const custom = import.meta.env.VITE_MONITOR_API_URL;
  return custom && custom.trim().length > 0 ? custom : DEFAULT_MONITOR_URL;
}

export interface ResolvedSnapshotResult {
  snapshot: MonitorApiSnapshot;
  isLive: boolean;
  errorMessage: string | null;
  activeSourceUrl: string;
}

export function normalizeMonitorSnapshot(raw: unknown): MonitorApiSnapshot {
  const obj = isRecord(raw) ? raw : {};
  const usage = isRecord(obj.usage) ? obj.usage : {};
  const pricing = isRecord(obj.pricing) ? obj.pricing : {};
  const model = isRecord(obj.model) ? obj.model : {};
  const meta = isRecord(obj.meta) ? obj.meta : {};

  return {
    tokenUsage: pickNumber(
      obj.tokenUsage,
      obj.tokens,
      obj.totalTokens,
      usage.total,
      usage.tokens,
    ),
    requestCount: pickNumber(
      obj.requestCount,
      obj.requests,
      obj.request_count,
      usage.requests,
      meta.requestCount,
    ),
    rmbCost: pickNumber(
      obj.rmbCost,
      obj.priceRmb,
      obj.price,
      pricing.rmb,
      pricing.cny,
    ),
    activeModel: pickString(
      obj.activeModel,
      obj.model,
      model.name,
      model.id,
    ),
    provider: pickString(
      obj.provider,
      model.provider,
      meta.provider,
    ),
    readmeSource: pickString(
      obj.readmeSource,
      obj.readme,
      meta.readmeSource,
    ),
    updatedAt: pickString(
      obj.updatedAt,
      obj.updated_at,
      meta.updatedAt,
    ),
  };
}

export function getErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "监控数据请求超时，请稍后重试。";
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "监控数据暂时不可用，请稍后重试。";
}

export function isSnapshotUsable(snapshot: MonitorApiSnapshot) {
  return Boolean(
    snapshot.tokenUsage > 0 ||
      snapshot.requestCount > 0 ||
      snapshot.rmbCost > 0 ||
      snapshot.activeModel.trim() ||
      snapshot.provider.trim() ||
      snapshot.readmeSource.trim() ||
      snapshot.updatedAt.trim(),
  );
}

export async function resolveSnapshotWithFallback({
  targetUrl,
  loadSnapshot,
}: {
  targetUrl: string;
  loadSnapshot: (url: string) => Promise<MonitorApiSnapshot>;
}): Promise<ResolvedSnapshotResult> {
  const hasCustomSource = targetUrl !== LOCAL_SNAPSHOT_URL;

  try {
    const snapshot = await loadSnapshot(targetUrl);
    return {
      snapshot,
      isLive: hasCustomSource,
      errorMessage: null,
      activeSourceUrl: targetUrl,
    };
  } catch (error) {
    if (hasCustomSource) {
      try {
        const snapshot = await loadSnapshot(LOCAL_SNAPSHOT_URL);
        return {
          snapshot,
          isLive: false,
          errorMessage: "真实接口请求失败，当前已回退到本地快照。",
          activeSourceUrl: LOCAL_SNAPSHOT_URL,
        };
      } catch {
        // Continue to generic error handling below.
      }
    }

    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pickNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const normalized = value.replace(/[^\d.-]/g, "").trim();
      if (!normalized) continue;

      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}
