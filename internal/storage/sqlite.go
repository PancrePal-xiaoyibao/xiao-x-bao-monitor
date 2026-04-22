package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	_ "modernc.org/sqlite"

	"github.com/liueic/xiao-x-bao-monitor/internal/model"
)

type SQLiteStore struct {
	db *sql.DB
}

func NewSQLiteStore(path string) (*SQLiteStore, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	db.SetMaxOpenConns(1)
	return &SQLiteStore{db: db}, nil
}

func (s *SQLiteStore) Close() error {
	return s.db.Close()
}

func (s *SQLiteStore) Init(ctx context.Context) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS usage_daily_cache (
			usage_date TEXT PRIMARY KEY,
			payload_json TEXT NOT NULL,
			synced_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_usage_daily_cache_synced_at
			ON usage_daily_cache(synced_at DESC);`,
		`CREATE TABLE IF NOT EXISTS providers_cache (
			cache_key TEXT PRIMARY KEY,
			payload_json TEXT NOT NULL,
			synced_at TEXT NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS model_catalog_cache (
			cache_key TEXT PRIMARY KEY,
			payload_json TEXT NOT NULL,
			synced_at TEXT NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS thresholds (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			scope TEXT NOT NULL,
			scope_value TEXT NOT NULL DEFAULT '',
			metric TEXT NOT NULL,
			threshold_value REAL NOT NULL,
			emails TEXT NOT NULL,
			enabled INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS alert_events (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			threshold_id INTEGER NOT NULL,
			alert_date TEXT NOT NULL,
			metric_value REAL NOT NULL,
			status TEXT NOT NULL,
			recipients TEXT NOT NULL,
			message TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_alert_events_threshold_date_status
			ON alert_events(threshold_id, alert_date, status);`,
		`CREATE INDEX IF NOT EXISTS idx_alert_events_created_at
			ON alert_events(created_at DESC);`,
	}

	for _, statement := range statements {
		if _, err := s.db.ExecContext(ctx, statement); err != nil {
			return fmt.Errorf("init sqlite schema: %w", err)
		}
	}
	return nil
}

func (s *SQLiteStore) UpsertDailySpendData(ctx context.Context, days []model.DailySpendData, syncedAt time.Time) error {
	if len(days) == 0 {
		return nil
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin usage cache transaction: %w", err)
	}
	defer tx.Rollback()

	statement, err := tx.PrepareContext(ctx, `
		INSERT INTO usage_daily_cache (usage_date, payload_json, synced_at)
		VALUES (?, ?, ?)
		ON CONFLICT(usage_date) DO UPDATE SET
			payload_json = excluded.payload_json,
			synced_at = excluded.synced_at
	`)
	if err != nil {
		return fmt.Errorf("prepare usage cache upsert: %w", err)
	}
	defer statement.Close()

	for _, day := range days {
		payload, err := json.Marshal(day)
		if err != nil {
			return fmt.Errorf("marshal usage day %s: %w", day.Date, err)
		}
		if _, err := statement.ExecContext(ctx, day.Date, string(payload), syncedAt.Format(time.RFC3339Nano)); err != nil {
			return fmt.Errorf("upsert usage day %s: %w", day.Date, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit usage cache transaction: %w", err)
	}
	return nil
}

func (s *SQLiteStore) ListCachedDailySpendData(ctx context.Context, startDate, endDate string) ([]model.CachedDailySpendData, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT usage_date, payload_json, synced_at
		FROM usage_daily_cache
		WHERE usage_date >= ? AND usage_date <= ?
		ORDER BY usage_date ASC
	`, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("list usage cache: %w", err)
	}
	defer rows.Close()

	var items []model.CachedDailySpendData
	for rows.Next() {
		var (
			item     model.CachedDailySpendData
			payload  string
			syncedAt string
		)
		if err := rows.Scan(&item.Date, &payload, &syncedAt); err != nil {
			return nil, fmt.Errorf("scan usage cache: %w", err)
		}
		if err := json.Unmarshal([]byte(payload), &item.Data); err != nil {
			return nil, fmt.Errorf("unmarshal usage cache %s: %w", item.Date, err)
		}
		item.SyncedAt, err = time.Parse(time.RFC3339Nano, syncedAt)
		if err != nil {
			return nil, fmt.Errorf("parse usage cache synced_at: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate usage cache: %w", err)
	}
	return items, nil
}

func (s *SQLiteStore) SaveProviders(ctx context.Context, providers []string, syncedAt time.Time) error {
	payload, err := json.Marshal(providers)
	if err != nil {
		return fmt.Errorf("marshal providers cache: %w", err)
	}

	if _, err := s.db.ExecContext(ctx, `
		INSERT INTO providers_cache (cache_key, payload_json, synced_at)
		VALUES ('default', ?, ?)
		ON CONFLICT(cache_key) DO UPDATE SET
			payload_json = excluded.payload_json,
			synced_at = excluded.synced_at
	`, string(payload), syncedAt.Format(time.RFC3339Nano)); err != nil {
		return fmt.Errorf("save providers cache: %w", err)
	}
	return nil
}

func (s *SQLiteStore) GetProviders(ctx context.Context) (model.CachedProviders, error) {
	var (
		item     model.CachedProviders
		payload  string
		syncedAt string
	)

	err := s.db.QueryRowContext(ctx, `
		SELECT payload_json, synced_at
		FROM providers_cache
		WHERE cache_key = 'default'
	`).Scan(&payload, &syncedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return model.CachedProviders{}, sql.ErrNoRows
		}
		return model.CachedProviders{}, fmt.Errorf("get providers cache: %w", err)
	}

	if err := json.Unmarshal([]byte(payload), &item.Providers); err != nil {
		return model.CachedProviders{}, fmt.Errorf("unmarshal providers cache: %w", err)
	}
	item.SyncedAt, err = time.Parse(time.RFC3339Nano, syncedAt)
	if err != nil {
		return model.CachedProviders{}, fmt.Errorf("parse providers synced_at: %w", err)
	}
	return item, nil
}

func (s *SQLiteStore) SaveModelCatalog(ctx context.Context, payload map[string]any, syncedAt time.Time) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal model catalog cache: %w", err)
	}

	if _, err := s.db.ExecContext(ctx, `
		INSERT INTO model_catalog_cache (cache_key, payload_json, synced_at)
		VALUES ('default', ?, ?)
		ON CONFLICT(cache_key) DO UPDATE SET
			payload_json = excluded.payload_json,
			synced_at = excluded.synced_at
	`, string(raw), syncedAt.Format(time.RFC3339Nano)); err != nil {
		return fmt.Errorf("save model catalog cache: %w", err)
	}
	return nil
}

func (s *SQLiteStore) GetModelCatalog(ctx context.Context) (model.CachedModelCatalog, error) {
	var (
		item     model.CachedModelCatalog
		payload  string
		syncedAt string
	)

	err := s.db.QueryRowContext(ctx, `
		SELECT payload_json, synced_at
		FROM model_catalog_cache
		WHERE cache_key = 'default'
	`).Scan(&payload, &syncedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return model.CachedModelCatalog{}, sql.ErrNoRows
		}
		return model.CachedModelCatalog{}, fmt.Errorf("get model catalog cache: %w", err)
	}

	item.Payload = make(map[string]any)
	if err := json.Unmarshal([]byte(payload), &item.Payload); err != nil {
		return model.CachedModelCatalog{}, fmt.Errorf("unmarshal model catalog cache: %w", err)
	}
	item.SyncedAt, err = time.Parse(time.RFC3339Nano, syncedAt)
	if err != nil {
		return model.CachedModelCatalog{}, fmt.Errorf("parse model catalog synced_at: %w", err)
	}
	return item, nil
}

