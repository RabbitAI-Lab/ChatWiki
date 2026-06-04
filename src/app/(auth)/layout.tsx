import type { Metadata } from "next";
import { getBrandName } from "@/lib/auth/settings";

export async function generateMetadata(): Promise<Metadata> {
  const brandName = getBrandName();
  return {
    title: `${brandName} - Auth`,
  };
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md px-4">{children}</div>
    </div>
  );
}
