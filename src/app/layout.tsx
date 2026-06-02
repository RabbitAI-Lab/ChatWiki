import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { App as AntApp } from "antd";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import ShareLayoutGuard from "@/components/layout/ShareLayoutGuard";
import FloatingChatProvider from "@/components/chat/FloatingChatProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ChatWiki - 文档管理与发布",
  description: "基于文件系统的文档管理与发布平台",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const savedWidth = cookieStore.get("sidebar-width")?.value;
  const savedCollapsed = cookieStore.get("sidebar-collapsed")?.value;

  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full flex bg-white">
        <AntApp className="flex h-full w-full">
          <FloatingChatProvider>
            <ShareLayoutGuard />
            <div data-sidebar>
              <Sidebar initialWidth={savedWidth} initialCollapsed={savedCollapsed} />
            </div>
            <main className="flex-1 h-full overflow-hidden bg-gray-50">
              {children}
            </main>
          </FloatingChatProvider>
        </AntApp>
      </body>
    </html>
  );
}
