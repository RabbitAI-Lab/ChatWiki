/**
 * ChatWiki ACP Client 实现
 *
 * 实现 ACP Client 接口：
 * - requestPermission: 校验 .md 文件路径 + 自动批准其他操作
 * - sessionUpdate: 将更新推入事件队列，供 AsyncGenerator 消费
 */
import * as path from "node:path";
import type { Client, SessionNotification, RequestPermissionRequest, RequestPermissionResponse } from "@agentclientprotocol/sdk";
import type { StreamEvent } from "./types";
import { mapAcpUpdateToStreamEvents } from "./acp-event-mapper";

type UsageUpdateData = {
  cost?: { amount: number; currency: string };
  size: number;
  used: number;
};

export class ChatWikiAcpClient implements Client {
  /**
   * 工作目录，用于路径解析。
   */
  private readonly cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
  }
  /**
   * 事件队列：ACP sessionUpdate 映射后的 StreamEvent 缓存在这里。
   * drainEvents() 作为 AsyncGenerator 从此队列消费。
   */
  private eventQueue: StreamEvent[] = [];

  /**
   * resolveWait: 当队列中有新事件时 resolve 当前等待的 Promise。
   * drainEvents() 通过 await 此 Promise 来等待新事件到达。
   */
  private resolveWait: (() => void) | null = null;

  /**
   * 标记 prompt turn 是否结束。
   * 当 prompt() 返回后，drainEvents() 应该停止等待。
   */
  private promptDone = false;

  /**
   * 跟踪是否已经发送过 thinking_start。
   * ACP 没有 thinking_start 事件，我们在第一次 agent_thought_chunk 时补充。
   */
  private thinkingStarted = false;

  /**
   * 最后一次 usage_update 数据（prompt 完成后采集）。
   */
  private _lastUsageUpdate: UsageUpdateData | null = null;

  /**
   * 前一次 prompt 结束时的 usage（用于计算增量）。
   */
  private _prevUsageUsed: number = 0;

  // --- Client interface 实现 ---

  async requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    const toolTitle = params.toolCall?.title ?? "(no title)";
    const rawInput = params.toolCall?.rawInput as Record<string, unknown> | undefined;
    const filePath = rawInput?.file_path as string | undefined;

    console.log("[ACP Client] requestPermission:", toolTitle, filePath ? `path=${filePath}` : "");

    // .md 文件路径校验：必须写入 docs/ 目录
    if (filePath && filePath.endsWith(".md")) {
      const resolved = path.resolve(this.cwd, filePath);
      const docsDir = path.resolve(this.cwd, "docs");
      if (!resolved.startsWith(docsDir + path.sep) && resolved !== path.resolve(this.cwd, "docs")) {
        console.log(`[ACP Client] BLOCKED: .md file must be in docs/, got: ${filePath} resolved: ${resolved}`);
        // 选择 reject 选项拒绝
        const rejectOption = params.options?.find(o => o.optionId === "reject");
        if (rejectOption) {
          return {
            outcome: { outcome: "selected", optionId: rejectOption.optionId },
          } as RequestPermissionResponse;
        }
        // 没有 reject 选项则 cancel
        return {
          outcome: { outcome: "cancelled" },
        } as RequestPermissionResponse;
      }
    }

    // 其他情况自动批准 allow
    const allowOption = params.options?.find(o => o.optionId === "allow");
    if (allowOption) {
      return {
        outcome: { outcome: "selected", optionId: allowOption.optionId },
      } as RequestPermissionResponse;
    }
    // fallback: 批准第一个选项
    if (params.options && params.options.length > 0) {
      return {
        outcome: { outcome: "selected", optionId: params.options[0].optionId },
      } as RequestPermissionResponse;
    }
    return {
      outcome: { outcome: "selected" },
    } as RequestPermissionResponse;
  }

  async sessionUpdate(params: SessionNotification): Promise<void> {
    const update = params.update;
    console.log("[ACP Client] sessionUpdate:", update.sessionUpdate, "sessionId=", params.sessionId);
    const mapped = mapAcpUpdateToStreamEvents(update);

    // 捕获 usage_update 事件
    if (update.sessionUpdate === "usage_update") {
      this._lastUsageUpdate = update as unknown as UsageUpdateData;
    }

    // 特殊处理：首次 agent_thought_chunk 时补充 thinking_start
    if (update.sessionUpdate === "agent_thought_chunk" && !this.thinkingStarted) {
      this.thinkingStarted = true;
      console.log("[ACP Client] 补充 thinking_start 事件");
      this.eventQueue.push({ type: "thinking_start" });
    }

    if (mapped.length > 0) {
      console.log("[ACP Client] 映射事件数:", mapped.length, "types:", mapped.map(e => e.type).join(","));
      this.eventQueue.push(...mapped);
      // 唤醒等待中的消费者
      this.resolveWait?.();
    }
  }

  // --- 事件消费 ---

  /**
   * 标记 prompt turn 结束，drainEvents 将在队列清空后停止。
   */
  markPromptDone(): void {
    this.promptDone = true;
    this.resolveWait?.();
  }

  /**
   * 重置状态（新一轮 prompt 前调用）。
   */
  resetForNewPrompt(): void {
    // 保存当前 usage used 值作为下一次增量计算的基线
    if (this._lastUsageUpdate) {
      this._prevUsageUsed = this._lastUsageUpdate.used;
    }
    this.eventQueue = [];
    this.resolveWait = null;
    this.promptDone = false;
    this.thinkingStarted = false;
  }

  /**
   * 获取最后一次 usage_update 数据。
   */
  getLastUsageUpdate(): UsageUpdateData | null {
    return this._lastUsageUpdate;
  }

  /**
   * 获取前一次 usage 的 used 值（用于增量计算）。
   */
  getPrevUsageUsed(): number {
    return this._prevUsageUsed;
  }

  /**
   * AsyncGenerator：从事件队列消费 StreamEvent。
   * 在 promptDone=true 且队列清空后结束。
   */
  async *drainEvents(): AsyncGenerator<StreamEvent> {
    while (true) {
      // 1. 先消费队列中的所有事件
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift()!;
        yield event;
      }

      // 2. 队列空 + prompt 完成 → 结束
      if (this.promptDone) {
        return;
      }

      // 3. 等待新事件到达或 prompt 完成
      await new Promise<void>((resolve) => {
        this.resolveWait = resolve;
      });
    }
  }
}
