package service

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/liueic/xiao-x-bao-monitor/internal/model"
	"github.com/liueic/xiao-x-bao-monitor/internal/provider"
)

type fakeLiteLLMClient struct {
	dailyActivity model.SpendAnalyticsResponse
}

func (f *fakeLiteLLMClient) GetDailyActivityAggregated(ctx context.Context, query model.DailyActivityQuery) (model.SpendAnalyticsResponse, error) {
	return f.dailyActivity, nil
}

func (f *fakeLiteLLMClient) GetSpendLogs(ctx context.Context, query model.SpendLogsQuery) (map[string]any, error) {
	return map[string]any{"logs": []any{}}, nil
}

func (f *fakeLiteLLMClient) GetModelCatalog(ctx context.Context, litellmModelID string) (map[string]any, error) {
	return map[string]any{"data": []any{}}, nil
}

func (f *fakeLiteLLMClient) GetSupportedProviders(ctx context.Context) ([]string, error) {
	return []string{"openai", "anthropic"}, nil
}

type fakeStore struct {
	thresholds []model.Threshold
	events     []model.AlertEvent
	cachedDays []model.CachedDailySpendData
	providers  model.CachedProviders
	catalog    model.CachedModelCatalog
}

func (f *fakeStore) ListThresholds(ctx context.Context) ([]model.Threshold, error) {
	return f.thresholds, nil
}

func (f *fakeStore) GetThreshold(ctx context.Context, id int64) (model.Threshold, error) {
	for _, threshold := range f.thresholds {
		if threshold.ID == id {
			return threshold, nil
		}
	}
	return model.Threshold{}, errors.New("not found")
}

func (f *fakeStore) CreateThreshold(ctx context.Context, threshold model.Threshold) (model.Threshold, error) {
	f.thresholds = append(f.thresholds, threshold)
	return threshold, nil
}

func (f *fakeStore) UpdateThreshold(ctx context.Context, threshold model.Threshold) (model.Threshold, error) {
	return threshold, nil
}

func (f *fakeStore) DeleteThreshold(ctx context.Context, id int64) error {
	return nil
}

func (f *fakeStore) HasSentAlertForDate(ctx context.Context, thresholdID int64, alertDate string) (bool, error) {
	for _, event := range f.events {
		if event.ThresholdID == thresholdID && event.AlertDate == alertDate && event.Status == "sent" {
			return true, nil
		}
	}
	return false, nil
}

func (f *fakeStore) CreateAlertEvent(ctx context.Context, event model.AlertEvent) (model.AlertEvent, error) {
	event.ID = int64(len(f.events) + 1)
	f.events = append(f.events, event)
	return event, nil
}

func (f *fakeStore) ListAlertEvents(ctx context.Context, limit int) ([]model.AlertEvent, error) {
	return f.events, nil
}

func (f *fakeStore) UpsertDailySpendData(ctx context.Context, days []model.DailySpendData, syncedAt time.Time) error {
	indexByDate := make(map[string]int, len(f.cachedDays))
	for i, item := range f.cachedDays {
		indexByDate[item.Date] = i
	}
	for _, day := range days {
		item := model.CachedDailySpendData{
			Date:     day.Date,
			Data:     day,
			SyncedAt: syncedAt,
		}
		if index, ok := indexByDate[day.Date]; ok {
			f.cachedDays[index] = item
			continue
		}
		f.cachedDays = append(f.cachedDays, item)
	}
	return nil
}

func (f *fakeStore) ListCachedDailySpendData(ctx context.Context, startDate, endDate string) ([]model.CachedDailySpendData, error) {
	items := make([]model.CachedDailySpendData, 0, len(f.cachedDays))
	for _, item := range f.cachedDays {
		if item.Date < startDate || item.Date > endDate {
			continue
		}
		items = append(items, item)
	}
	return items, nil
}

