package provider

import (
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Mappings  []Mapping  `yaml:"mappings"`
	ModelList []ModelDef `yaml:"model_list"`
}

type Mapping struct {
	Provider  string `yaml:"provider"`
	MatchType string `yaml:"match_type"`
	Value     string `yaml:"value"`
}

type ModelDef struct {
	ModelName     string             `yaml:"model_name"`
	Provider      string             `yaml:"provider"`
	LiteLLMParams ModelLiteLLMParams `yaml:"litellm_params"`
	ModelInfo     ModelInfo          `yaml:"model_info"`
}

type ModelLiteLLMParams struct {
	Model             string `yaml:"model"`
	APIBase           string `yaml:"api_base"`
	CustomLLMProvider string `yaml:"custom_llm_provider"`
}

type ModelInfo struct {
	BaseModel string `yaml:"base_model"`
	Provider  string `yaml:"provider"`
}

type Resolver struct {
	path    string
	mu      sync.RWMutex
	loaded  bool
	modTime time.Time
	config  Config
}

func NewResolver(path string) *Resolver {
	return &Resolver{path: strings.TrimSpace(path)}
}

func (r *Resolver) Resolve(modelName string, metadata map[string]any) string {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		return metadataProvider(metadata)
	}

	config, err := r.load()
	if err == nil {
		for _, mapping := range config.Mappings {
			if matches(mapping, modelName) {
				return mapping.Provider
			}
		}
		for _, model := range config.ModelList {
			if provider := modelProvider(model); provider != "" && modelMatches(model, modelName) {
				return provider
			}
		}
	}

	return metadataProvider(metadata)
}

func (r *Resolver) load() (Config, error) {
	if r.path == "" {
		return Config{}, nil
	}

	info, err := os.Stat(r.path)
	if err != nil {
		if os.IsNotExist(err) {
			return Config{}, nil
		}
		return Config{}, fmt.Errorf("stat provider config: %w", err)
	}

	r.mu.RLock()
	if r.loaded && info.ModTime().Equal(r.modTime) {
		config := r.config
		r.mu.RUnlock()
		return config, nil
	}
	r.mu.RUnlock()

	raw, err := os.ReadFile(r.path)
	if err != nil {
		return Config{}, fmt.Errorf("read provider config: %w", err)
	}

	var config Config
	if err := yaml.Unmarshal(raw, &config); err != nil {
		return Config{}, fmt.Errorf("unmarshal provider config: %w", err)
	}

	for index := range config.Mappings {
		config.Mappings[index].Provider = strings.TrimSpace(config.Mappings[index].Provider)
		config.Mappings[index].MatchType = strings.TrimSpace(config.Mappings[index].MatchType)
		config.Mappings[index].Value = strings.TrimSpace(config.Mappings[index].Value)
	}
	for index := range config.ModelList {
		config.ModelList[index].ModelName = strings.TrimSpace(config.ModelList[index].ModelName)
		config.ModelList[index].Provider = strings.TrimSpace(config.ModelList[index].Provider)
		config.ModelList[index].LiteLLMParams.Model = strings.TrimSpace(config.ModelList[index].LiteLLMParams.Model)
		config.ModelList[index].LiteLLMParams.APIBase = strings.TrimSpace(config.ModelList[index].LiteLLMParams.APIBase)
		config.ModelList[index].LiteLLMParams.CustomLLMProvider = strings.TrimSpace(config.ModelList[index].LiteLLMParams.CustomLLMProvider)
		config.ModelList[index].ModelInfo.BaseModel = strings.TrimSpace(config.ModelList[index].ModelInfo.BaseModel)
		config.ModelList[index].ModelInfo.Provider = strings.TrimSpace(config.ModelList[index].ModelInfo.Provider)
	}

	r.mu.Lock()
	r.loaded = true
	r.modTime = info.ModTime()
	r.config = config
	r.mu.Unlock()

	return config, nil
}

func matches(mapping Mapping, modelName string) bool {
	switch mapping.MatchType {
	case "exact":
		return mapping.Value == modelName
	case "prefix":
		return strings.HasPrefix(modelName, mapping.Value)
	default:
		return false
	}
}

func metadataProvider(metadata map[string]any) string {
	if metadata == nil {
		return ""
	}
	value, ok := metadata["provider"]
	if !ok {
		return ""
	}
	provider, ok := value.(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(provider)
}

func modelMatches(model ModelDef, modelName string) bool {
	if model.ModelName == modelName {
		return true
	}
	if model.LiteLLMParams.Model == modelName {
		return true
	}
	if model.ModelInfo.BaseModel == modelName {
		return true
	}
	return false
}

func modelProvider(model ModelDef) string {
	if model.Provider != "" {
		return model.Provider
	}
	if model.ModelInfo.Provider != "" {
		return model.ModelInfo.Provider
	}
	if model.LiteLLMParams.CustomLLMProvider != "" {
		return strings.ToLower(model.LiteLLMParams.CustomLLMProvider)
	}
	if provider := inferProviderFromAPIBase(model.LiteLLMParams.APIBase); provider != "" {
		return provider
	}
	if strings.HasPrefix(strings.ToLower(model.ModelName), "sf-") {
		return "siliconflow"
	}
	return ""
}

func inferProviderFromAPIBase(apiBase string) string {
	apiBase = strings.TrimSpace(apiBase)
	if apiBase == "" {
		return ""
	}

	normalized := strings.ToLower(apiBase)
	candidates := []string{
		"siliconflow",
		"openrouter",
		"anthropic",
		"openai",
		"moonshot",
		"deepseek",
		"minimax",
		"zai",
		"stepfun",
		"qwen",
	}
	for _, candidate := range candidates {
		if strings.Contains(normalized, candidate) {
			return candidate
		}
	}
	return ""
}
