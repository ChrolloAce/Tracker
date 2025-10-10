import React from 'react';
import { FileText } from 'lucide-react';

interface ContractPreviewProps {
  creatorName: string;
  contractStartDate: string;
  contractEndDate: string;
  contractNotes: string;
  paymentStructureName?: string;
}

const ContractPreview: React.FC<ContractPreviewProps> = ({
  creatorName,
  contractStartDate,
  contractEndDate,
  contractNotes,
  paymentStructureName
}) => {
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const hasContent = contractStartDate || contractEndDate || contractNotes;

  if (!hasContent) {
    return (
      <div className="bg-[#0A0A0A] border border-gray-800 text-white rounded-lg p-8 shadow-2xl h-full flex flex-col items-center justify-center text-center">
        <FileText className="w-12 h-12 text-gray-600 mb-3" />
        <p className="text-gray-400 text-sm">No contract details configured</p>
        <p className="text-gray-500 text-xs mt-1">Add contract information to see preview</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0A0A0A] border border-gray-800 text-white rounded-lg p-8 shadow-2xl min-h-full flex flex-col">
      {/* Header */}
      <div className="border-b-2 border-white/20 pb-4 mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">CREATOR CONTRACT</h2>
        <p className="text-sm text-gray-400">Content Creation Agreement</p>
      </div>

      {/* Parties */}
      <div className="mb-6">
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Parties</div>
        <div className="space-y-2">
          <div>
            <span className="text-sm text-gray-400">Creator: </span>
            <span className="text-base text-white font-semibold">{creatorName}</span>
          </div>
          <div>
            <span className="text-sm text-gray-400">Company: </span>
            <span className="text-base text-white font-semibold">[Your Company Name]</span>
          </div>
        </div>
      </div>

      {/* Contract Period */}
      {(contractStartDate || contractEndDate) && (
        <div className="mb-6">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Contract Period</div>
          <div className="space-y-1">
            {contractStartDate && (
              <div>
                <span className="text-sm text-gray-400">Start Date: </span>
                <span className="text-base text-white">{formatDate(contractStartDate)}</span>
              </div>
            )}
            {contractEndDate && (
              <div>
                <span className="text-sm text-gray-400">End Date: </span>
                <span className="text-base text-white">{formatDate(contractEndDate)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Reference */}
      {paymentStructureName && (
        <div className="mb-6">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Payment Structure</div>
          <div className="text-base text-white">{paymentStructureName}</div>
        </div>
      )}

      {/* Contract Terms */}
      {contractNotes && (
        <div className="flex-1">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-3 border-b border-white/10 pb-1">
            Terms & Conditions
          </div>
          <div className="text-base text-gray-300 leading-relaxed whitespace-pre-wrap">
            {contractNotes}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 pt-6 border-t-2 border-white/20">
        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-400">
            This is a preview
          </div>
          <div className="text-gray-500 text-xs">
            {new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>
        </div>
      </div>

      {/* Signature Section */}
      <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 gap-8">
        <div>
          <div className="text-xs text-gray-500 mb-2">Creator Signature</div>
          <div className="border-b border-white/20 pb-1 mb-1"></div>
          <div className="text-xs text-gray-400">{creatorName}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-2">Company Representative</div>
          <div className="border-b border-white/20 pb-1 mb-1"></div>
          <div className="text-xs text-gray-400">[Authorized Signatory]</div>
        </div>
      </div>
    </div>
  );
};

export default ContractPreview;

