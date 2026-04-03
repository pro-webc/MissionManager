"use client";

import { useState, useEffect } from "react";
import { countIncompleteMainTasks, formatDateJp, sortProjectsByDueAndIncomplete } from "@/lib/types";
import { Modal } from "./Modal";
import { EditTextModal } from "./EditTextModal";
import { EditDateModal } from "./EditDateModal";
import { AlertModal } from "./AlertModal";
import { ContextMenu } from "./ContextMenu";
import type { Project, Assignee } from "@/lib/types";

function toDateInputValue(v: string | null | undefined): string {
  if (!v) return "";
  const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function ProjectListButton({
  project,
  isSelected,
  onSelect,
  onOpenContextMenu,
  countIncomplete,
}: {
  project: Project;
  isSelected: boolean;
  onSelect: () => void;
  onOpenContextMenu: (x: number, y: number, p: Project) => void;
  countIncomplete: (p: Project) => number;
}) {
  const n = countIncomplete(project);

  const openMenuAt = (e: React.MouseEvent) => {
    onOpenContextMenu(e.clientX, e.clientY, project);
  };

  return (
    <div className="flex items-stretch gap-0.5">
      <button
        type="button"
        onClick={() => onSelect()}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openMenuAt(e);
        }}
        className={cn(
          "flex-1 text-left px-3 min-h-8 py-1.5 flex flex-col justify-start rounded transition-colors touch-manipulation",
          isSelected ? "bg-gray-700 text-gray-100" : "hover:bg-gray-700/50 text-gray-300"
        )}
      >
        <span className="font-medium flex items-center gap-2">
          {project.name}
        {n > 0 && (
          <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-semibold">
            {n}
          </span>
        )}
      </span>
      {(project.summary || project.dueDate || project.assignee) && (
        <span className="text-gray-400 text-xs block truncate mt-0.5">
          {project.dueDate && (
            <span className="text-blue-400 mr-2">{formatDateJp(project.dueDate)}</span>
          )}
          {project.assignee && (
            <span className="text-purple-400 mr-2">{project.assignee.name}</span>
          )}
          {project.summary}
        </span>
      )}
    </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); openMenuAt(e); }}
        className="lg:hidden flex-shrink-0 w-8 h-8 flex items-center justify-center rounded text-gray-400 hover:text-gray-200 hover:bg-gray-600/50 active:bg-gray-600 touch-manipulation"
        aria-label="メニューを開く"
      >
        ⋮
      </button>
    </div>
  );
}

interface ProjectSelectorProps {
  projects: Project[];
  loading: boolean;
  error: string | null;
  departmentId: string | null;
  refetch: () => Promise<void>;
  refetchSilent?: () => Promise<void>;
  selectedProject?: Project | null;
  onSelect?: (project: Project | null) => void;
  assignees: Assignee[];
  onAddAssignee: (name: string) => Promise<Assignee | null>;
  onDeleteAssignee: (id: string) => Promise<boolean>;
}

