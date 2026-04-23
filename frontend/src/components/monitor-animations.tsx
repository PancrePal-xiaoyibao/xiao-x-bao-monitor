import { motion } from "motion/react";
import { BarChart3, CircleDot, Cpu, RadioTower, Wallet } from "lucide-react";
import type { MonitorApiSnapshot } from "@/data/site";

interface MonitorAnimationProps {
  snapshot: MonitorApiSnapshot;
}

export function MonitorOverviewAnimation({ snapshot }: MonitorAnimationProps) {
  const rows = [
    { time: "21:32:14", model: snapshot.activeModel, provider: snapshot.provider, cost: formatMiniCurrency(snapshot.rmbCost * 0.18), status: "正常" },
    { time: "21:32:18", model: `${snapshot.activeModel}-cache`, provider: snapshot.provider, cost: formatMiniCurrency(snapshot.rmbCost * 0.07), status: "同步中" },
    { time: "21:32:22", model: snapshot.activeModel, provider: "README", cost: "文档", status: snapshot.readmeSource },
    { time: "21:32:28", model: snapshot.activeModel, provider: snapshot.provider, cost: formatMiniCurrency(snapshot.rmbCost * 0.05), status: "已更新" },
  ];

  return (
    <div className="relative h-[360px] overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_top,rgba(121,170,255,0.22),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-5">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:26px_26px] opacity-25" />
      <motion.div
        className="absolute -left-16 top-8 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl"
        animate={{ x: [0, 18, -8, 0], y: [0, -10, 14, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-10 bottom-4 h-32 w-32 rounded-full bg-indigo-400/20 blur-3xl"
        animate={{ x: [0, -20, 6, 0], y: [0, 10, -8, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-center justify-between rounded-[22px] border border-white/10 bg-black/30 px-4 py-3 backdrop-blur-xl">
          <div>
            <div className="text-xs font-body text-white/45">小馨宝监控总览</div>
            <div className="mt-1 text-lg font-body font-medium text-white">实时调用看板</div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
            <CircleDot className="h-3.5 w-3.5" />
            实时流
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: "Tokens", value: formatCompactNumber(snapshot.tokenUsage), icon: BarChart3 },
            { label: "请求", value: snapshot.requestCount.toLocaleString("zh-CN"), icon: RadioTower },
            { label: "成本", value: formatMiniCurrency(snapshot.rmbCost), icon: Wallet },
          ].map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.label}
                initial={{ opacity: 0.4, y: 12 }}
                animate={{ opacity: [0.55, 1, 0.55], y: [6, 0, 6] }}
                transition={{ duration: 4 + index, repeat: Infinity, ease: "easeInOut" }}
                className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl"
              >
                <Icon className="h-4 w-4 text-white/70" />
                <div className="mt-4 text-xs font-body text-white/45">{item.label}</div>
                <div className="mt-1 text-2xl font-heading italic text-white">{item.value}</div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-4 flex-1 overflow-hidden rounded-[24px] border border-white/10 bg-black/35 p-3">
          <motion.div
            animate={{ y: [0, -112, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="space-y-2"
          >
            {rows.concat(rows).map((row, index) => (
              <div
                key={`${row.time}-${index}`}
                className="grid grid-cols-[1fr_1.2fr_1fr_0.8fr_0.8fr] items-center rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3 text-[11px] font-body text-white/72"
              >
                <span>{row.time}</span>
                <span>{row.model}</span>
                <span>{row.provider}</span>
                <span>{row.cost}</span>
                <span className="text-right text-cyan-200">{row.status}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export function MonitorSignalsAnimation({ snapshot }: MonitorAnimationProps) {
  const seed = Math.max(32, Math.min(96, Math.round(snapshot.requestCount / 90)));
  const bars = [seed - 8, seed + 16, seed - 18, seed + 24, seed + 1, seed + 28, seed - 12, seed + 8, seed - 4, seed + 20, seed + 3, seed + 10];

  return (
    <div className="relative h-[360px] overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_bottom_right,rgba(255,98,130,0.2),transparent_30%),radial-gradient(circle_at_top_left,rgba(76,201,240,0.16),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-5">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:30px_30px] opacity-25" />

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-body text-white/45">Provider / 模型 / 成本波形</div>
            <div className="mt-1 text-lg font-body font-medium text-white">多来源监控状态</div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/70">
            <Cpu className="h-3.5 w-3.5" />
            5 个来源
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border border-white/10 bg-black/30 p-4 backdrop-blur-xl">
          <div className="flex items-end gap-2">
            {bars.map((height, index) => (
              <motion.div
                key={`${height}-${index}`}
                className="flex-1 rounded-t-full bg-gradient-to-t from-fuchsia-400 via-pink-300 to-white"
                style={{ height: `${height}px` }}
                animate={{ height: [`${Math.max(26, height - 18)}px`, `${height}px`, `${height + 18}px`, `${height}px`] }}
                transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut", delay: index * 0.08 }}
              />
            ))}
          </div>
          <div className="mt-3 flex justify-between text-[11px] font-body text-white/40">
            <span>{snapshot.provider}</span>
            <span>{snapshot.activeModel.slice(0, 4)}</span>
            <span>Tokens</span>
            <span>RMB</span>
            <span>README</span>
          </div>
        </div>

        <div className="mt-4 grid flex-1 grid-cols-[1.1fr_0.9fr] gap-4">
          <div className="rounded-[24px] border border-white/10 bg-black/35 p-4">
            <div className="text-xs font-body text-white/45">调用波形</div>
            <svg viewBox="0 0 320 160" className="mt-4 h-[170px] w-full">
              <defs>
                <linearGradient id="waveStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6ee7f9" />
                  <stop offset="50%" stopColor="#ffffff" />
                  <stop offset="100%" stopColor="#f472b6" />
                </linearGradient>
              </defs>
              <motion.path
                d="M0 112 C 34 60, 70 140, 110 88 S 180 32, 220 76 S 280 130, 320 62"
                fill="none"
                stroke="url(#waveStroke)"
                strokeWidth="4"
                strokeLinecap="round"
                initial={{ pathLength: 0.2, opacity: 0.4 }}
                animate={{ pathLength: [0.2, 1, 1], opacity: [0.4, 1, 0.7] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.circle
                cx="220"
                cy="76"
                r="6"
                fill="#fff"
                animate={{ scale: [1, 1.45, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              />
            </svg>
          </div>

          <div className="space-y-4">
            {[
              { label: "当前 Provider", value: snapshot.provider, accent: "text-cyan-200" },
              { label: "当前模型", value: snapshot.activeModel, accent: "text-pink-200" },
              { label: "README 来源", value: snapshot.readmeSource, accent: "text-emerald-200" },
            ].map((item, index) => (
              <motion.div
                key={item.label}
                className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl"
                animate={{ y: [0, -4, 0], opacity: [0.72, 1, 0.72] }}
                transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut", delay: index * 0.18 }}
              >
                <div className="text-xs font-body text-white/45">{item.label}</div>
                <div className={`mt-2 text-2xl font-heading italic ${item.accent}`}>{item.value}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatCompactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(1)}万`;
  return value.toLocaleString("zh-CN");
}

function formatMiniCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: value < 100 ? 1 : 0,
  }).format(value);
}
