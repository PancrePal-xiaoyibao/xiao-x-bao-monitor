export interface MonitorApiSnapshot {
  tokenUsage: number;
  promptTokens: number;
  completionTokens: number;
  requestCount: number;
  successCount: number;
  failedCount: number;
  rmbCost: number;
  activeModel: string;
  provider: string;
  readmeSource: string;
  updatedAt: string;
  startDate: string;
  endDate: string;
}

export const siteContent = {
  title: "小X宝 AI 调用监控",
  subtitle: "面向合作伙伴的实时运行数据看板",
  refreshHint: "数据每 15 秒自动刷新",
  liveText: "实时数据",
  fallbackText: "快照数据",
  footer: {
    copyright: "© 2026 Xiao X Bao Monitor. All rights reserved.",
    repo: "https://github.com/PancrePal-xiaoyibao/xiao-x-bao-monitor",
  },
} as const;
