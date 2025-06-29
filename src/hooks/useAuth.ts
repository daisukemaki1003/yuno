import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import React from "react";

export function useAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const requireAuth = () => {
    if (status === "loading") return;
    if (!session) {
      router.push("/auth/sign-in");
    }
  };

  useEffect(() => {
    // Auto-redirect effect can be added here if needed
  }, [session, status]);

  return {
    session: session,
    status: status,
    isAuthenticated: !!session,
    isLoading: status === "loading",
    requireAuth,
  };
}

export function withAuth<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  return function AuthenticatedComponent(props: P) {
    const { session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
      if (status === "loading") return;
      if (!session) {
        router.push("/auth/sign-in");
      }
    }, [session, status, router]);

    if (status === "loading") {
      return React.createElement("div", null, "認証状態を確認中...");
    }

    if (!session) {
      return null;
    }

    return React.createElement(Component, props);
  };
}