export interface SpendMetrics {
  spend: number;
  prompt_tokens: number;
  completion_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  total_tokens: number;
  successful_requests: number;
  failed_requests: number;
  api_requests: number;
}

export interface NamedMetric {
  name: string;
  provider?: string;
  metrics: SpendMetrics;
}

export interface NamedKeyMetric {
  name: string;
  metrics: SpendMetrics;
  metadata?: {
    key_alias?: string;
    team_id?: string;
  };
}

export interface UsageDay {
  date: string;
  start_date?: string;
  end_date?: string;
  metrics: SpendMetrics;
  models?: NamedMetric[];
  providers?: NamedMetric[];
  mcp_tools?: NamedMetric[];
}

export interface UsageOverview {
  filters: {
    start_date: string;
    end_date: string;
    period: string;
  };
  period: string;
  summary: SpendMetrics;
  days: UsageDay[];
  models?: NamedMetric[];
  providers?: NamedMetric[];
  mcp_tools?: NamedMetric[];
}
