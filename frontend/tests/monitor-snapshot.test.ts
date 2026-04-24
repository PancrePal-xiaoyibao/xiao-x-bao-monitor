import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SNAPSHOT,
  getErrorMessage,
  isSnapshotUsable,
  normalizeMonitorSnapshot,
  resolveSnapshotWithFallback,
  LOCAL_SNAPSHOT_URL,
} from "../src/lib/monitor-snapshot.js";

test("normalizeMonitorSnapshot maps nested aliases and numeric strings", () => {
  const snapshot = normalizeMonitorSnapshot({
    totalTokens: "12,800",
    usage: {
      requests: "0",
    },
    pricing: {
      cny: "1736",
    },
    model: {
      id: "gpt-4.1",
      provider: "OpenAI",
    },
    meta: {
      readmeSource: "README 已同步",
      updatedAt: "2026-04-22T13:00:00.000Z",
    },
  });

  assert.deepEqual(snapshot, {
    tokenUsage: 12800,
    requestCount: 0,
    rmbCost: 1736,
    activeModel: "gpt-4.1",
    provider: "OpenAI",
    readmeSource: "README 已同步",
    updatedAt: "2026-04-22T13:00:00.000Z",
  });
});

test("isSnapshotUsable accepts descriptive metadata without numeric metrics", () => {
  const snapshot = {
    ...DEFAULT_SNAPSHOT,
    readmeSource: "项目说明已同步",
  };

  assert.equal(isSnapshotUsable(snapshot), true);
});

test("isSnapshotUsable rejects a fully empty snapshot", () => {
  assert.equal(isSnapshotUsable(DEFAULT_SNAPSHOT), false);
});

test("getErrorMessage returns timeout copy for aborted requests", () => {
  const abortError = new DOMException("The operation was aborted.", "AbortError");

  assert.equal(getErrorMessage(abortError), "监控数据请求超时，请稍后重试。");
});

test("getErrorMessage falls back to generic copy for unknown errors", () => {
  assert.equal(getErrorMessage({}), "监控数据暂时不可用，请稍后重试。");
});

test("resolveSnapshotWithFallback keeps live data when target succeeds", async () => {
  const snapshot = {
    ...DEFAULT_SNAPSHOT,
    provider: "OpenAI",
  };
  const calls: string[] = [];

  const result = await resolveSnapshotWithFallback({
    targetUrl: "https://example.com/monitor",
    loadSnapshot: async (url) => {
      calls.push(url);
      return snapshot;
    },
  });

  assert.deepEqual(calls, ["https://example.com/monitor"]);
  assert.deepEqual(result, {
    snapshot,
    isLive: true,
    errorMessage: null,
    activeSourceUrl: "https://example.com/monitor",
  });
});

test("resolveSnapshotWithFallback falls back to local snapshot when target fails", async () => {
  const fallbackSnapshot = {
    ...DEFAULT_SNAPSHOT,
    readmeSource: "README 已同步",
  };
  const calls: string[] = [];

  const result = await resolveSnapshotWithFallback({
    targetUrl: "https://example.com/monitor",
    loadSnapshot: async (url) => {
      calls.push(url);
      if (url === LOCAL_SNAPSHOT_URL) {
        return fallbackSnapshot;
      }
      throw new Error("primary failed");
    },
  });

  assert.deepEqual(calls, ["https://example.com/monitor", LOCAL_SNAPSHOT_URL]);
  assert.deepEqual(result, {
    snapshot: fallbackSnapshot,
    isLive: false,
    errorMessage: "真实接口请求失败，当前已回退到本地快照，内容时间显示的是快照时间。",
    activeSourceUrl: LOCAL_SNAPSHOT_URL,
  });
});

test("resolveSnapshotWithFallback rethrows when target and fallback both fail", async () => {
  await assert.rejects(
    resolveSnapshotWithFallback({
      targetUrl: "https://example.com/monitor",
      loadSnapshot: async () => {
        throw new Error("both failed");
      },
    }),
    /both failed/,
  );
});
