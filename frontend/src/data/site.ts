export interface MonitorApiSnapshot {
  tokenUsage: number;
  requestCount: number;
  rmbCost: number;
  activeModel: string;
  provider: string;
  readmeSource: string;
  updatedAt: string;
}

export const siteContent = {
  title: "小馨宝 AI 调用监控",
  subtitle: "面向合作伙伴的实时运行数据看板",
  refreshHint: "数据每 15 秒自动刷新",
  liveText: "实时数据",
  fallbackText: "快照数据",
  footer: {
    copyright: "© 2026 Xiao X Bao Monitor. All rights reserved.",
    repo: "https://github.com/PancrePal-xiaoyibao/xiao-x-bao-monitor",
  },
} as const;
