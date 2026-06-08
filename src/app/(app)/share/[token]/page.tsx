import { db } from "@/db";
import { sharedChats, chats, chatMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import SharedChatView from "@/components/chat/SharedChatView";
import { getBrandName } from "@/lib/auth/settings";

export default async function SharedChatPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [share] = await db
    .select()
    .from(sharedChats)
    .where(eq(sharedChats.token, token));
  if (!share) notFound();

  const [chat] = await db.select().from(chats).where(eq(chats.id, share.chatId));
  if (!chat) notFound();

  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatId, chat.id));

  return (
    <SharedChatView
      title={chat.title}
      messages={messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      }))}
      brandName={await getBrandName()}
    />
  );
}
