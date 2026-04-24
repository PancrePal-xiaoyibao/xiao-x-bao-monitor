import test from "node:test";
import assert from "node:assert/strict";
import {
  formatDateTime,
  getHeroStatusState,
  isSnapshotStale,
} from "../src/lib/monitor-hero-state.js";

test("getHeroStatusState returns loading and empty-state copy during first load", () => {
  const state = getHeroStatusState({
    isLive: false,
    isLoading: true,
    errorMessage: null,
    hasUsableData: false,
    snapshotUpdatedAt: "",
    lastSuccessAt: null,
    liveText: "实时数据",
    fallbackText: "快照数据",
    now: Date.parse("2026-04-23T10:00:00.000Z"),
  });

  assert.equal(state.liveBadgeText, "加载中");
  assert.equal(state.freshnessText, "可能偏旧");
  assert.equal(state.statusText, "当前显示本地快照，内容时间显示的是快照时间");
  assert.equal(state.statusTone, "neutral");
  assert.equal(state.emptyStateText, "正在拉取监控数据，首屏指标会在请求完成后显示。");
  assert.equal(state.snapshotUpdatedTitle, "快照内容时间");
});

test("getHeroStatusState surfaces fallback error messaging", () => {
  const state = getHeroStatusState({
    isLive: false,
    isLoading: false,
    errorMessage: "真实接口请求失败，当前已回退到本地快照，内容时间显示的是快照时间。",
    hasUsableData: false,
    snapshotUpdatedAt: "",
    lastSuccessAt: "2026-04-23T09:58:30.000Z",
    liveText: "实时数据",
    fallbackText: "快照数据",
    now: Date.parse("2026-04-23T10:00:00.000Z"),
  });

  assert.equal(state.liveBadgeText, "快照数据");
  assert.equal(state.freshnessText, "最新可见");
  assert.equal(state.statusText, "真实接口请求失败，当前已回退到本地快照，内容时间显示的是快照时间。");
  assert.equal(state.statusTone, "warning");
  assert.equal(state.snapshotUpdatedTitle, "快照内容时间");
  assert.equal(
    state.emptyStateText,
    "当前还没有可展示的监控数据。 可以稍后刷新再看，或回到说明区了解当前数据来源。",
  );
});

test("getHeroStatusState prefers live success messaging when usable data exists", () => {
  const state = getHeroStatusState({
    isLive: true,
    isLoading: false,
    errorMessage: null,
    hasUsableData: true,
    snapshotUpdatedAt: "2026-04-23T09:58:30.000Z",
    lastSuccessAt: "2026-04-23T09:59:00.000Z",
    liveText: "实时数据",
    fallbackText: "快照数据",
    now: Date.parse("2026-04-23T10:00:00.000Z"),
  });

  assert.equal(state.liveBadgeText, "实时数据");
  assert.equal(state.freshnessText, "最新可见");
  assert.equal(state.statusText, "实时数据更新中");
  assert.equal(state.statusTone, "neutral");
  assert.equal(state.emptyStateText, null);
  assert.equal(state.snapshotUpdatedTitle, "内容同步时间");
});

test("formatDateTime returns unavailable copy for invalid timestamps", () => {
  assert.equal(formatDateTime("not-a-date"), "时间不可用");
  assert.equal(formatDateTime(null), "暂未成功拉取");
});

test("isSnapshotStale falls back to lastSuccessAt when updatedAt is missing", () => {
  const fresh = isSnapshotStale(
    "",
    "2026-04-23T09:58:30.000Z",
    Date.parse("2026-04-23T10:00:00.000Z"),
  );
  const stale = isSnapshotStale(
    "",
    "2026-04-23T09:40:00.000Z",
    Date.parse("2026-04-23T10:00:00.000Z"),
  );

  assert.equal(fresh, false);
  assert.equal(stale, true);
});
