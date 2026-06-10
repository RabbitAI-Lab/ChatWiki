"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/useAuth";
import { App, Tabs, Popconfirm } from "antd";
import { CopyOutlined, EyeOutlined, EyeInvisibleOutlined, ReloadOutlined, RobotOutlined, CodeOutlined, SwapOutlined } from "@ant-design/icons";
import UserMcpSection from "@/components/mcp/user-mcp-section";
import { COMING_SOON_CATALOG } from "@/components/mcp/coming-soon-catalog";

// ── Section Header ──
function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
      )}
    </div>
  );
}

// ── MCP Key Data ──
interface McpKeyData {
  key: string;
  prefix: string;
  createdAt: string;
}

// ── RabbitDocs MCP Card ──
function RabbitDocsMcpCard() {
  const t = useTranslations("integrationsPage");
  const { authFetch } = useAuth();
  const { message } = App.useApp();

  const [brandName, setBrandName] = useState("RabbitDocs");
  const [keyData, setKeyData] = useState<McpKeyData | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [activeTab, setActiveTab] = useState("claude");
  const [showRawConfig, setShowRawConfig] = useState(false);

  useEffect(() => {
    authFetch("/api/brand").then((res) =>
      res.json().then((data) => setBrandName(data.brandName || "RabbitDocs"))
    );
  }, [authFetch]);

  const loadKey = useCallback(async () => {
    try {
      const res = await authFetch("/api/auth/mcp-key");
      if (res.ok) {
        const json = await res.json();
        setKeyData(json);
      }
    } catch {
      // ignore
    }
  }, [authFetch]);

  useEffect(() => {
    Promise.resolve().then(() => loadKey());
  }, [loadKey]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await authFetch("/api/auth/mcp-key", { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        setKeyData(json);
        setRevealed(true);
        message.success(t("keyRegenerated"));
      }
    } catch {
      message.error(t("operationFailed"));
    } finally {
      setRegenerating(false);
    }
  };

  const maskKey = (key: string) => {
    if (key.length <= 12) return key;
    return key.slice(0, 8) + "****" + key.slice(-4);
  };

  const mcpUrl = useMemo(() => `${window.location.origin}/mcp`, []);
  const apiKey = keyData?.key || "atm_xxxx";

  // ── IDE Config Types ──
  type IdeConfigJson = { type: "json"; label: string; file: string; json: string; filePath: string; isGuiOnly?: boolean };
  type IdeConfigSteps = { type: "steps"; label: string; steps: string[] };
  type IdeConfigEntry = IdeConfigJson | IdeConfigSteps;

  const configs: Record<string, IdeConfigEntry> = {
    claude: {
      type: "json",
      label: t("claudeDesktop"),
      file: t("claudeDesktopFile"),
      filePath: "~/Library/Application Support/Claude/claude_desktop_config.json",
      json: JSON.stringify(
        {
          mcpServers: {
            rabbitdocs: {
              type: "http",
              url: mcpUrl,
              headers: { Authorization: `Bearer ${apiKey}` },
            },
          },
        },
        null,
        2
      ),
    },
    cursor: {
      type: "json",
      label: t("cursor"),
      file: t("cursorFile"),
      filePath: ".cursor/mcp.json",
      json: JSON.stringify(
        {
          servers: {
            rabbitdocs: {
              type: "http",
              url: mcpUrl,
              headers: { Authorization: `Bearer ${apiKey}` },
            },
          },
        },
        null,
        2
      ),
    },
    vscode: {
      type: "json",
      label: t("vscode"),
      file: t("vscodeFile"),
      filePath: ".vscode/mcp.json",
      json: JSON.stringify(
        {
          servers: {
            rabbitdocs: {
              type: "http",
              url: mcpUrl,
              headers: { Authorization: `Bearer ${apiKey}` },
            },
          },
        },
        null,
        2
      ),
    },
    trae: {
      type: "json",
      label: t("trae"),
      file: t("traeFile"),
      filePath: ".trae/mcp.json",
      json: JSON.stringify(
        {
          mcpServers: {
            rabbitdocs: {
              type: "http",
              url: mcpUrl,
              headers: { Authorization: `Bearer ${apiKey}` },
            },
          },
        },
        null,
        2
      ),
    },
    qoder: {
      type: "json",
      label: t("qoder"),
      file: t("qoderFile"),
      filePath: "",
      isGuiOnly: true,
      json: JSON.stringify(
        {
          mcpServers: {
            rabbitdocs: {
              type: "sse",
              url: mcpUrl,
              headers: { Authorization: `Bearer ${apiKey}` },
            },
          },
        },
        null,
        2
      ),
    },
    lovable: {
      type: "steps",
      label: t("lovable"),
      steps: [
        t("lovableStep1"),
        t("lovableStep2"),
        t("lovableStep3"),
        t("lovableStep4"),
        t("lovableStep5"),
        t("lovableStep6"),
      ],
    },
    bolt: {
      type: "steps",
      label: t("bolt"),
      steps: [
        t("boltStep1"),
        t("boltStep2"),
        t("boltStep3"),
        t("boltStep4"),
        t("boltStep5"),
        t("boltStep6"),
        t("boltStep7"),
      ],
    },
    v0: {
      type: "steps",
      label: t("v0Tab"),
      steps: [
        t("v0Step1"),
        t("v0Step2"),
        t("v0Step3"),
        t("v0Step4"),
        t("v0Step5"),
        t("v0Step6"),
      ],
    },
    replit: {
      type: "steps",
      label: t("replit"),
      steps: [
        t("replitStep1"),
        t("replitStep2"),
        t("replitStep3"),
        t("replitStep4"),
        t("replitStep5"),
        t("replitStep6"),
      ],
    },
    workbuddy: {
      type: "steps",
      label: t("workbuddy"),
      steps: [
        t("workbuddyStep1"),
        t("workbuddyStep2"),
        t("workbuddyStep3"),
        t("workbuddyStep4"),
        t("workbuddyStep5"),
        t("workbuddyStep6"),
      ],
    },
  };

  const copyToClipboard = (text: string, successMsg: string) => {
    navigator.clipboard.writeText(text);
    message.success(successMsg);
  };

  const getLocale = () => {
    if (typeof document === "undefined") return "zh";
    const match = document.cookie.match(/NEXT_LOCALE=(\w+)/);
    return match?.[1] || "zh";
  };

  const generateAiPrompt = (cfg: IdeConfigJson): string => {
    const locale = getLocale();
    if (cfg.isGuiOnly) {
      return locale === "zh"
        ? `请帮我在 ${cfg.label} 中配置 ${brandName} 的 MCP 服务器。\n\n操作方式：\n在 ${cfg.file} 中添加以下配置：\n${cfg.json}\n\n请按照上述 JSON 内容，在 MCP 设置界面中添加对应的服务器条目。服务器名称为 "rabbitdocs"。`
        : `Please help me configure the ${brandName} MCP server in ${cfg.label}.\n\nSteps:\nAdd the following configuration in ${cfg.file}:\n${cfg.json}\n\nAdd a new server entry named "rabbitdocs" with the above configuration in the MCP settings panel.`;
    }
    return locale === "zh"
      ? `请帮我配置 ${brandName} 的 MCP 服务器。\n\n操作步骤：\n1. 读取或创建配置文件：${cfg.filePath}\n2. 如果文件已存在，将以下 JSON 配置合并到现有配置中（注意保留已有配置，仅添加或更新 "rabbitdocs" 条目）\n3. 如果文件不存在，直接创建并写入以下完整内容\n\n需要写入的配置内容：\n${cfg.json}\n\n注意事项：\n- 如果已有 "rabbitdocs" 条目，请替换为上述配置\n- 请确保 JSON 格式正确\n- 完成后请确认配置已写入`
      : `Please help me configure the ${brandName} MCP server.\n\nSteps:\n1. Read or create the config file: ${cfg.filePath}\n2. If the file already exists, merge the following JSON config into it (preserve existing entries, only add or update the "rabbitdocs" entry)\n3. If the file does not exist, create it with the following content\n\nConfig to write:\n${cfg.json}\n\nNotes:\n- If a "rabbitdocs" entry already exists, replace it with the above config\n- Ensure valid JSON format\n- Confirm the configuration has been written when done`;
  };

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50/80 to-white dark:from-blue-900/20 dark:to-[var(--background)] p-5">
      {/* Title */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-blue-500 text-white flex items-center justify-center text-lg">
          🐰
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {t("rabbitdocsTitle", { brandName })}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("rabbitdocsDesc")}
          </p>
        </div>
      </div>

      {/* Endpoint URL */}
      <div className="mb-3">
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          {t("mcpEndpoint")}
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-sm bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 font-mono text-gray-700 dark:text-gray-300 select-all">
            {mcpUrl}
          </code>
          <button
            onClick={() => copyToClipboard(mcpUrl, t("configCopied"))}
            className="shrink-0 p-2 rounded-lg border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
          >
            <CopyOutlined className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* API Key */}
      <div className="mb-4">
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          {t("mcpApiKey")}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-sm bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 font-mono text-gray-700 dark:text-gray-300 select-all">
            {keyData ? (revealed ? keyData.key : maskKey(keyData.key)) : "..."}
          </code>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setRevealed((v) => !v)}
              className="px-2 py-1 text-xs rounded-md border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
            >
              {revealed ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            </button>
            <button
              onClick={() => keyData && copyToClipboard(keyData.key, t("keyCopied"))}
              className="px-2 py-1 text-xs rounded-md border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
            >
              <CopyOutlined />
            </button>
            <Popconfirm
              title={t("regenerateConfirm")}
              description={t("regenerateDesc")}
              onConfirm={handleRegenerate}
              okButtonProps={{ danger: true }}
            >
              <button
                className="px-2 py-1 text-xs rounded-md border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                disabled={regenerating}
              >
                <ReloadOutlined spin={regenerating} />
              </button>
            </Popconfirm>
          </div>
        </div>
        {keyData?.createdAt && (
          <div className="text-xs text-gray-400 mt-1">
            {t("keyCreatedAt")}: {new Date(keyData.createdAt).toLocaleString()}
          </div>
        )}
      </div>

      {/* IDE Config Tabs */}
      <div className="border-t border-gray-200 dark:border-zinc-700 pt-4">
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
          {t("ideConfig")}
        </div>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="small"
          items={Object.entries(configs).map(([key, cfg]) => ({
            key,
            label: cfg.label,
            children: cfg.type === "json" ? (
              <div>
                {/* Toggle between AI Prompt and Raw Config */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    {showRawConfig ? <CodeOutlined className="text-xs text-gray-500" /> : <RobotOutlined className="text-xs text-blue-500" />}
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      {showRawConfig ? t("rawConfigTitle") : t("aiInstallTitle")}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowRawConfig((v) => !v)}
                    className="flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <SwapOutlined className="text-[10px]" />
                    {showRawConfig ? t("switchToAiPrompt") : t("switchToRawConfig")}
                  </button>
                </div>
                {!showRawConfig ? (
                  // AI Install Prompt (default)
                  <>
                    <div className="text-[11px] text-gray-400 dark:text-gray-500 mb-1.5">
                      {t("aiInstallDesc")}
                    </div>
                    <div className="relative">
                      <pre className="text-xs bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-lg p-3 overflow-x-auto font-mono text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                        {generateAiPrompt(cfg)}
                      </pre>
                      <button
                        onClick={() => copyToClipboard(generateAiPrompt(cfg), t("aiPromptCopied"))}
                        className="absolute top-2 right-2 p-1.5 rounded-md bg-white dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-600 transition-colors"
                      >
                        <CopyOutlined className="text-xs text-gray-500" />
                      </button>
                    </div>
                  </>
                ) : (
                  // Raw JSON Config
                  <>
                    <div className="text-xs text-gray-400 mb-1">{cfg.file}</div>
                    <div className="relative">
                      <pre className="text-xs bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg p-3 overflow-x-auto font-mono text-gray-600 dark:text-gray-300">
                        {cfg.json}
                      </pre>
                      <button
                        onClick={() => copyToClipboard(cfg.json, t("configCopied"))}
                        className="absolute top-2 right-2 p-1.5 rounded-md bg-white dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-600 transition-colors"
                      >
                        <CopyOutlined className="text-xs text-gray-500" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-300 pl-1">
                {cfg.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            ),
          }))}
        />
      </div>
    </div>
  );
}

// ── Coming Soon Card ──
function ComingSoonCard({ entry }: { entry: (typeof COMING_SOON_CATALOG)[number] }) {
  const t = useTranslations("integrationsPage");
  return (
    <div className="rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-[var(--background)] p-4 opacity-60 relative">
      <div className="absolute top-2 right-2">
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-700 text-gray-400 dark:text-gray-500 font-medium">
          {t("comingSoon")}
        </span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{entry.icon}</span>
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
          {t(entry.nameKey as Parameters<typeof t>[0])}
        </span>
      </div>
      <div className="text-xs text-gray-400 dark:text-gray-500">
        {t(entry.descriptionKey as Parameters<typeof t>[0])}
      </div>
      <div className="mt-2">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-700 text-gray-400 dark:text-gray-500">
          {t(entry.categoryKey as Parameters<typeof t>[0])}
        </span>
      </div>
    </div>
  );
}

// ── Main Page ──
export default function IntegrationsPage() {
  const t = useTranslations("integrationsPage");

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t("subtitle")}
        </p>
      </div>

      <div className="space-y-10">
        {/* Section 1: AI Assistant Integrations */}
        <section>
          <SectionHeader
            title={t("aiAssistantSection")}
            description={t("aiAssistantDesc")}
          />
          <RabbitDocsMcpCard />
        </section>

        {/* Section 2: Third-Party MCP */}
        <section>
          <SectionHeader title={t("thirdPartyMcpSection")} />
          <UserMcpSection />
        </section>

        {/* Section 3: More Integrations (Coming Soon) */}
        <section>
          <SectionHeader
            title={t("moreSection")}
            description={t("moreDesc")}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {COMING_SOON_CATALOG.map((entry) => (
              <ComingSoonCard key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
