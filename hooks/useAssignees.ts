"use client";

import { useState, useEffect, useCallback } from "react";
import type { Assignee } from "@/lib/types";

export function useAssignees() {
  const [assignees, setAssignees] = useState<Assignee[]>([]);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch("/api/assignees", { credentials: "same-origin" });
      if (!res.ok) return;
      const data = await res.json();
      setAssignees(data.assignees ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  const addAssignee = async (name: string): Promise<Assignee | null> => {
    try {
      const res = await fetch("/api/assignees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const newAssignee: Assignee = data.assignee;
      setAssignees((prev) => [...prev, newAssignee].sort((a, b) => a.name.localeCompare(b.name)));
      return newAssignee;
    } catch {
      return null;
    }
  };

  const deleteAssignee = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/assignees/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) return false;
      setAssignees((prev) => prev.filter((a) => a.id !== id));
      return true;
    } catch {
      return false;
    }
  };

  return { assignees, refetch: fetch_, addAssignee, deleteAssignee };
}