func (f *fakeStore) SaveProviders(ctx context.Context, providers []string, syncedAt time.Time) error {
	f.providers = model.CachedProviders{
		Providers: append([]string(nil), providers...),
		SyncedAt:  syncedAt,
	}
	return nil
}

func (f *fakeStore) GetProviders(ctx context.Context) (model.CachedProviders, error) {
	if len(f.providers.Providers) == 0 {
		return model.CachedProviders{}, sql.ErrNoRows
	}
	return f.providers, nil
}

func (f *fakeStore) SaveModelCatalog(ctx context.Context, payload map[string]any, syncedAt time.Time) error {
	f.catalog = model.CachedModelCatalog{
		Payload:  payload,
		SyncedAt: syncedAt,
	}
	return nil
}

func (f *fakeStore) GetModelCatalog(ctx context.Context) (model.CachedModelCatalog, error) {
	if len(f.catalog.Payload) == 0 {
		return model.CachedModelCatalog{}, sql.ErrNoRows
	}
	return f.catalog, nil
}

type fakeMailer struct {
	sent int
}

func (f *fakeMailer) Send(ctx context.Context, subject, body string, recipients []string) error {
	f.sent++
	return nil
}

func TestGetUsageOverviewAggregatesByModelProviderAndKey(t *testing.T) {
	store := &fakeStore{}
	service := NewMonitorService(
		&fakeLiteLLMClient{
			dailyActivity: model.SpendAnalyticsResponse{
				Results: []model.DailySpendData{
					{
						Date: "2026-04-22",
						Metrics: model.SpendMetrics{
							Spend:              12.5,
							APIRequests:        10,
							SuccessfulRequests: 9,
							FailedRequests:     1,
							TotalTokens:        2000,
						},
						Breakdown: model.BreakdownMetrics{
							Models: map[string]model.MetricWithMetadata{
								"gpt-4o":            {Metrics: model.SpendMetrics{Spend: 10, APIRequests: 7}},
								"claude-3-5-sonnet": {Metrics: model.SpendMetrics{Spend: 2.5, APIRequests: 3}},
							},
							Providers: map[string]model.MetricWithMetadata{
								"openai":    {Metrics: model.SpendMetrics{Spend: 10, APIRequests: 7}},
								"anthropic": {Metrics: model.SpendMetrics{Spend: 2.5, APIRequests: 3}},
							},
							APIKeys: map[string]model.KeyMetricWithMetadata{
								"key-a": {Metrics: model.SpendMetrics{Spend: 12.5, APIRequests: 10}},
							},
						},
					},
					{
						Date: "2026-04-23",
						Metrics: model.SpendMetrics{
							Spend:       4,
							APIRequests: 2,
							TotalTokens: 500,
						},
						Breakdown: model.BreakdownMetrics{
							Models: map[string]model.MetricWithMetadata{
								"gpt-4o": {Metrics: model.SpendMetrics{Spend: 4, APIRequests: 2}},
							},
							Providers: map[string]model.MetricWithMetadata{
								"openai": {Metrics: model.SpendMetrics{Spend: 4, APIRequests: 2}},
							},
							APIKeys: map[string]model.KeyMetricWithMetadata{
								"key-a": {Metrics: model.SpendMetrics{Spend: 4, APIRequests: 2}},
							},
						},
					},
				},
			},
		},
		store,
		&fakeMailer{},
		time.FixedZone("UTC+8", 8*3600),
		newTestProviderResolver(t),
		30,
	)
	if _, err := service.SyncCache(context.Background(), time.Date(2026, 4, 23, 0, 0, 0, 0, time.FixedZone("UTC+8", 8*3600))); err != nil {
		t.Fatalf("SyncCache returned error: %v", err)
	}

	overview, err := service.GetUsageOverview(context.Background(), model.DailyActivityQuery{
		StartDate: "2026-04-22",
		EndDate:   "2026-04-23",
	})
	if err != nil {
		t.Fatalf("GetUsageOverview returned error: %v", err)
	}

	if overview.Summary.Spend != 16.5 {
		t.Fatalf("expected total spend 16.5, got %.2f", overview.Summary.Spend)
	}
	if len(overview.Models) != 2 {
		t.Fatalf("expected 2 model rollups, got %d", len(overview.Models))
	}
	if overview.Models[0].Name != "gpt-4o" {
		t.Fatalf("expected top model gpt-4o, got %s", overview.Models[0].Name)
	}
	if overview.Models[0].Provider != "openai" {
		t.Fatalf("expected top model provider openai, got %s", overview.Models[0].Provider)
	}
	if overview.Providers[0].Name != "openai" {
		t.Fatalf("expected top provider openai, got %s", overview.Providers[0].Name)
	}
	if overview.APIKeys[0].Metrics.APIRequests != 12 {
		t.Fatalf("expected API key request count 12, got %d", overview.APIKeys[0].Metrics.APIRequests)
	}
}