func (s *SQLiteStore) ListThresholds(ctx context.Context) ([]model.Threshold, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, name, scope, scope_value, metric, threshold_value, emails, enabled, created_at, updated_at
		FROM thresholds
		ORDER BY id ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("list thresholds: %w", err)
	}
	defer rows.Close()

	var thresholds []model.Threshold
	for rows.Next() {
		threshold, err := scanThreshold(rows)
		if err != nil {
			return nil, err
		}
		thresholds = append(thresholds, threshold)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate thresholds: %w", err)
	}
	return thresholds, nil
}

func (s *SQLiteStore) GetThreshold(ctx context.Context, id int64) (model.Threshold, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, name, scope, scope_value, metric, threshold_value, emails, enabled, created_at, updated_at
		FROM thresholds
		WHERE id = ?
	`, id)

	threshold, err := scanThreshold(row)
	if err != nil {
		return model.Threshold{}, err
	}
	return threshold, nil
}

func (s *SQLiteStore) CreateThreshold(ctx context.Context, threshold model.Threshold) (model.Threshold, error) {
	now := time.Now().UTC()
	threshold.CreatedAt = now
	threshold.UpdatedAt = now

	emails, err := json.Marshal(threshold.Emails)
	if err != nil {
		return model.Threshold{}, fmt.Errorf("marshal threshold emails: %w", err)
	}

	result, err := s.db.ExecContext(ctx, `
		INSERT INTO thresholds (name, scope, scope_value, metric, threshold_value, emails, enabled, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, threshold.Name, threshold.Scope, threshold.ScopeValue, threshold.Metric, threshold.ThresholdValue, string(emails), boolToInt(threshold.Enabled), threshold.CreatedAt.Format(time.RFC3339Nano), threshold.UpdatedAt.Format(time.RFC3339Nano))
	if err != nil {
		return model.Threshold{}, fmt.Errorf("create threshold: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return model.Threshold{}, fmt.Errorf("get threshold id: %w", err)
	}
	threshold.ID = id
	return threshold, nil
}

func (s *SQLiteStore) UpdateThreshold(ctx context.Context, threshold model.Threshold) (model.Threshold, error) {
	current, err := s.GetThreshold(ctx, threshold.ID)
	if err != nil {
		return model.Threshold{}, err
	}

	threshold.CreatedAt = current.CreatedAt
	threshold.UpdatedAt = time.Now().UTC()
	emails, err := json.Marshal(threshold.Emails)
	if err != nil {
		return model.Threshold{}, fmt.Errorf("marshal threshold emails: %w", err)
	}

	result, err := s.db.ExecContext(ctx, `
		UPDATE thresholds
		SET name = ?, scope = ?, scope_value = ?, metric = ?, threshold_value = ?, emails = ?, enabled = ?, updated_at = ?
		WHERE id = ?
	`, threshold.Name, threshold.Scope, threshold.ScopeValue, threshold.Metric, threshold.ThresholdValue, string(emails), boolToInt(threshold.Enabled), threshold.UpdatedAt.Format(time.RFC3339Nano), threshold.ID)
	if err != nil {
		return model.Threshold{}, fmt.Errorf("update threshold: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return model.Threshold{}, fmt.Errorf("threshold rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return model.Threshold{}, sql.ErrNoRows
	}
	return threshold, nil
}

func (s *SQLiteStore) DeleteThreshold(ctx context.Context, id int64) error {
	result, err := s.db.ExecContext(ctx, `DELETE FROM thresholds WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete threshold: %w", err)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("threshold rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *SQLiteStore) HasSentAlertForDate(ctx context.Context, thresholdID int64, alertDate string) (bool, error) {
	var count int
	err := s.db.QueryRowContext(ctx, `
		SELECT COUNT(1)
		FROM alert_events
		WHERE threshold_id = ? AND alert_date = ? AND status = 'sent'
	`, thresholdID, alertDate).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("check alert event: %w", err)
	}
	return count > 0, nil
}

func (s *SQLiteStore) CreateAlertEvent(ctx context.Context, event model.AlertEvent) (model.AlertEvent, error) {
	if event.CreatedAt.IsZero() {
		event.CreatedAt = time.Now().UTC()
	}

	recipients, err := json.Marshal(event.Recipients)
	if err != nil {
		return model.AlertEvent{}, fmt.Errorf("marshal alert recipients: %w", err)
	}

	result, err := s.db.ExecContext(ctx, `
		INSERT INTO alert_events (threshold_id, alert_date, metric_value, status, recipients, message, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, event.ThresholdID, event.AlertDate, event.MetricValue, event.Status, string(recipients), event.Message, event.CreatedAt.Format(time.RFC3339Nano))
	if err != nil {
		return model.AlertEvent{}, fmt.Errorf("create alert event: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return model.AlertEvent{}, fmt.Errorf("get alert event id: %w", err)
	}
	event.ID = id
	return event, nil
}

func (s *SQLiteStore) ListAlertEvents(ctx context.Context, limit int) ([]model.AlertEvent, error) {
	if limit <= 0 {
		limit = 50
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, threshold_id, alert_date, metric_value, status, recipients, message, created_at
		FROM alert_events
		ORDER BY created_at DESC
		LIMIT ?
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("list alert events: %w", err)
	}
	defer rows.Close()

	var events []model.AlertEvent
	for rows.Next() {
		var (
			event          model.AlertEvent
			recipientsJSON string
			createdAt      string
		)
		if err := rows.Scan(&event.ID, &event.ThresholdID, &event.AlertDate, &event.MetricValue, &event.Status, &recipientsJSON, &event.Message, &createdAt); err != nil {
			return nil, fmt.Errorf("scan alert event: %w", err)
		}
		if err := json.Unmarshal([]byte(recipientsJSON), &event.Recipients); err != nil {
			return nil, fmt.Errorf("unmarshal alert recipients: %w", err)
		}
		event.CreatedAt, err = time.Parse(time.RFC3339Nano, createdAt)
		if err != nil {
			return nil, fmt.Errorf("parse alert created_at: %w", err)
		}
		events = append(events, event)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate alert events: %w", err)
	}
	return events, nil
}

type thresholdScanner interface {
	Scan(dest ...any) error
}

func scanThreshold(scanner thresholdScanner) (model.Threshold, error) {
	var (
		threshold  model.Threshold
		emailsJSON string
		enabled    int
		createdAt  string
		updatedAt  string
	)

	err := scanner.Scan(
		&threshold.ID,
		&threshold.Name,
		&threshold.Scope,
		&threshold.ScopeValue,
		&threshold.Metric,
		&threshold.ThresholdValue,
		&emailsJSON,
		&enabled,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return model.Threshold{}, sql.ErrNoRows
		}
		return model.Threshold{}, fmt.Errorf("scan threshold: %w", err)
	}

	if err := json.Unmarshal([]byte(emailsJSON), &threshold.Emails); err != nil {
		return model.Threshold{}, fmt.Errorf("unmarshal threshold emails: %w", err)
	}
	threshold.Enabled = enabled == 1

	threshold.CreatedAt, err = time.Parse(time.RFC3339Nano, createdAt)
	if err != nil {
		return model.Threshold{}, fmt.Errorf("parse threshold created_at: %w", err)
	}
	threshold.UpdatedAt, err = time.Parse(time.RFC3339Nano, updatedAt)
	if err != nil {
		return model.Threshold{}, fmt.Errorf("parse threshold updated_at: %w", err)
	}

	return threshold, nil
}

func boolToInt(value bool) int {
	if value {
		return 1
	}
	return 0
}
