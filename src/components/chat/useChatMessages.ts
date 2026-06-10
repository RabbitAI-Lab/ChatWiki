"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/useAuth";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { Message } from "./chat-workspace-ref";
import type { TemplateItem } from "./useChatSelectors";
import { buildSystemMessage, consumeSseStream } from "./chat-constants";
import { getChatUrl } from "@/lib/chat-navigation";

/**
 * SSE 事件回调中更新消息的辅助函数。
 */
function updateMessageById(
  prev: Message[],
  id: number,
  patch: Partial<Message>
): Message[] {
  return prev.map((m) => (m.id === id ? { ...m, ...patch } : m));
}

/**
 * 统一的 AI 流式响应处理。
 * 提取自 handleSend / handleRegenerate 的重复 SSE 解析逻辑。
 */
async function streamAiResponse(params: {
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  tempAiMsgId: number;
  chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  selectedModelId: number | string;
  selectedProject: string | undefined;
  selectedWorkspace?: string;
  workspaceId?: string;
  chatId?: number | null;
  onToolCall?: (toolCall: { toolName: string; args: Record<string, unknown> }) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}): Promise<{ aiContent: string; aiThinking: string; aiSignature: string | undefined; hasError: boolean; quotaExceeded?: boolean }> {
  const {
    authFetch,
    tempAiMsgId,
    chatMessages,
    setMessages,
    abortControllerRef,
    selectedModelId,
    selectedProject,
    selectedWorkspace,
    workspaceId,
    chatId,
    onToolCall,
    t,
  } = params;

  let aiContent = "";
  let aiThinking = "";
  let aiSignature: string | undefined;
  let hasError = false;

  try {
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const res = await authFetch("/api/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelId: selectedModelId,
        messages: chatMessages,
        projectId: selectedProject,
        workspaceId: selectedWorkspace ?? workspaceId,
        chatId: chatId,
      }),
      signal: abortController.signal,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: t('errors.requestFailed') }));
      // Token 配额超限 → 标记为 quotaExceeded，前端展示充值提示
      if (res.status === 429 && errData.quotaExceeded) {
        aiContent = errData.error || "Token 已用完，记得充值订阅哦~";
        hasError = true;
        setMessages((prev) => updateMessageById(prev, tempAiMsgId, {
          content: aiContent,
          isError: true,
          isQuotaExceeded: true,
        }));
        return { aiContent, aiThinking, aiSignature, hasError, quotaExceeded: true };
      }
      aiContent = errData.error || t('errors.modelCallFailed');
      setMessages((prev) => updateMessageById(prev, tempAiMsgId, { content: aiContent }));
    } else {
      const reader = res.body?.getReader();
      if (reader) {
        await consumeSseStream(reader, (eventType, data) => {
          if (eventType === "delta" && data.type === "text_delta" && typeof data.text === "string") {
            aiContent += data.text;
            setMessages((prev) => updateMessageById(prev, tempAiMsgId, { content: aiContent }));
          } else if (eventType === "thinking_start" && data.type === "thinking_start") {
            aiThinking = "";
            setMessages((prev) => updateMessageById(prev, tempAiMsgId, { streamingThinking: "" }));
          } else if (eventType === "thinking_delta" && data.type === "thinking_delta" && typeof data.text === "string") {
            aiThinking += data.text;
            setMessages((prev) => updateMessageById(prev, tempAiMsgId, { streamingThinking: aiThinking }));
          } else if (eventType === "thinking_signature" && data.type === "thinking_signature" && typeof data.signature === "string") {
            aiSignature = data.signature;
          } else if (eventType === "error") {
            aiContent = (data.error as string) || t('errors.modelCallError');
            hasError = true;
            setMessages((prev) => updateMessageById(prev, tempAiMsgId, { content: aiContent, isError: true }));
          } else if (eventType === "done" && data.type === "done") {
            if (!aiContent && typeof data.fullText === "string") {
              aiContent = data.fullText;
            }
            const finalThinking = (data.thinking as string | undefined) || (aiThinking || undefined);
            const finalSignature = (data.thinkingSignature as string | undefined) || aiSignature;
            setMessages((prev) =>
              updateMessageById(prev, tempAiMsgId, {
                content: aiContent,
                thinking: finalThinking,
                thinkingSignature: finalSignature,
                streamingThinking: undefined,
              })
            );
          } else if (eventType === "tool_call" && data.type === "tool_call") {
            console.log("[ChatWorkspace] tool_call:", data.toolName, data.args);
            onToolCall?.({
              toolName: data.toolName as string,
              args: (data.args as Record<string, unknown>) ?? {},
            });
          }
        });
      } else {
        aiContent = t('errors.cannotReadStream');
        hasError = true;
        setMessages((prev) => updateMessageById(prev, tempAiMsgId, { content: aiContent, isError: true }));
      }
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      aiContent = aiContent || t('errors.modelCallFailedRetry');
      hasError = true;
      setMessages((prev) => updateMessageById(prev, tempAiMsgId, { content: aiContent, isError: true }));
    }
  } finally {
    abortControllerRef.current = null;
  }

  return { aiContent, aiThinking, aiSignature, hasError };
}

