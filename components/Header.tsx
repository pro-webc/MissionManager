"use client";

import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";

export function Header() {
  const { data: session, status } = useSession();

  return (
    <header className="border-b border-gray-700 mb-4 sm:mb-6 pb-4 flex flex-row justify-between items-center gap-3 flex-shrink-0 min-h-[3.5rem]">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-100 truncate min-w-0">MissionManagerWeb</h1>
      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
        {status === "loading" && (
          <span className="text-sm text-gray-500">読込中...</span>
        )}
        {status === "authenticated" && session?.user && (
          <>
            <span className="text-sm text-gray-400 truncate max-w-[120px] sm:max-w-[200px] hidden sm:inline" title={session.user.email ?? undefined}>
              {session.user.email}
            </span>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="px-4 py-2.5 min-h-[44px] text-sm border border-gray-600 rounded hover:bg-gray-700 text-gray-200 active:bg-gray-600 touch-manipulation"
            >
              ログアウト
            </button>
          </>
        )}
      </div>
    </header>
  );
}
