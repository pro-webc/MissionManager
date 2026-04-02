"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { missionProgress, formatDateJp, sortTasksByDueAndIncomplete } from "@/lib/types";
import { TaskItem } from "./TaskItem";
import { Modal } from "./Modal";
import { EditTextModal } from "./EditTextModal";
import { EditDateModal } from "./EditDateModal";
import { AlertModal } from "./AlertModal";
import { ContextMenu } from "./ContextMenu";
import type { Genre, Mission } from "@/lib/types";

function toDateInputValue(v: string | null | undefined): string {
  if (!v) return "";
  const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

interface MissionCardProps {
  mission: Mission;
  genre: Genre;
  onChanged?: () => void;
  updateTaskOptimistic?: (genreId: string, missionId: string, taskId: string, done: boolean, completedAt: string | null) => void;
}

export function MissionCard({ mission, genre, onChanged, updateTaskOptimistic }: MissionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showTaskAddModal, setShowTaskAddModal] = useState(false);
  const [taskAddName, setTaskAddName] = useState("");
  const [taskAddSummary, setTaskAddSummary] = useState("");
  const [taskAddDue, setTaskAddDue] = useState("");
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showDueModal, setShowDueModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const tasks = sortTasksByDueAndIncomplete(mission.tasks ?? []);
  const progress = missionProgress(mission);
  const dueDate = mission.dueDate;
  const completedAt = mission.completedAt;

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
    await apiCall("PATCH", `/api/missions/${mission.id}`, { name });
    setShowRenameModal(false);
  };

  const handleEditSummary = () => setShowSummaryModal(true);
  const handleSummaryConfirm = async (summary: string) => {
    await apiCall("PATCH", `/api/missions/${mission.id}`, {
      summary: summary || null,
    });
    setShowSummaryModal(false);
  };

  const handleEditDue = () => setShowDueModal(true);
  const handleDueConfirm = async (due: string | null) => {
    await apiCall("PATCH", `/api/missions/${mission.id}`, {
      due_date: due,
    });
    setShowDueModal(false);
  };

  const handleDelete = async () => {
    if (!window.confirm(`ミッション「${mission.name}」を削除しますか？`)) return;
    await apiCall("DELETE", `/api/missions/${mission.id}`);
  };

  const handleMoveUp = () => apiCall("POST", `/api/missions/${mission.id}/move/up`);
  const handleMoveDown = () =>
    apiCall("POST", `/api/missions/${mission.id}/move/down`);

  const handleAddTask = async () => {
    const name = taskAddName.trim();
    if (!name) {
      setAlertMessage("名前を入力してください。");
      return;
    }
    if (isAddingTask) return;
    setIsAddingTask(true);
    try {
      const res = await fetch(`/api/missions/${mission.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name,
          summary: taskAddSummary.trim() || null,
          due_date:
            taskAddDue && /^\d{4}-\d{2}-\d{2}$/.test(taskAddDue) ? taskAddDue : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "追加に失敗しました");
      }
      setTaskAddName("");
      setTaskAddSummary("");
      setTaskAddDue("");
      setShowTaskAddModal(false);
      onChanged?.();
    } catch (e) {
      setAlertMessage(e instanceof Error ? e.message : "不明なエラー");
    } finally {
      setIsAddingTask(false);
    }
  };

  const openMenuAt = (e: React.MouseEvent) => {
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <div
      className="border border-gray-700 rounded-lg p-4 bg-gray-800 shadow-sm hover:bg-gray-700/50 active:bg-gray-700/70 cursor-pointer touch-manipulation"
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("button") && !(e.target as HTMLElement).closest("input")) {
          setExpanded(!expanded);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium break-words">{mission.name}</h3>
          <div className="flex flex-wrap sm:flex-nowrap gap-x-4 gap-y-1 mt-1 text-sm">
            <span className="text-blue-400 font-medium whitespace-nowrap">
              期限: {dueDate ? formatDateJp(dueDate) : "未設定"}
            </span>
            <span className="text-emerald-400 font-medium whitespace-nowrap">
              完了: {progress >= 1 && completedAt ? formatDateJp(completedAt) : "-"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:flex-[2] sm:min-w-[6rem]">
          <div className="flex-1 min-w-0 h-2 bg-gray-700 rounded overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <span className="text-sm text-gray-400 font-medium flex-shrink-0 w-10 text-right">
            {Math.round(progress * 100)}%
          </span>
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
          <span className="text-gray-500 flex-shrink-0 text-lg">
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-700 space-y-2" onClick={(e) => e.stopPropagation()}>
          {mission.summary && (
            <p className="text-gray-300 text-sm">{mission.summary}</p>
          )}
          {tasks.map((t) => (
            <motion.div
              key={t.id}
              layout
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
            >
              <TaskItem
                task={t}
                missionId={mission.id}
                genreId={genre.id}
                onChanged={onChanged}
                updateTaskOptimistic={updateTaskOptimistic}
              />
            </motion.div>
          ))}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowTaskAddModal(true);
              }}
              className="px-4 py-2.5 min-h-[44px] text-sm border border-gray-600 rounded hover:bg-gray-700 active:bg-gray-600 text-gray-200 touch-manipulation"
            >
              タスク追加
            </button>
          </div>
        </div>
      )}

      <Modal
        isOpen={showTaskAddModal}
        onClose={() => setShowTaskAddModal(false)}
        title="タスク追加"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-200">名前:</label>
            <input
              type="text"
              value={taskAddName}
              onChange={(e) => setTaskAddName(e.target.value)}
              placeholder="例: API設計"
              className="w-full border border-gray-600 rounded px-3 py-2 bg-gray-800 text-gray-100 placeholder-gray-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-200">概要:</label>
            <textarea
              value={taskAddSummary}
              onChange={(e) => setTaskAddSummary(e.target.value)}
              placeholder="任意の概要を入力"
              className="w-full border border-gray-600 rounded px-3 py-2 h-16 resize-none bg-gray-800 text-gray-100 placeholder-gray-500"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-200">期限:</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={taskAddDue}
                onChange={(e) => setTaskAddDue(e.target.value)}
                className="border border-gray-600 rounded px-3 py-2 bg-gray-800 text-gray-100"
              />
              <button
                type="button"
                onClick={() => setTaskAddDue("")}
                className="px-3 py-2 border border-gray-600 rounded hover:bg-gray-700 text-gray-200"
              >
                解除
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowTaskAddModal(false)}
              className="px-4 py-2.5 min-h-[44px] border border-gray-600 rounded hover:bg-gray-700 active:bg-gray-600 text-gray-200 touch-manipulation"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleAddTask}
              disabled={isAddingTask}
              className="px-4 py-2.5 min-h-[44px] bg-emerald-600 text-white rounded hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              {isAddingTask ? "追加中..." : "OK"}
            </button>
          </div>
        </div>
      </Modal>

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
        title="ミッション名変更"
        initialValue={mission.name}
        placeholder="ミッション名"
        onConfirm={handleRenameConfirm}
      />
      <EditTextModal
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        title="概要を編集"
        initialValue={mission.summary ?? ""}
        placeholder="概要を入力"
        multiline
        allowEmpty
        onConfirm={handleSummaryConfirm}
      />
      <EditDateModal
        isOpen={showDueModal}
        onClose={() => setShowDueModal(false)}
        title="期限を編集"
        initialValue={toDateInputValue(mission.dueDate)}
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
