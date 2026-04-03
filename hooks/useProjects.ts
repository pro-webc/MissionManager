"use client";

import { useState, useEffect, useCallback } from "react";
import type { Project } from "@/lib/types";

export function useProjects(departmentId: string | null) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const updateSubTaskOptimistic = useCallback(
    (projectId: string, mainTaskId: string, subTaskId: string, done: boolean, completedAt: string | null) => {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            mainTasks: (p.mainTasks ?? []).map((m) => {
              if (m.id !== mainTaskId) return m;
              const subTasks = (m.subTasks ?? []).map((t) =>
                t.id === subTaskId ? { ...t, done, completedAt } : t
              );
              const doneCount = subTasks.filter((t) => t.done).length;
              const mainTaskCompletedAt = doneCount === subTasks.length && subTasks.length > 0
                ? (completedAt ?? new Date().toISOString().slice(0, 10))
                : null;
              return { ...m, subTasks, completedAt: mainTaskCompletedAt };
            }),
          };
        })
      );
    },
    []
  );

  const fetchProjects = useCallback(async (silent = false) => {
    if (!departmentId) {
      setProjects([]);
      if (!silent) setLoading(false);
      return;
    }
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetch(`/api/projects?departmentId=${departmentId}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error("取得に失敗しました");
      const data = await res.json();
      setProjects(data.projects ?? []);
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "不明なエラー");
      setProjects([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const refetch = useCallback(() => fetchProjects(false), [fetchProjects]);
  const refetchSilent = useCallback(() => fetchProjects(true), [fetchProjects]);

  return { projects, loading, error, refetch, refetchSilent, updateSubTaskOptimistic };
}
