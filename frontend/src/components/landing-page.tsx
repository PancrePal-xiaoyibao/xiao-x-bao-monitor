import logoIcon from "@/assets/logo-icon.png";
import {
  ArrowUpRight,
  BarChart3,
  Clock3,
  Menu,
  Palette,
  Play,
  RefreshCw,
  Shield,
  TriangleAlert,
  X,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { BlurText } from "@/components/blur-text";
import { HlsVideo } from "@/components/hls-video";
import {
  MonitorOverviewAnimation,
  MonitorSignalsAnimation,
} from "@/components/monitor-animations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { parsedReadme } from "@/data/readme";
import { siteContent } from "@/data/site";
import { useMonitorSnapshot } from "@/hooks/use-monitor-snapshot";
import { formatDateTime, getHeroStatusState } from "@/lib/monitor-hero-state";

const iconMap = {
  zap: Zap,
  palette: Palette,
  chart: BarChart3,
  shield: Shield,
} as const;

function SectionBadge({ children }: { children: React.ReactNode }) {
  return <Badge>{children}</Badge>;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-4xl font-heading italic leading-[0.9] tracking-tight text-white md:text-5xl lg:text-6xl">
      {children}
    </h2>
  );
}

export function LandingPage() {
  const {
    snapshot,
    isLive,
    isLoading,
    isRefreshing,
    errorMessage,
    lastSuccessAt,
    targetSourceUrl,
    activeSourceUrl,
    hasUsableData,
    refresh,
  } = useMonitorSnapshot();
  const dataSources = buildDataSources(snapshot, isLive);

  return (
    <div className="bg-black text-white">
      <div className="relative z-10">
        <Navbar />
        <Hero
          snapshot={snapshot}
          isLive={isLive}
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          errorMessage={errorMessage}
          lastSuccessAt={lastSuccessAt}
          onRefresh={refresh}
          dataSources={dataSources}
          hasUsableData={hasUsableData}
        />
        <div className="bg-black">
          <StartSection />
          <FeaturesChess snapshot={snapshot} />
          <FeaturesGrid />
          <DemoGallerySection />
          <Stats
            tokenUsage={formatCompactNumber(snapshot.tokenUsage)}
            requestCount={snapshot.requestCount.toLocaleString("zh-CN")}
            rmbCost={formatCurrency(snapshot.rmbCost)}
            provider={snapshot.provider}
            activeModel={snapshot.activeModel}
          />
          <IntegrationGuideSection
            targetSourceUrl={targetSourceUrl}
            activeSourceUrl={activeSourceUrl}
            isLive={isLive}
            lastSuccessAt={lastSuccessAt}
          />
          <OperationsSection />
          <ReadmeDigestSection />
          <CtaFooter
            provider={snapshot.provider}
            activeModel={snapshot.activeModel}
            readmeSource={snapshot.readmeSource}
            updatedAt={snapshot.updatedAt}
          />
        </div>
      </div>
    </div>
  );
}

function SectionSilkBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 flex flex-col items-center justify-start overflow-hidden">
        {Array.from({ length: 3 }).map((_, index) => (
          <video
            key={index}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="h-auto w-auto max-w-none shrink-0"
          >
            <source src="/videos/mid-section-silk.mp4" type="video/mp4" />
          </video>
        ))}
      </div>
    </div>
  );
}

type SnapshotView = {
  tokenUsage: number;
  requestCount: number;
  rmbCost: number;
  activeModel: string;
  provider: string;
  readmeSource: string;
  updatedAt: string;
};

