package integration_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/liueic/xiao-x-bao-monitor/internal/api"
	"github.com/liueic/xiao-x-bao-monitor/internal/config"
	"github.com/liueic/xiao-x-bao-monitor/internal/litellm"
	"github.com/liueic/xiao-x-bao-monitor/internal/model"
	"github.com/liueic/xiao-x-bao-monitor/internal/provider"
	"github.com/liueic/xiao-x-bao-monitor/internal/service"
	"github.com/liueic/xiao-x-bao-monitor/internal/storage"
)

func TestMonitorAPIIntegration(t *testing.T) {
	t.Parallel()

	upstream := newFakeLiteLLMServer(t)
	defer upstream.server.Close()

	dbPath := filepath.Join(t.TempDir(), "monitor.db")
	store, err := storage.NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("NewSQLiteStore returned error: %v", err)
	}
	defer store.Close()

	if err := store.Init(context.Background()); err != nil {
		t.Fatalf("Init returned error: %v", err)
	}

	location := time.FixedZone("UTC+8", 8*3600)
	mailer := &recordingMailer{}
	providerConfigPath := filepath.Join(t.TempDir(), "provider-config.yaml")
	writeProviderConfigFile(t, providerConfigPath, `
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: gpt-4o
      api_base: https://api.openai.com/v1
  - model_name: claude-3-5-sonnet
    litellm_params:
      model: claude-3-5-sonnet
      api_base: https://api.anthropic.com
`)
	client := litellm.NewClient(config.LiteLLMConfig{
		BaseURL: upstream.server.URL,
		APIKey:  "integration-api-key",
		Timeout: 5 * time.Second,
	})
	monitorService := service.NewMonitorService(client, store, mailer, location, provider.NewResolver(providerConfigPath), 30, 10*time.Minute)
	if _, err := monitorService.SyncCache(context.Background(), time.Date(2026, 4, 22, 12, 0, 0, 0, location)); err != nil {
		t.Fatalf("SyncCache returned error: %v", err)
	}
	server := httptest.NewServer(api.NewHandler(monitorService, log.New(io.Discard, "", 0), location))
	defer server.Close()

	providersHits := upstream.count("/public/providers")
	usageHits := upstream.count("/user/daily/activity/aggregated")
	modelHits := upstream.count("/model/info")

	t.Run("providers endpoint returns cached data", func(t *testing.T) {
		response, status := mustJSONRequest[[]string](t, http.MethodGet, server.URL+"/api/v1/providers", nil)
		if status != http.StatusOK {
			t.Fatalf("expected status 200, got %d", status)
		}
		if len(response) != 2 || response[0] != "openai" {
			t.Fatalf("unexpected providers response: %#v", response)
		}
		if upstream.count("/public/providers") != providersHits {
			t.Fatal("providers endpoint should not call upstream after cache sync")
		}
	})

	t.Run("usage daily endpoint returns cached aggregated data", func(t *testing.T) {
		response, status := mustJSONRequest[model.UsageOverview](t, http.MethodGet, server.URL+"/api/v1/usage/daily?start_date=2026-04-22&end_date=2026-04-22", nil)
		if status != http.StatusOK {
			t.Fatalf("expected status 200, got %d", status)
		}
		if response.Summary.Spend != 12.5 {
			t.Fatalf("expected summary spend 12.5, got %.2f", response.Summary.Spend)
		}
		if len(response.Providers) != 2 {
			t.Fatalf("expected 2 providers, got %d", len(response.Providers))
		}
		if response.Models[0].Provider != "openai" {
			t.Fatalf("expected top model provider openai, got %s", response.Models[0].Provider)
		}
		if response.Days[0].Models[1].Provider != "anthropic" {
			t.Fatalf("expected second model provider anthropic, got %s", response.Days[0].Models[1].Provider)
		}
		if response.Providers[0].Name != "openai" {
			t.Fatalf("expected top provider openai, got %s", response.Providers[0].Name)
		}
		if upstream.count("/user/daily/activity/aggregated") != usageHits {
			t.Fatal("usage endpoint should not call upstream after cache sync")
		}
	})

	t.Run("spend logs endpoint is disabled in cache mode", func(t *testing.T) {
		response, status := mustJSONRequest[map[string]any](t, http.MethodGet, server.URL+"/api/v1/usage/logs?model=gpt-4o", nil)
		if status != http.StatusNotImplemented {
			t.Fatalf("expected status 501, got %d", status)
		}
		if !strings.Contains(response["error"].(string), "not supported") {
			t.Fatalf("unexpected spend logs response: %#v", response)
		}
	})

	t.Run("models endpoint returns cached data", func(t *testing.T) {
		response, status := mustJSONRequest[map[string]any](t, http.MethodGet, server.URL+"/api/v1/models?litellm_model_id=openai/gpt-4o", nil)
		if status != http.StatusOK {
			t.Fatalf("expected status 200, got %d", status)
		}
		data, ok := response["data"].([]any)
		if !ok || len(data) != 1 {
			t.Fatalf("unexpected models response: %#v", response)
		}
		if upstream.count("/model/info") != modelHits {
			t.Fatal("models endpoint should not call upstream after cache sync")
		}
	})

	t.Run("threshold and alert check work end to end", func(t *testing.T) {
		thresholdPayload := map[string]any{
			"name":            "daily-openai-spend",
			"scope":           "provider",
			"scope_value":     "openai",
			"metric":          "spend",
			"threshold_value": 10,
			"emails":          []string{"ops@example.com"},
			"enabled":         true,
		}
		created, status := mustJSONRequest[model.Threshold](t, http.MethodPost, server.URL+"/api/v1/thresholds", thresholdPayload)
		if status != http.StatusCreated {
			t.Fatalf("expected status 201, got %d", status)
		}
		if created.ID <= 0 {
			t.Fatalf("expected created threshold id, got %d", created.ID)
		}

		result, status := mustJSONRequest[model.AlertCheckResult](t, http.MethodPost, server.URL+"/api/v1/alerts/check?date=2026-04-22", nil)
		if status != http.StatusOK {
			t.Fatalf("expected status 200, got %d", status)
		}
		if len(result.Results) != 1 {
			t.Fatalf("expected 1 alert result, got %d", len(result.Results))
		}
		if result.Results[0].NotificationStatus != "sent" {
			t.Fatalf("expected alert status sent, got %s", result.Results[0].NotificationStatus)
		}
		if mailer.sent != 1 {
			t.Fatalf("expected one alert email send, got %d", mailer.sent)
		}
	})
}

