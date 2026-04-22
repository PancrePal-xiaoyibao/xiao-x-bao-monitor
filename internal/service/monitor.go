package service

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/liueic/xiao-x-bao-monitor/internal/alert"
	"github.com/liueic/xiao-x-bao-monitor/internal/model"
)

type LiteLLMClient interface {
	GetDailyActivityAggregated(ctx context.Context, query model.DailyActivityQuery) (model.SpendAnalyticsResponse, error)
	GetSpendLogs(ctx context.Context, query model.SpendLogsQuery) (map[string]any, error)
	GetModelCatalog(ctx context.Context, litellmModelID string) (map[string]any, error)
	GetSupportedProviders(ctx context.Context) ([]string, error)
}

type MonitorStore interface {
	ListThresholds(ctx context.Context) ([]model.Threshold, error)
	GetThreshold(ctx context.Context, id int64) (model.Threshold, error)
	CreateThreshold(ctx context.Context, threshold model.Threshold) (model.Threshold, error)
	UpdateThreshold(ctx context.Context, threshold model.Threshold) (model.Threshold, error)
	DeleteThreshold(ctx context.Context, id int64) error
	HasSentAlertForDate(ctx context.Context, thresholdID int64, alertDate string) (bool, error)
	CreateAlertEvent(ctx context.Context, event model.AlertEvent) (model.AlertEvent, error)
	ListAlertEvents(ctx context.Context, limit int) ([]model.AlertEvent, error)
	UpsertDailySpendData(ctx context.Context, days []model.DailySpendData, syncedAt time.Time) error
	ListCachedDailySpendData(ctx context.Context, startDate, endDate string) ([]model.CachedDailySpendData, error)
	SaveProviders(ctx context.Context, providers []string, syncedAt time.Time) error
	GetProviders(ctx context.Context) (model.CachedProviders, error)
	SaveModelCatalog(ctx context.Context, payload map[string]any, syncedAt time.Time) error
	GetModelCatalog(ctx context.Context) (model.CachedModelCatalog, error)
}

type ModelProviderResolver interface {
	Resolve(modelName string, metadata map[string]any) string
}

type MonitorService struct {
	client           LiteLLMClient
	store            MonitorStore
	mailer           alert.Mailer
	location         *time.Location
	providerResolver ModelProviderResolver
	syncLookbackDays int
}

var (
	ErrSpendLogsNotSupported = errors.New("spend logs are not supported in local cache mode")
	ErrUserFilterUnsupported = errors.New("user_id filter is not supported in local cache mode")
)

func NewMonitorService(client LiteLLMClient, store MonitorStore, mailer alert.Mailer, location *time.Location, providerResolver ModelProviderResolver, syncLookbackDays int) *MonitorService {
	if syncLookbackDays <= 0 {
		syncLookbackDays = 30
	}
	return &MonitorService{
		client:           client,
		store:            store,
		mailer:           mailer,
		location:         location,
		providerResolver: providerResolver,
		syncLookbackDays: syncLookbackDays,
	}
}

