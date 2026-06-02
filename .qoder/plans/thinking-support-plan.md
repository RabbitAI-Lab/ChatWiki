# 为 ChatWiki 聊天 Service 增加 Extended Thinking 支持

## Context（为什么做）

当前 ChatWiki 的聊天链路在 4 层都没有处理 Anthropic Extended Thinking：

1. **SDK 配置层**（`src/lib/model-service.ts:90-184`）—— `sdkOptions` 未传 `thinking` / `effort` 字段，Anthropic 服务端默认行为是 thinking 关闭。
2. **流式事件层**（`src/lib/model-service.ts:246-261`）—— `stream_event` 只过滤 `text_delta` 转发，`thinking_delta` / `signature_delta` / `content_block_start` 中的 `BetaThinkingBlock` 全部被 log 后丢弃。
3. **类型契约层**（`src/lib/types.ts:1-18`）—— `StreamEvent` 联合类型只有 `text_delta | done | error | tool_call`，没有 `thinking_delta` 事件位。
4. **前端消费层**（`src/components/chat/ChatWorkspace.tsx:486-548` 和 `753-815`）—— SSE 解析只处理 `delta` / `done` / `error` / `tool_call`，没有任何分支接收 thinking。
5. **持久化层**（`src/db/schema.ts:52-58`）—— `chat_messages` 表只有 `content` 字段，没有 thinking 落库通道；重新打开历史会话时 thinking 永远消失。

**目标**：让管理员在模型配置上按模型启用/禁用 Extended Thinking，聊天流式输出时 thinking 单独作为 SSE 事件回传，UI 在 assistant 气泡顶部以可折叠区展示，DB 持久化完整 thinking 文本，重新加载历史仍可回看。

**用户已确认的设计决策**：

- **启用范围**：per-model 开关（在 `model_configs` 加列，admin 可在模型配置页按模型启/禁/选 `budgetTokens`；默认 `adaptive`，让 Opus 4.6+ 自动按需思考）
- **DB 存储**：新增 `chat_messages.thinking` 列，存原始 thinking 文本（含 signature），重载历史时能完整回看
- **UI 形式**：默认展开但可折叠（参考 Claude.ai：思考过程在 assistant 气泡顶部展示，可点击折叠/展开）

## Scope（做什么 / 不做什么）

**In scope**：
- 4 个 stream 事件类型（`text_delta` / `thinking_delta` / `thinking_signature` / `thinking_start`）的端到端透传
- per-model 启用开关（`adaptive` / `enabled` / `disabled`）和可选 `budgetTokens`
- UI 折叠区（默认展开，可点击折叠）
- DB 持久化 `thinking`（含 signature）
- 历史消息重载时回填 thinking
- 重新生成 / 首次发送两条路径都支持

**Out of scope**：
- 流式中的 thinking 增量编辑/打断（保持一次性渲染）
- thinking 的多语言摘要/翻译
- 替换或弃用 OpenAI 协议路径（OpenAI 协议下 thinking 不适用，不做对应字段）
- 调整 thinking `display: 'summarized' | 'omitted'` 字段（保持 `omitted` 即可，让 SDK 仍把原文通过 stream_event 抛回给我们，由前端展示）

## 类型契约（核心代码骨架）

### 1. `src/lib/types.ts` — 新增流式事件

```typescript
// 思考增量（流式追加到 aiThinking 变量）
export type StreamThinkingDeltaEvent = {
  type: "thinking_delta";
  text: string;
};

// 思考块的 signature（用于重放 Anthropic API）
export type StreamThinkingSignatureEvent = {
  type: "thinking_signature";
  signature: string;
};

// 思考块开始（可选，用于在 UI 折叠区显示"正在思考…"状态）
export type StreamThinkingStartEvent = {
  type: "thinking_start";
};

export type StreamEvent =
  | StreamDeltaEvent
  | StreamThinkingDeltaEvent
  | StreamThinkingSignatureEvent
  | StreamThinkingStartEvent
  | StreamDoneEvent
  | StreamErrorEvent
  | StreamToolCallEvent;
```