type recordingMailer struct {
	sent int
}

func (m *recordingMailer) Send(ctx context.Context, subject, body string, recipients []string) error {
	m.sent++
	return nil
}

type fakeLiteLLMServer struct {
	server *httptest.Server
	mu     sync.Mutex
	hits   map[string]int
}

func (f *fakeLiteLLMServer) record(path string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.hits[path]++
}

func (f *fakeLiteLLMServer) count(path string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.hits[path]
}

func newFakeLiteLLMServer(t *testing.T) *fakeLiteLLMServer {
	t.Helper()

	fake := &fakeLiteLLMServer{
		hits: make(map[string]int),
	}
	fake.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fake.record(r.URL.Path)

		switch r.URL.Path {
		case "/public/providers":
			writeJSON(t, w, []string{"openai", "anthropic"})
		case "/user/daily/activity/aggregated":
			requireAPIKey(t, r)
			writeJSON(t, w, map[string]any{
				"results": []map[string]any{
					{
						"date": "2026-04-22",
						"metrics": map[string]any{
							"spend":               12.5,
							"api_requests":        10,
							"successful_requests": 9,
							"failed_requests":     1,
							"total_tokens":        2000,
						},
						"breakdown": map[string]any{
							"models": map[string]any{
								"gpt-4o": map[string]any{
									"metrics": map[string]any{
										"spend":        10,
										"api_requests": 7,
									},
									"metadata": map[string]any{
										"provider": "openai",
									},
								},
								"claude-3-5-sonnet": map[string]any{
									"metrics": map[string]any{
										"spend":        2.5,
										"api_requests": 3,
									},
									"metadata": map[string]any{
										"provider": "anthropic",
									},
								},
							},
							"providers": map[string]any{
								"openai": map[string]any{
									"metrics": map[string]any{
										"spend":        10,
										"api_requests": 7,
									},
								},
								"anthropic": map[string]any{
									"metrics": map[string]any{
										"spend":        2.5,
										"api_requests": 3,
									},
								},
							},
							"api_keys": map[string]any{
								"key-a": map[string]any{
									"metrics": map[string]any{
										"spend":        12.5,
										"api_requests": 10,
									},
									"metadata": map[string]any{
										"key_alias": "backend",
										"team_id":   "team-1",
									},
								},
							},
						},
					},
				},
				"metadata": map[string]any{
					"total_spend":        12.5,
					"total_api_requests": 10,
				},
			})
		case "/spend/logs/v2":
			requireAPIKey(t, r)
			if got := r.URL.Query().Get("model"); got != "gpt-4o" {
				t.Fatalf("expected spend logs model filter gpt-4o, got %q", got)
			}
			writeJSON(t, w, map[string]any{
				"logs": []map[string]any{
					{"request_id": "req-1", "model": "gpt-4o", "spend": 1.25},
				},
				"total":     1,
				"page":      1,
				"page_size": 50,
			})
		case "/model/info":
			requireAPIKey(t, r)
			writeJSON(t, w, map[string]any{
				"data": []map[string]any{
					{
						"model_name": "gpt-4o",
						"litellm_params": map[string]any{
							"model": "openai/gpt-4o",
						},
					},
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	return fake
}

func requireAPIKey(t *testing.T, r *http.Request) {
	t.Helper()

	if got := r.Header.Get("x-litellm-api-key"); got != "integration-api-key" {
		t.Fatalf("expected x-litellm-api-key=integration-api-key, got %q", got)
	}
}

func writeJSON(t *testing.T, w http.ResponseWriter, payload any) {
	t.Helper()

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		t.Fatalf("encode json response: %v", err)
	}
}

func mustJSONRequest[T any](t *testing.T, method, url string, payload any) (T, int) {
	t.Helper()

	var zero T
	var body io.Reader
	if payload != nil {
		raw, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("marshal request payload: %v", err)
		}
		body = bytes.NewReader(raw)
	}

	req, err := http.NewRequest(method, url, body)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("perform request: %v", err)
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read response body: %v", err)
	}
	if len(strings.TrimSpace(string(responseBody))) == 0 {
		return zero, resp.StatusCode
	}

	var decoded T
	if err := json.Unmarshal(responseBody, &decoded); err != nil {
		t.Fatalf("decode response body %q: %v", string(responseBody), err)
	}
	return decoded, resp.StatusCode
}

func writeProviderConfigFile(t *testing.T, path, contents string) {
	t.Helper()

	if err := os.WriteFile(path, []byte(contents), 0o644); err != nil {
		t.Fatalf("write provider config: %v", err)
	}
}
