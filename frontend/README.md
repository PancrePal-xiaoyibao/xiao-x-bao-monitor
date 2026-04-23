# Xiao X Bao Monitor

这是 `xiao-x-bao-monitor` 仓库里的中文单页前端，技术栈为 `React + Vite + Tailwind CSS + motion/react`。页面重点不是泛泛的营销文案，而是直接展示这个项目真正关心的内容：`Token 用量`、`请求次数`、`人民币价格`、`当前模型`、`Provider`，以及和 README 对齐的公开说明。

## 现在这版已经包含什么

- 深色高质感单页视觉
- 固定悬浮导航
- Hero 视频背景与 `BlurText` 动画
- 3 段 HLS 视频背景区域
- 中文项目化文案
- 首页监控卡片
- 加载态 / 错误态 / 手动刷新 / 本地快照回退
- 本地演示动图展示区
- README 说明区
- 移动端导航与窄屏排版优化
- shadcn 风格基础组件：
  `Button`、`Badge`、`Card`

## 监控数据来源

页面会优先请求后端提供的前端快照接口；如果本地联调时后端没启动，或者接口暂时失败，就回退到本地快照。

- 默认后端接口：
  `/api/v1/monitor/snapshot`
- 本地快照文件：
  [public/monitor-fallback.json](/Users/elina/Documents/New project/xiao-x-bao-monitor/frontend/public/monitor-fallback.json)
- 前端轮询逻辑：
  [src/hooks/use-monitor-snapshot.ts](/Users/elina/Documents/New project/xiao-x-bao-monitor/frontend/src/hooks/use-monitor-snapshot.ts)
- 轮询间隔：
  `15 秒`
- 首屏状态反馈：
  `加载中`、`最近成功拉取`、`手动刷新`、`错误提示`
- 首次进入页面：
  不再显示假数据占位，会先进入加载态，等真实接口或本地快照返回后再渲染指标
- 接入说明区：
  会显示当前实际数据源地址，方便联调时确认正在请求哪一个接口或快照

在这个仓库里，前端默认就是为 `GET /api/v1/monitor/snapshot` 这条接口准备的，不需要再直接依赖 `/api/v1/usage/daily` 的聚合结构。

另外，数字字段返回 `0` 时现在也会被正确识别，不会误判成“没有数据”。
如果接口没有返回 `updatedAt`，页面会明确显示“时间不可用”，不会伪装成刚刚更新。
如果接口缺少 `provider`、`activeModel` 或 `readmeSource`，页面会显示“未提供”，避免出现空白卡片。
页面判断“数据是否过期”时会优先使用接口返回的 `updatedAt`；如果没有，再退到最近成功拉取时间。

## 环境变量

复制 `.env.example`，默认值已经对齐到本仓库后端：

```bash
VITE_MONITOR_API_URL=/api/v1/monitor/snapshot
```

如果你要连别的环境，也可以改成完整地址，例如：

```bash
VITE_MONITOR_API_URL=https://your-monitor-api.example.com/api/v1/monitor/snapshot
```

## 资源说明

这些资源现在已经和页面实现对齐：

- Hero poster：
  `public/images/hero_bg.jpeg`
- Logo：
  `src/assets/logo-icon.png`
- 功能演示动图：
  `public/media/feature-1.gif`
  `public/media/feature-2.gif`
- 本地视频背景：
  `public/videos/hero-metal-loop.mp4`
  `public/videos/hero-metal.mp4`
  `public/videos/mid-section-silk.mp4`

其中演示动图已经接入页面的“界面演示”区；HLS 远程视频用于中段和尾部背景；Hero 现在默认使用处理过的循环版 `hero-metal-loop.mp4`，原始素材 `hero-metal.mp4` 仍保留在仓库里；本地 MP4 也用于丝绸背景区。

## 本地启动

```bash
npm install
npm run dev
```

默认会通过 Vite proxy 把 `/api/*` 转发到 `http://127.0.0.1:8080`，所以本地联调时可以直接先启动后端，再启动前端。

## 构建

```bash
npm run build
```

## 关键文件

- 页面主结构：
  [src/components/landing-page.tsx](/Users/elina/Documents/New project/xiao-x-bao-monitor/frontend/src/components/landing-page.tsx)
- 页面文案源：
  [src/data/site.ts](/Users/elina/Documents/New project/xiao-x-bao-monitor/frontend/src/data/site.ts)
- 监控接口适配：
  [src/hooks/use-monitor-snapshot.ts](/Users/elina/Documents/New project/xiao-x-bao-monitor/frontend/src/hooks/use-monitor-snapshot.ts)
- 全局样式：
  [src/index.css](/Users/elina/Documents/New project/xiao-x-bao-monitor/frontend/src/index.css)
- Vite 配置：
  [vite.config.ts](/Users/elina/Documents/New project/xiao-x-bao-monitor/frontend/vite.config.ts)
