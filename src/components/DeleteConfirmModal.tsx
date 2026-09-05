import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { Conversation } from '../types';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  conversation: Conversation | null;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  isDeleting: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  conversation,
  onConfirm,
  onClose,
  isDeleting,
}) => {
  if (!isOpen || !conversation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-[#FFFFFF] border border-[#DCE5F0] rounded-[12px] shadow-lg max-w-md w-full p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-[8px] bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-base text-[#12243A]">Delete conversation?</h3>
            <p className="text-xs text-[#52657A] mt-1 leading-relaxed">
              Are you sure you want to delete <span className="font-medium text-[#12243A]">"{conversation.title}"</span>? This will permanently remove all messages, its summary, and any associated next-step actions.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DCE5F0]">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-3.5 py-2 text-xs font-medium text-[#52657A] hover:text-[#12243A] rounded-[8px] transition-colors"
          >
            Cancel
          </button>
          <button
            id="confirm-delete-conv-btn"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-[8px] transition-colors shadow-xs disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete conversation'}
          </button>
        </div>
      </div>
    </div>
  );
};
