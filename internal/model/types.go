package model

import (
	"fmt"
	"time"
)

type DailyActivityQuery struct {
	StartDate string `json:"start_date,omitempty"`
	EndDate   string `json:"end_date,omitempty"`
	UserID    string `json:"user_id,omitempty"`
	APIKey    string `json:"api_key,omitempty"`
	Model     string `json:"model,omitempty"`
	Timezone  *int   `json:"timezone,omitempty"`
	Period    string `json:"period,omitempty"`
}

type SpendLogsQuery struct {
	APIKey       string   `json:"api_key,omitempty"`
	UserID       string   `json:"user_id,omitempty"`
	RequestID    string   `json:"request_id,omitempty"`
	TeamID       string   `json:"team_id,omitempty"`
	MinSpend     *float64 `json:"min_spend,omitempty"`
	MaxSpend     *float64 `json:"max_spend,omitempty"`
	StartDate    string   `json:"start_date,omitempty"`
	EndDate      string   `json:"end_date,omitempty"`
	Page         int      `json:"page,omitempty"`
	PageSize     int      `json:"page_size,omitempty"`
	StatusFilter string   `json:"status_filter,omitempty"`
	Model        string   `json:"model,omitempty"`
	ModelID      string   `json:"model_id,omitempty"`
	KeyAlias     string   `json:"key_alias,omitempty"`
	EndUser      string   `json:"end_user,omitempty"`
	ErrorCode    string   `json:"error_code,omitempty"`
	ErrorMessage string   `json:"error_message,omitempty"`
}

type SpendMetrics struct {
	Spend                    float64 `json:"spend"`
	PromptTokens             int64   `json:"prompt_tokens"`
	CompletionTokens         int64   `json:"completion_tokens"`
	CacheReadInputTokens     int64   `json:"cache_read_input_tokens"`
	CacheCreationInputTokens int64   `json:"cache_creation_input_tokens"`
	TotalTokens              int64   `json:"total_tokens"`
	SuccessfulRequests       int64   `json:"successful_requests"`
	FailedRequests           int64   `json:"failed_requests"`
	APIRequests              int64   `json:"api_requests"`
}

func (m *SpendMetrics) Add(other SpendMetrics) {
	m.Spend += other.Spend
	m.PromptTokens += other.PromptTokens
	m.CompletionTokens += other.CompletionTokens
	m.CacheReadInputTokens += other.CacheReadInputTokens
	m.CacheCreationInputTokens += other.CacheCreationInputTokens
	m.TotalTokens += other.TotalTokens
	m.SuccessfulRequests += other.SuccessfulRequests
	m.FailedRequests += other.FailedRequests
	m.APIRequests += other.APIRequests
}

func (m SpendMetrics) MetricValue(metric ThresholdMetric) (float64, error) {
	switch metric {
	case ThresholdMetricSpend:
		return m.Spend, nil
	case ThresholdMetricAPIRequests:
		return float64(m.APIRequests), nil
	case ThresholdMetricSuccessfulRequests:
		return float64(m.SuccessfulRequests), nil
	case ThresholdMetricFailedRequests:
		return float64(m.FailedRequests), nil
	case ThresholdMetricTotalTokens:
		return float64(m.TotalTokens), nil
	case ThresholdMetricPromptTokens:
		return float64(m.PromptTokens), nil
	case ThresholdMetricCompletionTokens:
		return float64(m.CompletionTokens), nil
	default:
		return 0, fmt.Errorf("unsupported threshold metric %q", metric)
	}
}

type KeyMetadata struct {
	KeyAlias string `json:"key_alias,omitempty"`
	TeamID   string `json:"team_id,omitempty"`
}

type KeyMetricWithMetadata struct {
	Metrics  SpendMetrics `json:"metrics"`
	Metadata KeyMetadata  `json:"metadata,omitempty"`
}

type MetricWithMetadata struct {
	Metrics         SpendMetrics                     `json:"metrics"`
	Metadata        map[string]any                   `json:"metadata,omitempty"`
	APIKeyBreakdown map[string]KeyMetricWithMetadata `json:"api_key_breakdown,omitempty"`
}

type BreakdownMetrics struct {
	MCPServers  map[string]MetricWithMetadata    `json:"mcp_servers,omitempty"`
	Models      map[string]MetricWithMetadata    `json:"models,omitempty"`
	ModelGroups map[string]MetricWithMetadata    `json:"model_groups,omitempty"`
	Providers   map[string]MetricWithMetadata    `json:"providers,omitempty"`
	Endpoints   map[string]MetricWithMetadata    `json:"endpoints,omitempty"`
	APIKeys     map[string]KeyMetricWithMetadata `json:"api_keys,omitempty"`
	Entities    map[string]MetricWithMetadata    `json:"entities,omitempty"`
}

type DailySpendData struct {
	Date      string           `json:"date"`
	Metrics   SpendMetrics     `json:"metrics"`
	Breakdown BreakdownMetrics `json:"breakdown,omitempty"`
}

