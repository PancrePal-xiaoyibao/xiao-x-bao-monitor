package litellm

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/liueic/xiao-x-bao-monitor/internal/config"
	"github.com/liueic/xiao-x-bao-monitor/internal/model"
)

func TestGetDailyActivityAggregatedSendsAPIKeyAndQuery(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/user/daily/activity/aggregated" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if got := r.Header.Get("x-litellm-api-key"); got != "test-api-key" {
			t.Fatalf("expected x-litellm-api-key header, got %q", got)
		}
		if got := r.URL.Query().Get("start_date"); got != "2026-04-20" {
			t.Fatalf("unexpected start_date: %s", got)
		}
		if got := r.URL.Query().Get("end_date"); got != "2026-04-22" {
			t.Fatalf("unexpected end_date: %s", got)
		}
		if got := r.URL.Query().Get("user_id"); got != "user-123" {
			t.Fatalf("unexpected user_id: %s", got)
		}
		if got := r.URL.Query().Get("timezone"); got != "-480" {
			t.Fatalf("unexpected timezone: %s", got)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"results": [
				{
					"date": "2026-04-22",
					"metrics": {
						"spend": 12.5,
						"api_requests": 10
					}
				}
			],
			"metadata": {
				"total_spend": 12.5,
				"total_api_requests": 10
			}
		}`))
	}))
	defer server.Close()

	client := NewClient(config.LiteLLMConfig{
		BaseURL: server.URL,
		APIKey:  "test-api-key",
		Timeout: 5 * time.Second,
	})

	timezone := -480
	response, err := client.GetDailyActivityAggregated(context.Background(), model.DailyActivityQuery{
		StartDate: "2026-04-20",
		EndDate:   "2026-04-22",
		UserID:    "user-123",
		Timezone:  &timezone,
	})
	if err != nil {
		t.Fatalf("GetDailyActivityAggregated returned error: %v", err)
	}
	if len(response.Results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(response.Results))
	}
	if response.Results[0].Metrics.Spend != 12.5 {
		t.Fatalf("expected spend 12.5, got %.2f", response.Results[0].Metrics.Spend)
	}
}

func TestGetSpendLogsDefaultsPagination(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/spend/logs/v2" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if got := r.URL.Query().Get("page"); got != "1" {
			t.Fatalf("expected default page 1, got %s", got)
		}
		if got := r.URL.Query().Get("page_size"); got != "50" {
			t.Fatalf("expected default page_size 50, got %s", got)
		}
		if got := r.URL.Query().Get("model"); got != "gpt-4o" {
			t.Fatalf("unexpected model filter: %s", got)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"logs": [{"request_id": "req-1"}],
			"total": 1,
			"page": 1,
			"page_size": 50
		}`))
	}))
	defer server.Close()

	client := NewClient(config.LiteLLMConfig{
		BaseURL: server.URL,
		Timeout: 5 * time.Second,
	})

	response, err := client.GetSpendLogs(context.Background(), model.SpendLogsQuery{
		Model: "gpt-4o",
	})
	if err != nil {
		t.Fatalf("GetSpendLogs returned error: %v", err)
	}

	logs, ok := response["logs"].([]any)
	if !ok {
		t.Fatalf("expected logs slice in response, got %#v", response["logs"])
	}
	if len(logs) != 1 {
		t.Fatalf("expected 1 log, got %d", len(logs))
	}
}

func TestGetDailyActivityAggregatedReturnsUnauthorizedError(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
	}))
	defer server.Close()

	client := NewClient(config.LiteLLMConfig{
		BaseURL: server.URL,
		Timeout: 5 * time.Second,
	})

	_, err := client.GetDailyActivityAggregated(context.Background(), model.DailyActivityQuery{})
	if err == nil {
		t.Fatal("expected unauthorized error, got nil")
	}
}
