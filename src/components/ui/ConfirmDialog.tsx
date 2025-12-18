import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  requireTyping?: boolean;
  typingConfirmation?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDanger?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  requireTyping = false,
  typingConfirmation = 'DELETE',
  onConfirm,
  onCancel,
  isDanger = false
}) => {
  const [inputValue, setInputValue] = useState('');

  if (!isOpen) {
    return null;
  }

  const handleConfirm = () => {
    if (requireTyping && inputValue !== typingConfirmation) {
      return;
    }
    setInputValue('');
    onConfirm();
  };

  const handleCancel = () => {
    setInputValue('');
    onCancel();
  };

  const canConfirm = !requireTyping || inputValue === typingConfirmation;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleCancel}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-[#0A0A0A] rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            {isDanger && (
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
            )}
            <h2 className="text-xl font-bold text-white">{title}</h2>
          </div>
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-gray-400 text-sm whitespace-pre-line mb-4">{message}</p>
          
          {requireTyping && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-400">
                Type <span className="font-mono text-white">{typingConfirmation}</span> to confirm:
              </label>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={typingConfirmation}
                className="w-full px-4 py-3 bg-[#161616] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button
            onClick={handleCancel}
            className="px-6 py-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors font-medium"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={`px-6 py-2.5 text-sm font-medium rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isDanger
                ? 'text-white bg-red-500 hover:bg-red-600 disabled:hover:bg-red-500'
                : 'text-black bg-white hover:bg-gray-100 disabled:hover:bg-white'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

