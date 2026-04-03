"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { MainTaskCard } from "./MainTaskCard";
import { Modal } from "./Modal";
import { AlertModal } from "./AlertModal";
import { sortMainTasksByDueAndIncomplete, formatDateJp } from "@/lib/types";
import type { Project, MainTask, Assignee } from "@/lib/types";

interface MainTaskListProps {
  selectedProject: Project | null;
  refetch: () => Promise<void>;
  refetchSilent?: () => Promise<void>;
  updateSubTaskOptimistic?: (projectId: string, mainTaskId: string, subTaskId: string, done: boolean, completedAt: string | null) => void;
  assignees: Assignee[];
  onAddAssignee: (name: string) => Promise<Assignee | null>;
  onDeleteAssignee: (id: string) => Promise<boolean>;
}

export function MainTaskList({ selectedProject, refetch, refetchSilent, updateSubTaskOptimistic, assignees, onAddAssignee, onDeleteAssignee }: MainTaskListProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addSummary, setAddSummary] = useState("");
  const [addDueDate, setAddDueDate] = useState("");
  const [addAssigneeId, setAddAssigneeId] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [newAssigneeName, setNewAssigneeName] = useState("");

  const mainTasks: MainTask[] = sortMainTasksByDueAndIncomplete(selectedProject?.mainTasks ?? []);

  const handleAdd = async () => {
    if (!selectedProject) return;
    const name = addName.trim();
    if (!name) {
      setAlertMessage("名前を入力してください。");
      return;
    }
    if (isAdding) return;
    setIsAdding(true);
    try {
      const res = await fetch(`/api/projects/${selectedProject.id}/main-tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name,
          summary: addSummary.trim() || null,
          due_date: addDueDate && /^\d{4}-\d{2}-\d{2}$/.test(addDueDate) ? addDueDate : null,
          assignee_id: addAssigneeId || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "追加に失敗しました");
      }
      setAddName("");
      setAddSummary("");
      setAddDueDate("");
      setAddAssigneeId("");
      setShowAddModal(false);
      await (refetchSilent ?? refetch)();
    } catch (e) {
      setAlertMessage(e instanceof Error ? e.message : "不明なエラー");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-row items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-100 flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span>{selectedProject ? selectedProject.name : "プロジェクトを選択してください"}</span>
          {selectedProject && (selectedProject.dueDate || selectedProject.assignee || selectedProject.summary) && (
            <span className="text-sm font-normal flex flex-wrap gap-x-3">
              {selectedProject.dueDate && (
                <span className="text-blue-400">���限: {formatDateJp(selectedProject.dueDate)}</span>
              )}
              {selectedProject.assignee && (
                <span className="text-purple-400">担当: {selectedProject.assignee.name}</span>
              )}
              {selectedProject.summary && (
                <span className="text-gray-300">{selectedProject.summary}</span>
              )}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => selectedProject && setShowAddModal(true)}
          disabled={!selectedProject}
          className="flex-shrink-0 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
        >
          メインタスク追加
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        {mainTasks.map((m) => (
          <motion.div
            key={m.id}
            layout
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
          >
            <MainTaskCard
              mainTask={m}
              project={selectedProject!}
              onChanged={refetchSilent ?? refetch}
              updateSubTaskOptimistic={updateSubTaskOptimistic}
              assignees={assignees}
              onAddAssignee={onAddAssignee}
              onDeleteAssignee={onDeleteAssignee}
            />
          </motion.div>
        ))}
      </div>

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="メインタスク追加"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-200">名前:</label>
            <input
              type="text"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="例: ポートフォリオ作成"
              className="w-full border border-gray-600 rounded px-3 py-2 bg-gray-800 text-gray-100 placeholder-gray-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-200">概要:</label>
            <textarea
              value={addSummary}
              onChange={(e) => setAddSummary(e.target.value)}
              placeholder="任意の概要を入力"
              className="w-full border border-gray-600 rounded px-3 py-2 h-20 resize-none bg-gray-800 text-gray-100 placeholder-gray-500"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-200">期限:</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="date"
                value={addDueDate}
                onChange={(e) => setAddDueDate(e.target.value)}
                className="border border-gray-600 rounded px-3 py-2.5 min-h-[44px] bg-gray-800 text-gray-100 flex-1"
              />
              <button
                type="button"
                onClick={() => setAddDueDate("")}
                className="px-4 py-2.5 min-h-[44px] border border-gray-600 rounded hover:bg-gray-700 active:bg-gray-600 text-gray-200 touch-manipulation"
              >
                解除
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-200">担当:</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={addAssigneeId}
                onChange={(e) => setAddAssigneeId(e.target.value)}
                className="border border-gray-600 rounded px-3 py-2.5 min-h-[44px] bg-gray-800 text-gray-100 flex-1"
              >
                <option value="">未設定</option>
                {assignees.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={newAssigneeName}
                onChange={(e) => setNewAssigneeName(e.target.value)}
                placeholder="新しい担当者名"
                className="flex-1 border border-gray-600 rounded px-3 py-2 bg-gray-800 text-gray-100 placeholder-gray-500"
              />
              <button
                type="button"
                onClick={async () => {
                  const name = newAssigneeName.trim();
                  if (!name) return;
                  const created = await onAddAssignee(name);
                  if (created) {
                    setNewAssigneeName("");
                    setAddAssigneeId(created.id);
                  }
                }}
                className="px-3 py-2 min-h-[44px] bg-blue-600 text-white rounded hover:bg-blue-500 active:bg-blue-700 text-sm whitespace-nowrap touch-manipulation"
              >
                追加
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2.5 min-h-[44px] border border-gray-600 rounded hover:bg-gray-700 active:bg-gray-600 text-gray-200 touch-manipulation"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={isAdding}
              className="px-4 py-2.5 min-h-[44px] bg-emerald-600 text-white rounded hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              {isAdding ? "追加中..." : "OK"}
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
