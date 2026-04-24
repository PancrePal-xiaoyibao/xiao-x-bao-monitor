# LiteLLM Monitor API

基于 LiteLLM 后端接口实现的 Go 监控服务，聚焦三件事：

- 每日 API 用量总览
- 支持按日、周、月、年粒度聚合展示
- 模型调用与 provider 分布
- 通过本地 LiteLLM `config.yaml` 给模型补 provider 信息
- 阈值超限后的邮件告警
- 后台每 10 分钟同步一次 LiteLLM 数据到本地 SQLite，API 只读本地缓存

LiteLLM 接口来源：`https://api.xiao-x-bao.com.cn/openapi.json`

这个仓库现在同时包含：

- Go 后端 API（仓库根目录）
- React 前端单页（`frontend/`）

## 设计思路

这版实现直接复用 LiteLLM 已有的分析接口，但不会在请求路径里直连 LiteLLM：

- `/user/daily/activity/aggregated`
  后台定时拉取按天聚合后的 spend、requests、tokens，并带 `models / providers / api_keys` breakdown。
  这是监控总览和阈值判断的主数据源。
- `config/provider-config.yaml`
  直接复用 LiteLLM 的 `model_list` 配置，monitor API 会从 `model_name`、`litellm_params.model`、`model_info.base_model` 推断并补齐 `provider`。
- `/model/info`
  后台定时拉取模型清单和 LiteLLM model metadata。
- `/public/providers`
  后台定时拉取 LiteLLM 支持的 provider 列表。

同步流程：

- 服务启动时先做一次立即同步
- 之后由调度器每 `10m` 同步一次
- 同步结果持久化到本地 SQLite
- 对外 API 只读本地缓存，不再直接请求 LiteLLM

## 功能

- `GET /api/v1/monitor/snapshot`
  返回给前端首页直接消费的扁平快照结构，字段包括：
  `tokenUsage`、`requestCount`、`rmbCost`、`activeModel`、`provider`、`readmeSource`、`updatedAt`。
  这个接口会基于本地 SQLite 缓存自动组装摘要结果，避免前端直接耦合 `/api/v1/usage/daily` 的聚合结构。
- `GET /api/v1/usage/daily`
  返回本地 SQLite 中缓存的统计结果，包含总览、按模型聚合、按 provider 聚合、按 API key 聚合。
  模型项会额外带 `provider` 字段。
  支持 `period` 参数控制聚合粒度：`day`（默认）、`week`、`month`、`year`。
  不同粒度下，`days` 数组中每个条目的 `date` 字段含义不同：
  - `day` → `2026-04-22`
  - `week` → `2026-W17`（ISO 周）
  - `month` → `2026-04`
  - `year` → `2026`

  非 `day` 粒度的条目还会带 `start_date` / `end_date` 标示该周期的起止日期。
  省略 `start_date` / `end_date` 时，默认范围根据 `period` 自动推算（当天 / 当周 / 当月 / 当年）。
- `GET /api/v1/usage/logs`
  当前在本地缓存模式下固定返回 `501 Not Implemented`。
- `GET /api/v1/models`
  返回本地缓存的 LiteLLM `/model/info` 快照。
- `GET /api/v1/providers`
  返回本地缓存的 LiteLLM `/public/providers` 快照。
- `GET /api/v1/thresholds`
- `POST /api/v1/thresholds`
- `PUT /api/v1/thresholds/{id}`
- `DELETE /api/v1/thresholds/{id}`
  管理本地阈值配置，持久化到 SQLite。
- `POST /api/v1/alerts/check`
  手动执行一次阈值检查并发送邮件。
- `GET /api/v1/alerts/history`
  查看告警发送历史。

## 阈值模型

阈值按“日维度”工作，支持以下 scope：

- `global`
- `model`
- `provider`
- `api_key`

支持以下 metric：

- `spend`
- `api_requests`
- `successful_requests`
- `failed_requests`
- `total_tokens`
- `prompt_tokens`
- `completion_tokens`

示例：

```json
{
  "name": "openai-daily-spend",
  "scope": "provider",
  "scope_value": "openai",
  "metric": "spend",
  "threshold_value": 100,
  "emails": ["ops@example.com", "finance@example.com"],
  "enabled": true
}
```

## 配置

复制 `.env.example` 后至少补这些变量：

```bash
PROVIDER_CONFIG_PATH=config/provider-config.yaml
LITELLM_BASE_URL=https://api.xiao-x-bao.com.cn
LITELLM_API_KEY=your-litellm-admin-key
SYNC_LOOKBACK_DAYS=30
SCHEDULER_INTERVAL=10m
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=your-user
SMTP_PASSWORD=your-password
SMTP_FROM=monitor@example.com
```

说明：