type DailySpendMetadata struct {
	TotalSpend                    float64 `json:"total_spend"`
	TotalPromptTokens             int64   `json:"total_prompt_tokens"`
	TotalCompletionTokens         int64   `json:"total_completion_tokens"`
	TotalTokens                   int64   `json:"total_tokens"`
	TotalAPIRequests              int64   `json:"total_api_requests"`
	TotalSuccessfulRequests       int64   `json:"total_successful_requests"`
	TotalFailedRequests           int64   `json:"total_failed_requests"`
	TotalCacheReadInputTokens     int64   `json:"total_cache_read_input_tokens"`
	TotalCacheCreationInputTokens int64   `json:"total_cache_creation_input_tokens"`
	Page                          int     `json:"page"`
	TotalPages                    int     `json:"total_pages"`
	HasMore                       bool    `json:"has_more"`
}

type SpendAnalyticsResponse struct {
	Results  []DailySpendData   `json:"results"`
	Metadata DailySpendMetadata `json:"metadata"`
}

type NamedMetric struct {
	Name     string         `json:"name"`
	Provider string         `json:"provider,omitempty"`
	Metrics  SpendMetrics   `json:"metrics"`
	Metadata map[string]any `json:"metadata,omitempty"`
}

type NamedKeyMetric struct {
	Name     string       `json:"name"`
	Metrics  SpendMetrics `json:"metrics"`
	Metadata KeyMetadata  `json:"metadata,omitempty"`
}

type UsageDay struct {
	Date      string           `json:"date"`
	StartDate string           `json:"start_date,omitempty"`
	EndDate   string           `json:"end_date,omitempty"`
	Metrics   SpendMetrics     `json:"metrics"`
	Models    []NamedMetric    `json:"models,omitempty"`
	Providers []NamedMetric    `json:"providers,omitempty"`
	APIKeys   []NamedKeyMetric `json:"api_keys,omitempty"`
}

type UsageOverview struct {
	Filters   DailyActivityQuery `json:"filters"`
	Period    string             `json:"period"`
	Summary   SpendMetrics       `json:"summary"`
	Days      []UsageDay         `json:"days"`
	Models    []NamedMetric      `json:"models,omitempty"`
	Providers []NamedMetric      `json:"providers,omitempty"`
	APIKeys   []NamedKeyMetric   `json:"api_keys,omitempty"`
}

type MonitorSnapshot struct {
	TokenUsage   int64   `json:"tokenUsage"`
	RequestCount int64   `json:"requestCount"`
	RMBCost      float64 `json:"rmbCost"`
	ActiveModel  string  `json:"activeModel"`
	Provider     string  `json:"provider"`
	ReadmeSource string  `json:"readmeSource"`
	UpdatedAt    string  `json:"updatedAt"`
}

type CachedDailySpendData struct {
	Date     string         `json:"date"`
	Data     DailySpendData `json:"data"`
	SyncedAt time.Time      `json:"synced_at"`
}

type CachedProviders struct {
	Providers []string  `json:"providers"`
	SyncedAt  time.Time `json:"synced_at"`
}

type CachedModelCatalog struct {
	Payload  map[string]any `json:"payload"`
	SyncedAt time.Time      `json:"synced_at"`
}

type SyncReport struct {
	SyncedAt          time.Time `json:"synced_at"`
	UsageDaysSynced   int       `json:"usage_days_synced"`
	ProvidersSynced   int       `json:"providers_synced"`
	ModelCatalogItems int       `json:"model_catalog_items"`
}

type ThresholdScope string

const (
	ThresholdScopeGlobal   ThresholdScope = "global"
	ThresholdScopeModel    ThresholdScope = "model"
	ThresholdScopeProvider ThresholdScope = "provider"
	ThresholdScopeAPIKey   ThresholdScope = "api_key"
)

type ThresholdMetric string

const (
	ThresholdMetricSpend              ThresholdMetric = "spend"
	ThresholdMetricAPIRequests        ThresholdMetric = "api_requests"
	ThresholdMetricSuccessfulRequests ThresholdMetric = "successful_requests"
	ThresholdMetricFailedRequests     ThresholdMetric = "failed_requests"
	ThresholdMetricTotalTokens        ThresholdMetric = "total_tokens"
	ThresholdMetricPromptTokens       ThresholdMetric = "prompt_tokens"
	ThresholdMetricCompletionTokens   ThresholdMetric = "completion_tokens"
)

type Threshold struct {
	ID             int64           `json:"id"`
	Name           string          `json:"name"`
	Scope          ThresholdScope  `json:"scope"`
	ScopeValue     string          `json:"scope_value,omitempty"`
	Metric         ThresholdMetric `json:"metric"`
	ThresholdValue float64         `json:"threshold_value"`
	Emails         []string        `json:"emails"`
	Enabled        bool            `json:"enabled"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

type AlertEvent struct {
	ID          int64     `json:"id"`
	ThresholdID int64     `json:"threshold_id"`
	AlertDate   string    `json:"alert_date"`
	MetricValue float64   `json:"metric_value"`
	Status      string    `json:"status"`
	Recipients  []string  `json:"recipients"`
	Message     string    `json:"message,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

type ThresholdEvaluation struct {
	Threshold          Threshold `json:"threshold"`
	CurrentValue       float64   `json:"current_value"`
	Triggered          bool      `json:"triggered"`
	NotificationStatus string    `json:"notification_status"`
	Error              string    `json:"error,omitempty"`
}

type AlertCheckResult struct {
	CheckedDate string                `json:"checked_date"`
	Summary     SpendMetrics          `json:"summary"`
	Results     []ThresholdEvaluation `json:"results"`
}