func (s *MonitorService) GetUsageOverview(ctx context.Context, query model.DailyActivityQuery) (model.UsageOverview, error) {
	query = s.withDefaultPeriod(query)
	query = s.withDefaultDateRange(query)
	query = s.withDefaultTimezone(query)
	if strings.TrimSpace(query.UserID) != "" {
		return model.UsageOverview{}, ErrUserFilterUnsupported
	}

	cachedDays, err := s.store.ListCachedDailySpendData(ctx, query.StartDate, query.EndDate)
	if err != nil {
		return model.UsageOverview{}, err
	}

	overview := model.UsageOverview{
		Filters: query,
		Period:  query.Period,
	}

	modelTotals := make(map[string]model.NamedMetric)
	providerTotals := make(map[string]model.NamedMetric)
	apiKeyTotals := make(map[string]model.NamedKeyMetric)

	var usageDays []model.UsageDay
	for _, cachedDay := range cachedDays {
		usageDay, ok, err := s.buildUsageDay(query, cachedDay.Data)
		if err != nil {
			return model.UsageOverview{}, err
		}
		if !ok {
			continue
		}
		overview.Summary.Add(usageDay.Metrics)
		usageDays = append(usageDays, usageDay)
		mergeNamedMetricTotals(modelTotals, usageDay.Models)
		mergeNamedMetricTotals(providerTotals, usageDay.Providers)
		mergeNamedKeyMetricTotals(apiKeyTotals, usageDay.APIKeys)
	}

	if query.Period == "day" {
		overview.Days = usageDays
	} else {
		overview.Days = groupUsageDaysByPeriod(usageDays, query.Period)
	}

	overview.Models = sortNamedMetricsMap(modelTotals)
	overview.Providers = sortNamedMetricsMap(providerTotals)
	overview.APIKeys = sortNamedKeyMetricsMap(apiKeyTotals)
	return overview, nil
}

func (s *MonitorService) GetSpendLogs(ctx context.Context, query model.SpendLogsQuery) (map[string]any, error) {
	return nil, ErrSpendLogsNotSupported
}

func (s *MonitorService) GetModelCatalog(ctx context.Context, litellmModelID string) (map[string]any, error) {
	cached, err := s.store.GetModelCatalog(ctx)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(litellmModelID) == "" {
		return cached.Payload, nil
	}
	return filterModelCatalogPayload(cached.Payload, litellmModelID), nil
}

func (s *MonitorService) GetSupportedProviders(ctx context.Context) ([]string, error) {
	cached, err := s.store.GetProviders(ctx)
	if err != nil {
		return nil, err
	}
	return cached.Providers, nil
}

func (s *MonitorService) SyncCache(ctx context.Context, now time.Time) (model.SyncReport, error) {
	localNow := now
	if localNow.IsZero() {
		localNow = time.Now().In(s.location)
	} else {
		localNow = localNow.In(s.location)
	}

	syncedAt := localNow.UTC()
	startDate := localNow.AddDate(0, 0, -s.syncLookbackDays+1).Format("2006-01-02")
	endDate := localNow.Format("2006-01-02")
	timezone := jsTimezoneOffsetMinutes(localNow)

	report := model.SyncReport{
		SyncedAt: syncedAt,
	}
	var syncErrors []string

	usageResponse, err := s.client.GetDailyActivityAggregated(ctx, model.DailyActivityQuery{
		StartDate: startDate,
		EndDate:   endDate,
		Timezone:  &timezone,
	})
	if err != nil {
		syncErrors = append(syncErrors, fmt.Sprintf("sync usage: %v", err))
	} else if err := s.store.UpsertDailySpendData(ctx, usageResponse.Results, syncedAt); err != nil {
		syncErrors = append(syncErrors, fmt.Sprintf("save usage cache: %v", err))
	} else {
		report.UsageDaysSynced = len(usageResponse.Results)
	}

	providers, err := s.client.GetSupportedProviders(ctx)
	if err != nil {
		syncErrors = append(syncErrors, fmt.Sprintf("sync providers: %v", err))
	} else if err := s.store.SaveProviders(ctx, providers, syncedAt); err != nil {
		syncErrors = append(syncErrors, fmt.Sprintf("save providers cache: %v", err))
	} else {
		report.ProvidersSynced = len(providers)
	}

	modelCatalog, err := s.client.GetModelCatalog(ctx, "")
	if err != nil {
		syncErrors = append(syncErrors, fmt.Sprintf("sync model catalog: %v", err))
	} else if err := s.store.SaveModelCatalog(ctx, modelCatalog, syncedAt); err != nil {
		syncErrors = append(syncErrors, fmt.Sprintf("save model catalog cache: %v", err))
	} else {
		report.ModelCatalogItems = countModelCatalogItems(modelCatalog)
	}

	if len(syncErrors) > 0 {
		return report, errors.New(strings.Join(syncErrors, "; "))
	}
	return report, nil
}

