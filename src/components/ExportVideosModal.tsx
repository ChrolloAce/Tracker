import React, { useState } from 'react';
import { X, Download, FileDown } from 'lucide-react';

interface ExportVideosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (filename: string) => void;
  selectedCount: number;
}

export const ExportVideosModal: React.FC<ExportVideosModalProps> = ({
  isOpen,
  onClose,
  onExport,
  selectedCount
}) => {
  const [filename, setFilename] = useState('video-export');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (filename.trim()) {
      onExport(filename.trim());
      setFilename('video-export'); // Reset
    }
  };

  const handleClose = () => {
    setFilename('video-export');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-[#1A1A1A] rounded-2xl shadow-2xl border border-gray-800/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              <FileDown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Export Videos</h2>
              <p className="text-sm text-gray-400">{selectedCount} video{selectedCount !== 1 ? 's' : ''} selected</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              File Name
            </label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="Enter filename"
              className="w-full px-4 py-3 bg-[#1E1E20] border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              File will be saved as <span className="text-white font-mono">{filename || 'video-export'}.csv</span>
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-800/50">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-300 border border-gray-700 rounded-full hover:border-gray-600 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!filename.trim()}
              className="px-5 py-2 text-sm font-bold text-black bg-white rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

