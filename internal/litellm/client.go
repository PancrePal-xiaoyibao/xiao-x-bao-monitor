package litellm

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/liueic/xiao-x-bao-monitor/internal/config"
	"github.com/liueic/xiao-x-bao-monitor/internal/model"
)

type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

func NewClient(cfg config.LiteLLMConfig) *Client {
	return &Client{
		baseURL: strings.TrimRight(cfg.BaseURL, "/"),
		apiKey:  cfg.APIKey,
		httpClient: &http.Client{
			Timeout: cfg.Timeout,
		},
	}
}

func (c *Client) GetDailyActivityAggregated(ctx context.Context, query model.DailyActivityQuery) (model.SpendAnalyticsResponse, error) {
	params := url.Values{}
	setIfNotEmpty(params, "start_date", query.StartDate)
	setIfNotEmpty(params, "end_date", query.EndDate)
	setIfNotEmpty(params, "user_id", query.UserID)
	setIfNotEmpty(params, "api_key", query.APIKey)
	setIfNotEmpty(params, "model", query.Model)
	if query.Timezone != nil {
		params.Set("timezone", strconv.Itoa(*query.Timezone))
	}

	var response model.SpendAnalyticsResponse
	if err := c.getJSON(ctx, "/user/daily/activity/aggregated", params, &response); err != nil {
		return model.SpendAnalyticsResponse{}, err
	}
	return response, nil
}

func (c *Client) GetSpendLogs(ctx context.Context, query model.SpendLogsQuery) (map[string]any, error) {
	params := url.Values{}
	setIfNotEmpty(params, "api_key", query.APIKey)
	setIfNotEmpty(params, "user_id", query.UserID)
	setIfNotEmpty(params, "request_id", query.RequestID)
	setIfNotEmpty(params, "team_id", query.TeamID)
	setIfNotEmpty(params, "start_date", query.StartDate)
	setIfNotEmpty(params, "end_date", query.EndDate)
	setIfNotEmpty(params, "status_filter", query.StatusFilter)
	setIfNotEmpty(params, "model", query.Model)
	setIfNotEmpty(params, "model_id", query.ModelID)
	setIfNotEmpty(params, "key_alias", query.KeyAlias)
	setIfNotEmpty(params, "end_user", query.EndUser)
	setIfNotEmpty(params, "error_code", query.ErrorCode)
	setIfNotEmpty(params, "error_message", query.ErrorMessage)
	if query.MinSpend != nil {
		params.Set("min_spend", strconv.FormatFloat(*query.MinSpend, 'f', -1, 64))
	}
	if query.MaxSpend != nil {
		params.Set("max_spend", strconv.FormatFloat(*query.MaxSpend, 'f', -1, 64))
	}
	page := query.Page
	if page <= 0 {
		page = 1
	}
	pageSize := query.PageSize
	if pageSize <= 0 {
		pageSize = 50
	}
	params.Set("page", strconv.Itoa(page))
	params.Set("page_size", strconv.Itoa(pageSize))

	var response map[string]any
	if err := c.getJSON(ctx, "/spend/logs/v2", params, &response); err != nil {
		return nil, err
	}
	return response, nil
}

func (c *Client) GetModelCatalog(ctx context.Context, litellmModelID string) (map[string]any, error) {
	params := url.Values{}
	setIfNotEmpty(params, "litellm_model_id", litellmModelID)

	var response map[string]any
	if err := c.getJSON(ctx, "/model/info", params, &response); err != nil {
		return nil, err
	}
	return response, nil
}

func (c *Client) GetSupportedProviders(ctx context.Context) ([]string, error) {
	var response []string
	if err := c.getJSON(ctx, "/public/providers", nil, &response); err != nil {
		return nil, err
	}
	return response, nil
}

func (c *Client) getJSON(ctx context.Context, path string, params url.Values, out any) error {
	endpoint := c.baseURL + path
	if encoded := params.Encode(); encoded != "" {
		endpoint += "?" + encoded
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	if c.apiKey != "" {
		req.Header.Set("x-litellm-api-key", c.apiKey)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("call LiteLLM %s: %w", path, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusBadRequest {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 8192))
		return fmt.Errorf("LiteLLM %s returned %d: %s", path, resp.StatusCode, strings.TrimSpace(string(body)))
	}

	decoder := json.NewDecoder(resp.Body)
	if err := decoder.Decode(out); err != nil {
		return fmt.Errorf("decode LiteLLM %s response: %w", path, err)
	}
	return nil
}

func setIfNotEmpty(values url.Values, key, value string) {
	if strings.TrimSpace(value) != "" {
		values.Set(key, value)
	}
}
