# Monitor API Reference

本文档定义当前监控服务对外暴露的全部 HTTP 接口，以及用于 provider 补全的本地 LiteLLM 模型配置文件格式。

对应服务入口：

- [cmd/monitor/main.go](/Users/liueic/Documents/Code/xiao-x-bao-montior/cmd/monitor/main.go)
- [internal/api/handlers.go](/Users/liueic/Documents/Code/xiao-x-bao-montior/internal/api/handlers.go)

## Overview

Base URL:

```text
http://<host>:<port>
```

默认端口：

```text
:8080
```

认证：

- 当前 monitor API 本身不要求调用方传 API Key。
- monitor API 不会在请求路径里直接调用上游 LiteLLM。
- 后台同步任务调用上游 LiteLLM 时，使用服务端环境变量 `LITELLM_API_KEY`。

响应格式：

- 成功响应：`application/json`
- 错误响应：

```json
{
  "error": "error message"
}
```

常见状态码：

- `200 OK`
- `201 Created`
- `204 No Content`
- `400 Bad Request`
- `404 Not Found`
- `501 Not Implemented`
- `502 Bad Gateway`

说明：

- `502` 主要出现在后台同步失败后，本服务返回缓存缺失或同步错误场景。
- `/api/v1/usage/logs` 在当前本地缓存模式下固定返回 `501 Not Implemented`。

## Common Data Structures

### SpendMetrics

```json
{
  "spend": 4.7781762,
  "prompt_tokens": 1478414,
  "completion_tokens": 88895,
  "cache_read_input_tokens": 0,
  "cache_creation_input_tokens": 0,
  "total_tokens": 1567309,
  "successful_requests": 219,
  "failed_requests": 68,
  "api_requests": 287
}
```

字段：

- `spend`: 当日或聚合花费
- `prompt_tokens`: 输入 token 数
- `completion_tokens`: 输出 token 数
- `cache_read_input_tokens`: cache read token 数
- `cache_creation_input_tokens`: cache creation token 数
- `total_tokens`: 总 token 数
- `successful_requests`: 成功请求数
- `failed_requests`: 失败请求数
- `api_requests`: 总请求数

### NamedMetric

用于模型、provider 等维度的聚合项。

```json
{
  "name": "openai/Pro/deepseek-ai/DeepSeek-V3.1-Terminus",
  "provider": "siliconflow",
  "metrics": {
    "spend": 2.270372,
    "prompt_tokens": 714557,
    "completion_tokens": 10916,
    "cache_read_input_tokens": 0,
    "cache_creation_input_tokens": 0,
    "total_tokens": 725473,
    "successful_requests": 53,
    "failed_requests": 0,
    "api_requests": 53
  },
  "metadata": {}
}
```

字段：

- `name`: 维度名，例如模型名或 provider 名
- `provider`: 仅模型项会补充该字段
- `metrics`: 该维度下的用量指标
- `metadata`: LiteLLM 原始 metadata，可能为空

### NamedKeyMetric

```json
{
  "name": "80057cd96ffe12460755534789af4a4e0cbd3dad3cfe43a456736983a7396215",
  "metrics": {
    "spend": 1.1012529999999998,
    "prompt_tokens": 523635,
    "completion_tokens": 28432,
    "cache_read_input_tokens": 0,
    "cache_creation_input_tokens": 0,
    "total_tokens": 552067,
    "successful_requests": 19,
    "failed_requests": 0,
    "api_requests": 19
  },
  "metadata": {
    "key_alias": "26-04-18",
    "team_id": null
  }
}
```

### UsageDay

```json
{
  "date": "2026-04-22",
  "metrics": {
    "spend": 1.1012529999999998,
    "prompt_tokens": 523635,
    "completion_tokens": 28432,
    "cache_read_input_tokens": 0,
    "cache_creation_input_tokens": 0,
    "total_tokens": 552067,
    "successful_requests": 19,
    "failed_requests": 2,
    "api_requests": 21
  },
  "models": [],
  "providers": [],
  "api_keys": []
}
```

