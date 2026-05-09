import logoIcon from "@/assets/logo-icon.png";
import {
  Activity,
  ArrowUpRight,
  CircleDot,
  Clock,
  Cpu,
  RefreshCw,
  Server,
  Zap,
} from "lucide-react";
import { siteContent } from "@/data/site";
import { useMonitorSnapshot } from "@/hooks/use-monitor-snapshot";
import { useUsageData } from "@/hooks/use-usage-data";
import { formatDateTime } from "@/lib/monitor-hero-state";
import {
  DailyTrendChart,
  ModelDistributionChart,
  SuccessRatePanel,
} from "@/components/usage-charts";

export function LandingPage() {
  const {
    snapshot,
    isLive,
    isLoading,
    isRefreshing,
    errorMessage,
    lastSuccessAt,
    hasUsableData,
    refresh,
  } = useMonitorSnapshot();
  const { data: usageData, isLoading: usageLoading } = useUsageData(20);

  return (
    <div className="min-h-screen bg-background">
      <Header isLive={isLive} isLoading={isLoading} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              运行概览
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {snapshot.startDate && snapshot.endDate
                ? `统计周期：${snapshot.startDate} ~ ${snapshot.endDate}`
                : siteContent.refreshHint}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "刷新中..." : "手动刷新"}
          </button>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            {errorMessage}
          </div>
        )}

        {isLoading && !hasUsableData ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <RefreshCw className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">正在加载数据...</p>
            </div>
          </div>
        ) : (
          <>
            <MetricsGrid
              tokenUsage={snapshot.tokenUsage}
              promptTokens={snapshot.promptTokens}
              completionTokens={snapshot.completionTokens}
              requestCount={snapshot.requestCount}
              successCount={snapshot.successCount}
              failedCount={snapshot.failedCount}
              activeModel={snapshot.activeModel}
              hasUsableData={hasUsableData}
              modelCount={usageData?.models?.length ?? 0}
            />

            <div className="mt-8 grid gap-6 lg:grid-cols-3">
              <StatusPanel
                isLive={isLive}
                lastSuccessAt={lastSuccessAt}
                updatedAt={snapshot.updatedAt}
                provider={snapshot.provider}
              />
              <MetricsDetail
                tokenUsage={snapshot.tokenUsage}
                requestCount={snapshot.requestCount}
                promptTokens={snapshot.promptTokens}
                completionTokens={snapshot.completionTokens}
              />
            </div>

            {!usageLoading && usageData && (
              <div className="mt-8 space-y-6">
                <DailyTrendChart data={usageData} />

                {usageData.models && usageData.models.length > 0 && (
                  <ModelDistributionChart models={usageData.models} />
                )}

                <SuccessRatePanel data={usageData} />
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

function Header({ isLive, isLoading }: { isLive: boolean; isLoading: boolean }) {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <img src={logoIcon} alt="" className="h-9 w-9 rounded-lg" />
          <div>
            <div className="text-base font-semibold text-foreground">
              {siteContent.title}
            </div>
            <div className="text-xs text-muted-foreground">
              {siteContent.subtitle}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge isLive={isLive} isLoading={isLoading} />
          <a
            href={siteContent.footer.repo}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground sm:inline-flex"
          >
            GitHub
            <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </header>
  );
}

function StatusBadge({ isLive, isLoading }: { isLive: boolean; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
        <div className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground" />
        加载中
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        isLive
          ? "bg-success/15 text-success"
          : "bg-warning/15 text-warning"
      }`}
    >
      <div
        className={`h-2 w-2 rounded-full ${
          isLive ? "bg-success animate-pulse" : "bg-warning"
        }`}
      />
      {isLive ? siteContent.liveText : siteContent.fallbackText}
    </div>
  );
}

function MetricsGrid({
  tokenUsage,
  promptTokens,
  completionTokens,
  requestCount,
  successCount,
  failedCount,
  activeModel,
  hasUsableData,
  modelCount,
}: {
  tokenUsage: number;
  promptTokens: number;
  completionTokens: number;
  requestCount: number;
  successCount: number;
  failedCount: number;
  activeModel: string;
  hasUsableData: boolean;
  modelCount: number;
}) {
  if (!hasUsableData) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <Activity className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">
          暂无可展示的监控数据，数据就绪后将自动显示
        </p>
      </div>
    );
  }

  const metrics = [
    {
      label: "总 Token 用量",
      value: formatCompactNumber(tokenUsage),
      subtext: `输入 ${formatCompactNumber(promptTokens)} · 输出 ${formatCompactNumber(completionTokens)}`,
      icon: Zap,
      accent: "text-amber-400",
      bg: "bg-amber-400/10",
    },
    {
      label: "请求次数",
      value: requestCount.toLocaleString("zh-CN"),
      subtext: `成功 ${successCount.toLocaleString("zh-CN")} · 失败 ${failedCount}`,
      icon: Activity,
      accent: "text-blue-400",
      bg: "bg-blue-400/10",
    },
    {
      label: "活跃模型",
      value: modelCount > 0 ? String(modelCount) : "—",
      subtext: modelCount > 0 ? `最常用: ${shortModelName(activeModel)}` : "暂无数据",
      icon: Cpu,
      accent: "text-purple-400",
      bg: "bg-purple-400/10",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-xl border border-border bg-card p-5 transition hover:border-border/80"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              {metric.label}
            </span>
            <div className={`rounded-lg p-2 ${metric.bg}`}>
              <metric.icon className={`h-4 w-4 ${metric.accent}`} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-foreground">
            {metric.value}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {metric.subtext}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusPanel({
  isLive,
  lastSuccessAt,
  updatedAt,
  provider,
}: {
  isLive: boolean;
  lastSuccessAt: string | null;
  updatedAt: string;
  provider: string;
}) {
  const items = [
    {
      label: "数据来源",
      value: isLive ? "实时接口" : "本地快照",
      icon: CircleDot,
    },
    {
      label: "最近成功拉取",
      value: formatDateTime(lastSuccessAt),
      icon: Clock,
    },
    {
      label: "数据更新时间",
      value: formatDateTime(updatedAt),
      icon: RefreshCw,
    },
    {
      label: "服务提供商",
      value: provider || "未提供",
      icon: Server,
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-6 lg:col-span-1">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        系统状态
      </h2>
      <div className="mt-5 space-y-4">
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-3">
            <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted-foreground">{item.label}</div>
              <div className="mt-0.5 truncate text-sm font-medium text-foreground">
                {item.value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricsDetail({
  tokenUsage,
  requestCount,
  promptTokens,
  completionTokens,
}: {
  tokenUsage: number;
  requestCount: number;
  promptTokens: number;
  completionTokens: number;
}) {
  const avgTokensPerRequest = requestCount > 0 ? Math.round(tokenUsage / requestCount) : 0;
  const promptRatio = tokenUsage > 0 ? ((promptTokens / tokenUsage) * 100).toFixed(1) : "0";

  return (
    <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        数据分析
      </h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <AnalysisCard
          label="平均每次请求 Token"
          value={avgTokensPerRequest.toLocaleString("zh-CN")}
          unit="tokens/req"
        />
        <AnalysisCard
          label="输入 Token 占比"
          value={`${promptRatio}%`}
          unit="prompt/total"
        />
        <AnalysisCard
          label="输出 Token 总量"
          value={formatCompactNumber(completionTokens)}
          unit="completion tokens"
        />
      </div>

      <div className="mt-6">
        <h3 className="mb-3 text-xs font-medium text-muted-foreground">
          Token 分布
        </h3>
        <TokenBar promptTokens={promptTokens} completionTokens={completionTokens} />
      </div>
    </div>
  );
}

function AnalysisCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/50 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-bold text-foreground">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{unit}</div>
    </div>
  );
}

function TokenBar({
  promptTokens,
  completionTokens,
}: {
  promptTokens: number;
  completionTokens: number;
}) {
  const total = promptTokens + completionTokens;
  if (total === 0) return null;

  const segments = [
    { label: "输入 (Prompt)", pct: (promptTokens / total) * 100, color: "bg-amber-400" },
    { label: "输出 (Completion)", pct: (completionTokens / total) * 100, color: "bg-blue-400" },
  ];

  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-secondary">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={`${seg.color} transition-all duration-500`}
            style={{ width: `${seg.pct}%` }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-4">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className={`h-2.5 w-2.5 rounded-full ${seg.color}`} />
            {seg.label} ({seg.pct.toFixed(1)}%)
          </div>
        ))}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="text-xs text-muted-foreground">
          {siteContent.footer.copyright}
        </div>
        <a
          href={siteContent.footer.repo}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground transition hover:text-foreground"
        >
          GitHub Repository
        </a>
      </div>
    </footer>
  );
}

function formatCompactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(1)}万`;
  return value.toLocaleString("zh-CN");
}

function shortModelName(name: string): string {
  if (!name) return "";
  const parts = name.split("/");
  return parts[parts.length - 1];
}