func (s *MonitorService) ListThresholds(ctx context.Context) ([]model.Threshold, error) {
	return s.store.ListThresholds(ctx)
}

func (s *MonitorService) CreateThreshold(ctx context.Context, threshold model.Threshold) (model.Threshold, error) {
	threshold = sanitizeThreshold(threshold)
	if err := validateThreshold(threshold); err != nil {
		return model.Threshold{}, err
	}
	return s.store.CreateThreshold(ctx, threshold)
}

func (s *MonitorService) UpdateThreshold(ctx context.Context, threshold model.Threshold) (model.Threshold, error) {
	if threshold.ID <= 0 {
		return model.Threshold{}, errors.New("threshold id is required")
	}
	threshold = sanitizeThreshold(threshold)
	if err := validateThreshold(threshold); err != nil {
		return model.Threshold{}, err
	}
	return s.store.UpdateThreshold(ctx, threshold)
}

func (s *MonitorService) DeleteThreshold(ctx context.Context, id int64) error {
	return s.store.DeleteThreshold(ctx, id)
}

func (s *MonitorService) ListAlertEvents(ctx context.Context, limit int) ([]model.AlertEvent, error) {
	return s.store.ListAlertEvents(ctx, limit)
}

func (s *MonitorService) CheckThresholds(ctx context.Context, day time.Time) (model.AlertCheckResult, error) {
	localDay := day.In(s.location)
	alertDate := localDay.Format("2006-01-02")
	timezone := jsTimezoneOffsetMinutes(localDay)

	overview, err := s.GetUsageOverview(ctx, model.DailyActivityQuery{
		StartDate: alertDate,
		EndDate:   alertDate,
		Timezone:  &timezone,
	})
	if err != nil {
		return model.AlertCheckResult{}, err
	}

	var currentDay model.UsageDay
	for _, dayUsage := range overview.Days {
		if dayUsage.Date == alertDate {
			currentDay = dayUsage
			break
		}
	}

	result := model.AlertCheckResult{
		CheckedDate: alertDate,
		Summary:     currentDay.Metrics,
	}

	thresholds, err := s.store.ListThresholds(ctx)
	if err != nil {
		return model.AlertCheckResult{}, err
	}

	for _, threshold := range thresholds {
		evaluation := model.ThresholdEvaluation{
			Threshold: threshold,
		}

		if !threshold.Enabled {
			evaluation.NotificationStatus = "disabled"
			result.Results = append(result.Results, evaluation)
			continue
		}

		value, err := scopedMetricValue(currentDay, threshold)
		if err != nil {
			evaluation.NotificationStatus = "error"
			evaluation.Error = err.Error()
			result.Results = append(result.Results, evaluation)
			continue
		}

		evaluation.CurrentValue = value
		if value < threshold.ThresholdValue {
			evaluation.NotificationStatus = "not_triggered"
			result.Results = append(result.Results, evaluation)
			continue
		}

		evaluation.Triggered = true
		alreadySent, err := s.store.HasSentAlertForDate(ctx, threshold.ID, alertDate)
		if err != nil {
			evaluation.NotificationStatus = "error"
			evaluation.Error = err.Error()
			result.Results = append(result.Results, evaluation)
			continue
		}
		if alreadySent {
			evaluation.NotificationStatus = "already_sent"
			result.Results = append(result.Results, evaluation)
			continue
		}

		subject, body := buildAlertMessage(threshold, alertDate, value, currentDay.Metrics)
		sendErr := s.mailer.Send(ctx, subject, body, threshold.Emails)
		event := model.AlertEvent{
			ThresholdID: threshold.ID,
			AlertDate:   alertDate,
			MetricValue: value,
			Recipients:  threshold.Emails,
			CreatedAt:   time.Now().UTC(),
		}
		if sendErr != nil {
			event.Status = "failed"
			event.Message = sendErr.Error()
			evaluation.NotificationStatus = "failed"
			evaluation.Error = sendErr.Error()
		} else {
			event.Status = "sent"
			event.Message = subject
			evaluation.NotificationStatus = "sent"
		}
		if _, err := s.store.CreateAlertEvent(ctx, event); err != nil && sendErr == nil {
			evaluation.NotificationStatus = "failed"
			evaluation.Error = err.Error()
		}
		result.Results = append(result.Results, evaluation)
	}
	return result, nil
}