### UsageOverview

`GET /api/v1/usage/daily` 的主响应结构。

```json
{
  "filters": {
    "start_date": "2026-04-15",
    "end_date": "2026-04-22",
    "timezone": -480
  },
  "summary": {},
  "days": [],
  "models": [],
  "providers": [],
  "api_keys": []
}
```

字段：

- `filters`: 本次查询实际生效的过滤条件
- `summary`: 整个区间的汇总指标
- `days`: 按天拆分后的结果
- `models`: 全区间按模型聚合
- `providers`: 全区间按 provider 聚合
- `api_keys`: 全区间按 API key 聚合

### Threshold

```json
{
  "id": 1,
  "name": "daily-openai-spend",
  "scope": "provider",
  "scope_value": "openai",
  "metric": "spend",
  "threshold_value": 100,
  "emails": ["ops@example.com"],
  "enabled": true,
  "created_at": "2026-04-22T11:00:00Z",
  "updated_at": "2026-04-22T11:00:00Z"
}
```

字段：

- `scope`: `global | model | provider | api_key`
- `metric`: `spend | api_requests | successful_requests | failed_requests | total_tokens | prompt_tokens | completion_tokens`

### AlertEvent

```json
{
  "id": 1,
  "threshold_id": 1,
  "alert_date": "2026-04-22",
  "metric_value": 123.45,
  "status": "sent",
  "recipients": ["ops@example.com"],
  "message": "subject or error text",
  "created_at": "2026-04-22T11:00:00Z"
}
```

### AlertCheckResult

```json
{
  "checked_date": "2026-04-22",
  "summary": {},
  "results": [
    {
      "threshold": {},
      "current_value": 123.45,
      "triggered": true,
      "notification_status": "sent",
      "error": ""
    }
  ]
}
```

`notification_status` 可能值：

- `disabled`
- `not_triggered`
- `sent`
- `already_sent`
- `failed`
- `error`

## Endpoints

### GET /healthz

用途：

- 健康检查

请求参数：

- 无

响应：

```json
{
  "status": "ok"
}
```

状态码：

- `200`

### GET /api/v1/usage/daily

用途：

- 获取日级用量概览
- 数据来源于本地 SQLite 缓存，不会在请求时回源 LiteLLM
- 返回总区间汇总、按天明细、按模型聚合、按 provider 聚合、按 API key 聚合
- 模型项会额外带 `provider`

查询参数：

- `start_date`: 可选，格式 `YYYY-MM-DD`
- `end_date`: 可选，格式 `YYYY-MM-DD`
- `user_id`: 当前不支持，本地缓存模式下传入会返回 `400`
- `api_key`: 可选
- `model`: 可选
- `timezone`: 可选，整数，遵循 JavaScript `Date.getTimezoneOffset()` 约定

默认行为：

- 如果 `start_date` 未传，默认取 `APP_TIMEZONE` 下的当天
- 如果 `end_date` 未传，默认等于 `start_date`
- 如果 `timezone` 未传，默认使用 `APP_TIMEZONE` 对应的 offset

请求示例：

```bash
curl "http://localhost:8080/api/v1/usage/daily?start_date=2026-04-15&end_date=2026-04-22"
```

响应示例：

