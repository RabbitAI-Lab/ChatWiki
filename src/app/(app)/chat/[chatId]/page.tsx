import { db } from "@/db";
import { chats, chatMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/tokens";
import ChatPageContent from "@/components/chat/ChatPageContent";
import { canAccessChat } from "@/lib/auth/chat-access";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;

  // 验证用户身份
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;
  let currentUserId: string | null = null;
  if (accessToken) {
    const payload = await verifyToken(accessToken);
    if (payload && payload.type === "access") {
      currentUserId = payload.sub;
    }
  }

  // 查询 chat，通过 canAccessChat 做权限检查
  const chat = db.select().from(chats).where(eq(chats.id, parseInt(chatId))).get();
  if (!chat) notFound();

  if (currentUserId) {
    const auth = { id: currentUserId, isAdmin: false };
    if (!canAccessChat(auth, chat)) notFound();
  } else {
    // 未登录用户只可见旧数据（userId 为 null）
    if (chat.userId) notFound();
  }

  // 如果 chat 有 projectId，重定向到项目详情页
  if (chat.projectId && currentUserId) {
    redirect(`/project/${chat.projectId}?chatId=${chat.id}`);
  }

  // 如果 chat 仅 workspaceId，重定向到工作区详情页
  if (chat.workspaceId && currentUserId) {
    redirect(`/workspace/${chat.workspaceId}?chatId=${chat.id}`);
  }

  // 孤立 chat（无 projectId 和 workspaceId）：保留原有的独立页面渲染
  const messages = db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatId, parseInt(chatId)))
    .all();

  return (
    <ChatPageContent
      key={chat.id}
      chatId={chat.id}
      chatTitle={chat.title}
      initialMessages={messages.map((m) => ({ ...m, isError: !!m.isError }))}
      initialModelId={chat.modelId ?? undefined}
      initialTemplateId={chat.templateId ?? undefined}
    />
  );
}
