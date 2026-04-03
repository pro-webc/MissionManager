"use client";

import { useState, useEffect, useCallback } from "react";
import type { Department } from "@/lib/types";

export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDepartments = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetch("/api/departments", { credentials: "same-origin" });
      if (!res.ok) throw new Error("取得に失敗しました");
      const data = await res.json();
      setDepartments(data.departments ?? []);
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "不明なエラー");
      setDepartments([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const refetch = useCallback(() => fetchDepartments(false), [fetchDepartments]);

  return { departments, loading, error, refetch };
}