func (s *MonitorService) buildUsageDay(query model.DailyActivityQuery, day model.DailySpendData) (model.UsageDay, bool, error) {
	modelFilter := strings.TrimSpace(query.Model)
	apiKeyFilter := strings.TrimSpace(query.APIKey)

	switch {
	case modelFilter != "":
		return s.buildUsageDayForModel(day, modelFilter, apiKeyFilter)
	case apiKeyFilter != "":
		return s.buildUsageDayForAPIKey(day, apiKeyFilter)
	default:
		return model.UsageDay{
			Date:      day.Date,
			Metrics:   day.Metrics,
			Models:    s.normalizeMetricMap(day.Breakdown.Models, true),
			Providers: normalizeMetricMap(day.Breakdown.Providers),
			APIKeys:   normalizeKeyMetricMap(day.Breakdown.APIKeys),
		}, true, nil
	}
}

func (s *MonitorService) buildUsageDayForModel(day model.DailySpendData, modelName, apiKey string) (model.UsageDay, bool, error) {
	modelEntry, ok := day.Breakdown.Models[modelName]
	if !ok {
		return model.UsageDay{}, false, nil
	}

	usageDay := model.UsageDay{
		Date:   day.Date,
		Models: []model.NamedMetric{s.namedMetricFromValue(modelName, modelEntry, true)},
	}

	if apiKey != "" {
		apiKeyEntry, ok := modelEntry.APIKeyBreakdown[apiKey]
		if !ok {
			return model.UsageDay{}, false, nil
		}
		usageDay.Metrics = apiKeyEntry.Metrics
		usageDay.Models[0].Metrics = apiKeyEntry.Metrics
		usageDay.APIKeys = []model.NamedKeyMetric{{
			Name:     apiKey,
			Metrics:  apiKeyEntry.Metrics,
			Metadata: apiKeyEntry.Metadata,
		}}
	} else {
		usageDay.Metrics = modelEntry.Metrics
		usageDay.APIKeys = normalizeKeyMetricMap(modelEntry.APIKeyBreakdown)
	}

	if providerName := usageDay.Models[0].Provider; providerName != "" {
		usageDay.Providers = []model.NamedMetric{syntheticProviderMetric(providerName, usageDay.Metrics)}
	}
	return usageDay, true, nil
}

func (s *MonitorService) buildUsageDayForAPIKey(day model.DailySpendData, apiKey string) (model.UsageDay, bool, error) {
	apiKeyEntry, ok := day.Breakdown.APIKeys[apiKey]
	if !ok {
		return model.UsageDay{}, false, nil
	}

	usageDay := model.UsageDay{
		Date:    day.Date,
		Metrics: apiKeyEntry.Metrics,
		APIKeys: []model.NamedKeyMetric{{
			Name:     apiKey,
			Metrics:  apiKeyEntry.Metrics,
			Metadata: apiKeyEntry.Metadata,
		}},
	}

	providerTotals := make(map[string]model.NamedMetric)
	for name, value := range day.Breakdown.Models {
		modelAPIKeyEntry, ok := value.APIKeyBreakdown[apiKey]
		if !ok {
			continue
		}

		item := s.namedMetricFromValue(name, value, true)
		item.Metrics = modelAPIKeyEntry.Metrics
		usageDay.Models = append(usageDay.Models, item)

		if item.Provider != "" {
			current := providerTotals[item.Provider]
			current.Name = item.Provider
			current.Provider = item.Provider
			current.Metrics.Add(modelAPIKeyEntry.Metrics)
			providerTotals[item.Provider] = current
		}
	}

	if len(usageDay.Models) > 0 {
		slices.SortFunc(usageDay.Models, compareNamedMetrics)
	}
	usageDay.Providers = sortNamedMetricsMap(providerTotals)
	return usageDay, true, nil
}