### 2. `src/lib/model-service.ts` — SDK 配置 + 流式过滤

在 `streamModelResponse` 内、构造 `sdkOptions` 之前，读取 model config 新增字段：

```typescript
type ModelConfigRow = {
  id: number;
  provider: string;
  protocol: "openai" | "anthropic";
  name: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  thinkingMode: "adaptive" | "enabled" | "disabled";
  thinkingBudgetTokens: number | null;
};
```

（`resolveModelConfig` 也要把新字段塞进 `ModelConfigRow`。）

`sdkOptions` 拼接 `thinking`：

```typescript
if (config.thinkingMode === "adaptive") {
  sdkOptions.thinking = { type: "adaptive", display: "omitted" };
} else if (config.thinkingMode === "enabled") {
  sdkOptions.thinking = {
    type: "enabled",
    budgetTokens: config.thinkingBudgetTokens ?? 1024,
    display: "omitted",
  };
}
// disabled：不传 thinking 字段
```

`stream_event` 分支增加两个 case（关键变更，原 line 246-261 替换为）：

```typescript
let accumulatedText = "";
let accumulatedThinking = "";
let lastSignature: string | undefined;

if (message.type === "stream_event") {
  const event = message.event;

  // 思考块开始 — UI 显示"正在思考…"
  if (event.type === "content_block_start") {
    const block = (event as { content_block?: { type: string } }).content_block;
    if (block?.type === "thinking") {
      yield { type: "thinking_start" };
    }
    continue;
  }

  if (event.type !== "content_block_delta") {
    continue;
  }
  const delta = "delta" in event ? event.delta : undefined;
  if (!delta) continue;

  if (delta.type === "text_delta" && "text" in delta) {
    accumulatedText += delta.text;
    yield { type: "text_delta", text: delta.text };
  } else if (delta.type === "thinking_delta" && "thinking" in delta) {
    accumulatedThinking += delta.thinking;
    yield { type: "thinking_delta", text: delta.thinking };
  } else if (delta.type === "signature_delta" && "signature" in delta) {
    lastSignature = delta.signature;
    yield { type: "thinking_signature", signature: delta.signature };
  }
  // 其他 delta（citations_delta、input_json_delta 等）保持原样 log
}
```

`result` 分支更新 `done` 事件，附上完整 thinking：

```typescript
yield {
  type: "done",
  fullText: resultText,
  thinking: accumulatedThinking || undefined,
  thinkingSignature: lastSignature,
};
```

### 3. `src/lib/types.ts` — 扩展 `StreamDoneEvent`

```typescript
export type StreamDoneEvent = {
  type: "done";
  fullText: string;
  thinking?: string;
  thinkingSignature?: string;
};
```

### 4. `src/app/api/chat/completions/route.ts` — SSE 透传

第 72-78 行 SSE 透传已对非 `text_delta` 直传，**无需修改**——新增的 `thinking_delta` / `thinking_signature` / `thinking_start` 自动以 `event: thinking_delta` 等事件名发到前端。

### 5. `src/components/chat/ChatWorkspace.tsx` — 端到端消费

#### 5.1 `Message` 接口扩展（line 28-32）

```typescript
interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  thinkingSignature?: string;
  streamingThinking?: string; // 正在流式追加的 thinking（仅在生成中）
}
```

#### 5.2 handleSend 中流式分支（line 486-548）增加：

```typescript
let aiContent = "";
let aiThinking = "";
let aiSignature = "";

// 在 SSE 解析循环里（与 "delta"/"text_delta" 同级）：
} else if (eventType === "thinking_start") {
  setMessages((prev) =>
    prev.map((m) =>
      m.id === tempAiMsg.id
        ? { ...m, streamingThinking: "" }
        : m
    )
  );
} else if (eventType === "thinking_delta" && data.type === "thinking_delta") {
  aiThinking += data.text;
  setMessages((prev) =>
    prev.map((m) =>
      m.id === tempAiMsg.id
        ? { ...m, streamingThinking: aiThinking }
        : m
    )
  );
} else if (eventType === "thinking_signature" && data.type === "thinking_signature") {
  aiSignature = data.signature;
}
```

