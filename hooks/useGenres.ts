"use client";

import { useState, useEffect, useCallback } from "react";
import type { Genre, Mission } from "@/lib/types";

export function useGenres() {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const updateTaskOptimistic = useCallback(
    (genreId: string, missionId: string, taskId: string, done: boolean, completedAt: string | null) => {
      setGenres((prev) =>
        prev.map((g) => {
          if (g.id !== genreId) return g;
          return {
            ...g,
            missions: (g.missions ?? []).map((m) => {
              if (m.id !== missionId) return m;
              const tasks = (m.tasks ?? []).map((t) =>
                t.id === taskId ? { ...t, done, completedAt } : t
              );
              const doneCount = tasks.filter((t) => t.done).length;
              const missionCompletedAt = doneCount === tasks.length && tasks.length > 0
                ? (completedAt ?? new Date().toISOString().slice(0, 10))
                : null;
              return { ...m, tasks, completedAt: missionCompletedAt };
            }),
          };
        })
      );
    },
    []
  );

  const fetchGenres = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetch("/api/genres", { credentials: "same-origin" });
      if (!res.ok) throw new Error("取得に失敗しました");
      const data = await res.json();
      setGenres(data.genres ?? []);
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "不明なエラー");
      setGenres([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGenres();
  }, [fetchGenres]);

  const refetch = useCallback(() => fetchGenres(false), [fetchGenres]);
  const refetchSilent = useCallback(() => fetchGenres(true), [fetchGenres]);

  return { genres, loading, error, refetch, refetchSilent, updateTaskOptimistic };
}
