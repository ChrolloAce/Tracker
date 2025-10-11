import React from 'react';
import { FileText } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

interface ContractSignature {
  name: string;
  signedAt: Timestamp;
  signatureData?: string;
  ipAddress?: string;
}

interface ContractPreviewProps {
  creatorName: string;
  companyName?: string;
  contractStartDate: string;
  contractEndDate: string;
  contractNotes: string;
  paymentStructureName?: string;
  creatorSignature?: ContractSignature | null;
  companySignature?: ContractSignature | null;
}

const ContractPreview: React.FC<ContractPreviewProps> = ({
  creatorName,
  companyName,
  contractStartDate,
  contractEndDate,
  contractNotes,
  paymentStructureName,
  creatorSignature,
  companySignature
}) => {
  const formatDate = (dateString: string) => {
    if (!dateString || dateString === 'Indefinite') return dateString || 'Not specified';
    // Parse as local date to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
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
            <span className="text-base text-white font-semibold">{companyName || '[Your Company Name]'}</span>
          </div>
        </div>
      </div>

      {/* Contract Period */}
      {contractStartDate && (
        <div className="mb-6">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Contract Period</div>
          <div className="space-y-1">
            <div>
              <span className="text-sm text-gray-400">Start Date: </span>
              <span className="text-base text-white">{formatDate(contractStartDate)}</span>
            </div>
            {contractEndDate && contractEndDate !== 'Indefinite' && (
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
          {creatorSignature?.signatureData ? (
            <>
              <div className="mb-2">
                <img 
                  src={creatorSignature.signatureData} 
                  alt="Creator Signature" 
                  className="max-w-full h-auto max-h-16 bg-white rounded px-2 py-1"
                />
              </div>
              <div className="text-xs text-gray-400">{creatorSignature.name}</div>
              <div className="text-xs text-gray-500 mt-1">
                Signed: {creatorSignature.signedAt.toDate().toLocaleDateString()}
              </div>
            </>
          ) : (
            <>
              <div className="border-b border-white/20 pb-1 mb-1 h-12"></div>
              <div className="text-xs text-gray-400">{creatorName}</div>
            </>
          )}
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-2">Company Representative</div>
          {companySignature?.signatureData ? (
            <>
              <div className="mb-2">
                <img 
                  src={companySignature.signatureData} 
                  alt="Company Signature" 
                  className="max-w-full h-auto max-h-16 bg-white rounded px-2 py-1"
                />
              </div>
              <div className="text-xs text-gray-400">{companySignature.name}</div>
              <div className="text-xs text-gray-500 mt-1">
                Signed: {companySignature.signedAt.toDate().toLocaleDateString()}
              </div>
            </>
          ) : (
            <>
              <div className="border-b border-white/20 pb-1 mb-1 h-12"></div>
              <div className="text-xs text-gray-400">[Authorized Signatory]</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContractPreview;