func (s *MonitorService) namedMetricFromValue(name string, value model.MetricWithMetadata, includeProvider bool) model.NamedMetric {
	item := model.NamedMetric{
		Name:     name,
		Metrics:  value.Metrics,
		Metadata: value.Metadata,
	}
	if includeProvider && s.providerResolver != nil {
		item.Provider = s.providerResolver.Resolve(name, value.Metadata)
	}
	return item
}

func syntheticProviderMetric(name string, metrics model.SpendMetrics) model.NamedMetric {
	return model.NamedMetric{
		Name:     name,
		Provider: name,
		Metrics:  metrics,
	}
}

func (s *MonitorService) withDefaultPeriod(query model.DailyActivityQuery) model.DailyActivityQuery {
	switch query.Period {
	case "day", "week", "month", "year":
	default:
		query.Period = "day"
	}
	return query
}

func (s *MonitorService) withDefaultDateRange(query model.DailyActivityQuery) model.DailyActivityQuery {
	if strings.TrimSpace(query.StartDate) != "" && strings.TrimSpace(query.EndDate) != "" {
		return query
	}

	now := time.Now().In(s.location)

	switch query.Period {
	case "week":
		if strings.TrimSpace(query.StartDate) == "" {
			offset := int(now.Weekday()) - 1
			if offset < 0 {
				offset = 6
			}
			monday := now.AddDate(0, 0, -offset)
			query.StartDate = monday.Format("2006-01-02")
		}
		if strings.TrimSpace(query.EndDate) == "" {
			start, _ := time.ParseInLocation("2006-01-02", query.StartDate, s.location)
			offset := int(start.Weekday()) - 1
			if offset < 0 {
				offset = 6
			}
			monday := start.AddDate(0, 0, -offset)
			query.EndDate = monday.AddDate(0, 0, 6).Format("2006-01-02")
		}
	case "month":
		if strings.TrimSpace(query.StartDate) == "" {
			query.StartDate = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, s.location).Format("2006-01-02")
		}
		if strings.TrimSpace(query.EndDate) == "" {
			start, _ := time.ParseInLocation("2006-01-02", query.StartDate, s.location)
			query.EndDate = time.Date(start.Year(), start.Month()+1, 0, 0, 0, 0, 0, s.location).Format("2006-01-02")
		}
	case "year":
		if strings.TrimSpace(query.StartDate) == "" {
			query.StartDate = fmt.Sprintf("%d-01-01", now.Year())
		}
		if strings.TrimSpace(query.EndDate) == "" {
			start, _ := time.ParseInLocation("2006-01-02", query.StartDate, s.location)
			query.EndDate = fmt.Sprintf("%d-12-31", start.Year())
		}
	default:
		today := now.Format("2006-01-02")
		if strings.TrimSpace(query.StartDate) == "" {
			query.StartDate = today
		}
		if strings.TrimSpace(query.EndDate) == "" {
			query.EndDate = query.StartDate
		}
	}
	return query
}

func (s *MonitorService) withDefaultTimezone(query model.DailyActivityQuery) model.DailyActivityQuery {
	if query.Timezone != nil {
		return query
	}
	offset := jsTimezoneOffsetMinutes(time.Now().In(s.location))
	query.Timezone = &offset
	return query
}

