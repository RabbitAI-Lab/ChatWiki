"use client";

import { useAuth } from "@/components/auth/useAuth";

interface AuthGateProps {
  children: React.ReactNode;
}

/**
 * Renders children only when user is authenticated.
 * Use for client components that need to skip data fetching on auth pages.
 */
export default function AuthGate({ children }: AuthGateProps) {
  const { user, isLoading } = useAuth();

  if (isLoading || !user) {
    return null;
  }

  return <>{children}</>;
}
