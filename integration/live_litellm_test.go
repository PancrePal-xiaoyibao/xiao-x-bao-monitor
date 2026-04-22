package integration_test

import (
	"context"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/liueic/xiao-x-bao-monitor/internal/config"
	"github.com/liueic/xiao-x-bao-monitor/internal/litellm"
	"github.com/liueic/xiao-x-bao-monitor/internal/model"
)

func TestLiveLiteLLMProvidersEndpoint(t *testing.T) {
	if os.Getenv("LITELLM_LIVE_TEST") != "1" {
		t.Skip("set LITELLM_LIVE_TEST=1 to run live LiteLLM tests")
	}

	baseURL := liveBaseURL()
	resp, err := http.Get(baseURL + "/public/providers")
	if err != nil {
		t.Fatalf("request /public/providers failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected /public/providers to return 200, got %d", resp.StatusCode)
	}
}

func TestLiveLiteLLMDailyActivityEndpoint(t *testing.T) {
	if os.Getenv("LITELLM_LIVE_TEST") != "1" {
		t.Skip("set LITELLM_LIVE_TEST=1 to run live LiteLLM tests")
	}

	apiKey := strings.TrimSpace(os.Getenv("LITELLM_API_KEY"))
	if apiKey == "" {
		t.Skip("set LITELLM_API_KEY to query protected LiteLLM analytics endpoints")
	}

	client := litellm.NewClient(config.LiteLLMConfig{
		BaseURL: liveBaseURL(),
		APIKey:  apiKey,
		Timeout: 30 * time.Second,
	})

	now := time.Now().UTC()
	startDate := now.AddDate(0, 0, -7).Format("2006-01-02")
	endDate := now.Format("2006-01-02")
	timezone := -480

	response, err := client.GetDailyActivityAggregated(context.Background(), model.DailyActivityQuery{
		StartDate: startDate,
		EndDate:   endDate,
		Timezone:  &timezone,
	})
	if err != nil {
		t.Fatalf("GetDailyActivityAggregated live call failed: %v", err)
	}
	if response.Results == nil {
		t.Fatal("expected non-nil results slice from live analytics endpoint")
	}
}

func liveBaseURL() string {
	baseURL := strings.TrimSpace(os.Getenv("LITELLM_BASE_URL"))
	if baseURL == "" {
		baseURL = "https://api.xiao-x-bao.com.cn"
	}
	return strings.TrimRight(baseURL, "/")
}