func validateThreshold(threshold model.Threshold) error {
	if threshold.Name == "" {
		return errors.New("validation: threshold name is required")
	}
	switch threshold.Scope {
	case model.ThresholdScopeGlobal:
	case model.ThresholdScopeModel, model.ThresholdScopeProvider, model.ThresholdScopeAPIKey:
		if threshold.ScopeValue == "" {
			return fmt.Errorf("validation: scope_value is required for scope %q", threshold.Scope)
		}
	default:
		return fmt.Errorf("validation: unsupported threshold scope %q", threshold.Scope)
	}

	switch threshold.Metric {
	case model.ThresholdMetricSpend,
		model.ThresholdMetricAPIRequests,
		model.ThresholdMetricSuccessfulRequests,
		model.ThresholdMetricFailedRequests,
		model.ThresholdMetricTotalTokens,
		model.ThresholdMetricPromptTokens,
		model.ThresholdMetricCompletionTokens:
	default:
		return fmt.Errorf("validation: unsupported threshold metric %q", threshold.Metric)
	}

	if threshold.ThresholdValue < 0 {
		return errors.New("validation: threshold_value must be >= 0")
	}
	if len(threshold.Emails) == 0 {
		return errors.New("validation: at least one email recipient is required")
	}
	for _, email := range threshold.Emails {
		if strings.TrimSpace(email) == "" {
			return errors.New("validation: email recipients must not be empty")
		}
	}
	return nil
}

func sanitizeThreshold(threshold model.Threshold) model.Threshold {
	threshold.Name = strings.TrimSpace(threshold.Name)
	threshold.ScopeValue = strings.TrimSpace(threshold.ScopeValue)
	for i, email := range threshold.Emails {
		threshold.Emails[i] = strings.TrimSpace(email)
	}
	if threshold.Scope == model.ThresholdScopeGlobal {
		threshold.ScopeValue = ""
	}
	return threshold
}

func scopedMetricValue(day model.UsageDay, threshold model.Threshold) (float64, error) {
	switch threshold.Scope {
	case model.ThresholdScopeGlobal:
		return day.Metrics.MetricValue(threshold.Metric)
	case model.ThresholdScopeModel:
		for _, item := range day.Models {
			if item.Name == threshold.ScopeValue {
				return item.Metrics.MetricValue(threshold.Metric)
			}
		}
		return 0, nil
	case model.ThresholdScopeProvider:
		for _, item := range day.Providers {
			if item.Name == threshold.ScopeValue {
				return item.Metrics.MetricValue(threshold.Metric)
			}
		}
		return 0, nil
	case model.ThresholdScopeAPIKey:
		for _, item := range day.APIKeys {
			if item.Name == threshold.ScopeValue {
				return item.Metrics.MetricValue(threshold.Metric)
			}
		}
		return 0, nil
	default:
		return 0, fmt.Errorf("unsupported threshold scope %q", threshold.Scope)
	}
}

func normalizeMetricMap(values map[string]model.MetricWithMetadata) []model.NamedMetric {
	if len(values) == 0 {
		return nil
	}
	items := make([]model.NamedMetric, 0, len(values))
	for name, value := range values {
		items = append(items, model.NamedMetric{
			Name:     name,
			Metrics:  value.Metrics,
			Metadata: value.Metadata,
		})
	}
	slices.SortFunc(items, compareNamedMetrics)
	return items
}

func (s *MonitorService) normalizeMetricMap(values map[string]model.MetricWithMetadata, includeProvider bool) []model.NamedMetric {
	if len(values) == 0 {
		return nil
	}
	items := make([]model.NamedMetric, 0, len(values))
	for name, value := range values {
		item := model.NamedMetric{
			Name:     name,
			Metrics:  value.Metrics,
			Metadata: value.Metadata,
		}
		if includeProvider && s.providerResolver != nil {
			item.Provider = s.providerResolver.Resolve(name, value.Metadata)
		}
		items = append(items, item)
	}
	slices.SortFunc(items, compareNamedMetrics)
	return items
}

func normalizeKeyMetricMap(values map[string]model.KeyMetricWithMetadata) []model.NamedKeyMetric {
	if len(values) == 0 {
		return nil
	}
	items := make([]model.NamedKeyMetric, 0, len(values))
	for name, value := range values {
		items = append(items, model.NamedKeyMetric{
			Name:     name,
			Metrics:  value.Metrics,
			Metadata: value.Metadata,
		})
	}
	slices.SortFunc(items, compareNamedKeyMetrics)
	return items
}