```json
{
  "filters": {
    "start_date": "2026-04-15",
    "end_date": "2026-04-22",
    "timezone": -480
  },
  "summary": {
    "spend": 4.7781762,
    "prompt_tokens": 1478414,
    "completion_tokens": 88895,
    "cache_read_input_tokens": 0,
    "cache_creation_input_tokens": 0,
    "total_tokens": 1567309,
    "successful_requests": 219,
    "failed_requests": 68,
    "api_requests": 287
  },
  "days": [
    {
      "date": "2026-04-22",
      "metrics": {
        "spend": 1.1012529999999998,
        "prompt_tokens": 523635,
        "completion_tokens": 28432,
        "cache_read_input_tokens": 0,
        "cache_creation_input_tokens": 0,
        "total_tokens": 552067,
        "successful_requests": 19,
        "failed_requests": 2,
        "api_requests": 21
      },
      "models": [
        {
          "name": "openai/Pro/moonshotai/Kimi-K2.5",
          "provider": "siliconflow",
          "metrics": {
            "spend": 0.6305729999999999,
            "prompt_tokens": 463199,
            "completion_tokens": 13101,
            "cache_read_input_tokens": 0,
            "cache_creation_input_tokens": 0,
            "total_tokens": 476300,
            "successful_requests": 14,
            "failed_requests": 0,
            "api_requests": 14
          }
        }
      ]
    }
  ],
  "models": [],
  "providers": [],
  "api_keys": []
}
```

状态码：

- `200`
- `400`
  例如 `timezone` 非整数，或传入了当前不支持的 `user_id`

### GET /api/v1/usage/logs

用途：

- 当前本地缓存模式下不支持 spend logs
- 调用该接口固定返回 `501 Not Implemented`

查询参数：

- `api_key`
- `user_id`
- `request_id`
- `team_id`
- `min_spend`
- `max_spend`
- `start_date`
- `end_date`
- `page`
- `page_size`
- `status_filter`
- `model`
- `model_id`
- `key_alias`
- `end_user`
- `error_code`
- `error_message`

说明：

- `page` 默认 `1`
- `page_size` 默认 `50`
- 这些参数当前只保留在接口定义里，实际不会触发上游查询

请求示例：

```bash
curl "http://localhost:8080/api/v1/usage/logs?start_date=2026-04-15%2000:00:00&end_date=2026-04-22%2023:59:59&page=1&page_size=5"
```

响应示例：

```json
{
  "error": "spend logs are not supported in local cache mode"
}
```

状态码：

- `501`

### GET /api/v1/models

用途：

- 透传 LiteLLM `/model/info`

查询参数：

- `litellm_model_id`: 可选

请求示例：

```bash
curl "http://localhost:8080/api/v1/models"
```

响应说明：

- 返回本地缓存的 LiteLLM `/model/info` 快照
- 如果传了 `litellm_model_id`，服务会在本地快照中做过滤，不会回源 LiteLLM

状态码：

- `200`
- `404`

### GET /api/v1/providers

用途：

- 获取本地缓存的 LiteLLM provider 列表

请求参数：

- 无

请求示例：

```bash
curl "http://localhost:8080/api/v1/providers"
```

响应示例：

```json
[
  "openai",
  "anthropic",
  "bedrock"
]
```

状态码：

- `200`
- `404`

### GET /api/v1/thresholds

用途：

- 列出所有阈值配置

请求参数：

- 无

响应示例：

```json
[
  {
    "id": 1,
    "name": "daily-openai-spend",
    "scope": "provider",
    "scope_value": "openai",
    "metric": "spend",
    "threshold_value": 100,
    "emails": ["ops@example.com"],
    "enabled": true,
    "created_at": "2026-04-22T11:00:00Z",
    "updated_at": "2026-04-22T11:00:00Z"
  }
]
```

状态码：

- `200`

### POST /api/v1/thresholds

用途：

- 创建阈值

请求体：

```json
{
  "name": "daily-openai-spend",
  "scope": "provider",
  "scope_value": "openai",
  "metric": "spend",
  "threshold_value": 100,
  "emails": ["ops@example.com"],
  "enabled": true
}
```

字段要求：

- `name`: 必填
- `scope`: 必填
- `scope_value`: 当 `scope` 是 `model | provider | api_key` 时必填
- `metric`: 必填
- `threshold_value`: 必填，且必须 `>= 0`
- `emails`: 必填，至少 1 个
- `enabled`: 可选，不传时默认为 `false`

响应：

- 返回完整 `Threshold`

状态码：

- `201`
- `400`

### PUT /api/v1/thresholds/{id}

用途：

- 更新阈值

路径参数：

- `id`: 阈值 ID