- 全局聚合场景依赖 LiteLLM admin 级别 API key，因为 `/user/daily/activity/aggregated` 的 OpenAPI 描述里说明 admin 可以不带 `user_id` 获取全局视图。
- `APP_TIMEZONE` 用于计算每天的告警日期。
- `PROVIDER_CONFIG_PATH` 指向本地 LiteLLM 模型配置文件，默认是 `config/provider-config.yaml`。
- `SYNC_LOOKBACK_DAYS` 控制每次同步回拉多少天的日级聚合数据，默认 `30`。
- `SCHEDULER_INTERVAL` 默认 `10m`。
- LiteLLM 的 `timezone` 参数遵循 JavaScript `Date.getTimezoneOffset()` 语义。
  `Asia/Shanghai` 对应 `-480`。

`config/provider-config.yaml` 采用 LiteLLM 的 `model_list` 结构，例如：

```yaml
model_list:
  - model_name: sf-kimi-k2.5
    litellm_params:
      model: openai/Pro/moonshotai/Kimi-K2.5
      api_base: os.environ/SILICONFLOW_API_BASE
  - model_name: sf-glm-4.7-pro
    litellm_params:
      model: openai/Pro/zai-org/GLM-4.7
      api_base: os.environ/SILICONFLOW_API_BASE
```

provider 推断优先级：

- 模型配置中的显式 `provider`
- `model_info.provider`
- `litellm_params.custom_llm_provider`
- `litellm_params.api_base` 中的 provider 线索
- 最后回退到 LiteLLM analytics 原始 `metadata.provider`

## 运行

```bash
go mod tidy
go run ./cmd/monitor
```

默认监听：`http://localhost:8080`

启动后会先做一次 LiteLLM -> SQLite 的初始化同步。

## 前端联调

前端项目位于 `frontend/`，默认会请求：

```bash
/api/v1/monitor/snapshot
```

本地联调步骤：

```bash
go run ./cmd/monitor
cd frontend
npm install
npm run dev
```

前端开发服务默认监听：`http://127.0.0.1:4173`

Vite 已经内置 `/api` 到 `http://127.0.0.1:8080` 的代理，所以前端和后端在本地可以直接联通。

## 示例

获取最近一天聚合：

```bash
curl "http://localhost:8080/api/v1/usage/daily?start_date=2026-04-22&end_date=2026-04-22"
```

获取前端首页快照：

```bash
curl "http://localhost:8080/api/v1/monitor/snapshot"
```

按周聚合（默认当前周）：

```bash
curl "http://localhost:8080/api/v1/usage/daily?period=week"
```

按月聚合（指定范围，返回多个月的分组）：

```bash
curl "http://localhost:8080/api/v1/usage/daily?period=month&start_date=2026-01-01&end_date=2026-04-22"
```

按年聚合（默认当年）：

```bash
curl "http://localhost:8080/api/v1/usage/daily?period=year"
```

创建阈值：

```bash
curl -X POST "http://localhost:8080/api/v1/thresholds" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "daily-total-spend",
    "scope": "global",
    "metric": "spend",
    "threshold_value": 50,
    "emails": ["ops@example.com"],
    "enabled": true
  }'
```

手动检查告警：

```bash
curl -X POST "http://localhost:8080/api/v1/alerts/check?date=2026-04-22"
```

## 测试

默认测试包含单元测试和本地集成测试：

```bash
go test ./...
```

当前已覆盖：

- `internal/litellm/client_test.go`
  校验 LiteLLM client 的 query/header 组装和错误处理。
- `internal/storage/sqlite_test.go`
  校验阈值、告警历史、usage/providers/models 缓存的 SQLite CRUD。
- `internal/service/monitor_test.go`
  校验本地缓存聚合、定时同步后的读路径，以及“同一天只发一次告警”逻辑。
- `integration/api_integration_test.go`
  起一个 fake LiteLLM 上游和本地 monitor API，先同步入库，再走真实 HTTP 链路验证 `/api/v1/providers`、`/api/v1/models`、`/api/v1/usage/daily`、`/api/v1/thresholds`、`/api/v1/alerts/check`，并确认这些接口不会再直接打上游。

如果你想直接打真实 LiteLLM 实例做 live integration test：

```bash
export LITELLM_LIVE_TEST=1
export LITELLM_BASE_URL=https://api.xiao-x-bao.com.cn
export LITELLM_API_KEY=your-litellm-admin-key
go test ./integration -run TestLive -v
```

## API Key 说明

有两个层次，不要混在一起：

- 访问你本地这层 monitor API
  当前实现**不要求**调用方再传 API Key。
- monitor API 去调用上游 LiteLLM
  只发生在后台同步任务里，对大多数分析接口**需要**在服务端配置 `LITELLM_API_KEY`，请求头名是 `x-litellm-api-key`。

按当前这个实例的实际行为：

- `/public/providers`
  可以匿名访问，但我们仍然会缓存到本地。
- `/user/daily/activity/aggregated`
  没有 API key 会返回 `401`，所以要同步真实用量必须配置可用 key。

所以现在的职责边界是：

- monitor API 对外只读本地 SQLite
- LiteLLM key 只用于后台同步
- 如果同步失败，API 读到的是旧缓存或空缓存，不会在请求时临时回源

## 后续建议

- 把阈值 scope 扩展到 `team / user / customer`
- 增加 webhook / 企业微信 / 飞书通知渠道
- 为缓存增加 `last_synced_at` 查询接口，方便前端展示数据新鲜度