func mergeNamedMetricTotals(target map[string]model.NamedMetric, items []model.NamedMetric) {
	for _, item := range items {
		current := target[item.Name]
		current.Name = item.Name
		if current.Provider == "" {
			current.Provider = item.Provider
		}
		current.Metadata = item.Metadata
		current.Metrics.Add(item.Metrics)
		target[item.Name] = current
	}
}

func mergeNamedKeyMetricTotals(target map[string]model.NamedKeyMetric, items []model.NamedKeyMetric) {
	for _, item := range items {
		current := target[item.Name]
		current.Name = item.Name
		current.Metadata = item.Metadata
		current.Metrics.Add(item.Metrics)
		target[item.Name] = current
	}
}

func sortNamedMetricsMap(values map[string]model.NamedMetric) []model.NamedMetric {
	if len(values) == 0 {
		return nil
	}
	items := make([]model.NamedMetric, 0, len(values))
	for _, value := range values {
		items = append(items, value)
	}
	slices.SortFunc(items, compareNamedMetrics)
	return items
}

func sortNamedKeyMetricsMap(values map[string]model.NamedKeyMetric) []model.NamedKeyMetric {
	if len(values) == 0 {
		return nil
	}
	items := make([]model.NamedKeyMetric, 0, len(values))
	for _, value := range values {
		items = append(items, value)
	}
	slices.SortFunc(items, compareNamedKeyMetrics)
	return items
}

func compareNamedMetrics(left, right model.NamedMetric) int {
	if left.Metrics.Spend != right.Metrics.Spend {
		if left.Metrics.Spend > right.Metrics.Spend {
			return -1
		}
		return 1
	}
	if left.Metrics.APIRequests != right.Metrics.APIRequests {
		if left.Metrics.APIRequests > right.Metrics.APIRequests {
			return -1
		}
		return 1
	}
	return strings.Compare(left.Name, right.Name)
}

func compareNamedKeyMetrics(left, right model.NamedKeyMetric) int {
	if left.Metrics.Spend != right.Metrics.Spend {
		if left.Metrics.Spend > right.Metrics.Spend {
			return -1
		}
		return 1
	}
	if left.Metrics.APIRequests != right.Metrics.APIRequests {
		if left.Metrics.APIRequests > right.Metrics.APIRequests {
			return -1
		}
		return 1
	}
	return strings.Compare(left.Name, right.Name)
}

func jsTimezoneOffsetMinutes(t time.Time) int {
	_, offsetSeconds := t.Zone()
	return -offsetSeconds / 60
}

func countModelCatalogItems(payload map[string]any) int {
	data, ok := payload["data"].([]any)
	if !ok {
		return 0
	}
	return len(data)
}

func filterModelCatalogPayload(payload map[string]any, litellmModelID string) map[string]any {
	filtered := make(map[string]any, len(payload))
	for key, value := range payload {
		filtered[key] = value
	}

	data, ok := payload["data"].([]any)
	if !ok {
		return filtered
	}

	items := make([]any, 0, len(data))
	for _, item := range data {
		if modelCatalogItemMatches(item, litellmModelID) {
			items = append(items, item)
		}
	}
	filtered["data"] = items
	return filtered
}

func modelCatalogItemMatches(item any, litellmModelID string) bool {
	record, ok := item.(map[string]any)
	if !ok {
		return false
	}

	if stringValue(record["model_name"]) == litellmModelID {
		return true
	}

	litellmParams, ok := record["litellm_params"].(map[string]any)
	if !ok {
		return false
	}
	return stringValue(litellmParams["model"]) == litellmModelID
}

func stringValue(value any) string {
	text, _ := value.(string)
	return strings.TrimSpace(text)
}

