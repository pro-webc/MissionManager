"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { MissionCard } from "./MissionCard";
import { Modal } from "./Modal";
import { AlertModal } from "./AlertModal";
import { sortMissionsByDueAndIncomplete } from "@/lib/types";
import type { Genre, Mission } from "@/lib/types";

interface MissionListProps {
  selectedGenre: Genre | null;
  refetch: () => Promise<void>;
  refetchSilent?: () => Promise<void>;
  updateTaskOptimistic?: (genreId: string, missionId: string, taskId: string, done: boolean, completedAt: string | null) => void;
}

export function MissionList({ selectedGenre, refetch, refetchSilent, updateTaskOptimistic }: MissionListProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addSummary, setAddSummary] = useState("");
  const [addDueDate, setAddDueDate] = useState("");
  const [isAddingMission, setIsAddingMission] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const missions: Mission[] = sortMissionsByDueAndIncomplete(selectedGenre?.missions ?? []);

  const handleAddMission = async () => {
    if (!selectedGenre) return;
    const name = addName.trim();
    if (!name) {
      setAlertMessage("名前を入力してください。");
      return;
    }
    if (isAddingMission) return;
    setIsAddingMission(true);
    try {
      const res = await fetch(`/api/genres/${selectedGenre.id}/missions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name,
          summary: addSummary.trim() || null,
          due_date: addDueDate && /^\d{4}-\d{2}-\d{2}$/.test(addDueDate) ? addDueDate : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "追加に失敗しました");
      }
      setAddName("");
      setAddSummary("");
      setAddDueDate("");
      setShowAddModal(false);
      await (refetchSilent ?? refetch)();
    } catch (e) {
      setAlertMessage(e instanceof Error ? e.message : "不明なエラー");
    } finally {
      setIsAddingMission(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-row items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-100 flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span>{selectedGenre ? selectedGenre.name : "ジャンルを選択してください"}</span>
          {selectedGenre?.summary && (
            <span className="text-gray-300 text-sm font-normal">
              {selectedGenre.summary}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => selectedGenre && setShowAddModal(true)}
          disabled={!selectedGenre}
          className="flex-shrink-0 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
        >
          ミッション追加
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        {missions.map((m) => (
          <motion.div
            key={m.id}
            layout
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
          >
            <MissionCard
            mission={m}
            genre={selectedGenre!}
            onChanged={refetchSilent ?? refetch}
            updateTaskOptimistic={updateTaskOptimistic}
          />
          </motion.div>
        ))}
      </div>

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="ミッション追加"
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
              onClick={handleAddMission}
              disabled={isAddingMission}
              className="px-4 py-2.5 min-h-[44px] bg-emerald-600 text-white rounded hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              {isAddingMission ? "追加中..." : "OK"}
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
