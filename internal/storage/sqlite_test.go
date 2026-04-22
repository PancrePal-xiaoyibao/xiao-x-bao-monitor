package storage

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	"github.com/liueic/xiao-x-bao-monitor/internal/model"
)

func TestSQLiteStoreThresholdCRUD(t *testing.T) {
	t.Parallel()

	store := newTestSQLiteStore(t)
	ctx := context.Background()

	created, err := store.CreateThreshold(ctx, model.Threshold{
		Name:           "daily-spend",
		Scope:          model.ThresholdScopeProvider,
		ScopeValue:     "openai",
		Metric:         model.ThresholdMetricSpend,
		ThresholdValue: 100,
		Emails:         []string{"ops@example.com"},
		Enabled:        true,
	})
	if err != nil {
		t.Fatalf("CreateThreshold returned error: %v", err)
	}
	if created.ID <= 0 {
		t.Fatalf("expected threshold id to be set, got %d", created.ID)
	}

	listed, err := store.ListThresholds(ctx)
	if err != nil {
		t.Fatalf("ListThresholds returned error: %v", err)
	}
	if len(listed) != 1 {
		t.Fatalf("expected 1 threshold, got %d", len(listed))
	}
	if listed[0].Name != "daily-spend" {
		t.Fatalf("unexpected threshold name: %s", listed[0].Name)
	}

	created.Name = "daily-openai-spend"
	created.ThresholdValue = 120
	updated, err := store.UpdateThreshold(ctx, created)
	if err != nil {
		t.Fatalf("UpdateThreshold returned error: %v", err)
	}
	if updated.Name != "daily-openai-spend" {
		t.Fatalf("unexpected updated name: %s", updated.Name)
	}

	fetched, err := store.GetThreshold(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetThreshold returned error: %v", err)
	}
	if fetched.ThresholdValue != 120 {
		t.Fatalf("expected threshold value 120, got %.2f", fetched.ThresholdValue)
	}

	if err := store.DeleteThreshold(ctx, created.ID); err != nil {
		t.Fatalf("DeleteThreshold returned error: %v", err)
	}
	if _, err := store.GetThreshold(ctx, created.ID); err == nil {
		t.Fatal("expected GetThreshold to fail after delete")
	} else if err != sql.ErrNoRows {
		t.Fatalf("expected sql.ErrNoRows after delete, got %v", err)
	}
}

func TestSQLiteStoreAlertEvents(t *testing.T) {
	t.Parallel()

	store := newTestSQLiteStore(t)
	ctx := context.Background()

	event, err := store.CreateAlertEvent(ctx, model.AlertEvent{
		ThresholdID: 1,
		AlertDate:   "2026-04-22",
		MetricValue: 12.5,
		Status:      "sent",
		Recipients:  []string{"ops@example.com"},
		Message:     "threshold exceeded",
	})
	if err != nil {
		t.Fatalf("CreateAlertEvent returned error: %v", err)
	}
	if event.ID <= 0 {
		t.Fatalf("expected alert event id to be set, got %d", event.ID)
	}

	sent, err := store.HasSentAlertForDate(ctx, 1, "2026-04-22")
	if err != nil {
		t.Fatalf("HasSentAlertForDate returned error: %v", err)
	}
	if !sent {
		t.Fatal("expected sent alert event to be found")
	}

	events, err := store.ListAlertEvents(ctx, 10)
	if err != nil {
		t.Fatalf("ListAlertEvents returned error: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected 1 alert event, got %d", len(events))
	}
	if events[0].Recipients[0] != "ops@example.com" {
		t.Fatalf("unexpected recipients: %#v", events[0].Recipients)
	}
}

func TestSQLiteStoreUsageAndCatalogCache(t *testing.T) {
	t.Parallel()

	store := newTestSQLiteStore(t)
	ctx := context.Background()
	syncedAt := time.Date(2026, 4, 22, 10, 0, 0, 0, time.UTC)

	err := store.UpsertDailySpendData(ctx, []model.DailySpendData{
		{
			Date: "2026-04-22",
			Metrics: model.SpendMetrics{
				Spend:       12.5,
				APIRequests: 10,
			},
			Breakdown: model.BreakdownMetrics{
				Models: map[string]model.MetricWithMetadata{
					"gpt-4o": {
						Metrics: model.SpendMetrics{
							Spend:       12.5,
							APIRequests: 10,
						},
					},
				},
			},
		},
	}, syncedAt)
	if err != nil {
		t.Fatalf("UpsertDailySpendData returned error: %v", err)
	}

	days, err := store.ListCachedDailySpendData(ctx, "2026-04-22", "2026-04-22")
	if err != nil {
		t.Fatalf("ListCachedDailySpendData returned error: %v", err)
	}
	if len(days) != 1 {
		t.Fatalf("expected 1 cached day, got %d", len(days))
	}
	if days[0].Data.Metrics.Spend != 12.5 {
		t.Fatalf("expected cached spend 12.5, got %.2f", days[0].Data.Metrics.Spend)
	}
	if !days[0].SyncedAt.Equal(syncedAt) {
		t.Fatalf("unexpected synced_at: %s", days[0].SyncedAt)
	}

	if err := store.SaveProviders(ctx, []string{"openai", "anthropic"}, syncedAt); err != nil {
		t.Fatalf("SaveProviders returned error: %v", err)
	}
	providers, err := store.GetProviders(ctx)
	if err != nil {
		t.Fatalf("GetProviders returned error: %v", err)
	}
	if len(providers.Providers) != 2 || providers.Providers[0] != "openai" {
		t.Fatalf("unexpected cached providers: %#v", providers.Providers)
	}

	catalogPayload := map[string]any{
		"data": []any{
			map[string]any{
				"model_name": "gpt-4o",
			},
		},
	}
	if err := store.SaveModelCatalog(ctx, catalogPayload, syncedAt); err != nil {
		t.Fatalf("SaveModelCatalog returned error: %v", err)
	}
	catalog, err := store.GetModelCatalog(ctx)
	if err != nil {
		t.Fatalf("GetModelCatalog returned error: %v", err)
	}
	data, ok := catalog.Payload["data"].([]any)
	if !ok || len(data) != 1 {
		t.Fatalf("unexpected cached model catalog: %#v", catalog.Payload)
	}
}

func newTestSQLiteStore(t *testing.T) *SQLiteStore {
	t.Helper()

	dbPath := filepath.Join(t.TempDir(), "monitor.db")
	store, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("NewSQLiteStore returned error: %v", err)
	}
	t.Cleanup(func() {
		_ = store.Close()
	})

	if err := store.Init(context.Background()); err != nil {
		t.Fatalf("Init returned error: %v", err)
	}
	return store
}