func buildAlertMessage(threshold model.Threshold, alertDate string, value float64, summary model.SpendMetrics) (string, string) {
	scope := string(threshold.Scope)
	if threshold.ScopeValue != "" {
		scope += ":" + threshold.ScopeValue
	}
	subject := fmt.Sprintf("[LiteLLM Monitor] %s exceeded %.2f on %s", threshold.Name, threshold.ThresholdValue, alertDate)
	body := fmt.Sprintf(
		"LiteLLM threshold alert\n\nDate: %s\nThreshold: %s\nScope: %s\nMetric: %s\nCurrent Value: %.2f\nThreshold Value: %.2f\n\nDaily Summary\nSpend: %.4f\nAPI Requests: %d\nSuccessful Requests: %d\nFailed Requests: %d\nTotal Tokens: %d\nPrompt Tokens: %d\nCompletion Tokens: %d\n",
		alertDate,
		threshold.Name,
		scope,
		threshold.Metric,
		value,
		threshold.ThresholdValue,
		summary.Spend,
		summary.APIRequests,
		summary.SuccessfulRequests,
		summary.FailedRequests,
		summary.TotalTokens,
		summary.PromptTokens,
		summary.CompletionTokens,
	)
	return subject, body
}

func groupUsageDaysByPeriod(days []model.UsageDay, period string) []model.UsageDay {
	type periodGroup struct {
		key       string
		startDate string
		endDate   string
		metrics   model.SpendMetrics
		models    map[string]model.NamedMetric
		providers map[string]model.NamedMetric
		apiKeys   map[string]model.NamedKeyMetric
	}

	groups := make(map[string]*periodGroup)
	var order []string

	for _, day := range days {
		key, start, end := periodKeyForDate(day.Date, period)
		group, exists := groups[key]
		if !exists {
			group = &periodGroup{
				key:       key,
				startDate: start,
				endDate:   end,
				models:    make(map[string]model.NamedMetric),
				providers: make(map[string]model.NamedMetric),
				apiKeys:   make(map[string]model.NamedKeyMetric),
			}
			groups[key] = group
			order = append(order, key)
		}
		group.metrics.Add(day.Metrics)
		mergeNamedMetricTotals(group.models, day.Models)
		mergeNamedMetricTotals(group.providers, day.Providers)
		mergeNamedKeyMetricTotals(group.apiKeys, day.APIKeys)
	}

	result := make([]model.UsageDay, 0, len(order))
	for _, key := range order {
		group := groups[key]
		result = append(result, model.UsageDay{
			Date:      group.key,
			StartDate: group.startDate,
			EndDate:   group.endDate,
			Metrics:   group.metrics,
			Models:    sortNamedMetricsMap(group.models),
			Providers: sortNamedMetricsMap(group.providers),
			APIKeys:   sortNamedKeyMetricsMap(group.apiKeys),
		})
	}
	return result
}

func periodKeyForDate(dateStr string, period string) (key, startDate, endDate string) {
	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return dateStr, dateStr, dateStr
	}

	switch period {
	case "week":
		year, week := t.ISOWeek()
		key = fmt.Sprintf("%d-W%02d", year, week)
		offset := int(t.Weekday()) - 1
		if offset < 0 {
			offset = 6
		}
		monday := t.AddDate(0, 0, -offset)
		startDate = monday.Format("2006-01-02")
		endDate = monday.AddDate(0, 0, 6).Format("2006-01-02")
	case "month":
		key = t.Format("2006-01")
		startDate = time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, t.Location()).Format("2006-01-02")
		endDate = time.Date(t.Year(), t.Month()+1, 0, 0, 0, 0, 0, t.Location()).Format("2006-01-02")
	case "year":
		key = t.Format("2006")
		startDate = fmt.Sprintf("%d-01-01", t.Year())
		endDate = fmt.Sprintf("%d-12-31", t.Year())
	default:
		key = dateStr
		startDate = dateStr
		endDate = dateStr
	}
	return
}
