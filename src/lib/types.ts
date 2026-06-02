// 流式事件类型
export type StreamDeltaEvent = { type: "text_delta"; text: string };
// Extended Thinking 起始事件（Anthropic content_block_start 中 block.type === "thinking"）
export type StreamThinkingStartEvent = { type: "thinking_start" };
// Extended Thinking 增量事件（Anthropic thinking_delta.delta.thinking）
export type StreamThinkingDeltaEvent = { type: "thinking_delta"; text: string };
// Extended Thinking 签名事件（Anthropic signature_delta.delta.signature）
export type StreamThinkingSignatureEvent = { type: "thinking_signature"; signature: string };
export type StreamDoneEvent = {
  type: "done";
  fullText: string;
  thinking?: string;
  thinkingSignature?: string;
};
export type StreamErrorEvent = {
  type: "error";
  error: string;
  code?: string;
};
export type StreamToolCallEvent = {
  type: "tool_call";
  toolName: string;
  args: Record<string, unknown>;
};
export type StreamEvent =
  | StreamDeltaEvent
  | StreamThinkingStartEvent
  | StreamThinkingDeltaEvent
  | StreamThinkingSignatureEvent
  | StreamDoneEvent
  | StreamErrorEvent
  | StreamToolCallEvent;

// API 请求类型
export type ChatCompletionRequest = {
  modelId: number;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  /** @deprecated 由前端 system 消息替代 */
  systemPrompt?: string;
  projectId?: string;
};

// 文档活动日志
export interface DocumentActivity {
  id: number;
  projectId: string;
  documentPath: string;
  documentTitle: string;
  action: "create" | "update" | "delete" | "rename";
  oldTitle?: string | null;
  createdAt: string;
}

// 自定义错误类
export class ModelError extends Error {
  code:
    | "MODEL_NOT_FOUND"
    | "PROTOCOL_UNSUPPORTED"
    | "INVALID_CONFIG"
    | "SDK_ERROR";

  constructor(
    message: string,
    code:
      | "MODEL_NOT_FOUND"
      | "PROTOCOL_UNSUPPORTED"
      | "INVALID_CONFIG"
      | "SDK_ERROR"
  ) {
    super(message);
    this.name = "ModelError";
    this.code = code;
  }
}
