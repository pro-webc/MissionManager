"use client";

import { Modal } from "./Modal";

interface AlertModalProps {
  isOpen: boolean;
  message: string;
  onClose: () => void;
}

export function AlertModal({ isOpen, message, onClose }: AlertModalProps) {
  if (!isOpen) return null;
  return (
    <Modal isOpen title="メッセージ" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-gray-200">{message}</p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-500 touch-manipulation"
          >
            OK
          </button>
        </div>
      </div>
    </Modal>
  );
}
