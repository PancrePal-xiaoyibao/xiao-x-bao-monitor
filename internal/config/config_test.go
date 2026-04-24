package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadDotEnvLoadsMissingVariablesOnly(t *testing.T) {
	tempDir := t.TempDir()
	envPath := filepath.Join(tempDir, ".env")

	content := "LITELLM_BASE_URL=https://api.example.com\nLITELLM_API_KEY=sk-test\n"
	if err := os.WriteFile(envPath, []byte(content), 0o644); err != nil {
		t.Fatalf("write temp .env: %v", err)
	}

	t.Setenv("LITELLM_API_KEY", "sk-existing")
	if err := loadDotEnv(envPath); err != nil {
		t.Fatalf("loadDotEnv returned error: %v", err)
	}

	if got := os.Getenv("LITELLM_BASE_URL"); got != "https://api.example.com" {
		t.Fatalf("expected base url from .env, got %q", got)
	}
	if got := os.Getenv("LITELLM_API_KEY"); got != "sk-existing" {
		t.Fatalf("expected existing env to win, got %q", got)
	}
}
