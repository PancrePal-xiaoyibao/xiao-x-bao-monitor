import logoIcon from "@/assets/logo-icon.png";
import sponsorSiliconflow from "@/assets/sponsor-siliconflow.png";
import sponsorStepfun from "@/assets/sponsor-stepfun.png";
import sponsorKnows from "@/assets/sponsor-knows.png";
import {
  Activity,
  ArrowUpRight,
  CheckCircle,
  Cpu,
  RefreshCw,
  Zap,
} from "lucide-react";
import { siteContent } from "@/data/site";
import { useMonitorSnapshot } from "@/hooks/use-monitor-snapshot";
import { useUsageData } from "@/hooks/use-usage-data";
import {
  DailyTrendChart,
  MCPToolsPanel,
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
    hasUsableData,
    refresh,
  } = useMonitorSnapshot();
  const { data: usageData, isLoading: usageLoading } = useUsageData(20);

  const successRate = snapshot.requestCount > 0
    ? ((snapshot.successCount / snapshot.requestCount) * 100).toFixed(1)
    : "—";

  return (
    <div className="min-h-screen bg-background">
      <Header isLive={isLive} isLoading={isLoading} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Title */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              服务概览
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {snapshot.startDate && snapshot.endDate
                ? `${snapshot.startDate} — ${snapshot.endDate} · 数据每分钟自动同步`
                : "数据加载中..."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "同步中..." : "立即同步"}
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
              <p className="mt-4 text-sm text-muted-foreground">正在加载监控数据...</p>
            </div>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            {hasUsableData && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                  label="Token 消耗"
                  value={formatCompact(snapshot.tokenUsage)}
                  detail={`输入 ${formatCompact(snapshot.promptTokens)} · 输出 ${formatCompact(snapshot.completionTokens)}`}
                  icon={Zap}
                  accent="text-amber-400"
                  bg="bg-amber-400/10"
                />
                <KpiCard
                  label="API 请求"
                  value={snapshot.requestCount.toLocaleString("zh-CN")}
                  detail={`成功 ${snapshot.successCount.toLocaleString("zh-CN")} · 失败 ${snapshot.failedCount}`}
                  icon={Activity}
                  accent="text-blue-400"
                  bg="bg-blue-400/10"
                />
                <KpiCard
                  label="请求成功率"
                  value={`${successRate}%`}
                  detail={`共 ${snapshot.requestCount.toLocaleString("zh-CN")} 次调用`}
                  icon={CheckCircle}
                  accent="text-emerald-400"
                  bg="bg-emerald-400/10"
                />
                <KpiCard
                  label="接入模型"
                  value={String(usageData?.models?.length ?? 0)}
                  detail={`Top 1: ${shortModelName(snapshot.activeModel)}`}
                  icon={Cpu}
                  accent="text-purple-400"
                  bg="bg-purple-400/10"
                />
              </div>
            )}

            {/* Section: API 调用分析 */}
            {!usageLoading && usageData && (
              <>
                <section className="mt-10">
                  <SectionHeader title="API 调用分析" subtitle="模型推理请求的用量趋势与分布" />
                  <div className="mt-4 space-y-6">
                    <DailyTrendChart data={usageData} />
                    <div className="grid gap-6 lg:grid-cols-2">
                      {usageData.models && usageData.models.length > 0 && (
                        <ModelDistributionChart models={usageData.models} />
                      )}
                      <SuccessRatePanel data={usageData} />
                    </div>
                  </div>
                </section>

                {/* Section: MCP 工具分析 */}
                <section className="mt-10">
                  <SectionHeader title="MCP 工具调用" subtitle="KnowS 医学证据检索服务的工具使用情况" />
                  <div className="mt-4">
                    <MCPToolsPanel data={usageData} />
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </main>

      <Sponsors />
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
        连接中
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
      {isLive ? "服务正常" : "离线模式"}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="border-l-2 border-blue-400 pl-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  accent,
  bg,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  bg: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 transition hover:border-border/80">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className={`rounded-lg p-2 ${bg}`}>
          <Icon className={`h-4 w-4 ${accent}`} />
        </div>
      </div>
      <div className="mt-3 text-2xl font-bold text-foreground">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function Sponsors() {
  return (
    <section className="border-t border-border bg-card/50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="mb-6 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
          感谢赞助商支持
        </p>
        <div className="flex flex-wrap items-center justify-center gap-12">
          <a href="https://siliconflow.cn" target="_blank" rel="noreferrer" className="transition hover:opacity-80">
            <img src={sponsorSiliconflow} alt="SiliconFlow" className="h-8" />
          </a>
          <a href="https://www.stepfun.com" target="_blank" rel="noreferrer" className="transition hover:opacity-80">
            <img src={sponsorStepfun} alt="StepFun 阶跃星辰" className="h-8" />
          </a>
          <a href="https://www.medknows.com/" target="_blank" rel="noreferrer" className="flex items-center gap-2 transition hover:opacity-80">
            <img src={sponsorKnows} alt="KnowS" className="h-8 w-8" />
            <span className="text-sm font-medium text-muted-foreground">KnowS</span>
          </a>
        </div>
      </div>
    </section>
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

function formatCompact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(1)}万`;
  return value.toLocaleString("zh-CN");
}

function shortModelName(name: string): string {
  if (!name) return "—";
  const parts = name.split("/");
  return parts[parts.length - 1];
}
