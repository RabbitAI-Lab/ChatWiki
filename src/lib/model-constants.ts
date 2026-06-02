// Preset provider list (for dropdown quick select + default value mapping)
export const PROVIDERS = ["GLM", "MiniMax", "Kimi", "Alibaba Cloud", "DeepSeek"] as const;
export type Provider = (typeof PROVIDERS)[number];

// Protocol list
export const PROTOCOLS = ["openai", "anthropic"] as const;
export type Protocol = (typeof PROTOCOLS)[number];

// Protocol display names
export const PROTOCOL_LABELS: Record<Protocol, string> = {
  openai: "OpenAI Compatible",
  anthropic: "Anthropic Compatible",
};

// Protocol tag colors
export const PROTOCOL_TAG_COLORS: Record<Protocol, string> = {
  openai: "cyan",
  anthropic: "volcano",
};

// Provider tag colors (custom provider defaults to geekblue)
export const PROVIDER_TAG_COLORS: Record<string, string> = {
  GLM: "blue",
  MiniMax: "purple",
  Kimi: "gold",
  "Alibaba Cloud": "orange",
  DeepSeek: "green",
};

// Preset provider × protocol → default value mapping (custom provider has no preset defaults, user fills manually)
export const PROVIDER_DEFAULTS: Record<
  Provider,
  Record<Protocol, { baseUrl: string; modelName: string }>
> = {
  GLM: {
    openai: {
      baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
      modelName: "glm-5.1",
    },
    anthropic: {
      baseUrl: "https://open.bigmodel.cn/api/anthropic",
      modelName: "glm-5.1",
    },
  },
  MiniMax: {
    openai: {
      baseUrl: "https://api.minimaxi.com/v1",
      modelName: "MiniMax-M2.7",
    },
    anthropic: {
      baseUrl: "https://api.minimaxi.com/anthropic",
      modelName: "MiniMax-M2.7",
    },
  },
  Kimi: {
    openai: {
      baseUrl: "https://api.kimi.com/coding/v1",
      modelName: "kimi-for-coding",
    },
    anthropic: {
      baseUrl: "https://api.kimi.com/coding",
      modelName: "kimi-for-coding",
    },
  },
  "Alibaba Cloud": {
    openai: {
      baseUrl: "https://coding.dashscope.aliyuncs.com/v1",
      modelName: "glm-5",
    },
    anthropic: {
      baseUrl: "https://coding.dashscope.aliyuncs.com/apps/anthropic",
      modelName: "glm-5",
    },
  },
  DeepSeek: {
    openai: {
      baseUrl: "https://api.deepseek.com",
      modelName: "deepseek-v4-pro",
    },
    anthropic: {
      baseUrl: "https://api.deepseek.com/anthropic",
      modelName: "deepseek-v4-pro",
    },
  },
};

// Helper function: get provider + protocol defaults (returns null for custom providers)
export function getProviderDefaults(provider: string, protocol: string) {
  return (
    PROVIDER_DEFAULTS[provider as Provider]?.[protocol as Protocol] ?? null
  );
}

// Check if provider is a preset provider
export function isPresetProvider(provider: string): provider is Provider {
  return (PROVIDERS as readonly string[]).includes(provider);
}
