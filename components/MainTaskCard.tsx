"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { mainTaskProgress, formatDateJp, sortSubTasksByDueAndIncomplete } from "@/lib/types";
import { SubTaskItem } from "./SubTaskItem";
import { Modal } from "./Modal";
import { EditTextModal } from "./EditTextModal";
import { EditDateModal } from "./EditDateModal";
import { AlertModal } from "./AlertModal";
import { ContextMenu } from "./ContextMenu";
import type { Project, MainTask, Assignee } from "@/lib/types";

function toDateInputValue(v: string | null | undefined): string {
  if (!v) return "";
  const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

interface MainTaskCardProps {
  mainTask: MainTask;
  project: Project;
  onChanged?: () => void;
  updateSubTaskOptimistic?: (projectId: string, mainTaskId: string, subTaskId: string, done: boolean, completedAt: string | null) => void;
  assignees: Assignee[];
  onAddAssignee: (name: string) => Promise<Assignee | null>;
  onDeleteAssignee: (id: string) => Promise<boolean>;
}

export function MainTaskCard({ mainTask, project, onChanged, updateSubTaskOptimistic, assignees, onAddAssignee, onDeleteAssignee }: MainTaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showSubTaskAddModal, setShowSubTaskAddModal] = useState(false);
  const [subTaskAddName, setSubTaskAddName] = useState("");
  const [subTaskAddSummary, setSubTaskAddSummary] = useState("");
  const [subTaskAddDue, setSubTaskAddDue] = useState("");
  const [isAddingSubTask, setIsAddingSubTask] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showDueModal, setShowDueModal] = useState(false);
  const [showAssigneeModal, setShowAssigneeModal] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState(mainTask.assigneeId ?? "");
  const [newAssigneeNameInput, setNewAssigneeNameInput] = useState("");
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const subTasks = sortSubTasksByDueAndIncomplete(mainTask.subTasks ?? []);
  const progress = mainTaskProgress(mainTask);
  const dueDate = mainTask.dueDate;
  const completedAt = mainTask.completedAt;

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
    await apiCall("PATCH", `/api/main-tasks/${mainTask.id}`, { name });
    setShowRenameModal(false);
  };

  const handleEditSummary = () => setShowSummaryModal(true);
  const handleSummaryConfirm = async (summary: string) => {
    await apiCall("PATCH", `/api/main-tasks/${mainTask.id}`, {
      summary: summary || null,
    });
    setShowSummaryModal(false);
  };

  const handleEditDue = () => setShowDueModal(true);
  const handleDueConfirm = async (due: string | null) => {
    await apiCall("PATCH", `/api/main-tasks/${mainTask.id}`, {
      due_date: due,
    });
    setShowDueModal(false);
  };

  const handleEditAssignee = () => {
    setSelectedAssigneeId(mainTask.assigneeId ?? "");
    setNewAssigneeNameInput("");
    setShowAssigneeModal(true);
  };
  const handleAssigneeConfirm = async () => {
    await apiCall("PATCH", `/api/main-tasks/${mainTask.id}`, {
      assignee_id: selectedAssigneeId || null,
    });
    setShowAssigneeModal(false);
  };

  const handleDelete = async () => {
    if (!window.confirm(`メインタスク「${mainTask.name}」を削除しますか？`)) return;
    await apiCall("DELETE", `/api/main-tasks/${mainTask.id}`);
  };

  const handleMoveUp = () => apiCall("POST", `/api/main-tasks/${mainTask.id}/move/up`);
  const handleMoveDown = () =>
    apiCall("POST", `/api/main-tasks/${mainTask.id}/move/down`);

  const handleAddSubTask = async () => {
    const name = subTaskAddName.trim();
    if (!name) {
      setAlertMessage("名前を入力してください。");
      return;
    }
    if (isAddingSubTask) return;
    setIsAddingSubTask(true);
    try {
      const res = await fetch(`/api/main-tasks/${mainTask.id}/sub-tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name,
          summary: subTaskAddSummary.trim() || null,
          due_date:
            subTaskAddDue && /^\d{4}-\d{2}-\d{2}$/.test(subTaskAddDue) ? subTaskAddDue : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "追加に失敗しました");
      }
      setSubTaskAddName("");
      setSubTaskAddSummary("");
      setSubTaskAddDue("");
      setShowSubTaskAddModal(false);
      onChanged?.();
    } catch (e) {
      setAlertMessage(e instanceof Error ? e.message : "不明なエラー");
    } finally {
      setIsAddingSubTask(false);
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
          <h3 className="font-medium break-words">{mainTask.name}</h3>
          <div className="flex flex-wrap sm:flex-nowrap gap-x-4 gap-y-1 mt-1 text-sm">
            <span className="text-blue-400 font-medium whitespace-nowrap">
              期限: {dueDate ? formatDateJp(dueDate) : "未設定"}
            </span>
            <span className="text-emerald-400 font-medium whitespace-nowrap">
              完了: {progress >= 1 && completedAt ? formatDateJp(completedAt) : "-"}
            </span>
            <span className="text-purple-400 font-medium whitespace-nowrap">
              担当: {mainTask.assignee?.name ?? "未設定"}
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
          {mainTask.summary && (
            <p className="text-gray-300 text-sm">{mainTask.summary}</p>
          )}
          {subTasks.map((t) => (
            <motion.div
              key={t.id}
              layout
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
            >
              <SubTaskItem
                subTask={t}
                mainTaskId={mainTask.id}
                projectId={project.id}
                onChanged={onChanged}
                updateSubTaskOptimistic={updateSubTaskOptimistic}
              />
            </motion.div>
          ))}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowSubTaskAddModal(true);
              }}
              className="px-4 py-2.5 min-h-[44px] text-sm border border-gray-600 rounded hover:bg-gray-700 active:bg-gray-600 text-gray-200 touch-manipulation"
            >
              サブタスク追加
            </button>
          </div>
        </div>
      )}

      <Modal
        isOpen={showSubTaskAddModal}
        onClose={() => setShowSubTaskAddModal(false)}
        title="サブタスク追加"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-200">名前:</label>
            <input
              type="text"
              value={subTaskAddName}
              onChange={(e) => setSubTaskAddName(e.target.value)}
              placeholder="例: API設計"
              className="w-full border border-gray-600 rounded px-3 py-2 bg-gray-800 text-gray-100 placeholder-gray-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-200">概要:</label>
            <textarea
              value={subTaskAddSummary}
              onChange={(e) => setSubTaskAddSummary(e.target.value)}
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
                value={subTaskAddDue}
                onChange={(e) => setSubTaskAddDue(e.target.value)}
                className="border border-gray-600 rounded px-3 py-2 bg-gray-800 text-gray-100"
              />
              <button
                type="button"
                onClick={() => setSubTaskAddDue("")}
                className="px-3 py-2 border border-gray-600 rounded hover:bg-gray-700 text-gray-200"
              >
                解除
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowSubTaskAddModal(false)}
              className="px-4 py-2.5 min-h-[44px] border border-gray-600 rounded hover:bg-gray-700 active:bg-gray-600 text-gray-200 touch-manipulation"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleAddSubTask}
              disabled={isAddingSubTask}
              className="px-4 py-2.5 min-h-[44px] bg-emerald-600 text-white rounded hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              {isAddingSubTask ? "追加中..." : "OK"}
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
            { label: "担当者を編集", onClick: handleEditAssignee },
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
        title="メインタスク名変更"
        initialValue={mainTask.name}
        placeholder="メインタスク名"
        onConfirm={handleRenameConfirm}
      />
      <EditTextModal
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        title="概要を編集"
        initialValue={mainTask.summary ?? ""}
        placeholder="概要を入力"
        multiline
        allowEmpty
        onConfirm={handleSummaryConfirm}
      />
      <EditDateModal
        isOpen={showDueModal}
        onClose={() => setShowDueModal(false)}
        title="期限を編集"
        initialValue={toDateInputValue(mainTask.dueDate)}
        onConfirm={handleDueConfirm}
      />
      <Modal
        isOpen={showAssigneeModal}
        onClose={() => setShowAssigneeModal(false)}
        title="担当者を編集"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-200">担当者:</label>
            <select
              value={selectedAssigneeId}
              onChange={(e) => setSelectedAssigneeId(e.target.value)}
              className="w-full border border-gray-600 rounded px-3 py-2.5 min-h-[44px] bg-gray-800 text-gray-100"
            >
              <option value="">未設定</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-200">新しい担当者を追加:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newAssigneeNameInput}
                onChange={(e) => setNewAssigneeNameInput(e.target.value)}
                placeholder="担当者名"
                className="flex-1 border border-gray-600 rounded px-3 py-2 bg-gray-800 text-gray-100 placeholder-gray-500"
              />
              <button
                type="button"
                onClick={async () => {
                  const name = newAssigneeNameInput.trim();
                  if (!name) return;
                  const created = await onAddAssignee(name);
                  if (created) {
                    setNewAssigneeNameInput("");
                    setSelectedAssigneeId(created.id);
                  }
                }}
                className="px-3 py-2 min-h-[44px] bg-blue-600 text-white rounded hover:bg-blue-500 active:bg-blue-700 text-sm whitespace-nowrap touch-manipulation"
              >
                追加
              </button>
            </div>
          </div>
          {selectedAssigneeId && (
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm("この担当者を削除しますか？他のメインタスクからも解除されます。")) return;
                const ok = await onDeleteAssignee(selectedAssigneeId);
                if (ok) setSelectedAssigneeId("");
              }}
              className="text-sm text-red-400 hover:text-red-300"
            >
              選択中の担当者を削除
            </button>
          )}
          <div className="flex justify-end gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowAssigneeModal(false)}
              className="px-4 py-2.5 min-h-[44px] border border-gray-600 rounded hover:bg-gray-700 active:bg-gray-600 text-gray-200 touch-manipulation"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleAssigneeConfirm}
              className="px-4 py-2.5 min-h-[44px] bg-emerald-600 text-white rounded hover:bg-emerald-500 active:bg-emerald-700 touch-manipulation"
            >
              OK
            </button>
          </div>
        </div>
      </Modal>
      <AlertModal
        isOpen={alertMessage !== null}
        message={alertMessage ?? ""}
        onClose={() => setAlertMessage(null)}
      />
    </div>
  );
}
