import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CheckCircle, XCircle } from "lucide-react";
import type { NamedMetric, UsageOverview } from "@/types/usage";

/* eslint-disable @typescript-eslint/no-explicit-any */

const COLORS = [
  "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444",
  "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1",
];

const tooltipStyle = {
  contentStyle: { background: "#1a1a1a", border: "1px solid #333", borderRadius: 8 },
  labelStyle: { color: "#aaa" },
};

// ─── Daily Trend ───────────────────────────────────────────────────────────────

export function DailyTrendChart({ data }: { data: UsageOverview }) {
  const chartData = data.days.map((day) => ({
    date: day.date.slice(5),
    tokens: day.metrics.total_tokens,
    requests: day.metrics.api_requests,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-xs font-medium text-muted-foreground">每日 Token 消耗</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#888" }} />
              <YAxis tick={{ fontSize: 11, fill: "#888" }} tickFormatter={compact} />
              <Tooltip {...tooltipStyle} formatter={((v: number) => [v.toLocaleString(), "Tokens"]) as any} />
              <Area type="monotone" dataKey="tokens" stroke="#f59e0b" fill="url(#tokenGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h3 className="mb-3 text-xs font-medium text-muted-foreground">每日请求量</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="reqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#888" }} />
              <YAxis tick={{ fontSize: 11, fill: "#888" }} />
              <Tooltip {...tooltipStyle} formatter={((v: number) => [v.toLocaleString(), "请求数"]) as any} />
              <Area type="monotone" dataKey="requests" stroke="#3b82f6" fill="url(#reqGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── Model Distribution ────────────────────────────────────────────────────────

export function ModelDistributionChart({ models }: { models: NamedMetric[] }) {
  const top8 = models.slice(0, 8);
  const chartData = top8.map((m) => ({
    name: shortName(m.name),
    requests: m.metrics.api_requests,
  }));

  const pieData = top8.map((m, i) => ({
    name: shortName(m.name),
    value: m.metrics.api_requests,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-4 text-xs font-medium text-muted-foreground">模型调用分布 · Top 8</h3>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#888" }} tickFormatter={compact} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#888" }} width={130} />
              <Tooltip {...tooltipStyle} formatter={((v: number) => [v.toLocaleString(), "请求数"]) as any} />
              <Bar dataKey="requests" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col items-center justify-center lg:col-span-2">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2} dataKey="value">
                {pieData.map((entry, i) => (
                  <Cell key={entry.name} fill={entry.color || COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} formatter={((v: number) => [v.toLocaleString(), "请求数"]) as any} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
            {pieData.slice(0, 6).map((e) => (
              <span key={e.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: e.color }} />
                {e.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Success Rate ──────────────────────────────────────────────────────────────

export function SuccessRatePanel({ data }: { data: UsageOverview }) {
  const { summary } = data;
  const total = summary.api_requests;
  const rate = total > 0 ? (summary.successful_requests / total) * 100 : 0;

  const dailyRates = data.days.map((day) => ({
    date: day.date.slice(5),
    rate: day.metrics.api_requests > 0
      ? Number(((day.metrics.successful_requests / day.metrics.api_requests) * 100).toFixed(1))
      : 100,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-4 text-xs font-medium text-muted-foreground">服务可用性</h3>
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="relative flex h-28 w-28 items-center justify-center">
            <svg className="h-28 w-28 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#333" strokeWidth="8" />
              <circle
                cx="60" cy="60" r="50" fill="none" stroke="#10b981" strokeWidth="8"
                strokeDasharray={`${rate * 3.14} ${314 - rate * 3.14}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute text-center">
              <div className="text-xl font-bold text-foreground">{rate.toFixed(1)}%</div>
              <div className="text-[10px] text-muted-foreground">成功率</div>
            </div>
          </div>
          <div className="flex gap-3 text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <CheckCircle className="h-3 w-3 text-emerald-400" />{summary.successful_requests}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <XCircle className="h-3 w-3 text-red-400" />{summary.failed_requests}
            </span>
          </div>
        </div>

        <div className="sm:col-span-2">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={dailyRates}>
              <defs>
                <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#888" }} />
              <YAxis domain={[60, 100]} tick={{ fontSize: 10, fill: "#888" }} tickFormatter={(v) => `${v}%`} />
              <Tooltip {...tooltipStyle} formatter={((v: number) => [`${v}%`, "成功率"]) as any} />
              <Area type="monotone" dataKey="rate" stroke="#10b981" fill="url(#rateGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── MCP Tools ─────────────────────────────────────────────────────────────────

export function MCPToolsPanel({ data }: { data: UsageOverview }) {
  const mcpTools = data.mcp_tools ?? [];
  if (mcpTools.length === 0) return null;

  const totalCalls = mcpTools.reduce((sum, t) => sum + t.metrics.api_requests, 0);
  const daysActive = data.days.filter((d) => d.mcp_tools && d.mcp_tools.length > 0).length;

  const chartData = mcpTools.map((t) => ({
    name: t.name.replace("Knows/", ""),
    calls: t.metrics.api_requests,
  }));

  const dailyData = data.days
    .filter((d) => d.mcp_tools && d.mcp_tools.length > 0)
    .map((d) => ({
      date: d.date.slice(5),
      calls: d.mcp_tools!.reduce((sum, t) => sum + t.metrics.api_requests, 0),
    }));

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-5 flex items-baseline justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            数据来源：<span className="font-medium text-cyan-400">KnowS</span> MCP Server
          </p>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>活跃 <strong className="text-foreground">{daysActive}</strong> 天</span>
          <span>工具 <strong className="text-foreground">{mcpTools.length}</strong> 个</span>
          <span>总计 <strong className="text-foreground">{totalCalls}</strong> 次</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">工具使用频次</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#888" }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#888" }} width={130} />
              <Tooltip {...tooltipStyle} formatter={((v: number) => [v.toLocaleString(), "调用次数"]) as any} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="calls" name="调用次数" fill="#06b6d4" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">日调用量趋势</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="mcpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#888" }} />
              <YAxis tick={{ fontSize: 11, fill: "#888" }} />
              <Tooltip {...tooltipStyle} formatter={((v: number) => [v.toLocaleString(), "调用次数"]) as any} />
              <Area type="monotone" dataKey="calls" stroke="#06b6d4" fill="url(#mcpGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function shortName(name: string): string {
  const parts = name.split("/");
  const last = parts[parts.length - 1];
  return last.length > 18 ? last.slice(0, 16) + "…" : last;
}

function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}