function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed left-0 right-0 top-4 z-50 px-4 py-3 md:px-8 lg:px-16">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <a href="#home" className="flex items-center gap-3">
          <img src={logoIcon} alt="Xiao X Bao Monitor" className="h-12 w-12 rounded-full" />
          <div className="hidden sm:block">
            <div className="text-sm font-body font-medium text-white">Xiao X Bao Monitor</div>
            <div className="text-xs font-body text-white/45">AI 调用监控首页</div>
          </div>
        </a>

        <nav className="liquid-glass hidden items-center rounded-full px-1.5 py-1 md:flex">
          {(siteContent.nav ?? []).map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-2 text-sm font-medium font-body text-foreground/90 transition hover:text-white"
            >
              {item.label}
            </a>
          ))}
          <a
            href="#metrics"
            className="ml-2 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm text-black"
          >
            查看指标
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </nav>

        <button
          type="button"
          onClick={() => setMobileOpen((value) => !value)}
          className="liquid-glass flex h-12 w-12 items-center justify-center rounded-full md:hidden"
          aria-label="打开导航"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen ? (
        <div className="mx-auto mt-4 max-w-7xl md:hidden">
          <div className="liquid-glass rounded-[28px] p-3">
            <div className="grid grid-cols-2 gap-2">
              {(siteContent.nav ?? []).map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-body text-white/80"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function Hero({
  snapshot,
  isLive,
  isLoading,
  isRefreshing,
  errorMessage,
  lastSuccessAt,
  onRefresh,
  dataSources,
  hasUsableData,
}: {
  snapshot: SnapshotView;
  isLive: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  errorMessage: string | null;
  lastSuccessAt: string | null;
  onRefresh: () => Promise<void>;
  dataSources: string[];
  hasUsableData: boolean;
}) {
  const heroStatus = getHeroStatusState({
    isLive,
    isLoading,
    errorMessage,
    hasUsableData,
    snapshotUpdatedAt: snapshot.updatedAt,
    lastSuccessAt,
    liveText: siteContent.hero.liveText,
    fallbackText: siteContent.hero.fallbackText,
  });

  return (
    <section
      id="home"
      className="relative overflow-visible"
      style={{ minHeight: 920 }}
    >
      <HeroLiquidBackground />

      <div className="relative z-10 mx-auto flex min-h-[920px] max-w-7xl flex-col px-4 pb-8 pt-[124px] sm:px-8 lg:px-16 lg:pt-[150px]">
        <div className="w-fit max-w-4xl rounded-[36px] border border-white/16 bg-black/62 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:p-7 lg:p-8">
          <div className="liquid-glass inline-flex w-fit items-center gap-3 rounded-full px-1 py-1 text-sm text-white">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-black">
              {siteContent.hero.badge}
            </span>
            <span className="pr-4 font-body">{siteContent.hero.badgeText}</span>
          </div>

          <div className="mt-8 max-w-4xl [text-shadow:0_12px_36px_rgba(0,0,0,0.62)]">
            <BlurText
              text="把 Tokens、请求量、"
              delay={0.1}
              className="text-5xl font-heading italic leading-[0.88] tracking-[-2px] text-white sm:text-6xl md:text-7xl lg:text-[5.1rem]"
            />
            <BlurText
              text="人民币成本和模型信息"
              delay={0.12}
              className="text-5xl font-heading italic leading-[0.88] tracking-[-2px] text-white sm:text-6xl md:text-7xl lg:text-[5.1rem]"
            />
            <BlurText
              text="放到同一个监控首页里。"
              delay={0.14}
              className="text-5xl font-heading italic leading-[0.88] tracking-[-2px] text-white sm:text-6xl md:text-7xl lg:text-[5.1rem]"
            />
          </div>

          <motion.p
            initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6, ease: "easeOut" }}
            className="mt-6 max-w-2xl text-sm font-body font-normal leading-7 text-white/92 [text-shadow:0_10px_28px_rgba(0,0,0,0.52)] md:text-base"
          >
            {siteContent.hero.description}
          </motion.p>

          <motion.div
            initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.6, ease: "easeOut" }}
            className="mt-8 flex flex-wrap items-center gap-4"
          >
            <a href="#metrics">
              <Button variant="glassStrong">
                {siteContent.hero.primaryCta}
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </a>
            <a href="#readme">
              <Button variant="ghost" className="px-0 text-white [text-shadow:0_8px_24px_rgba(0,0,0,0.38)]">
                <Play className="h-4 w-4 fill-white text-white" />
                {siteContent.hero.secondaryCta}
              </Button>
            </a>
          </motion.div>
        </div>

        <div className="mt-12 rounded-[28px] border border-white/16 bg-black/58 p-4 shadow-[0_20px_72px_rgba(0,0,0,0.42)] backdrop-blur-xl">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="px-3 py-1">
                {siteContent.hero.liveLabel} · {heroStatus.liveBadgeText}
              </Badge>
              <Badge className={heroStatus.freshnessText === "可能偏旧" ? "border border-amber-300/20 bg-amber-300/10 text-amber-100" : "px-3 py-1"}>
                信息状态 · {heroStatus.freshnessText}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void onRefresh()}
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-body text-white/78 transition hover:bg-white/[0.08]"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                {isRefreshing ? "更新中" : "立即更新"}
              </button>
              <div className="text-xs font-body text-white/62 [text-shadow:0_8px_24px_rgba(0,0,0,0.42)]">
                {siteContent.hero.refreshHint}
              </div>
            </div>
          </div>

          <div className="mb-4 grid gap-3 lg:grid-cols-3">
            <StatusChip
              icon={Clock3}
              label={heroStatus.snapshotUpdatedTitle}
              value={heroStatus.snapshotUpdatedLabel}
            />
            <StatusChip
              icon={RefreshCw}
              label="最近成功拉取"
              value={heroStatus.lastSuccessLabel}
            />
            <StatusChip
              icon={TriangleAlert}
              label="当前状态"
              value={heroStatus.statusText}
              tone={heroStatus.statusTone}
            />
          </div>

          {errorMessage ? (
            <div className="mb-4 rounded-[22px] border border-amber-300/20 bg-amber-300/10 p-4 text-sm font-body leading-6 text-amber-50">
              {errorMessage}
            </div>
          ) : null}

          {hasUsableData ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <Metric label="Token 用量" value={formatCompactNumber(snapshot.tokenUsage)} />
              <Metric label="请求次数" value={snapshot.requestCount.toLocaleString("zh-CN")} />
              <Metric label="价格（人民币）" value={formatCurrency(snapshot.rmbCost)} />
              <Metric label="当前模型" value={formatDisplayValue(snapshot.activeModel)} />
              <Metric label="Provider" value={formatDisplayValue(snapshot.provider)} />
            </div>
          ) : (
            <div className="rounded-[24px] border border-white/12 bg-black/34 p-5 text-sm font-body leading-7 text-white/72 backdrop-blur-md">
              {heroStatus.emptyStateText}
            </div>
          )}
        </div>

        <div className="mt-auto w-fit rounded-[28px] border border-white/14 bg-black/52 px-5 pb-4 pt-5 shadow-[0_18px_56px_rgba(0,0,0,0.38)] backdrop-blur-lg md:pt-6">
          <div className="liquid-glass inline-flex rounded-full px-3.5 py-1 text-xs font-medium font-body text-white">
            {siteContent.hero.sourcesLabel}
          </div>

          <div className="mt-6 flex flex-wrap gap-8 md:gap-12">
            {dataSources.map((partner) => (
              <span
                key={partner}
                className="text-xl font-heading italic text-white [text-shadow:0_10px_30px_rgba(0,0,0,0.58)] md:text-3xl"
              >
                {partner}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function StartSection() {
  return (
    <section id="integration" className="relative overflow-hidden px-4 py-20 sm:px-8 lg:px-16 lg:py-24">
      <div className="absolute inset-0">
        <HlsVideo src={siteContent.startVideo} poster={siteContent.heroPoster} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[200px] bg-gradient-to-b from-black to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[200px] bg-gradient-to-t from-black to-transparent" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[500px] max-w-5xl flex-col items-center justify-center px-2 text-center">
        <SectionBadge>{siteContent.howItWorks.badge}</SectionBadge>
        <SectionHeading>{siteContent.howItWorks.title}</SectionHeading>
        <p className="mt-5 max-w-2xl text-sm font-body font-light leading-7 text-white/60 md:text-base">
          {siteContent.howItWorks.description}
        </p>
        <a href="#integration-guide">
          <Button variant="glassStrong" className="mt-8 px-6 py-3">
            {siteContent.howItWorks.cta}
          </Button>
        </a>
      </div>
    </section>
  );
}

function FeaturesChess({ snapshot }: { snapshot: SnapshotView }) {
  return (
    <section id="capabilities" className="relative overflow-hidden bg-black">
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:px-16 lg:py-24">
      <div className="max-w-3xl">
        <SectionBadge>{siteContent.capabilitiesHeader.badge}</SectionBadge>
        <SectionHeading>{siteContent.capabilitiesHeader.title}</SectionHeading>
      </div>

      <div className="mt-16 space-y-20">
        {(siteContent.capabilityRows ?? []).map((feature, index) => (
          <div
            key={feature.title}
            className={`flex flex-col items-center gap-10 lg:gap-16 ${
              index % 2 === 1 ? "lg:flex-row-reverse" : "lg:flex-row"
            }`}
          >
            <div className="max-w-xl flex-1">
              <h3 className="text-3xl font-heading italic text-white md:text-4xl">
                {feature.title}
              </h3>
              <p className="mt-5 text-sm font-body font-light leading-7 text-white/60 md:text-base">
                {feature.body}
              </p>
              <a href={index === 0 ? "#metrics" : "#integration-guide"}>
                <Button variant="glassStrong" className="mt-8">
                  {feature.cta}
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </a>
            </div>

            <Card className="w-full flex-1 overflow-hidden rounded-2xl">
              <CardContent className="p-0">
                {index === 0 ? (
                  <MonitorOverviewAnimation snapshot={snapshot} />
                ) : (
                  <MonitorSignalsAnimation snapshot={snapshot} />
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
      </div>
    </section>
  );
}

function HeroLiquidBackground() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      <motion.video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster={siteContent.heroPoster}
        className="absolute inset-0 h-full w-full scale-[1.08] object-cover brightness-[0.58] contrast-[1.06] saturate-[0.78]"
        animate={{
          scale: [1.08, 1.11, 1.08],
          x: ["0%", "-0.7%", "0%"],
          y: ["0%", "0.7%", "0%"],
        }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      >
        <source src="/videos/hero-metal-loop.mp4" type="video/mp4" />
      </motion.video>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_76%,rgba(255,232,183,0.22),transparent_20%),radial-gradient(circle_at_18%_52%,rgba(255,192,92,0.08),transparent_18%),radial-gradient(circle_at_82%_52%,rgba(255,209,140,0.08),transparent_18%),linear-gradient(180deg,rgba(5,10,16,0.68)_0%,rgba(7,11,16,0.42)_44%,rgba(0,0,0,0.66)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,0.42)_100%)]" />
    </div>
  );
}

function FeaturesGrid() {
  return (
    <section className="relative overflow-hidden bg-black">
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:px-16 lg:py-24">
      <div className="max-w-3xl">
        <SectionBadge>{siteContent.whyUsHeader.badge}</SectionBadge>
        <SectionHeading>{siteContent.whyUsHeader.title}</SectionHeading>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {(siteContent.whyUs ?? []).map((item) => {
          const Icon = iconMap[item.icon];

          return (
            <Card key={item.title}>
              <CardContent>
                <div className="liquid-glass-strong flex h-10 w-10 items-center justify-center rounded-full">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <h3 className="mt-6 text-xl font-body font-medium text-white">{item.title}</h3>
                <p className="mt-4 text-sm font-body font-light leading-7 text-white/60">
                  {item.body}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      </div>
    </section>
  );
}

function DemoGallerySection() {
  return (
    <section className="relative overflow-hidden bg-black">
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:px-16 lg:py-24">
        <div className="max-w-3xl">
          <SectionBadge>{siteContent.demoSection.badge}</SectionBadge>
          <SectionHeading>{siteContent.demoSection.title}</SectionHeading>
          <p className="mt-5 text-sm font-body font-light leading-7 text-white/65 md:text-base">
            {siteContent.demoSection.description}
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {siteContent.demoSection.items.map((item) => (
            <Card key={item.title} className="overflow-hidden">
              <CardContent className="p-0">
                <img
                  src={item.src}
                  alt={item.title}
                  className="h-[300px] w-full object-cover object-top md:h-[360px]"
                  loading="lazy"
                />
                <div className="p-6">
                  <div className="text-xl font-body font-medium text-white">{item.title}</div>
                  <p className="mt-3 text-sm font-body font-light leading-7 text-white/65">
                    {item.body}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stats({
  tokenUsage,
  requestCount,
  rmbCost,
  provider,
  activeModel,
}: {
  tokenUsage: string;
  requestCount: string;
  rmbCost: string;
  provider: string;
  activeModel: string;
}) {
  const items = [
    { value: tokenUsage, label: "累计 Token 用量" },
    { value: requestCount, label: "累计请求次数" },
    { value: rmbCost, label: "估算价格（人民币）" },
    {
      value: `${formatDisplayValue(provider)} / ${formatDisplayValue(activeModel)}`,
      label: "当前 Provider / 模型",
    },
  ];

  return (
    <section id="metrics" className="relative overflow-hidden px-4 py-20 sm:px-8 lg:px-16 lg:py-24">
      <div className="absolute inset-0">
        <HlsVideo
          src={siteContent.statsVideo}
          poster={siteContent.heroPoster}
          desaturated
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[200px] bg-gradient-to-b from-black to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[200px] bg-gradient-to-t from-black to-transparent" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="mb-8 max-w-3xl">
          <SectionBadge>{siteContent.metricsHeader.badge}</SectionBadge>
          <SectionHeading>{siteContent.metricsHeader.title}</SectionHeading>
        </div>
        <div className="liquid-glass rounded-3xl p-8 md:p-12 lg:p-16">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {items.map((item) => (
              <div key={item.label}>
                <div className="break-words text-4xl font-heading italic text-white md:text-5xl lg:text-6xl">
                  {item.value}
                </div>
                <div className="mt-3 text-sm font-body font-light text-white/60">
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function OperationsSection() {
  return (
    <section className="relative overflow-hidden">
      <SectionSilkBackdrop />
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:px-16 lg:py-24">
      <div className="max-w-3xl">
        <SectionBadge>{siteContent.operationsHeader.badge}</SectionBadge>
        <SectionHeading>{siteContent.operationsHeader.title}</SectionHeading>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {(siteContent.operations ?? []).map((item) => (
          <Card key={item.title}>
            <CardContent className="p-8">
              <div className="text-xl font-body font-medium text-white">{item.title}</div>
              <p className="mt-4 text-sm font-body font-light leading-7 text-white/72">
                {item.body}
              </p>
              <div className="mt-8 text-xs font-body font-light text-white/48">{item.detail}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      </div>
    </section>
  );
}

function IntegrationGuideSection({
  targetSourceUrl,
  activeSourceUrl,
  isLive,
  lastSuccessAt,
}: {
  targetSourceUrl: string;
  activeSourceUrl: string;
  isLive: boolean;
  lastSuccessAt: string | null;
}) {
  return (
    <section id="integration-guide" className="relative overflow-hidden bg-black">
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:px-16 lg:py-24">
      <div className="max-w-3xl">
        <SectionBadge>{siteContent.integrationGuide.badge}</SectionBadge>
        <SectionHeading>{siteContent.integrationGuide.title}</SectionHeading>
        <p className="mt-5 text-sm font-body font-light leading-7 text-white/65 md:text-base">
          {siteContent.integrationGuide.description}
        </p>
      </div>

      <div className="mt-14 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="grid gap-5 border-b border-white/10 p-6 md:grid-cols-3">
              <Metric
                label={siteContent.integrationGuide.endpointLabel}
                value={siteContent.integrationGuide.endpointValue}
              />
              <Metric
                label={siteContent.integrationGuide.pollLabel}
                value={siteContent.integrationGuide.pollValue}
              />
              <Metric
                label={siteContent.integrationGuide.envVarLabel}
                value={siteContent.integrationGuide.envVarValue}
              />
            </div>

            <div className="border-b border-white/10 p-6">
              <div className="grid gap-3 md:grid-cols-3">
                <SourceInfoCard
                  label="优先来源"
                  value={targetSourceUrl}
                  description="页面会优先参考这里的内容。"
                />
                <SourceInfoCard
                  label="当前内容来源"
                  value={activeSourceUrl}
                  description={isLive ? "当前页面展示的是实时数据。" : "当前页面展示的是快照数据。"}
                />
                <SourceInfoCard
                  label="最近更新成功"
                  value={formatDateTime(lastSuccessAt)}
                  description="可以帮助你判断当前内容是不是刚刚更新过。"
                />
              </div>
            </div>

            <div className="p-6">
              <div className="text-sm font-body font-medium text-white">
                页面里会出现的主要信息
              </div>
              <div className="mt-5 space-y-3">
                {siteContent.monitorFields.map((field) => (
                  <div
                    key={field.key}
                    className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-sm font-body font-medium text-white">{field.label}</div>
                        <div className="mt-1 text-xs font-body text-white/45">
                          对应字段：<code>{field.key}</code>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {field.aliases.map((alias) => (
                          <Badge key={alias} className="text-[11px] text-white/80">
                            {alias}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-5">
            <div>
              <div className="text-sm font-body font-medium text-white">
                {siteContent.integrationGuide.exampleTitle}
              </div>
              <p className="mt-2 text-sm font-body font-light leading-6 text-white/60">
                如果你想知道这些内容大概会以什么样的形式出现，可以参考下面这份示意。
              </p>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-black/40 p-4">
              <pre className="overflow-x-auto text-xs leading-6 text-cyan-100">
                <code>{siteContent.exampleResponse}</code>
              </pre>
            </div>

            <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-body leading-6 text-emerald-50">
              当实时内容暂时不可用时，页面会自动展示快照内容，帮助你继续了解整体情况。
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </section>
  );
}

function ReadmeDigestSection() {
  const readmeUpdatedAt = new Date(__README_LAST_UPDATED__).toLocaleString("zh-CN");
  const readmeHighlights = parsedReadme.sections
    .filter((section) => section.paragraphs[0] || section.bullets[0] || section.codeBlocks[0])
    .slice(0, 4)
    .map((section) => ({
      title: section.title,
      summary:
        section.paragraphs[0] ??
        section.bullets[0] ??
        (section.codeBlocks[0] ? "这一节包含可直接复制使用的配置或命令示例。" : ""),
      meta: [
        section.paragraphs.length > 0 ? `${section.paragraphs.length} 段说明` : null,
        section.bullets.length > 0 ? `${section.bullets.length} 个要点` : null,
        section.codeBlocks.length > 0 ? `${section.codeBlocks.length} 段代码` : null,
      ].filter(Boolean) as string[],
    }));

  return (
    <section id="readme" className="relative overflow-hidden bg-black">
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:px-16 lg:py-24">
      <div className="max-w-3xl">
        <SectionBadge>{siteContent.readmeSection.badge}</SectionBadge>
        <SectionHeading>{siteContent.readmeSection.title}</SectionHeading>
        <p className="mt-5 text-sm font-body font-light leading-7 text-white/65 md:text-base">
          {siteContent.readmeSection.description}
        </p>
      </div>

      <div className="mt-14 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="solid">{parsedReadme.title}</Badge>
              <div className="text-xs font-body text-white/45">
                项目说明已同步展示
              </div>
            </div>
            <div className="mt-3 text-xs font-body text-white/45">
              最近更新：{readmeUpdatedAt}
            </div>

            <div className="mt-6 rounded-[24px] border border-white/10 bg-black/30 p-4">
              <div className="text-xs font-body uppercase tracking-[0.18em] text-white/42">
                说明目录
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {parsedReadme.sections.map((section, index) => (
                  <a
                    key={section.title}
                    href={`#readme-section-${index}`}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-body text-white/78 transition hover:bg-white/10 hover:text-white"
                  >
                    {section.title}
                  </a>
                ))}
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {parsedReadme.intro.map((paragraph) => (
                <p
                  key={paragraph}
                  className="text-sm font-body font-light leading-7 text-white/72"
                >
                  <InlineMarkdownText text={paragraph} />
                </p>
              ))}
            </div>

            <div className="mt-8 space-y-5">
              {parsedReadme.sections.map((section, index) => (
                <div
                  key={section.title}
                  id={`readme-section-${index}`}
                  className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5"
                >
                  <div className="text-lg font-body font-medium text-white">{section.title}</div>

                  {section.paragraphs.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {section.paragraphs.map((paragraph) => (
                        <p
                          key={paragraph}
                          className="text-sm font-body font-light leading-7 text-white/70"
                        >
                          <InlineMarkdownText text={paragraph} />
                        </p>
                      ))}
                    </div>
                  ) : null}

                  {section.bullets.length > 0 ? (
                    <ul className="mt-4 space-y-3">
                      {section.bullets.map((bullet) => (
                        <li
                          key={bullet}
                          className="flex gap-3 text-sm font-body font-light leading-7 text-white/70"
                        >
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-200" />
                          <span>
                            <InlineMarkdownText text={bullet} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {section.codeBlocks.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {section.codeBlocks.map((block) => (
                        <div
                          key={block}
                          className="rounded-[20px] border border-white/10 bg-black/40 p-4"
                        >
                          <pre className="overflow-x-auto text-xs leading-6 text-cyan-100">
                            <code>{block}</code>
                          </pre>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {section.tables.length > 0 ? (
                    <div className="mt-4 space-y-4">
                      {section.tables.map((table, tableIndex) => (
                        <div
                          key={`${section.title}-table-${tableIndex}`}
                          className="overflow-x-auto rounded-[20px] border border-white/10 bg-black/30"
                        >
                          <table className="min-w-full border-collapse text-left text-sm font-body text-white/75">
                            <thead>
                              <tr className="border-b border-white/10 bg-white/[0.03]">
                                {table.headers.map((header) => (
                                  <th key={header} className="px-4 py-3 font-medium text-white">
                                    <InlineMarkdownText text={header} />
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {table.rows.map((row, rowIndex) => (
                                <tr
                                  key={`${section.title}-row-${rowIndex}`}
                                  className="border-b border-white/5 last:border-b-0"
                                >
                                  {row.map((cell, cellIndex) => (
                                    <td key={`${cell}-${cellIndex}`} className="px-4 py-3 align-top">
                                      <InlineMarkdownText text={cell} />
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="md:col-span-2">
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-body uppercase tracking-[0.28em] text-white/42">
                    项目速览
                  </div>
                  <div className="mt-3 text-2xl font-heading italic text-white">
                    {parsedReadme.title}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>{parsedReadme.intro.length} 段开场说明</Badge>
                  <Badge>{parsedReadme.sections.length} 个部分</Badge>
                  <Badge>{readmeHighlights.length} 条重点</Badge>
                </div>
              </div>
              <p className="mt-5 max-w-xl text-sm font-body font-light leading-7 text-white/68">
                右侧这些卡片会先提炼出最值得优先阅读的要点，帮助你更快理解这个项目在做什么、怎么使用。
              </p>
            </CardContent>
          </Card>

          {readmeHighlights.map((item) => (
            <Card key={item.title}>
              <CardContent>
                <div className="text-xs font-body uppercase tracking-[0.26em] text-white/38">
                  说明摘要
                </div>
                <div className="mt-3 text-xl font-body font-medium text-white">{item.title}</div>
                <p className="mt-4 text-sm font-body font-light leading-7 text-white/68">
                  <InlineMarkdownText text={item.summary} />
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {item.meta.map((meta) => (
                    <Badge key={meta} className="text-[11px] text-white/82">
                      {meta}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      </div>
    </section>
  );
}

function InlineMarkdownText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={`${part}-${index}`} className="rounded bg-white/8 px-1.5 py-0.5 text-white">
              {part.slice(1, -1)}
            </code>
          );
        }

        const markdownLink = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (markdownLink) {
          const [, label, href] = markdownLink;
          return (
            <a
              key={`${part}-${index}`}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-cyan-200 underline decoration-white/20 underline-offset-4 hover:text-white"
            >
              {label}
            </a>
          );
        }

        return <span key={`${part}-${index}`}>{part}</span>;
      })}
    </>
  );
}

function CtaFooter({
  provider,
  activeModel,
  readmeSource,
  updatedAt,
}: {
  provider: string;
  activeModel: string;
  readmeSource: string;
  updatedAt: string;
}) {
  return (
    <section className="relative overflow-hidden px-4 py-20 sm:px-8 lg:px-16 lg:py-24">
      <div className="absolute inset-0">
        <HlsVideo src={siteContent.ctaVideo} poster={siteContent.heroPoster} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[200px] bg-gradient-to-b from-black to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[200px] bg-gradient-to-t from-black to-transparent" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl text-center">
        <h2 className="text-4xl font-heading italic leading-[0.9] text-white md:text-6xl lg:text-7xl">
          {siteContent.footer.title}
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-sm font-body font-light leading-7 text-white/70 md:text-base">
          {siteContent.footer.description}
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <a href="https://github.com/PancrePal-xiaoyibao/xiao-x-bao-monitor" target="_blank" rel="noreferrer">
            <Button variant="glassStrong" className="px-6 py-3">
              {siteContent.footer.primaryCta}
            </Button>
          </a>
          <a href="#metrics">
            <Button variant="solid" className="px-6 py-3">
              {siteContent.footer.secondaryCta}
            </Button>
          </a>
        </div>

        <div className="mt-12 rounded-[28px] border border-white/10 bg-black/30 p-6 text-left backdrop-blur-xl">
          <div className="grid gap-5 md:grid-cols-3">
            <Metric label="当前 Provider" value={formatDisplayValue(provider)} />
            <Metric label="当前模型" value={formatDisplayValue(activeModel)} />
            <Metric label="说明来源" value={formatDisplayValue(readmeSource)} />
          </div>
          <div className="mt-4 text-xs font-body text-white/45">
            最近同步时间：{formatDateTime(updatedAt)}
          </div>
        </div>

        <div className="mt-32 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-white/40 md:flex-row">
          <div>{siteContent.footer.copyright}</div>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {(siteContent.footer.links ?? []).map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-white/12 bg-black/34 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md">
      <div className="text-sm font-body text-white/72 [text-shadow:0_6px_18px_rgba(0,0,0,0.44)]">{label}</div>
      <div className="mt-3 break-words text-2xl font-heading italic text-white [text-shadow:0_10px_28px_rgba(0,0,0,0.56)]">{value}</div>
    </div>
  );
}

function StatusChip({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: typeof RefreshCw;
  label: string;
  value: string;
  tone?: "neutral" | "warning";
}) {
  return (
    <div
      className={`rounded-[22px] border p-4 backdrop-blur-md ${
        tone === "warning"
          ? "border-amber-300/20 bg-amber-300/10"
          : "border-white/12 bg-black/34"
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-body text-white/55">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-sm font-body text-white/88">{value}</div>
    </div>
  );
}

function SourceInfoCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-[22px] border border-cyan-300/15 bg-cyan-300/10 p-4 backdrop-blur-md">
      <div className="text-xs font-body uppercase tracking-[0.2em] text-cyan-100/70">
        {label}
      </div>
      <div className="mt-3 break-all text-sm font-body text-white">
        <code>{value}</code>
      </div>
      <div className="mt-2 text-xs font-body text-white/55">{description}</div>
    </div>
  );
}

function formatCompactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(1)}万`;
  return value.toLocaleString("zh-CN");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDisplayValue(value: string) {
  return value.trim() ? value : "未提供";
}

function buildDataSources(snapshot: SnapshotView, isLive: boolean) {
  return [
    isLive ? "实时接口" : "本地快照",
    snapshot.provider,
    snapshot.activeModel,
    snapshot.readmeSource,
  ].filter((value, index, array) => value && array.indexOf(value) === index);
}