`done` 事件处理时把 streamingThinking 落到 thinking 字段：

```typescript
} else if (eventType === "done" && data.type === "done") {
  if (!aiContent && data.fullText) aiContent = data.fullText;
  const finalThinking = data.thinking ?? aiThinking;
  const finalSig = data.thinkingSignature ?? aiSignature;
  setMessages((prev) =>
    prev.map((m) =>
      m.id === tempAiMsg.id
        ? {
            ...m,
            content: aiContent,
            thinking: finalThinking || undefined,
            thinkingSignature: finalSig || undefined,
            streamingThinking: undefined,
          }
        : m
    )
  );
}
```

#### 5.3 handleRegenerate 同改动（line 754-815），逻辑完全一致

**重要**：两处解析逻辑重复，建议本次顺手抽出一个 helper（`function parseSseLine(...)`），避免后续再扩事件时漏改一处。**重构范围限制在本次新加的几个分支**，不动原有 delta/done/error/tool_call 逻辑。

#### 5.4 气泡渲染（line 866-914 `bubbleItems`）

在 AI 气泡 `contentRender` 之上，加一个可折叠的 thinking 区域：

```typescript
import { DownOutlined, ThunderboltOutlined } from "@ant-design/icons";

const ThinkingBlock = ({ text }: { text: string }) => {
  const [open, setOpen] = useState(true); // 默认展开
  if (!text) return null;
  return (
    <div className="mb-2 rounded border border-amber-200 bg-amber-50/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-2 py-1 text-xs text-amber-700 hover:text-amber-900 w-full text-left"
      >
        <ThunderboltOutlined />
        <span className="font-medium">思考过程</span>
        <span className="text-amber-500">({text.length} 字)</span>
        <DownOutlined
          className={`ml-auto transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && (
        <div className="px-3 pb-2 pt-1 text-xs text-gray-700 whitespace-pre-wrap border-t border-amber-200/50">
          {text}
        </div>
      )}
    </div>
  );
};
```

`bubbleItems` 改造：

```typescript
return {
  key: msg.id.toString(),
  role: msg.role,
  // AI 气泡：content 拆成 thinking + 正文两块
  content: msg.role === "assistant" ? (
    <div>
      <ThinkingBlock text={msg.streamingThinking ?? msg.thinking ?? ""} />
      {renderMarkdown(msg.content)}
    </div>
  ) : msg.content,
  loading: isAiLoading || undefined,
  typing: msg.role === "assistant" && msg.content && !isAiLoading
    ? { effect: "typing" as const, step: 5, interval: 50 }
    : undefined,
  footer: ... // 不动
};
```

> 决策点：把 `content` 字段直接传 ReactNode 是 `@ant-design/x` Bubble 支持的模式。也可以走 `contentRender` 渲染（更整洁），但 `contentRender` 拿到的参数是字符串，与本设计冲突——走 `content` 字段更直接。

#### 5.5 持久化（line 411-422 save user message + 826-854 regenerate DB save）

`POST /api/chats/${currentChatId}/messages` 同步带上 thinking：

```typescript
body: JSON.stringify({
  role: "assistant",
  content: aiContent,
  thinking: aiThinking || null,
  thinkingSignature: aiSignature || null,
}),
```

regenerate 路径保存时同样处理。

### 6. `src/app/api/chats/[chatId]/messages/route.ts` — 接住新字段

```typescript
const { role, content, thinking, thinkingSignature } = body;

if (!role || !content) {
  return NextResponse.json({ error: "role and content are required" }, { status: 400 });
}

