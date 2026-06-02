// 用于序列化/反序列化 model_configs.extra_env_json 列
// 失败容错：永远不抛错，失败时返回空对象

export function parseExtraEnv(json: string | null | undefined): Record<string, string> {
  if (!json || typeof json !== "string") return {};
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.warn("[model-env] extraEnvJson 不是对象，已忽略");
      return {};
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof k === "string" && k.length > 0 && typeof v === "string") {
        out[k] = v;
      }
    }
    return out;
  } catch (err) {
    console.warn(
      "[model-env] extraEnvJson 解析失败，已忽略:",
      err instanceof Error ? err.message : err
    );
    return {};
  }
}

export function serializeExtraEnv(obj: Record<string, string> | null | undefined): string {
  if (!obj || typeof obj !== "object") return "{}";
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof k === "string" && k.length > 0 && typeof v === "string") {
      out[k] = v;
    }
  }
  return JSON.stringify(out);
}

export const PREDEFINED_ENV_KEYS = {
  DISABLE_ADAPTIVE: "CLAUDE_CODE_DISABLE_ADAPTIVE",
  DEFAULT_THINKING: "CLAUDE_CODE_DEFAULT_THINKING",
} as const;

export const DEFAULT_THINKING_VALUE = '{"type":"enabled","budgetTokens":4096}';

export function defaultExtraEnvForCreate(): Record<string, string> {
  return {
    [PREDEFINED_ENV_KEYS.DISABLE_ADAPTIVE]: "1",
    [PREDEFINED_ENV_KEYS.DEFAULT_THINKING]: DEFAULT_THINKING_VALUE,
  };
}
