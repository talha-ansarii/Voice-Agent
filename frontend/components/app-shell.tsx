"use client";

import { SessionProvider } from "next-auth/react";
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { PageContainer } from "@/components/page-container";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  return (
    <SessionProvider>
      <div className="flex min-h-screen flex-col bg-surface">
        {!isLogin && <AppHeader />}
        <main className="flex-1 overflow-y-auto">
          {isLogin ? children : <PageContainer>{children}</PageContainer>}
        </main>
      </div>
    </SessionProvider>
  );
}
