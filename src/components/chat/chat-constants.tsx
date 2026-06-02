"use client";

import React from "react";
import { Avatar } from "antd";
import { RobotOutlined, UserOutlined } from "@ant-design/icons";

/**
 * 构建 system message，用于注入模板内容、agent 指令、项目上下文等信息。
 */
export function buildSystemMessage(options: {
  agentPrompt?: string;
  templateContent?: string;
  projectId?: string;
  projectName?: string;
  openFileTabs?: Array<{ fileName: string; filePath: string }>;
}): { role: "system"; content: string } | null {
  const parts: string[] = [];

  if (options.agentPrompt?.trim()) {
    parts.push(`## Agent 指令\n\n${options.agentPrompt.trim()}`);
  }
  if (options.templateContent?.trim()) {
    parts.push(`## 文档模板\n\n${options.templateContent.trim()}`);
  }

  const contextLines: string[] = [];
  if (options.projectId) {
    contextLines.push(`- 项目ID: ${options.projectId}`);
  }
  if (options.projectName) {
    contextLines.push(`- 项目名称: ${options.projectName}`);
  }
  if (options.openFileTabs && options.openFileTabs.length > 0) {
    contextLines.push(`- 已打开的文件:`);
    for (const f of options.openFileTabs) {
      contextLines.push(`  - ${f.fileName} (${f.filePath})`);
    }
  }
  if (contextLines.length > 0) {
    parts.push(`## 当前上下文\n\n${contextLines.join("\n")}`);
  }

  if (parts.length === 0) return null;
  return { role: "system", content: parts.join("\n\n---\n\n") };
}

/**
 * 气泡角色配置（assistant / user）。
 */
export const roles = {
  assistant: {
    placement: "start" as const,
    avatar: <Avatar icon={<RobotOutlined />} style={{ backgroundColor: "#1677ff" }} />,
    variant: "borderless" as const,
    typing: { effect: "typing" as const, step: 5, interval: 50 },
  },
  user: {
    placement: "end" as const,
    avatar: <Avatar icon={<UserOutlined />} />,
    variant: "filled" as const,
  },
};

/**
 * Sender.Switch 样式常量。
 */
export const switchStyles: Record<string, React.CSSProperties> = {
  root: { fontSize: 12, lineHeight: '20px', padding: '0 4px', gap: 2 },
  icon: { fontSize: 12 },
};

/**
 * 消费 SSE 流并按 event/data 协议逐个回调。
 */
export async function consumeSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (eventType: string, data: { type: string; [k: string]: unknown }) => void
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("event: ")) {
        const eventType = line.slice(7).trim();
        const dataLine = lines[i + 1];
        if (dataLine?.startsWith("data: ")) {
          i++;
          try {
            onEvent(eventType, JSON.parse(dataLine.slice(6)));
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  }
}