const result = db.insert(chatMessages).values({
  chatId: parseInt(chatId),
  role,
  content,
  thinking: thinking ?? null,
  thinkingSignature: thinkingSignature ?? null,
  createdAt: new Date().toISOString(),
}).run();
```

GET 返回的 message 也带 `thinking` 字段，前端 `initialMessages` 自动接到。

### 7. `src/db/schema.ts` — 持久化新字段

```typescript
export const chatMessages = sqliteTable("chat_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chatId: integer("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  thinking: text("thinking"),
  thinkingSignature: text("thinking_signature"),
  createdAt: text("created_at").notNull(),
});

export const modelConfigs = sqliteTable("model_configs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull(),
  protocol: text("protocol", { enum: ["openai", "anthropic"] }).notNull().default("openai"),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  apiKey: text("api_key").notNull(),
  modelName: text("model_name").notNull(),
  thinkingMode: text("thinking_mode", { enum: ["adaptive", "enabled", "disabled"] })
    .notNull()
    .default("adaptive"),
  thinkingBudgetTokens: integer("thinking_budget_tokens"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  isDefault: integer("is_default").notNull().default(0),
});
```

## DB Migration

新增 `drizzle/0016_add_thinking_fields.sql`：

```sql
-- model_configs: thinking 模式 + 可选 budget
ALTER TABLE `model_configs` ADD `thinking_mode` text NOT NULL DEFAULT 'adaptive';
ALTER TABLE `model_configs` ADD `thinking_budget_tokens` integer;

-- chat_messages: 持久化 thinking 原文 + signature
ALTER TABLE `chat_messages` ADD `thinking` text;
ALTER TABLE `chat_messages` ADD `thinking_signature` text;
```

迁移完后生成 `_journal.json` 索引（沿用现有 drizzle 流程：`npx drizzle-kit generate`）。本地启动时会自动应用。

> 注意：现有 row 全部 `thinking_mode = 'adaptive'`、`thinking` / `thinking_signature` 为 NULL——和"新功能"语义一致（admin 可在 admin 页面按需切换）。

## 文件修改清单

| 文件 | 性质 | 关键改动 |
|------|------|----------|
| `src/db/schema.ts` | 改 | `chatMessages` 加 `thinking`/`thinkingSignature`；`modelConfigs` 加 `thinkingMode`/`thinkingBudgetTokens` |
| `drizzle/0016_add_thinking_fields.sql` | 新 | 4 条 ALTER TABLE |
| `drizzle/meta/0016_snapshot.json` | 新 | drizzle-kit 自动生成（先 `drizzle-kit generate`） |
| `drizzle/meta/_journal.json` | 改 | 追加 0016 条目（drizzle-kit 自动） |
| `src/lib/types.ts` | 改 | 新增 3 个 `StreamEvent` 类型，扩展 `StreamDoneEvent` |
| `src/lib/model-service.ts` | 改 | `ModelConfigRow` 加 2 字段；`sdkOptions` 拼 `thinking`；`stream_event` 分支扩 3 个 case；`result` 分支 done 事件带 thinking |
| `src/app/api/chat/completions/route.ts` | **不动** | 现有 SSE 透传已兼容新事件 |
| `src/app/api/chats/[chatId]/messages/route.ts` | 改 | POST 接受 `thinking` / `thinkingSignature`，写 DB |
| `src/app/api/models/route.ts` | 改 | POST 接受 `thinkingMode` / `thinkingBudgetTokens` |
| `src/app/api/models/[id]/route.ts` | 改 | PATCH 接受两个新字段 |
| `src/components/admin/ModelsPageClient.tsx` | 改 | Create / Edit 表单各加一个 Segmented（adaptive/enabled/disabled）+ NumberInput（仅 enabled 时显示） |
| `src/components/chat/ChatWorkspace.tsx` | 改 | `Message` 加 `thinking` / `thinkingSignature` / `streamingThinking`；SSE 解析扩 3 个 case（两处），重构为 helper；`bubbleItems` 顶部插 `ThinkingBlock`；保存消息请求带 thinking |

## Admin 模型配置 UI 设计

在 ModelsPageClient 的 Create / Edit 表单中（参考 `renderProviderField` 模式，line 409-444），在 `modelName` 之后插入：

```tsx
<Form.Item label="思考模式" name="thinkingMode" initialValue="adaptive" tooltip="adaptive: 让模型按需自动思考（推荐）；enabled: 强制开启并设置预算；disabled: 关闭">
  <Select
    options={[
      { value: "adaptive", label: "自适应（推荐）" },
      { value: "enabled", label: "强制开启" },
      { value: "disabled", label: "关闭" },
    ]}
  />