/** 队列中的待发送消息 */
interface QueuedMessage {
  content: string;
  mentionedFiles: string[];
}

interface UseChatMessagesOptions {
  effectiveChatId: number | null;
  setEffectiveChatId: (id: number | null) => void;
  initialMessages: Message[];
  selectedModelId: number | string | undefined;
  selectedProject: string | undefined;
  selectedWorkspace: string | undefined;
  workspaceId: string | undefined;
  selectedTemplateId: number | undefined;
  templates: TemplateItem[];
  projectName?: string;
  openFileTabs?: Array<{ fileName: string; filePath: string }>;
  embedded: boolean;
  floating: boolean;
  router: AppRouterInstance;
  onChatCreated?: (chatId: number) => void;
  onToolCall?: (toolCall: { toolName: string; args: Record<string, unknown> }) => void;
  mentionFile?: string | null;
  onMentionConsumed?: () => void;
  userId?: string;
}

export function useChatMessages({
  effectiveChatId,
  setEffectiveChatId,
  initialMessages,
  selectedModelId,
  selectedProject,
  selectedWorkspace,
  workspaceId,
  selectedTemplateId,
  templates,
  projectName,
  openFileTabs,
  embedded,
  floating,
  router,
  onChatCreated,
  onToolCall,
  mentionFile,
  onMentionConsumed,
  userId,
}: UseChatMessagesOptions) {
  const creatingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [messages, setMessages] = useState<Message[]>(initialMessages || []);
  const { authFetch, accessToken } = useAuth();
  const t = useTranslations("chat");
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [mentionedFiles, setMentionedFiles] = useState<string[]>([]);

  // --- 队列机制 ---
  const queueRef = useRef<QueuedMessage[]>([]);
  const [queueSize, setQueueSize] = useState(0);
  const [queueItems, setQueueItems] = useState<QueuedMessage[]>([]);
  const isProcessingRef = useRef(false);

  // --- 最新状态快照 ref（解决闭包陈旧值问题） ---
  const messagesRef = useRef<Message[]>(initialMessages || []);
  const effectiveChatIdRef = useRef(effectiveChatId);

  // 同步 messages 到 ref
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // 同步 effectiveChatId 到 ref
  useEffect(() => {
    effectiveChatIdRef.current = effectiveChatId;
  }, [effectiveChatId]);

  // --- ACP 刷新恢复检测 ---
  // 当页面加载完成且最后一条消息是 user（无 assistant 回复）时，
  // 尝试连接 acp-stream SSE 端点恢复 ACP 进行中的响应
  const acpRecoveryStartedRef = useRef(false);
  const acpRecoveryGenRef = useRef(0);
  useEffect(() => {
    // 防止重复触发
    if (acpRecoveryStartedRef.current) return;
    // 仅在 effectiveChatId 存在、loading 为 false、有消息时检测
    if (!effectiveChatId || loading || messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "user") return;

    // 标记已触发，分配唯一 generation
    acpRecoveryStartedRef.current = true;
    const myGen = ++acpRecoveryGenRef.current;

    // 创建占位消息 + loading 状态（移入 async IIFE 避免 set-state-in-effect 警告）
    const tempAiMsgId = Date.now();

    // 使用 generation 计数器避免 React Strict Mode 双重 mount 竞争
    // （Strict Mode: effect1 → cleanup → effect2，effect2 的 gen 更新，effect1 的 async 检测到过期自动退出）
    (async () => {
      setLoading(true);
      setMessages((prev) => [...prev, {
        id: tempAiMsgId,
        role: "assistant" as const,
        content: "",
        streamingThinking: "",
      }]);

      const isActive = () => myGen === acpRecoveryGenRef.current;

      try {
        // 使用原生 fetch 而非 authFetch，因为 authFetch 内部的 dedupFetch 会 r.clone()
        // clone() 会缓冲整个流式 body 直到流关闭，SSE 流无法正常读取
        const sseHeaders: Record<string, string> = {};
        if (accessToken) {
          sseHeaders["Authorization"] = `Bearer ${accessToken}`;
        }
        console.log("[ACP-Recovery] 检测 ACP 恢复, chatId=", effectiveChatId, "gen=", myGen);
        const res = await fetch(`/api/chats/${effectiveChatId}/acp-stream`, { headers: sseHeaders });
        if (!isActive()) return; // 过期，静默退出（cleanup 已处理占位和 loading）

        console.log("[ACP-Recovery] acp-stream 响应:", res.status, res.ok);
        if (!res.ok) {
          console.warn("[ACP-Recovery] acp-stream 非 200 响应");
          setLoading(false);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          console.warn("[ACP-Recovery] 无 ReadableStream reader");
          setLoading(false);
          return;
        }

        // SSE 解析
        const decoder = new TextDecoder();
        let aiContent = "";
        let aiThinking = "";
        let gotNotInProgress = false;
        let eventCount = 0;
        let sseBuffer = "";

        const handleEvent = (eventType: string, data: Record<string, unknown>) => {
          eventCount++;
          if (eventCount <= 3) {
            console.log("[ACP-Recovery] event #", eventCount, eventType, data.type);
          }

          if (!isActive()) return;

          if (eventType === "not_in_progress") {
            gotNotInProgress = true;
            console.log("[ACP-Recovery] 收到 not_in_progress，延迟从 DB 重新加载");
            setMessages((prev) => prev.filter((m) => m.id !== tempAiMsgId));
            setTimeout(async () => {
              try {
                const msgsRes = await authFetch(`/api/chats/${effectiveChatId}/messages`);
                if (msgsRes.ok) {
                  const dbMessages = await msgsRes.json();
                  setMessages(
                    dbMessages.map((m: Record<string, unknown>) => ({
                      id: m.id as number,
                      role: m.role as "user" | "assistant",
                      content: m.content as string,
                      thinking: m.thinking as string | undefined,
                      thinkingSignature: m.thinkingSignature as string | undefined,
                      isError: m.isError === 1,
                    }))
                  );
                }
              } catch {
                // DB 加载失败
              }
              setLoading(false);
            }, 500);
            return;
          }

          if (eventType === "delta" && data.type === "text_delta" && typeof data.text === "string") {
            aiContent += data.text;
            setMessages((prev) => updateMessageById(prev, tempAiMsgId, { content: aiContent }));
          } else if (eventType === "thinking_start" && data.type === "thinking_start") {
            aiThinking = "";
            setMessages((prev) => updateMessageById(prev, tempAiMsgId, { streamingThinking: "" }));
          } else if (eventType === "thinking_delta" && data.type === "thinking_delta" && typeof data.text === "string") {
            aiThinking += data.text;
            setMessages((prev) => updateMessageById(prev, tempAiMsgId, { streamingThinking: aiThinking }));
          } else if (eventType === "error") {
            const errorContent = (data.error as string) || "ACP 恢复流错误";
            setMessages((prev) => updateMessageById(prev, tempAiMsgId, { content: errorContent, isError: true }));
          } else if (eventType === "tool_call" && data.type === "tool_call") {
            onToolCall?.({
              toolName: data.toolName as string,
              args: (data.args as Record<string, unknown>) ?? {},
            });
          } else if (eventType === "done" && data.type === "done") {
            const finalText = typeof data.fullText === "string" ? data.fullText : aiContent;
            const finalThinking = (data.thinking as string | undefined) || aiThinking || undefined;
            setMessages((prev) =>
              updateMessageById(prev, tempAiMsgId, {
                content: finalText,
                thinking: finalThinking,
                streamingThinking: undefined,
              })
            );
          }
        };

        // SSE 解析循环
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log("[ACP-Recovery] 流结束, 共处理", eventCount, "个事件");
            break;
          }
          if (!isActive()) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() || "";

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith("event: ")) {
              const eventType = line.slice(7).trim();
              const dataLine = lines[i + 1];
              if (dataLine?.startsWith("data: ")) {
                i++;
                try {
                  handleEvent(eventType, JSON.parse(dataLine.slice(6)));
                } catch {
                  // 解析错误忽略
                }
              }
            }
          }
        }

        console.log("[ACP-Recovery] SSE 循环退出, eventCount=", eventCount);

        // DB reload 获取正式记录
        if (!gotNotInProgress && isActive()) {
          try {
            const msgsRes = await authFetch(`/api/chats/${effectiveChatId}/messages`);
            if (msgsRes.ok) {
              const dbMessages = await msgsRes.json();
              setMessages(
                dbMessages.map((m: Record<string, unknown>) => ({
                  id: m.id as number,
                  role: m.role as "user" | "assistant",
                  content: m.content as string,
                  thinking: m.thinking as string | undefined,
                  thinkingSignature: m.thinkingSignature as string | undefined,
                  isError: m.isError === 1,
                }))
              );
            }
          } catch {
            // DB 加载失败，保留内存中的消息
          }
          setLoading(false);
        }

        console.log("[ACP-Recovery] 恢复完成, chatId=", effectiveChatId);
      } catch (err) {
        console.error("[ACP-Recovery] 错误:", err);
        if (isActive()) setLoading(false);
      }
    })();

    // cleanup：重置 startedRef + 移除本 effect 创建的占位消息（避免 Strict Mode 双气泡）
    return () => {
      acpRecoveryStartedRef.current = false;
      setMessages((prev) => prev.filter((m) => m.id !== tempAiMsgId));
      setLoading(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveChatId]); // 只依赖 effectiveChatId，避免 state 变化导致 cleanup 竞争

  useEffect(() => {
    if (mentionFile) {
      Promise.resolve().then(() => {
        setMentionedFiles((prev) => {
          if (prev.includes(mentionFile)) return prev;
          return [...prev, mentionFile];
        });
        onMentionConsumed?.();
      });
    }
  }, [mentionFile, onMentionConsumed]);

  // --- 队列排空函数（前置声明，由 processSingleMessage 末尾调用） ---
  // drainQueue 和 processSingleMessage 互相引用，使用 ref 打破循环依赖
  const processSingleMessageRef = useRef<
    (content: string, mentionedFiles: string[]) => Promise<void>
  >(() => Promise.resolve());

  const syncQueueState = useCallback(() => {
    setQueueSize(queueRef.current.length);
    setQueueItems([...queueRef.current]);
  }, []);

  const drainQueue = useCallback(() => {
    const next = queueRef.current.shift();
    if (next) {
      syncQueueState();
      queueMicrotask(() => {
        processSingleMessageRef.current(next.content, next.mentionedFiles);
      });
    } else {
      isProcessingRef.current = false;
      setLoading(false);
      setQueueSize(0);
      setQueueItems([]);
    }
  }, [syncQueueState]);

  // --- 实际的消息发送逻辑 ---
  const processSingleMessage = useCallback(async (
    trimmedContent: string,
    capturedMentionedFiles: string[],
  ) => {
    console.log("Selected model:", selectedModelId, "Selected project:", selectedProject, "Selected template:", selectedTemplateId);

    // Prepend mentioned files to message content
    let fullContent = trimmedContent;
    if (capturedMentionedFiles.length > 0) {
      const mentionText = capturedMentionedFiles
        .map((f) => {
          const fileName = f.split("/").pop() || f;
          return `@${fileName}`;
        })
        .join(" ");
      fullContent = `${mentionText} ${trimmedContent}`;
    }

    // 1. Optimistically add user message
    const tempUserMsg: Message = {
      id: Date.now(),
      role: "user",
      content: fullContent,
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    // 2. If no chat exists yet, create one first
    let currentChatId = effectiveChatIdRef.current;
    if (currentChatId === null) {
      if (creatingRef.current) {
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
        drainQueue();
        return;
      }
      creatingRef.current = true;
      try {
        const chatRes = await authFetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: trimmedContent.slice(0, 50),
            modelId: selectedModelId,
            templateId: selectedTemplateId,
            projectId: selectedProject,
            workspaceId: selectedWorkspace ?? workspaceId,
          }),
        });
        if (!chatRes.ok) {
          setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
          creatingRef.current = false;
          drainQueue();
          return;
        }
        const chat = await chatRes.json();
        currentChatId = chat.id;
        // 同步更新 ref 和 state
        effectiveChatIdRef.current = chat.id;
        setEffectiveChatId(chat.id);
        onChatCreated?.(chat.id);
        // 嵌入模式跳过 router.refresh()，避免 Next.js 服务端重渲染导致 ChatWorkspace 卸载重建
        if (!embedded) {
          router.refresh();
        }
        if (!floating) {
          if (embedded) {
            // 嵌入模式：只更新查询参数，避免触发 Next.js 路由检测导致的二次渲染
            const url = new URL(window.location.href);
            url.searchParams.set("chatId", String(chat.id));
            window.history.replaceState(null, "", url.pathname + url.search + url.hash);
          } else {
            // 独立页面：使用完整路径
            const chatUrl = getChatUrl({ chatId: chat.id, projectId: selectedProject, workspaceId: selectedWorkspace ?? workspaceId, userId: userId ?? '' });
            window.history.replaceState(null, "", chatUrl || `/chat/${chat.id}`);
          }
        }
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
        creatingRef.current = false;
        drainQueue();
        return;
      }
      creatingRef.current = false;
    }

    // 3. Save user message to DB
    try {
      const userRes = await authFetch(`/api/chats/${currentChatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", content: fullContent }),
      });

      if (userRes.ok) {
        const saved = await userRes.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === tempUserMsg.id ? { ...m, id: saved.id } : m))
        );
      } else {
        console.error("[ChatWorkspace] Failed to save user message:", userRes.status, await userRes.text().catch(() => ""));
      }
    } catch (err) {
      console.error("[ChatWorkspace] Error saving user message:", err);
    }

    // 4. Add AI placeholder message (loading bubble)
    const tempAiMsg: Message = {
      id: Date.now() + 1,
      role: "assistant",
      content: "",
      streamingThinking: "",
    };
    setMessages((prev) => [...prev, tempAiMsg]);

    // 5. Stream AI response via SSE
    const selectedTemplate = selectedTemplateId
      ? templates.find((tpl) => tpl.id === selectedTemplateId)
      : undefined;

    const systemMsg = buildSystemMessage({
      agentPrompt: selectedTemplate?.agentPrompt,
      templateContent: selectedTemplate?.content,
      projectId: selectedProject,
      projectName,
      openFileTabs,
    });

    // 使用 messagesRef 读取最新消息列表
    const currentMessages = messagesRef.current;
    const allMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      ...(systemMsg ? [systemMsg] : []),
      ...currentMessages.filter((m) => !m.isError).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: fullContent },
    ];

    const result = await streamAiResponse({
      authFetch,
      tempAiMsgId: tempAiMsg.id,
      chatMessages: allMessages,
      setMessages,
      abortControllerRef,
      selectedModelId: selectedModelId!,
      selectedProject,
      selectedWorkspace,
      workspaceId,
      chatId: currentChatId,
      onToolCall,
      t,
    });

    // 6. Save AI message to DB
    if (result.aiContent) {
      const finalThinking = result.aiThinking || null;
      const finalSignature = result.aiSignature ?? null;
      const isErrorMessage = result.hasError;
      const aiRes = await authFetch(`/api/chats/${currentChatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "assistant",
          content: result.aiContent,
          thinking: finalThinking,
          thinkingSignature: finalSignature,
          isError: isErrorMessage,
        }),
      });

      if (aiRes.ok) {
        const savedAi = await aiRes.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempAiMsg.id
              ? {
                  ...m,
                  id: savedAi.id,
                  content: result.aiContent,
                  thinking: savedAi.thinking ?? finalThinking,
                  thinkingSignature: savedAi.thinkingSignature ?? finalSignature,
                  streamingThinking: undefined,
                }
              : m
          )
        );
      }
    }

    // 处理队列中的下一条消息
    drainQueue();
  }, [selectedModelId, selectedProject, selectedTemplateId, selectedWorkspace, workspaceId, embedded, floating, templates, projectName, openFileTabs, router, onChatCreated, onToolCall, setEffectiveChatId, authFetch, t, userId, drainQueue]);

  // 保持 ref 始终指向最新的 processSingleMessage
  useEffect(() => {
    processSingleMessageRef.current = processSingleMessage;
  }, [processSingleMessage]);

  // --- 公共 handleSend：入队判断 + 启动处理 ---
  const handleSend = useCallback(async (content: string) => {
    if (!content.trim()) return;

    if (!selectedModelId) {
      setInputValue(content);
      return;
    }

    const capturedFiles = [...mentionedFiles];
    setInputValue("");
    setMentionedFiles([]);

    if (isProcessingRef.current) {
      // AI 正在响应 → 入队
      queueRef.current.push({
        content: content.trim(),
        mentionedFiles: capturedFiles,
      });
      syncQueueState();
      return;
    }

    // 不在处理 → 直接开始
    isProcessingRef.current = true;
    setLoading(true);
    await processSingleMessage(content.trim(), capturedFiles);
  }, [selectedModelId, mentionedFiles, processSingleMessage, syncQueueState]);

  const handleRemoveFromQueue = useCallback((index: number) => {
    queueRef.current.splice(index, 1);
    syncQueueState();
  }, [syncQueueState]);

  const handleClearQueue = useCallback(() => {
    queueRef.current = [];
    syncQueueState();
  }, [syncQueueState]);

  const handleRegenerate = useCallback(async (aiMsg: Message) => {
    if (!effectiveChatId || isProcessingRef.current || !selectedModelId) return;

    const msgIndex = messages.findIndex((m) => m.id === aiMsg.id);
    const prevUserMsg = messages
      .slice(0, msgIndex)
      .reverse()
      .find((m) => m.role === "user");

    if (!prevUserMsg) return;

    setLoading(true);
    isProcessingRef.current = true;

    setMessages((prev) => prev.filter((m) => m.id !== aiMsg.id));

    authFetch(`/api/chats/${effectiveChatId}/messages/${aiMsg.id}`, {
      method: "DELETE",
    }).catch(() => {});

    const tempAiMsg: Message = {
      id: Date.now(),
      role: "assistant",
      content: "",
      streamingThinking: "",
    };
    setMessages((prev) => [...prev, tempAiMsg]);

    const selectedTemplate = selectedTemplateId
      ? templates.find((t) => t.id === selectedTemplateId)
      : undefined;

    const systemMsg = buildSystemMessage({
      agentPrompt: selectedTemplate?.agentPrompt,
      templateContent: selectedTemplate?.content,
      projectId: selectedProject,
      projectName,
      openFileTabs,
    });

    const historyMsgs: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      ...(systemMsg ? [systemMsg] : []),
      ...messages
        .slice(0, msgIndex)
        .filter((m) => m.id !== aiMsg.id && !m.isError)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    const result = await streamAiResponse({
      authFetch,
      tempAiMsgId: tempAiMsg.id,
      chatMessages: historyMsgs,
      setMessages,
      abortControllerRef,
      selectedModelId,
      selectedProject,
      selectedWorkspace,
      workspaceId,
      chatId: effectiveChatId,
      onToolCall,
      t,
    });

    // Save AI message to DB
    if (result.aiContent) {
      const finalThinking = result.aiThinking || null;
      const finalSignature = result.aiSignature ?? null;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempAiMsg.id
            ? {
                ...m,
                content: result.aiContent,
                thinking: finalThinking,
                thinkingSignature: finalSignature,
                streamingThinking: undefined,
              }
            : m
        )
      );

      try {
        const aiRes = await authFetch(`/api/chats/${effectiveChatId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "assistant",
            content: result.aiContent,
            thinking: finalThinking,
            thinkingSignature: finalSignature,
            isError: result.hasError,
          }),
        });

        if (aiRes.ok) {
          const savedAi = await aiRes.json();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempAiMsg.id
                ? {
                    ...m,
                    id: savedAi.id,
                    content: result.aiContent,
                    thinking: savedAi.thinking ?? finalThinking,
                    thinkingSignature: savedAi.thinkingSignature ?? finalSignature,
                    streamingThinking: undefined,
                  }
                : m
            )
          );
        }
      } catch {
        // DB save failed, content is still visible
      }
    }

    isProcessingRef.current = false;
    setLoading(false);
  }, [effectiveChatId, selectedModelId, messages, selectedTemplateId, templates, selectedProject, selectedWorkspace, workspaceId, projectName, openFileTabs, onToolCall, authFetch, t]);

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    // 清空队列
    queueRef.current = [];
    setQueueSize(0);
    setQueueItems([]);
    isProcessingRef.current = false;
    setLoading(false);

    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === "assistant" && !last.content) {
        return prev.slice(0, -1);
      }
      return prev;
    });
  }, []);

  const handleClear = useCallback(() => {
    queueRef.current = [];
    setQueueSize(0);
    setQueueItems([]);
    isProcessingRef.current = false;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoading(false);
    setMessages([]);
  }, []);

  return {
    messages,
    setMessages,
    inputValue,
    setInputValue,
    loading,
    queueSize,
    queueItems,
    handleRemoveFromQueue,
    handleClearQueue,
    mentionedFiles,
    setMentionedFiles,
    handleSend,
    handleRegenerate,
    handleCancel,
    handleClear,
    abortControllerRef,
  };
}