func TestCheckThresholdsSendsEmailOncePerDay(t *testing.T) {
	store := &fakeStore{
		thresholds: []model.Threshold{
			{
				ID:             1,
				Name:           "daily-spend",
				Scope:          model.ThresholdScopeGlobal,
				Metric:         model.ThresholdMetricSpend,
				ThresholdValue: 10,
				Emails:         []string{"ops@example.com"},
				Enabled:        true,
			},
		},
	}
	mailer := &fakeMailer{}
	service := NewMonitorService(
		&fakeLiteLLMClient{
			dailyActivity: model.SpendAnalyticsResponse{
				Results: []model.DailySpendData{
					{
						Date: "2026-04-22",
						Metrics: model.SpendMetrics{
							Spend:              12.5,
							APIRequests:        10,
							SuccessfulRequests: 9,
							FailedRequests:     1,
						},
					},
				},
			},
		},
		store,
		mailer,
		time.FixedZone("UTC+8", 8*3600),
		newTestProviderResolver(t),
		30,
	)
	if _, err := service.SyncCache(context.Background(), time.Date(2026, 4, 22, 0, 0, 0, 0, time.FixedZone("UTC+8", 8*3600))); err != nil {
		t.Fatalf("SyncCache returned error: %v", err)
	}

	first, err := service.CheckThresholds(context.Background(), time.Date(2026, 4, 22, 12, 0, 0, 0, time.FixedZone("UTC+8", 8*3600)))
	if err != nil {
		t.Fatalf("first CheckThresholds returned error: %v", err)
	}
	second, err := service.CheckThresholds(context.Background(), time.Date(2026, 4, 22, 13, 0, 0, 0, time.FixedZone("UTC+8", 8*3600)))
	if err != nil {
		t.Fatalf("second CheckThresholds returned error: %v", err)
	}

	if mailer.sent != 1 {
		t.Fatalf("expected exactly one email send, got %d", mailer.sent)
	}
	if first.Results[0].NotificationStatus != "sent" {
		t.Fatalf("expected first check status sent, got %s", first.Results[0].NotificationStatus)
	}
	if second.Results[0].NotificationStatus != "already_sent" {
		t.Fatalf("expected second check status already_sent, got %s", second.Results[0].NotificationStatus)
	}
}

func newTestProviderResolver(t *testing.T) *provider.Resolver {
	t.Helper()

	path := filepath.Join(t.TempDir(), "provider-config.yaml")
	if err := os.WriteFile(path, []byte(`
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: gpt-4o
      api_base: https://api.openai.com/v1
  - model_name: claude-3-5-sonnet
    litellm_params:
      model: claude-3-5-sonnet
      api_base: https://api.anthropic.com
  - model_name: sf-kimi-k2.5
    litellm_params:
      model: openai/Pro/moonshotai/Kimi-K2.5
      api_base: os.environ/SILICONFLOW_API_BASE
`), 0o644); err != nil {
		t.Fatalf("write provider config: %v", err)
	}
	return provider.NewResolver(path)
}