请求体：

与 `POST /api/v1/thresholds` 相同

响应：

- 返回更新后的完整 `Threshold`

状态码：

- `200`
- `400`
- `404`

### DELETE /api/v1/thresholds/{id}

用途：

- 删除阈值

路径参数：

- `id`: 阈值 ID

响应：

- 无响应体

状态码：

- `204`
- `400`
- `404`

### POST /api/v1/alerts/check

用途：

- 立即执行一次阈值检查
- 超阈值时尝试发送邮件

查询参数：

- `date`: 可选，格式 `YYYY-MM-DD`

默认行为：

- 不传 `date` 时，使用 `APP_TIMEZONE` 下的当天

请求示例：

```bash
curl -X POST "http://localhost:8080/api/v1/alerts/check?date=2026-04-22"
```

响应示例：

```json
{
  "checked_date": "2026-04-22",
  "summary": {
    "spend": 123.45,
    "prompt_tokens": 10000,
    "completion_tokens": 2000,
    "cache_read_input_tokens": 0,
    "cache_creation_input_tokens": 0,
    "total_tokens": 12000,
    "successful_requests": 20,
    "failed_requests": 1,
    "api_requests": 21
  },
  "results": [
    {
      "threshold": {
        "id": 1,
        "name": "daily-openai-spend",
        "scope": "provider",
        "scope_value": "openai",
        "metric": "spend",
        "threshold_value": 100,
        "emails": ["ops@example.com"],
        "enabled": true,
        "created_at": "2026-04-22T11:00:00Z",
        "updated_at": "2026-04-22T11:00:00Z"
      },
      "current_value": 123.45,
      "triggered": true,
      "notification_status": "sent"
    }
  ]
}
```

状态码：

- `200`
- `400`
- `502`

### GET /api/v1/alerts/history

用途：

- 查询告警发送历史

查询参数：

- `limit`: 可选，默认 `50`

请求示例：

```bash
curl "http://localhost:8080/api/v1/alerts/history?limit=20"
```

响应：

- 返回 `AlertEvent[]`

响应示例：

```json
[
  {
    "id": 1,
    "threshold_id": 1,
    "alert_date": "2026-04-22",
    "metric_value": 123.45,
    "status": "sent",
    "recipients": ["ops@example.com"],
    "message": "[LiteLLM Monitor] daily-openai-spend exceeded 100.00 on 2026-04-22",
    "created_at": "2026-04-22T11:00:00Z"
  }
]
```

状态码：

- `200`

## Provider Config File

当前服务通过 `PROVIDER_CONFIG_PATH` 指定的本地 LiteLLM 配置文件来补齐模型 `provider`。

默认路径：

```text
config/provider-config.yaml
```

示例：

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

provider 解析规则：

1. `mappings` 中的手工规则优先
2. 匹配 `model_list[].model_name`
3. 匹配 `model_list[].litellm_params.model`
4. 匹配 `model_list[].model_info.base_model`
5. 从 `provider` / `model_info.provider` / `litellm_params.custom_llm_provider` 推断
6. 再从 `litellm_params.api_base` 推断
7. 最后回退到 LiteLLM analytics 返回的 `metadata.provider`

说明：

- `mappings` 是可选覆盖层
- 当前示例配置 [config/provider-config.yaml](/Users/liueic/Documents/Code/xiao-x-bao-montior/config/provider-config.yaml) 已按你给的 SiliconFlow / LiteLLM 模型配置更新

## Current Route List

当前 monitor API 实际注册的路由：

- `GET /healthz`
- `GET /api/v1/usage/daily`
- `GET /api/v1/usage/logs`
- `GET /api/v1/models`
- `GET /api/v1/providers`
- `GET /api/v1/thresholds`
- `POST /api/v1/thresholds`
- `PUT /api/v1/thresholds/{id}`
- `DELETE /api/v1/thresholds/{id}`
- `POST /api/v1/alerts/check`
- `GET /api/v1/alerts/history`
