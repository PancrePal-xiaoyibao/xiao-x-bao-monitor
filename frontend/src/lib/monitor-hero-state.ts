export interface HeroStatusStateInput {
  isLive: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  hasUsableData: boolean;
  snapshotUpdatedAt: string;
  lastSuccessAt: string | null;
  now?: number;
  liveText: string;
  fallbackText: string;
}

export interface HeroStatusState {
  liveBadgeText: string;
  freshnessText: string;
  statusText: string;
  statusTone: "neutral" | "warning";
  emptyStateText: string | null;
  snapshotUpdatedTitle: string;
  snapshotUpdatedLabel: string;
  lastSuccessLabel: string;
}

const STALE_AFTER_MS = 5 * 60 * 1000;

export function getHeroStatusState(input: HeroStatusStateInput): HeroStatusState {
  const snapshotUpdatedLabel = formatDateTime(input.snapshotUpdatedAt);
  const lastSuccessLabel = formatDateTime(input.lastSuccessAt);
  const isStale = isSnapshotStale(input.snapshotUpdatedAt, input.lastSuccessAt, input.now);

  return {
    liveBadgeText: input.isLoading
      ? "加载中"
      : input.isLive
        ? input.liveText
        : input.fallbackText,
    freshnessText: isStale ? "可能偏旧" : "最新可见",
    statusText:
      input.errorMessage ??
      (input.isLive ? "实时数据更新中" : "当前显示本地快照，内容时间显示的是快照时间"),
    statusTone: input.errorMessage ? "warning" : "neutral",
    emptyStateText: input.hasUsableData
      ? null
      : buildEmptyStateText({
          isLoading: input.isLoading,
          errorMessage: input.errorMessage,
        }),
    snapshotUpdatedTitle: input.isLive ? "内容同步时间" : "快照内容时间",
    snapshotUpdatedLabel,
    lastSuccessLabel,
  };
}

export function formatDateTime(value: string | null) {
  if (!value) return "暂未成功拉取";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间不可用";

  return date.toLocaleString("zh-CN");
}

export function isSnapshotStale(updatedAt: string, lastSuccessAt: string | null, now = Date.now()) {
  const date = pickFreshnessDate(updatedAt, lastSuccessAt);
  if (!date) return true;

  return now - date.getTime() > STALE_AFTER_MS;
}

function buildEmptyStateText({
  isLoading,
  errorMessage,
}: {
  isLoading: boolean;
  errorMessage: string | null;
}) {
  if (isLoading) {
    return "正在拉取监控数据，首屏指标会在请求完成后显示。";
  }

  return errorMessage
    ? "当前还没有可展示的监控数据。 可以稍后刷新再看，或回到说明区了解当前数据来源。"
    : "当前还没有可展示的监控数据。 相关指标会在数据准备好之后显示在这里。";
}

function pickFreshnessDate(updatedAt: string, lastSuccessAt: string | null) {
  const candidates = [updatedAt, lastSuccessAt];

  for (const value of candidates) {
    if (!value) continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return null;
}
