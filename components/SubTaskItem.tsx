"use client";

import { useState, useEffect } from "react";
import { formatDateJp } from "@/lib/types";
import { EditTextModal } from "./EditTextModal";
import { EditDateModal } from "./EditDateModal";
import { AlertModal } from "./AlertModal";
import { ContextMenu } from "./ContextMenu";
import type { SubTask } from "@/lib/types";

function toDateInputValue(v: string | null | undefined): string {
  if (!v) return "";
  const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

interface SubTaskItemProps {
  subTask: SubTask;
  mainTaskId: string;
  projectId?: string;
  onChanged?: () => void;
  updateSubTaskOptimistic?: (projectId: string, mainTaskId: string, subTaskId: string, done: boolean, completedAt: string | null) => void;
}

export function SubTaskItem({ subTask, mainTaskId, projectId, onChanged, updateSubTaskOptimistic }: SubTaskItemProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showDueModal, setShowDueModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [optimisticDone, setOptimisticDone] = useState<boolean | null>(null);

  const displayedDone = optimisticDone ?? subTask.done;
  useEffect(() => {
    if (optimisticDone !== null && subTask.done === optimisticDone) {
      setOptimisticDone(null);
    }
  }, [optimisticDone, subTask.done]);
  const displayedCompletedAt = displayedDone ? (subTask.completedAt || new Date().toISOString().slice(0, 10)) : null;

  const handleToggle = async () => {
    const nextDone = !displayedDone;
    const completedAt = nextDone ? new Date().toISOString().slice(0, 10) : null;

    if (projectId && updateSubTaskOptimistic) {
      updateSubTaskOptimistic(projectId, mainTaskId, subTask.id, nextDone, completedAt);
    }
    setOptimisticDone(nextDone);

    try {
      const res = await fetch(`/api/sub-tasks/${subTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: nextDone }),
        credentials: "same-origin",
      });
      if (!res.ok) {
        setOptimisticDone(subTask.done);
        if (projectId && updateSubTaskOptimistic) {
          updateSubTaskOptimistic(projectId, mainTaskId, subTask.id, subTask.done, subTask.completedAt);
        }
      }
    } catch {
      setOptimisticDone(subTask.done);
      if (projectId && updateSubTaskOptimistic) {
        updateSubTaskOptimistic(projectId, mainTaskId, subTask.id, subTask.done, subTask.completedAt);
      }
    }
  };

  const apiCall = async (
    method: string,
    url: string,
    body?: object
  ): Promise<boolean> => {
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "操作に失敗しました");
      }
      onChanged?.();
      return true;
    } catch (e) {
      setAlertMessage(e instanceof Error ? e.message : "不明なエラー");
      return false;
    }
  };

  const handleRename = () => setShowRenameModal(true);
  const handleRenameConfirm = async (name: string) => {
    await apiCall("PATCH", `/api/sub-tasks/${subTask.id}`, { name });
    setShowRenameModal(false);
  };

  const handleEditSummary = () => setShowSummaryModal(true);
  const handleSummaryConfirm = async (summary: string) => {
    await apiCall("PATCH", `/api/sub-tasks/${subTask.id}`, { summary: summary || null });
    setShowSummaryModal(false);
  };

  const handleEditDue = () => setShowDueModal(true);
  const handleDueConfirm = async (due: string | null) => {
    await apiCall("PATCH", `/api/sub-tasks/${subTask.id}`, { due_date: due });
    setShowDueModal(false);
  };

  const handleDelete = async () => {
    if (!window.confirm(`サブタスク「${subTask.name}」を削除しますか？`)) return;
    await apiCall("DELETE", `/api/sub-tasks/${subTask.id}`);
  };

  const handleMoveUp = () => apiCall("POST", `/api/sub-tasks/${subTask.id}/move/up`);
  const handleMoveDown = () => apiCall("POST", `/api/sub-tasks/${subTask.id}/move/down`);

  const openMenuAt = (e: React.MouseEvent) => {
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <div
      className="flex flex-col gap-1 py-3 px-3 sm:py-1.5 sm:px-2 rounded hover:bg-gray-700/50 active:bg-gray-700/70 min-h-[44px] touch-manipulation"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <div className="flex items-center gap-2 min-h-0">
        <input
          type="checkbox"
          checked={displayedDone}
          onChange={handleToggle}
          className="rounded cursor-pointer w-5 h-5 sm:w-4 sm:h-4 flex-shrink-0"
        />
        <div
          className={`flex-1 min-w-0 break-words leading-snug ${displayedDone ? "line-through text-gray-500" : "text-gray-200"}`}
        >
          {subTask.name}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openMenuAt(e);
          }}
          className="lg:hidden flex-shrink-0 w-8 h-8 sm:w-6 sm:h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-200 hover:bg-gray-600/50 active:bg-gray-600 touch-manipulation"
          aria-label="メニューを開く"
        >
          ⋮
        </button>
      </div>
      {(subTask.summary || subTask.dueDate || displayedCompletedAt) && (
          <div className="mt-0.5 pl-7 sm:pl-6 text-xs space-y-0.5">
            {subTask.summary && (
              <p className="text-gray-400">{subTask.summary}</p>
            )}
            {(subTask.dueDate || displayedCompletedAt) && (
              <div className="flex flex-wrap sm:flex-nowrap gap-x-3 gap-y-0.5">
            {subTask.dueDate && (
              <span className="text-blue-400 font-medium whitespace-nowrap">
                期限: {formatDateJp(subTask.dueDate)}
              </span>
            )}
            {displayedCompletedAt && (
              <span className="text-emerald-400 font-medium whitespace-nowrap">
                完了: {formatDateJp(displayedCompletedAt)}
              </span>
            )}
              </div>
            )}
          </div>
        )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={[
            { label: "名前変更", onClick: handleRename },
            { label: "概要を編集", onClick: handleEditSummary },
            { label: "期限を編集", onClick: handleEditDue },
            { label: "上へ移動", onClick: handleMoveUp },
            { label: "下へ移動", onClick: handleMoveDown },
            { label: "削除", onClick: handleDelete },
          ]}
          onClose={() => setContextMenu(null)}
        />
      )}

      <EditTextModal
        isOpen={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        title="サブタスク名変更"
        initialValue={subTask.name}
        placeholder="サブタスク名"
        onConfirm={handleRenameConfirm}
      />
      <EditTextModal
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        title="概要を編集"
        initialValue={subTask.summary ?? ""}
        placeholder="概要を入力"
        multiline
        allowEmpty
        onConfirm={handleSummaryConfirm}
      />
      <EditDateModal
        isOpen={showDueModal}
        onClose={() => setShowDueModal(false)}
        title="期限を編集"
        initialValue={toDateInputValue(subTask.dueDate)}
        onConfirm={handleDueConfirm}
      />
      <AlertModal
        isOpen={alertMessage !== null}
        message={alertMessage ?? ""}
        onClose={() => setAlertMessage(null)}
      />
    </div>
  );
}
