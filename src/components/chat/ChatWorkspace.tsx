"use client";

import { useState, forwardRef, useImperativeHandle, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bubble, Sender, XProvider, Suggestion } from "@ant-design/x";
import { ClockCircleOutlined, CloseOutlined, FileOutlined } from "@ant-design/icons";
import { Tag } from "antd";
import type { Message, ChatWorkspaceProps, ChatWorkspaceRef } from "./chat-workspace-ref";
export type { Message, ChatWorkspaceProps, ChatWorkspaceRef } from "./chat-workspace-ref";
import { roles } from "./chat-constants";
import { useChatSelectors } from "./useChatSelectors";
import { useChatShare } from "./useChatShare";
import { useChatNavigation } from "./useChatNavigation";
import { useChatMessages } from "./useChatMessages";
import { useAuth } from "@/components/auth/useAuth";
import { flattenFileNodes } from "@/lib/tree";
import { mapMessagesToBubbleItems } from "./ChatBubbleItem";
import ChatInputFooter from "./ChatInputFooter";
import ChatHeader from "./ChatHeader";
import ChatWelcome from "./ChatWelcome";
import SaveToDocumentModal from "./SaveToDocumentModal";

const ChatWorkspace = forwardRef<ChatWorkspaceRef, ChatWorkspaceProps>(function ChatWorkspace({
  chatId,
  chatTitle,
  initialMessages,
  initialModelId,
  initialTemplateId,
  embedded = false,
  projectId: initialProjectId,
  projectName,
  openFileTabs,
  onBack,
  onDocumentSaved,
  mentionFile,
  onMentionConsumed,
  onToolCall,
  onSwitchToChat,
  onNewChat,
  onChatCreated,
  floating = false,
  showProjectSelector = false,
  workspaceId,
  onRefStateChange,
  fileTree,
}, ref) {
  console.log('[ChatWorkspace] render, fileTree:', fileTree?.length ?? 'undefined');
  const router = useRouter();
  const t = useTranslations("chat");
  const { user, authFetch } = useAuth();
  const [effectiveChatId, setEffectiveChatId] = useState<number | null>(chatId ?? null);
  const [effectiveChatTitle, setEffectiveChatTitle] = useState<string>(chatTitle);

  // Data loading + selection persistence
  const selectors = useChatSelectors({
    initialModelId,
    initialTemplateId,
    initialProjectId,
    workspaceId,
    effectiveChatId,
  });

  // Share management
  const share = useChatShare({ effectiveChatId });

  // Message state + streaming (handles send, regenerate, cancel, clear)
  const messagesApi = useChatMessages({
    effectiveChatId,
    setEffectiveChatId,
    initialMessages,
    selectedModelId: selectors.selectedModelId,
    selectedProject: selectors.selectedProject,
    selectedWorkspace: selectors.selectedWorkspace,
    workspaceId,
    selectedTemplateId: selectors.selectedTemplateId,
    templates: selectors.templates,
    projectName,
    openFileTabs,
    embedded,
    floating,
    router,
    onChatCreated,
    onToolCall,
    mentionFile,
    onMentionConsumed,
    userId: user?.id,
  });

  // Navigation (loadChat, history select, new chat)
  const navigation = useChatNavigation({
    effectiveChatId,
    setEffectiveChatId,
    setEffectiveChatTitle,
    setMessages: messagesApi.setMessages,
    setInputValue: messagesApi.setInputValue,
    selectedProject: selectors.selectedProject,
    selectedWorkspace: selectors.selectedWorkspace,
    setSelectedModelId: selectors.setSelectedModelId,
    setSelectedTemplateId: selectors.setSelectedTemplateId,
    setSelectedProject: selectors.setSelectedProject,
    setSelectedWorkspace: selectors.setSelectedWorkspace,
    embedded,
    floating,
    router,
    onSwitchToChat,
    authFetch,
  });

  // Save to document modal state
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveModalContent, setSaveModalContent] = useState("");

  const handleSaveSingleMessage = (msg: Message) => {
    const roleLabel = msg.role === "user" ? t("roleLabels.user") : t("roleLabels.assistant");
    const content = `### ${roleLabel}\n\n${msg.content}`;
    setSaveModalContent(content);
    setSaveModalOpen(true);
  };

  const handleSaved = (_docPath: string) => {
    setSaveModalOpen(false);
    onDocumentSaved?.();
  };

  // Expose ref methods
  useImperativeHandle(ref, () => ({
    handleNewChat: navigation.handleNewChat,
    handleHistorySelect: navigation.handleHistorySelect,
    handleShare: share.handleShare,
    get effectiveChatId() { return effectiveChatId; },
    get shareOpen() { return share.shareOpen; },
    setShareOpen: share.setShareOpen,
    get shareToken() { return share.shareToken; },
    get shareLoading() { return share.shareLoading; },
    handleCopyLink: share.handleCopyLink,
    handleRegenerateLink: share.handleRegenerateLink,
    handleCancelShare: share.handleCancelShare,
  }), [effectiveChatId, share.shareOpen, share.shareToken, share.shareLoading, share.handleShare, share.setShareOpen, share.handleCopyLink, share.handleRegenerateLink, share.handleCancelShare, navigation.handleNewChat, navigation.handleHistorySelect]);

  // Notify parent of state changes for floating window
  useEffect(() => {
    onRefStateChange?.({ effectiveChatId, shareOpen: share.shareOpen, shareToken: share.shareToken, shareLoading: share.shareLoading });
  }, [onRefStateChange, effectiveChatId, share.shareOpen, share.shareToken, share.shareLoading]);

  // Resolve display names for the welcome context strip
  const effectiveProjectName =
    (selectors.selectedProject
      ? selectors.projects.find((p) => p.id === selectors.selectedProject)?.name
      : undefined) ??
    (selectors.selectedWorkspace
      ? selectors.workspaces.find((w) => w.id === selectors.selectedWorkspace)?.name
      : undefined) ??
    projectName;
  const effectiveModelName = selectors.selectedModelId
    ? (typeof selectors.selectedModelId === 'string' && selectors.selectedModelId.startsWith('byok_')
        ? selectors.userModels.find((m) => `byok_${m.id}` === selectors.selectedModelId)?.modelName
        : selectors.models.find((m) => m.id === selectors.selectedModelId)?.modelName)
    : undefined;
  const isEmpty = messagesApi.messages.length === 0 && !floating;

  // --- File mention via Suggestion ---
  const allFileItems = useMemo(() => {
    if (!fileTree || fileTree.length === 0) return [];
    const flat = flattenFileNodes(fileTree);
    console.log('[Suggestion] fileTree items:', flat.length);
    return flat.map(({ name, path }) => ({
      label: name,
      value: path,
      icon: <FileOutlined style={{ fontSize: 12 }} />,
      extra: path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : undefined,
    }));
  }, [fileTree]);

  const atIndexRef = useRef<number | null>(null);

  const getSuggestionItems = useCallback((_info?: unknown): Array<{ label: string; value: string; icon?: React.ReactNode; extra?: string }> => {
    if (atIndexRef.current === null || !messagesApi.inputValue) return allFileItems;
    const query = messagesApi.inputValue.substring(atIndexRef.current + 1).toLowerCase();
    if (!query) return allFileItems;
    return allFileItems.filter(
      (item) => item.label.toLowerCase().includes(query) || item.value.toLowerCase().includes(query),
    );
  }, [allFileItems, messagesApi.inputValue]);

  // Footer renderer
  const renderFooter = ChatInputFooter({
    floating,
    embedded,
    showProjectSelector,
    models: selectors.models,
    userModels: selectors.userModels,
    projects: selectors.projects,
    workspaces: selectors.workspaces,
    templates: selectors.templates,
    selectedModelId: selectors.selectedModelId,
    selectedProject: selectors.selectedProject,
    selectedWorkspace: selectors.selectedWorkspace,
    selectedTemplateId: selectors.selectedTemplateId,
    onModelChange: selectors.handleModelChange,
    onProjectChange: selectors.handleProjectChange,
    onWorkspaceChange: selectors.handleWorkspaceChange,
    onTemplateChange: selectors.handleTemplateChange,
  });

  // Build bubble items
  const bubbleItems = mapMessagesToBubbleItems({
    messages: messagesApi.messages,
    loading: messagesApi.loading,
    onRegenerate: messagesApi.handleRegenerate,
    onSaveSingleMessage: handleSaveSingleMessage,
    t,
  });

  return (
    <XProvider>
    <div className="flex flex-col h-full">
      {/* Header - hidden in floating mode, rendered by FloatingChatWindow */}
      {!floating && (
        <ChatHeader
          effectiveChatTitle={effectiveChatTitle}
          effectiveChatId={effectiveChatId}
          embedded={embedded}
          onBack={onBack}
          onNewChat={onNewChat ?? navigation.handleNewChat}
          shareOpen={share.shareOpen}
          setShareOpen={share.setShareOpen}
          shareToken={share.shareToken}
          shareLoading={share.shareLoading}
          onShare={share.handleShare}
          onCopyLink={share.handleCopyLink}
          onRegenerateLink={share.handleRegenerateLink}
          onCancelShare={share.handleCancelShare}
          onHistorySelect={navigation.handleHistorySelect}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Welcome surface — only when chat is empty (and not floating) */}
        {isEmpty ? (
          <div className="flex-1 min-h-0">
            <ChatWelcome
              projectName={effectiveProjectName}
              hasProject={Boolean(selectors.selectedProject || selectors.selectedWorkspace || projectName)}
              hasModel={Boolean(selectors.selectedModelId)}
              modelName={effectiveModelName}
              onPromptSelect={(prompt) => messagesApi.setInputValue(prompt)}
            />
          </div>
        ) : (
          <>
            {/* Messages area */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <Bubble.List
                style={{ height: "100%", maxWidth: '48rem', margin: '0 auto' }}
                items={bubbleItems}
                role={roles}
                autoScroll
              />
            </div>
          </>
        )}

        {/* Input */}
        <div className="px-4 py-3 shrink-0">
          <div className="max-w-3xl mx-auto">
            {/* Queue indicator */}
            {messagesApi.queueSize > 0 && (
              <div
                className="rounded-md border mb-2"
                style={{
                  borderColor: 'var(--ant-color-primary)',
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  color: 'var(--ant-color-primary)',
                }}
              >
                <div className="flex items-center gap-2 text-xs px-3 pt-2 pb-1">
                  <ClockCircleOutlined spin />
                  <span>{t('queue.pending', { count: messagesApi.queueSize })}</span>
                </div>
                <div className="flex flex-col gap-1 px-3 pb-2">
                  {messagesApi.queueItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 text-xs rounded px-2 py-1"
                      style={{
                        color: 'var(--ant-color-text)',
                      }}
                    >
                      <span
                        className="flex-1 min-w-0"
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={item.content}
                      >
                        {item.content}
                      </span>
                      <button
                        onClick={() => messagesApi.handleRemoveFromQueue(index)}
                        className="shrink-0 transition-colors leading-none"
                        style={{ color: 'var(--ant-color-text-quaternary)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ant-color-error)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ant-color-text-quaternary)')}
                        title={t('queue.remove')}
                      >
                        <CloseOutlined style={{ fontSize: 10 }} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Suggestion
              // @ts-expect-error Suggestion Omit 了 showSearch 但运行时会透传给 Cascader，防止 BaseSelect 拦截空格键
              showSearch
              items={getSuggestionItems}
              onSelect={(value) => {
                messagesApi.setMentionedFiles((prev) =>
                  prev.includes(value) ? prev : [...prev, value],
                );
                // Remove the @query text from input
                if (atIndexRef.current !== null) {
                  const before = messagesApi.inputValue.substring(0, atIndexRef.current);
                  const afterCursor = atIndexRef.current + 1;
                  // Find where the query ends (end of input or next space)
                  const rest = messagesApi.inputValue.substring(afterCursor);
                  const match = rest.match(/^[^\s]*/);
                  const queryLen = match ? match[0].length : 0;
                  const after = messagesApi.inputValue.substring(afterCursor + queryLen);
                  messagesApi.setInputValue(before + after);
                }
                atIndexRef.current = null;
              }}
              onOpenChange={(open) => {
                if (!open) atIndexRef.current = null;
              }}
              styles={{ popup: { maxHeight: 280 } }}
            >
              {({ onTrigger, onKeyDown: suggestionOnKeyDown, open }) => (
                <Sender
                  value={messagesApi.inputValue}
                  onChange={(val) => {
                    messagesApi.setInputValue(val);
                    // Detect @ trigger
                    if (allFileItems.length === 0) return;

                    const hasAt = val.includes('@');

                    if (open) {
                      // Panel is open
                      if (!hasAt || (atIndexRef.current !== null && val[atIndexRef.current] !== '@')) {
                        // User deleted the @, close
                        atIndexRef.current = null;
                        onTrigger(false);
                        return;
                      }
                      // Update filtered items as user types
                      if (atIndexRef.current !== null) {
                        onTrigger();
                      }
                    } else {
                      // Panel is closed – check if @ exists
                      if (hasAt) {
                        // Find the LAST @ that doesn't have a space after it (still typing query)
                        const idx = val.lastIndexOf('@');
                        // Only trigger if the @ is at end or followed by non-space chars
                        const afterAt = val.substring(idx + 1);
                        if (!afterAt.includes(' ')) {
                          console.log('[Suggestion] trigger at index:', idx, 'val:', val);
                          atIndexRef.current = idx;
                          onTrigger();
                        }
                      }
                    }
                  }}
                  onSubmit={messagesApi.handleSend}
                  loading={messagesApi.loading}
                  onCancel={messagesApi.handleCancel}
                  onKeyDown={(e) => {
                    // When suggestion panel is open, route keys to Suggestion
                    if (open) {
                      suggestionOnKeyDown(e);
                      // If Suggestion handled the key (Enter/Escape/Arrows → e.defaultPrevented), stop Sender processing
                      if (e.defaultPrevented) return false;
                      return;
                    }
                    if (
                      messagesApi.loading &&
                      e.key === 'Enter' &&
                      !e.shiftKey &&
                      !(e.ctrlKey || e.altKey || e.metaKey) &&
                      !e.nativeEvent.isComposing &&
                      messagesApi.inputValue.trim()
                    ) {
                      e.preventDefault();
                      messagesApi.handleSend(messagesApi.inputValue);
                      return false;
                    }
                  }}
                  placeholder={t('input.placeholder')}
                  autoSize={
                    messagesApi.messages.length === 0 && !floating
                      ? { minRows: 2, maxRows: 6 }
                      : { minRows: 1, maxRows: 4 }
                  }
                  suffix={false}
                  header={
                    messagesApi.mentionedFiles.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "6px 12px" }}>
                        {messagesApi.mentionedFiles.map((filePath) => {
                          const fileName = filePath.split("/").pop() || filePath;
                          return (
                            <Tag
                              key={filePath}
                              closable
                              onClose={() =>
                                messagesApi.setMentionedFiles((prev) =>
                                  prev.filter((f) => f !== filePath)
                                )
                              }
                              style={{ margin: 0 }}
                            >
                              @{fileName}
                            </Tag>
                          );
                        })}
                      </div>
                    ) : false
                  }
                  styles={{ root: { backgroundColor: 'var(--sender-bg)' } }}
                  footer={renderFooter}
                />
              )}
            </Suggestion>
          </div>
        </div>

        {/* Bottom spacer — small fixed gap in empty state, collapses once conversation starts */}
        <div
          style={{
            flex: isEmpty ? '0 0 0px' : '0 0 0px',
            height: isEmpty ? 0 : 0,
            minHeight: 0,
            transition: 'height 0.5s ease',
          }}
        />
      </div>
    </div>
    <SaveToDocumentModal
      open={saveModalOpen}
      projectId={selectors.selectedProject}
      content={saveModalContent}
      onClose={() => setSaveModalOpen(false)}
      onSaved={handleSaved}
    />
    </XProvider>
  );
});

export default ChatWorkspace;
