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

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Activity,
  CheckCircle,
  TrendingUp,
  XCircle,
} from "lucide-react";
import type { NamedMetric, UsageOverview } from "@/types/usage";

const COLORS = [
  "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444",
  "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1",
];

export function DailyTrendChart({ data }: { data: UsageOverview }) {
  const chartData = data.days.map((day) => ({
    date: day.date.slice(5),
    tokens: day.metrics.total_tokens,
    requests: day.metrics.api_requests,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-blue-400" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          每日用量趋势
        </h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs text-muted-foreground">Token 用量</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#888" }} />
              <YAxis tick={{ fontSize: 11, fill: "#888" }} tickFormatter={compactNumber} />
              <Tooltip
                contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8 }}
                labelStyle={{ color: "#aaa" }}
                formatter={((value: number) => [value.toLocaleString(), "Tokens"]) as any}
              />
              <Area type="monotone" dataKey="tokens" stroke="#f59e0b" fill="url(#tokenGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div>
          <h3 className="mb-2 text-xs text-muted-foreground">请求次数</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="requestGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#888" }} />
              <YAxis tick={{ fontSize: 11, fill: "#888" }} />
              <Tooltip
                contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8 }}
                labelStyle={{ color: "#aaa" }}
              />
              <Area type="monotone" dataKey="requests" name="请求数" stroke="#3b82f6" fill="url(#requestGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export function ModelDistributionChart({ models }: { models: NamedMetric[] }) {
  const top8 = models.slice(0, 8);
  const chartData = top8.map((m) => ({
    name: shortModelName(m.name),
    fullName: m.name,
    requests: m.metrics.api_requests,
    tokens: m.metrics.total_tokens,
    spend: Number(m.metrics.spend.toFixed(4)),
  }));

  const pieData = top8.map((m, i) => ({
    name: shortModelName(m.name),
    value: m.metrics.api_requests,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-4 w-4 text-purple-400" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          模型用量分布
        </h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#888" }} tickFormatter={compactNumber} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#888" }} width={140} />
              <Tooltip
                contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8 }}
                labelStyle={{ color: "#aaa" }}
                formatter={((value: number, name: string) => {
                  if (name === "tokens") return [value.toLocaleString(), "Tokens"];
                  return [value.toLocaleString(), "请求数"];
                }) as any}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="requests" name="请求数" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="lg:col-span-1">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={entry.name} fill={entry.color || COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8 }}
                formatter={((value: number) => [value.toLocaleString(), "请求数"]) as any}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-2">
            {pieData.slice(0, 6).map((entry) => (
              <div key={entry.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SuccessRatePanel({ data }: { data: UsageOverview }) {
  const { summary } = data;
  const total = summary.api_requests;
  const successRate = total > 0 ? (summary.successful_requests / total) * 100 : 0;

  const dailyRates = data.days.map((day) => ({
    date: day.date.slice(5),
    success: day.metrics.api_requests > 0
      ? Number(((day.metrics.successful_requests / day.metrics.api_requests) * 100).toFixed(1))
      : 100,
    failed: day.metrics.failed_requests,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <CheckCircle className="h-4 w-4 text-emerald-400" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          请求成功率
        </h2>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="relative flex h-32 w-32 items-center justify-center">
            <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#333" strokeWidth="10" />
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="#10b981"
                strokeWidth="10"
                strokeDasharray={`${successRate * 3.14} ${314 - successRate * 3.14}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute text-center">
              <div className="text-2xl font-bold text-foreground">{successRate.toFixed(1)}%</div>
              <div className="text-[10px] text-muted-foreground">成功率</div>
            </div>
          </div>

          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-3 w-3 text-emerald-400" />
              <span className="text-muted-foreground">成功 {summary.successful_requests}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="h-3 w-3 text-red-400" />
              <span className="text-muted-foreground">失败 {summary.failed_requests}</span>
            </div>
          </div>
        </div>

        <div className="sm:col-span-2">
          <h3 className="mb-2 text-xs text-muted-foreground">每日成功率趋势</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={dailyRates}>
              <defs>
                <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#888" }} />
              <YAxis domain={[60, 100]} tick={{ fontSize: 11, fill: "#888" }} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8 }}
                labelStyle={{ color: "#aaa" }}
                formatter={((value: number, name: string) => {
                  if (name === "success") return [`${value}%`, "成功率"];
                  return [String(value), "失败次数"];
                }) as any}
              />
              <Area type="monotone" dataKey="success" stroke="#10b981" fill="url(#successGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function shortModelName(name: string): string {
  const parts = name.split("/");
  const last = parts[parts.length - 1];
  return last.length > 20 ? last.slice(0, 18) + "…" : last;
}

function compactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}
