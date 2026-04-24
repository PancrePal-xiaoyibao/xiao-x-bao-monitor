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
  nav: [
    { label: "首页", href: "#home" },
    { label: "能力", href: "#capabilities" },
    { label: "指标", href: "#metrics" },
    { label: "接入", href: "#integration" },
    { label: "配置", href: "#integration-guide" },
    { label: "说明", href: "#readme" },
  ],
  startVideo:
    "https://stream.mux.com/9JXDljEVWYwWu01PUkAemafDugK89o01BR6zqJ3aS9u00A.m3u8",
  statsVideo:
    "https://stream.mux.com/NcU3HlHeF7CUL86azTTzpy3Tlb00d6iF3BmCdFslMJYM.m3u8",
  ctaVideo:
    "https://stream.mux.com/8wrHPCX2dC3msyYU9ObwqNdm00u3ViXvOSHUMRYSEe5Q.m3u8",
  heroPoster: "/images/hero_bg.jpeg",
  hero: {
    badge: "监控单页",
    badgeText: "面向合作沟通的小馨宝状态总览。",
    title: "把 Tokens、请求量、人民币成本和模型信息放到同一个监控首页里。",
    description:
      "帮助合作方快速了解小馨宝当前的运行规模、成本情况、所用模型与服务来源，也能同步看到项目说明和整体进展，便于沟通与判断。",
    primaryCta: "查看监控指标",
    secondaryCta: "了解项目",
    liveLabel: "当前状态",
    liveText: "实时数据",
    fallbackText: "快照数据",
    refreshHint: "数据每 15 秒更新一次",
    sourcesLabel: "当前参考信息",
  },
  howItWorks: {
    badge: "查看方式",
    title: "打开首页，就能先把小馨宝当前情况看明白。",
    description:
      "如果你是第一次了解这个项目，这一页会先把最关键的信息摆在眼前，让沟通从整体情况开始，而不是从零散细节开始。",
    cta: "了解更多",
  },
  capabilitiesHeader: {
    badge: "首页重点",
    title: "先看到最该被看到的信息。",
  },
  capabilityRows: [
    {
      title: "把关键监控指标集中到一张卡片里。",
      body:
        "Token 用量、请求次数、人民币成本、当前模型和服务来源会集中呈现，帮助合作方更快理解项目当前的运行状态。",
      cta: "查看指标区",
    },
    {
      title: "把项目说明和运行状态放在同一页里。",
      body:
        "除了运行数据，你也能在这里快速看到项目说明、信息来源和整体口径，方便合作沟通时保持表达一致。",
      cta: "查看说明",
    },
  ],
  whyUsHeader: {
    badge: "你能看到",
    title: "首页已经可以回答的大部分关键问题。",
  },
  whyUs: [
    {
      title: "当前数据来自哪里",
      body:
        "你可以直接知道当前看到的是实时内容还是阶段快照，更容易理解这页反映的是哪一时刻的情况。",
      icon: "zap" as const,
    },
    {
      title: "项目说明是否一致",
      body:
        "项目说明会同步展示在页面里，方便合作方、客户和团队成员快速对齐对项目的理解。",
      icon: "palette" as const,
    },
    {
      title: "成本和状态是否清楚",
      body:
        "调用规模、成本、模型与服务来源会一起出现，更方便快速判断项目当前所处的状态。",
      icon: "chart" as const,
    },
    {
      title: "下一步该去看哪里",
      body:
        "从指标到说明再到信息来源，这一页可以帮助你判断下一步是继续了解项目，还是继续深入沟通细节。",
      icon: "shield" as const,
    },
  ],
  demoSection: {
    badge: "页面预览",
    title: "在进入细节之前，先感受这页会如何呈现项目。",
    description:
      "下面这两段预览可以帮助你快速了解首页的整体氛围、信息密度和对外呈现方式。",
    items: [
      {
        title: "首页总览",
        body: "快速了解首页卡片、背景氛围和整体信息布局。",
        src: "/media/feature-1.gif",
      },
      {
        title: "说明与指标区域",
        body: "快速了解说明区、指标区和滚动阅读时的页面节奏。",
        src: "/media/feature-2.gif",
      },
    ],
  },
  metricsHeader: {
    badge: "核心指标",
    title: "先看这几项，就能把项目当前情况讲明白。",
  },
  integrationGuide: {
    badge: "更多信息",
    title: "想知道这页在看什么，可以从这里继续往下读。",
    description:
      "这里会补充说明当前内容的来源、更新节奏，以及你在页面里会看到的主要信息。",
    endpointLabel: "默认来源",
    endpointValue: "/api/v1/monitor/snapshot",
    pollLabel: "更新节奏",
    pollValue: "15 秒",
    envVarLabel: "切换方式",
    envVarValue: "VITE_MONITOR_API_URL",
    exampleTitle: "内容示意",
  },
  monitorFields: [
    {
      label: "Token 用量",
      key: "tokenUsage",
      aliases: ["tokens", "totalTokens", "usage.total", "usage.tokens"],
    },
    {
      label: "请求次数",
      key: "requestCount",
      aliases: ["requests", "request_count", "usage.requests", "meta.requestCount"],
    },
    {
      label: "人民币价格",
      key: "rmbCost",
      aliases: ["priceRmb", "price", "pricing.rmb", "pricing.cny"],
    },
    {
      label: "当前模型",
      key: "activeModel",
      aliases: ["model", "model.name", "model.id"],
    },
    {
      label: "Provider",
      key: "provider",
      aliases: ["model.provider", "meta.provider"],
    },
    {
      label: "说明来源",
      key: "readmeSource",
      aliases: ["readme", "meta.readmeSource"],
    },
    {
      label: "更新时间",
      key: "updatedAt",
      aliases: ["updated_at", "meta.updatedAt"],
    },
  ],
  exampleResponse: `{
  "tokenUsage": 1280000,
  "requestCount": 4892,
  "rmbCost": 1736,
  "activeModel": "gpt-4.1",
  "provider": "OpenAI",
  "readmeSource": "项目说明已同步",
  "updatedAt": "2026-04-22T13:00:00.000Z"
}`,
  readmeSection: {
    badge: "项目说明",
    title: "把项目说明直接放到首页，方便合作方随时查看。",
    description:
      "如果你想更完整地了解小馨宝 monitor 的背景、用途和关键说明，可以从这一部分开始阅读。",
  },
  operationsHeader: {
    badge: "适合场景",
    title: "这页最适合在这些场景里打开。",
  },
  operations: [
    {
      title: "对外介绍时先讲清楚全貌",
      body:
        "当你需要向合作方或客户介绍小馨宝 monitor 时，这一页能先把运行状态、成本和模型信息讲清楚。",
      detail: "适合项目介绍、阶段沟通和统一理解。",
    },
    {
      title: "合作沟通时快速对齐重点",
      body:
        "做合作沟通或阶段汇报时，这一页能先把最重要的数字和当前状态摆出来，减少来回解释成本。",
      detail: "适合合作交流、阶段汇报和重点说明。",
    },
    {
      title: "需要深入了解时也有继续查看的入口",
      body:
        "如果你需要进一步了解项目说明、信息来源或页面内容含义，也可以顺着这页继续往下看，不用重新找资料。",
      detail: "适合深入了解、后续沟通和合作前准备。",
    },
  ],
  footer: {
    title: "把项目最关键的监控信息先放到首页。",
    description:
      "无论你是第一次了解小馨宝 monitor，还是想快速确认当前情况，这一页都能先把最重要的信息交到你手里。",
    primaryCta: "打开仓库",
    secondaryCta: "回到指标区",
    copyright: "© 2026 Xiao X Bao Monitor. All rights reserved.",
    links: [
      { label: "更多信息", href: "#integration-guide" },
      { label: "项目说明", href: "#readme" },
      { label: "指标总览", href: "#metrics" },
    ],
  },
} as const;