</Form.Item>
<Form.Item
  noStyle
  shouldUpdate={(prev, curr) => prev.thinkingMode !== curr.thinkingMode}
>
  {({ getFieldValue }) =>
    getFieldValue("thinkingMode") === "enabled" ? (
      <Form.Item
        label="思考预算 (tokens)"
        name="thinkingBudgetTokens"
        tooltip="建议 1024-16000，模型自动思考则忽略"
      >
        <InputNumber min={1024} max={32000} step={512} style={{ width: "100%" }} />
      </Form.Item>
    ) : null
  }
</Form.Item>
```

回显时（`handleStartEdit` line 243-260）补：

```typescript
editForm.setFieldsValue({
  ...
  thinkingMode: model.thinkingMode ?? "adaptive",
  thinkingBudgetTokens: model.thinkingBudgetTokens ?? undefined,
});
```

## UI 折叠区（参考 Claude.ai）

- 位置：assistant 气泡顶部、正文之上
- 默认：展开
- 视觉：amber-50 底 + amber-200 边框 + `ThunderboltOutlined` 图标 + 字数提示
- 折叠/展开：点击头部整行可切换；右侧 `DownOutlined` 旋转 90° 表示折叠
- 字号：12px（小一号），`whitespace-pre-wrap` 保留换行
- 不影响：流式 typing 动画、Copy 按钮、Actions 工具栏、Save / Regenerate
- streamingThinking 与 thinking 共用同一渲染组件，无需分支

## 验证步骤

1. **DB 迁移**：
   - `npx drizzle-kit generate`（确认 0016 文件生成 + _journal 更新）
   - 启动 dev server（会自动执行迁移）；`sqlite3 data.db ".schema model_configs"` / `".schema chat_messages"` 看到 4 个新列

2. **后端**：
   - `pnpm tsc --noEmit` 无错
   - `pnpm lint` 无错
   - 临时把日志级别调高，向一个支持 thinking 的 Claude 模型发请求：`curl -N -X POST http://localhost:3000/api/chat/completions -d '{...}'` 应看到 `event: thinking_start`、`event: thinking_delta`、`event: thinking_signature`、`event: text_delta` 按序到达

3. **Admin UI**：
   - 打开 `/admin/models`，编辑一个 anthropic 协议模型，把思考模式从 adaptive 切到 enabled，填 4096 tokens，保存
   - 重新打开，验证回显
   - 切到 disabled，保存
   - 重新打开，验证回显（budget 应为 undefined）

4. **端到端**：
   - 在聊天页选刚配的 anthropic + enabled 模型，发一条复杂问题
   - 应看到：assistant 气泡顶部先出现"思考过程"折叠区（实时增长），到达一定长度后正文开始打字效果
   - 点击折叠区头部可折叠/展开，状态在多次切换中保持
   - 停止 / 重新生成：重新生成路径同样工作
   - 刷新页面（F5）：历史 assistant 气泡的折叠区依然显示完整 thinking
   - 切换到 `disabled` 模型，刷新后再发消息：折叠区不出现
   - 切到 `adaptive` 模型（如果该模型支持），刷新后发消息：折叠区出现，正文跟在其后

5. **回归**：
   - OpenAI 协议模型不报错（不传 thinking 字段）
   - 旧的 chat（无 thinking 数据）正常显示，只是不显示折叠区
   - 工具调用（`tool_call`）行为不变
   - SSE 错误处理不变
