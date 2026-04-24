package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	HTTP        HTTPConfig
	LiteLLM     LiteLLMConfig
	Storage     StorageConfig
	Mail        MailConfig
	Scheduler   SchedulerConfig
	Provider    ProviderConfig
	Sync        SyncConfig
	AppTimeZone string
	Location    *time.Location
}

type HTTPConfig struct {
	Addr string
}

type LiteLLMConfig struct {
	BaseURL string
	APIKey  string
	Timeout time.Duration
}

type StorageConfig struct {
	Path string
}

type ProviderConfig struct {
	Path string
}

type MailConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	From     string
}

func (m MailConfig) Enabled() bool {
	return m.Host != "" && m.From != ""
}

type SchedulerConfig struct {
	Enabled  bool
	Interval time.Duration
}

type SyncConfig struct {
	LookbackDays int
}

func Load() (Config, error) {
	if err := loadDotEnv(".env"); err != nil {
		return Config{}, err
	}

	cfg := Config{
		HTTP: HTTPConfig{
			Addr: envString("HTTP_ADDR", ":8080"),
		},
		LiteLLM: LiteLLMConfig{
			BaseURL: strings.TrimRight(envString("LITELLM_BASE_URL", "http://localhost:4000"), "/"),
			APIKey:  strings.TrimSpace(os.Getenv("LITELLM_API_KEY")),
			Timeout: envDuration("LITELLM_TIMEOUT", 30*time.Second),
		},
		Storage: StorageConfig{
			Path: envString("DB_PATH", "data/monitor.db"),
		},
		Provider: ProviderConfig{
			Path: envString("PROVIDER_CONFIG_PATH", "config/provider-config.yaml"),
		},
		Mail: MailConfig{
			Host:     strings.TrimSpace(os.Getenv("SMTP_HOST")),
			Port:     envInt("SMTP_PORT", 587),
			Username: strings.TrimSpace(os.Getenv("SMTP_USERNAME")),
			Password: os.Getenv("SMTP_PASSWORD"),
			From:     strings.TrimSpace(os.Getenv("SMTP_FROM")),
		},
		Scheduler: SchedulerConfig{
			Enabled:  envBool("SCHEDULER_ENABLED", true),
			Interval: envDuration("SCHEDULER_INTERVAL", 10*time.Minute),
		},
		Sync: SyncConfig{
			LookbackDays: envInt("SYNC_LOOKBACK_DAYS", 30),
		},
		AppTimeZone: envString("APP_TIMEZONE", "Asia/Shanghai"),
	}

	loc, err := time.LoadLocation(cfg.AppTimeZone)
	if err != nil {
		return Config{}, fmt.Errorf("load APP_TIMEZONE: %w", err)
	}
	cfg.Location = loc
	return cfg, nil
}

func loadDotEnv(path string) error {
	raw, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("read %s: %w", path, err)
	}

	lines := strings.Split(string(raw), "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}

		key, value, ok := strings.Cut(trimmed, "=")
		if !ok {
			continue
		}

		key = strings.TrimSpace(key)
		if key == "" || os.Getenv(key) != "" {
			continue
		}

		value = strings.TrimSpace(value)
		value = strings.Trim(value, `"'`)
		if err := os.Setenv(key, value); err != nil {
			return fmt.Errorf("set env %s: %w", key, err)
		}
	}

	return nil
}

func envString(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func envInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func envBool(key string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func envDuration(key string, fallback time.Duration) time.Duration {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}
	return parsed
}
