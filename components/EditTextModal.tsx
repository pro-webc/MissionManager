"use client";

import { useState, useEffect, useRef } from "react";
import { Modal } from "./Modal";
import { AlertModal } from "./AlertModal";

interface EditTextModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  initialValue: string;
  placeholder?: string;
  multiline?: boolean;
  allowEmpty?: boolean; // 概要など、空を許可する場合
  onConfirm: (value: string) => void;
}

export function EditTextModal({
  isOpen,
  onClose,
  title,
  initialValue,
  placeholder,
  multiline = false,
  allowEmpty = false,
  onConfirm,
}: EditTextModalProps) {
  const [value, setValue] = useState(initialValue);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      setValidationError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, initialValue]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed || allowEmpty) {
      onConfirm(trimmed);
      onClose();
    } else {
      setValidationError("値を入力してください。");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full border border-gray-600 rounded px-3 py-2.5 min-h-[80px] bg-gray-800 text-gray-100 placeholder-gray-500 text-base"
            rows={4}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full border border-gray-600 rounded px-3 py-2.5 min-h-[44px] bg-gray-800 text-gray-100 placeholder-gray-500 text-base"
          />
        )}
        <div className="flex justify-end gap-2 flex-wrap">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 min-h-[44px] border border-gray-600 rounded hover:bg-gray-700 active:bg-gray-600 text-gray-200 touch-manipulation"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2.5 min-h-[44px] bg-blue-600 text-white rounded hover:bg-blue-500 active:bg-blue-700 touch-manipulation"
          >
            OK
          </button>
        </div>
      </div>
      <AlertModal
        isOpen={validationError !== null}
        message={validationError ?? ""}
        onClose={() => setValidationError(null)}
      />
    </Modal>
  );
}
