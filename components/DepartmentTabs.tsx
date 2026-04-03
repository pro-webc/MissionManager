"use client";

import { useState } from "react";
import type { Department } from "@/lib/types";
import { EditTextModal } from "./EditTextModal";
import { AlertModal } from "./AlertModal";
import { ContextMenu } from "./ContextMenu";

interface DepartmentTabsProps {
  departments: Department[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  refetch: () => Promise<void>;
}

export function DepartmentTabs({
  departments,
  loading,
  selectedId,
  onSelect,
  refetch,
}: DepartmentTabsProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; dept: Department } | null>(null);

  const apiCall = async (method: string, url: string, body?: object): Promise<boolean> => {
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
      await refetch();
      return true;
    } catch (e) {
      setAlertMessage(e instanceof Error ? e.message : "不明なエラー");
      return false;
    }
  };

  const handleAdd = async (name: string) => {
    const res = await fetch("/api/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
      credentials: "same-origin",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setAlertMessage(data.error ?? "追加に失敗しました");
      return;
    }
    const data = await res.json();
    await refetch();
    onSelect(data.department.id);
    setShowAddModal(false);
  };

  const handleRename = async (name: string) => {
    if (!editingDept) return;
    await apiCall("PATCH", `/api/departments/${editingDept.id}`, { name });
    setShowRenameModal(false);
    setEditingDept(null);
  };

  const handleDelete = async (dept: Department) => {
    if (!window.confirm(`部門「${dept.name}」を削除しますか？\n配下のジャンル・ミッション・タスクもすべて削除されます。`)) return;
    await apiCall("DELETE", `/api/departments/${dept.id}`);
    if (selectedId === dept.id) {
      const remaining = departments.filter((d) => d.id !== dept.id);
      onSelect(remaining[0]?.id ?? null);
    }
  };

  const contextMenuItems = contextMenu?.dept
    ? [
        {
          label: "名前変更",
          onClick: () => {
            setEditingDept(contextMenu.dept);
            setShowRenameModal(true);
          },
        },
        {
          label: "削除",
          onClick: () => handleDelete(contextMenu.dept),
        },
      ]
    : [];

  if (loading) return null;

  return (
    <div className="border-b border-gray-700 mb-4 sm:mb-6">
      <div className="flex items-end gap-0 overflow-x-auto scrollbar-hide -mb-px">
        {departments.map((dept) => {
          const isSelected = dept.id === selectedId;
          return (
            <button
              key={dept.id}
              type="button"
              onClick={() => onSelect(dept.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, dept });
              }}
              className={[
                "px-4 py-2.5 min-h-[44px] text-sm font-medium whitespace-nowrap border-b-2 transition-colors touch-manipulation flex-shrink-0",
                isSelected
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500",
              ].join(" ")}
            >
              {dept.name}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-3 py-2.5 min-h-[44px] text-sm text-gray-500 hover:text-gray-300 whitespace-nowrap border-b-2 border-transparent transition-colors touch-manipulation flex-shrink-0"
          aria-label="部門を追加"
        >
          + 追加
        </button>
      </div>

      <EditTextModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="部門を追加"
        initialValue=""
        placeholder="部門名を入力"
        onConfirm={handleAdd}
      />

      <EditTextModal
        isOpen={showRenameModal}
        onClose={() => {
          setShowRenameModal(false);
          setEditingDept(null);
        }}
        title="部門名を変更"
        initialValue={editingDept?.name ?? ""}
        placeholder="新しい部門名"
        onConfirm={handleRename}
      />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      <AlertModal
        isOpen={alertMessage !== null}
        message={alertMessage ?? ""}
        onClose={() => setAlertMessage(null)}
      />
    </div>
  );
}
