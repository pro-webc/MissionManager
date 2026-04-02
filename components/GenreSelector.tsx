"use client";

import { useState, useEffect } from "react";
import { countIncompleteMissions } from "@/lib/types";
import { Modal } from "./Modal";
import { EditTextModal } from "./EditTextModal";
import { AlertModal } from "./AlertModal";
import { ContextMenu } from "./ContextMenu";
import type { Genre } from "@/lib/types";

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function GenreListButton({
  genre,
  isSelected,
  onSelect,
  onOpenContextMenu,
  countIncomplete,
}: {
  genre: Genre;
  isSelected: boolean;
  onSelect: () => void;
  onOpenContextMenu: (x: number, y: number, g: Genre) => void;
  countIncomplete: (g: Genre) => number;
}) {
  const n = countIncomplete(genre);

  const openMenuAt = (e: React.MouseEvent) => {
    onOpenContextMenu(e.clientX, e.clientY, genre);
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
          {genre.name}
        {n > 0 && (
          <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-semibold">
            {n}
          </span>
        )}
      </span>
      {genre.summary && (
        <span className="text-gray-400 text-xs block truncate mt-0.5">
          {genre.summary}
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

interface GenreSelectorProps {
  genres: Genre[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  refetchSilent?: () => Promise<void>;
  selectedGenre?: Genre | null;
  onSelect?: (genre: Genre | null) => void;
}

export function GenreSelector({
  genres,
  loading,
  error,
  refetch,
  refetchSilent,
  selectedGenre,
  onSelect,
}: GenreSelectorProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addSummary, setAddSummary] = useState("");
  const [isAddingGenre, setIsAddingGenre] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; genre: Genre } | null>(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [editingGenre, setEditingGenre] = useState<Genre | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !selectedGenre && genres.length > 0) {
      onSelect?.(genres[0]);
    }
  }, [loading, selectedGenre, genres, onSelect]);

  const handleAdd = async () => {
    const name = addName.trim();
    if (!name) {
      setAlertMessage("名前を入力してください。");
      return;
    }
    if (isAddingGenre) return;
    setIsAddingGenre(true);
    try {
      const res = await fetch("/api/genres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, summary: addSummary.trim() || null }),
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "追加に失敗しました");
      }
      setAddName("");
      setAddSummary("");
      setShowAddModal(false);
      const data = await res.json();
      await (refetchSilent ?? refetch)();
      onSelect?.(data.genre);
    } catch (e) {
      setAlertMessage(e instanceof Error ? e.message : "不明なエラー");
    } finally {
      setIsAddingGenre(false);
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

  const menuTarget = contextMenu?.genre ?? selectedGenre;

  const handleRename = (g: Genre) => {
    setEditingGenre(g);
    setShowRenameModal(true);
  };

  const handleRenameConfirm = async (name: string) => {
    const target = editingGenre ?? selectedGenre;
    if (!target) return;
    await apiCall("PATCH", `/api/genres/${target.id}`, { name });
    setShowRenameModal(false);
    setEditingGenre(null);
  };

  const handleEditSummary = (g: Genre) => {
    setEditingGenre(g);
    setShowSummaryModal(true);
  };

  const handleSummaryConfirm = async (summary: string) => {
    const target = editingGenre ?? selectedGenre;
    if (!target) return;
    await apiCall("PATCH", `/api/genres/${target.id}`, {
      summary: summary || null,
    });
    setShowSummaryModal(false);
    setEditingGenre(null);
  };

  const handleDelete = async (g: Genre) => {
    if (!window.confirm(`ジャンル「${g.name}」を削除しますか？`)) return;
    await apiCall("DELETE", `/api/genres/${g.id}`);
    const idx = genres.findIndex((x) => x.id === g.id);
    const next = genres[idx + 1] ?? genres[idx - 1] ?? null;
    onSelect?.(next ?? null);
  };

  const handleMoveUp = (g: Genre) => apiCall("POST", `/api/genres/${g.id}/move/up`);
  const handleMoveDown = (g: Genre) => apiCall("POST", `/api/genres/${g.id}/move/down`);

  const contextMenuItems = menuTarget
    ? [
        { label: "名前変更", onClick: () => handleRename(menuTarget) },
        { label: "概要を編集", onClick: () => handleEditSummary(menuTarget) },
        { label: "上へ移動", onClick: () => handleMoveUp(menuTarget) },
        { label: "下へ移動", onClick: () => handleMoveDown(menuTarget) },
        { label: "削除", onClick: () => handleDelete(menuTarget) },
      ]
    : [];

  const openContextMenu = (e: React.MouseEvent, genre: Genre) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, genre });
  };

  const openContextMenuAt = (x: number, y: number, genre: Genre) => {
    setContextMenu({ x, y, genre });
  };

  if (loading) return <p className="text-gray-400">読み込み中...</p>;
  if (error) return <p className="text-red-400">エラー: {error}</p>;

  return (
    <div className="flex flex-col gap-2 mb-4 md:mb-0">
      {/* スマホ: ドロップダウン */}
      <div
        className="flex flex-row gap-2 items-center md:hidden touch-manipulation"
        onContextMenu={(e) => {
          if (selectedGenre) {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, genre: selectedGenre });
          }
        }}
      >
        <select
          className="border border-gray-600 rounded px-3 py-2.5 min-h-[44px] flex-1 min-w-0 bg-gray-800 text-gray-100 touch-manipulation outline-none focus:ring-0 focus:ring-offset-0"
          value={selectedGenre?.id ?? ""}
          onChange={(e) => {
            const id = e.target.value;
            if (!id) {
              onSelect?.(null);
              return;
            }
            const g = genres.find((x) => x.id === id) ?? null;
            onSelect?.(g);
          }}
        >
          <option value="">ジャンルを選択</option>
          {genres.map((g) => {
            const n = countIncompleteMissions(g);
            const label = n > 0 ? g.name + " \u00B7 " + n : g.name;
            return (
              <option key={g.id} value={g.id}>
                {label}
              </option>
            );
          })}
        </select>
        {selectedGenre && (
          <button
            type="button"
            onClick={(e) => {
              const rect = (e.target as HTMLElement).getBoundingClientRect();
              setContextMenu({ x: rect.right - 8, y: rect.bottom + 4, genre: selectedGenre });
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

      {/* PC: サイドバー用ジャンル一覧 */}
      <div className="hidden md:flex md:flex-col md:gap-1">
        <div className="flex justify-between items-center gap-2 mb-2">
          <span className="font-semibold text-gray-200">ジャンル</span>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex-shrink-0 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-500 active:bg-blue-700"
          >
            追加
          </button>
        </div>
        <div className="flex flex-col gap-0.5 overflow-y-auto">
          {genres.map((g) => (
            <GenreListButton
              key={g.id}
              genre={g}
              isSelected={selectedGenre?.id === g.id}
              onSelect={() => onSelect?.(g)}
              onOpenContextMenu={openContextMenuAt}
              countIncomplete={countIncompleteMissions}
            />
          ))}
        </div>
      </div>

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="ジャンル追加"
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
              disabled={isAddingGenre}
              className="px-4 py-2.5 min-h-[44px] bg-blue-600 text-white rounded hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              {isAddingGenre ? "追加中..." : "OK"}
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
          setEditingGenre(null);
        }}
        title="ジャンル名変更"
        initialValue={(editingGenre ?? selectedGenre)?.name ?? ""}
        placeholder="新しいジャンル名"
        onConfirm={handleRenameConfirm}
      />
      <EditTextModal
        isOpen={showSummaryModal}
        onClose={() => {
          setShowSummaryModal(false);
          setEditingGenre(null);
        }}
        title="概要を編集"
        initialValue={(editingGenre ?? selectedGenre)?.summary ?? ""}
        placeholder="概要を入力"
        multiline
        allowEmpty
        onConfirm={handleSummaryConfirm}
      />
      <AlertModal
        isOpen={alertMessage !== null}
        message={alertMessage ?? ""}
        onClose={() => setAlertMessage(null)}
      />
    </div>
  );
}