export function ProjectSelector({
  projects,
  loading,
  error,
  departmentId,
  refetch,
  refetchSilent,
  selectedProject,
  onSelect,
  assignees,
  onAddAssignee,
  onDeleteAssignee,
}: ProjectSelectorProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addSummary, setAddSummary] = useState("");
  const [addDueDate, setAddDueDate] = useState("");
  const [addAssigneeId, setAddAssigneeId] = useState("");
  const [newAssigneeNameInAdd, setNewAssigneeNameInAdd] = useState("");
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; project: Project } | null>(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showDueModal, setShowDueModal] = useState(false);
  const [showAssigneeModal, setShowAssigneeModal] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [newAssigneeNameInput, setNewAssigneeNameInput] = useState("");
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const sortedProjects = sortProjectsByDueAndIncomplete(projects);

  useEffect(() => {
    if (!loading && !selectedProject && sortedProjects.length > 0) {
      onSelect?.(sortedProjects[0]);
    }
  }, [loading, selectedProject, sortedProjects, onSelect]);

  const handleAdd = async () => {
    const name = addName.trim();
    if (!name) {
      setAlertMessage("名前を入力してください。");
      return;
    }
    if (isAddingProject) return;
    setIsAddingProject(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          summary: addSummary.trim() || null,
          due_date: addDueDate && /^\d{4}-\d{2}-\d{2}$/.test(addDueDate) ? addDueDate : null,
          assignee_id: addAssigneeId || null,
          departmentId,
        }),
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "追加に失敗しました");
      }
      setAddName("");
      setAddSummary("");
      setAddDueDate("");
      setAddAssigneeId("");
      setNewAssigneeNameInAdd("");
      setShowAddModal(false);
      const data = await res.json();
      await (refetchSilent ?? refetch)();
      onSelect?.(data.project);
    } catch (e) {
      setAlertMessage(e instanceof Error ? e.message : "不明なエラー");
    } finally {
      setIsAddingProject(false);
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
      await (refetchSilent ?? refetch)();
      return true;
    } catch (e) {
      setAlertMessage(e instanceof Error ? e.message : "不明なエラー");
      return false;
    }
  };

  const menuTarget = contextMenu?.project ?? selectedProject;

  const handleRename = (p: Project) => {
    setEditingProject(p);
    setShowRenameModal(true);
  };

  const handleRenameConfirm = async (name: string) => {
    const target = editingProject ?? selectedProject;
    if (!target) return;
    await apiCall("PATCH", `/api/projects/${target.id}`, { name });
    setShowRenameModal(false);
    setEditingProject(null);
  };

  const handleEditSummary = (p: Project) => {
    setEditingProject(p);
    setShowSummaryModal(true);
  };

  const handleEditDue = (p: Project) => {
    setEditingProject(p);
    setShowDueModal(true);
  };

  const handleDueConfirm = async (due: string | null) => {
    const target = editingProject ?? selectedProject;
    if (!target) return;
    await apiCall("PATCH", `/api/projects/${target.id}`, { due_date: due });
    setShowDueModal(false);
    setEditingProject(null);
  };

  const handleEditAssignee = (p: Project) => {
    setEditingProject(p);
    setSelectedAssigneeId(p.assigneeId ?? "");
    setNewAssigneeNameInput("");
    setShowAssigneeModal(true);
  };

  const handleAssigneeConfirm = async () => {
    const target = editingProject ?? selectedProject;
    if (!target) return;
    await apiCall("PATCH", `/api/projects/${target.id}`, {
      assignee_id: selectedAssigneeId || null,
    });
    setShowAssigneeModal(false);
    setEditingProject(null);
  };

  const handleSummaryConfirm = async (summary: string) => {
    const target = editingProject ?? selectedProject;
    if (!target) return;
    await apiCall("PATCH", `/api/projects/${target.id}`, {
      summary: summary || null,
    });
    setShowSummaryModal(false);
    setEditingProject(null);
  };

  const handleDelete = async (p: Project) => {
    if (!window.confirm(`プロジェクト「${p.name}」を削除しますか？`)) return;
    await apiCall("DELETE", `/api/projects/${p.id}`);
    const idx = sortedProjects.findIndex((x) => x.id === p.id);
    const next = sortedProjects[idx + 1] ?? sortedProjects[idx - 1] ?? null;
    onSelect?.(next ?? null);
  };

  const handleMoveUp = (p: Project) => apiCall("POST", `/api/projects/${p.id}/move/up`);
  const handleMoveDown = (p: Project) => apiCall("POST", `/api/projects/${p.id}/move/down`);

  const contextMenuItems = menuTarget
    ? [
        { label: "名前変更", onClick: () => handleRename(menuTarget) },
        { label: "概要を編集", onClick: () => handleEditSummary(menuTarget) },
        { label: "期限を編集", onClick: () => handleEditDue(menuTarget) },
        { label: "担当者を編集", onClick: () => handleEditAssignee(menuTarget) },
        { label: "上へ移動", onClick: () => handleMoveUp(menuTarget) },
        { label: "下へ移動", onClick: () => handleMoveDown(menuTarget) },
        { label: "削除", onClick: () => handleDelete(menuTarget) },
      ]
    : [];

  const openContextMenuAt = (x: number, y: number, project: Project) => {
    setContextMenu({ x, y, project });
  };

  if (loading) return <p className="text-gray-400">読み込み中...</p>;
  if (error) return <p className="text-red-400">エラー: {error}</p>;

  return (
    <div className="flex flex-col gap-2 mb-4 md:mb-0">
      {/* スマホ: ドロップダウン */}
      <div
        className="flex flex-row gap-2 items-center md:hidden touch-manipulation"
        onContextMenu={(e) => {
          if (selectedProject) {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, project: selectedProject });
          }
        }}
      >
        <select
          className="border border-gray-600 rounded px-3 py-2.5 min-h-[44px] flex-1 min-w-0 bg-gray-800 text-gray-100 touch-manipulation outline-none focus:ring-0 focus:ring-offset-0"
          value={selectedProject?.id ?? ""}
          onChange={(e) => {
            const id = e.target.value;
            if (!id) {
              onSelect?.(null);
              return;
            }
            const p = projects.find((x) => x.id === id) ?? null;
            onSelect?.(p);
          }}
        >
          <option value="">プロジェクトを選択</option>
          {sortedProjects.map((p) => {
            const n = countIncompleteMainTasks(p);
            const label = n > 0 ? p.name + " \u00B7 " + n : p.name;
            return (
              <option key={p.id} value={p.id}>
                {label}
              </option>
            );
          })}
        </select>
        {selectedProject && (
          <button
            type="button"
            onClick={(e) => {
              const rect = (e.target as HTMLElement).getBoundingClientRect();
              setContextMenu({ x: rect.right - 8, y: rect.bottom + 4, project: selectedProject });
            }}
            className="flex-shrink-0 w-10 h-10 min-h-[44px] flex items-center justify-center rounded text-gray-400 hover:text-gray-200 hover:bg-gray-600/50 active:bg-gray-600 touch-manipulation"
            aria-label="メニューを開く"
          >
            ⋮
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 min-h-[44px] flex-shrink-0 bg-blue-600 text-white rounded hover:bg-blue-500 active:bg-blue-700 touch-manipulation"
        >
          追加
        </button>
      </div>

      {/* PC: サイドバー用プロジェクト一覧 */}
      <div className="hidden md:flex md:flex-col md:gap-1">
        <div className="flex justify-between items-center gap-2 mb-2">
          <span className="font-semibold text-gray-200">プロジェクト</span>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex-shrink-0 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-500 active:bg-blue-700"
          >
            追加
          </button>
        </div>
        <div className="flex flex-col gap-0.5 overflow-y-auto">
          {sortedProjects.map((p) => (
            <ProjectListButton
              key={p.id}
              project={p}
              isSelected={selectedProject?.id === p.id}
              onSelect={() => onSelect?.(p)}
              onOpenContextMenu={openContextMenuAt}
              countIncomplete={countIncompleteMainTasks}
            />
          ))}
        </div>
      </div>

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="プロジェクト追加"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-200">名前:</label>
            <input
              type="text"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="例: 開発"
              className="w-full border border-gray-600 rounded px-3 py-2 bg-gray-800 text-gray-100 placeholder-gray-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-200">概要:</label>
            <textarea
              value={addSummary}
              onChange={(e) => setAddSummary(e.target.value)}
              placeholder="任意の概要・説明を入力"
              className="w-full border border-gray-600 rounded px-3 py-2 h-20 resize-none bg-gray-800 text-gray-100 placeholder-gray-500"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-200">期限:</label>
            <div className="flex gap-2">
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
                value={newAssigneeNameInAdd}
                onChange={(e) => setNewAssigneeNameInAdd(e.target.value)}
                placeholder="新しい担当者名"
                className="flex-1 border border-gray-600 rounded px-3 py-2 bg-gray-800 text-gray-100 placeholder-gray-500"
              />
              <button
                type="button"
                onClick={async () => {
                  const name = newAssigneeNameInAdd.trim();
                  if (!name) return;
                  const created = await onAddAssignee(name);
                  if (created) {
                    setNewAssigneeNameInAdd("");
                    setAddAssigneeId(created.id);
                  }
                }}
                className="px-3 py-2 min-h-[44px] bg-blue-600 text-white rounded hover:bg-blue-500 active:bg-blue-700 text-sm whitespace-nowrap touch-manipulation"
              >
                追加
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-2">
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
              disabled={isAddingProject}
              className="px-4 py-2.5 min-h-[44px] bg-blue-600 text-white rounded hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              {isAddingProject ? "追加中..." : "OK"}
            </button>
          </div>
        </div>
      </Modal>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      <EditTextModal
        isOpen={showRenameModal}
        onClose={() => {
          setShowRenameModal(false);
          setEditingProject(null);
        }}
        title="プロジェクト名変更"
        initialValue={(editingProject ?? selectedProject)?.name ?? ""}
        placeholder="新しいプロジェクト名"
        onConfirm={handleRenameConfirm}
      />
      <EditDateModal
        isOpen={showDueModal}
        onClose={() => {
          setShowDueModal(false);
          setEditingProject(null);
        }}
        title="期限を編集"
        initialValue={toDateInputValue((editingProject ?? selectedProject)?.dueDate)}
        onConfirm={handleDueConfirm}
      />
      <EditTextModal
        isOpen={showSummaryModal}
        onClose={() => {
          setShowSummaryModal(false);
          setEditingProject(null);
        }}
        title="概要を編集"
        initialValue={(editingProject ?? selectedProject)?.summary ?? ""}
        placeholder="概要を入力"
        multiline
        allowEmpty
        onConfirm={handleSummaryConfirm}
      />
      <Modal
        isOpen={showAssigneeModal}
        onClose={() => {
          setShowAssigneeModal(false);
          setEditingProject(null);
        }}
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
                if (!window.confirm("この担当者を削除しますか？他のプロジェクトやメインタスクからも解除されます。")) return;
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
              onClick={() => {
                setShowAssigneeModal(false);
                setEditingProject(null);
              }}
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
