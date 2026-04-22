package provider

import (
	"os"
	"path/filepath"
	"testing"
)

func TestResolverSupportsLiteLLMModelList(t *testing.T) {
	t.Parallel()

	path := filepath.Join(t.TempDir(), "provider-config.yaml")
	writeProviderConfig(t, path, `
model_list:
  - model_name: sf-kimi-k2.5
    litellm_params:
      model: openai/Pro/moonshotai/Kimi-K2.5
      api_base: os.environ/SILICONFLOW_API_BASE
  - model_name: gpt-4o
    litellm_params:
      model: gpt-4o
      api_base: https://api.openai.com/v1
`)

	resolver := NewResolver(path)
	if got := resolver.Resolve("openai/Pro/moonshotai/Kimi-K2.5", nil); got != "siliconflow" {
		t.Fatalf("expected model_list provider siliconflow, got %q", got)
	}
	if got := resolver.Resolve("gpt-4o", nil); got != "openai" {
		t.Fatalf("expected model_list provider openai, got %q", got)
	}
}

func TestResolverSupportsExplicitMappingsAsOverride(t *testing.T) {
	t.Parallel()

	path := filepath.Join(t.TempDir(), "provider-config.yaml")
	writeProviderConfig(t, path, `
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: gpt-4o
      api_base: https://api.openai.com/v1
mappings:
  - provider: azure-openai
    match_type: exact
    value: gpt-4o
`)

	resolver := NewResolver(path)
	if got := resolver.Resolve("gpt-4o", nil); got != "azure-openai" {
		t.Fatalf("expected explicit mapping override azure-openai, got %q", got)
	}
}

func TestResolverFallsBackToMetadataProvider(t *testing.T) {
	t.Parallel()

	resolver := NewResolver(filepath.Join(t.TempDir(), "missing.yaml"))
	if got := resolver.Resolve("custom-model", map[string]any{"provider": "anthropic"}); got != "anthropic" {
		t.Fatalf("expected metadata provider anthropic, got %q", got)
	}
}

func writeProviderConfig(t *testing.T, path, contents string) {
	t.Helper()

	if err := os.WriteFile(path, []byte(contents), 0o644); err != nil {
		t.Fatalf("write provider config: %v", err)
	}
}
