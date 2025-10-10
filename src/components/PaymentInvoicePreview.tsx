import React from 'react';
import { TieredPaymentStructure } from '../types/payments';
import { FileText } from 'lucide-react';

interface PaymentInvoicePreviewProps {
  structure: TieredPaymentStructure | null;
  creatorName: string;
}

const PaymentInvoicePreview: React.FC<PaymentInvoicePreviewProps> = ({ structure, creatorName }) => {
  if (!structure || !structure.tiers || structure.tiers.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-lg p-8 h-full flex flex-col items-center justify-center text-center">
        <FileText className="w-12 h-12 text-gray-600 mb-3" />
        <p className="text-gray-400 text-sm">No payment structure configured</p>
        <p className="text-gray-500 text-xs mt-1">Add payment stages to see preview</p>
      </div>
    );
  }

  const generateInvoiceText = (): string[] => {
    const lines: string[] = [];

    structure.tiers.forEach((tier, index) => {
      const tierNum = index + 1;
      const componentDescs: string[] = [];

      tier.components.forEach(comp => {
        if (comp.type === 'flat_fee') {
          componentDescs.push(`$${comp.amount.toLocaleString()}`);
        } else if (comp.type === 'cpm') {
          let desc = `$${comp.amount} CPM`;
          if (comp.minViews) {
            desc += ` (after ${(comp.minViews / 1000).toFixed(0)}K views)`;
          }
          if (comp.maxAmount) {
            desc += ` [capped at $${comp.maxAmount.toLocaleString()}]`;
          }
          componentDescs.push(desc);
        } else if (comp.type === 'per_view') {
          componentDescs.push(`$${comp.amount} per view`);
        } else if (comp.type === 'bonus') {
          componentDescs.push(`$${comp.amount} bonus`);
        } else if (comp.type === 'per_engagement') {
          componentDescs.push(`$${comp.amount} per engagement`);
        }
      });

      if (componentDescs.length > 0) {
        let line = `${tierNum}. ${componentDescs.join(' + ')}`;

        if (tier.appliesTo === 'per_video') {
          line += ' per video';
        } else if (tier.appliesTo === 'milestone' && tier.milestoneCondition) {
          const threshold = tier.milestoneCondition.threshold;
          const thresholdStr = threshold >= 1000 
            ? `${(threshold / 1000).toFixed(0)}K` 
            : threshold.toString();
          line += ` upon reaching ${thresholdStr} ${tier.milestoneCondition.type}`;
        } else if (tier.appliesTo === 'per_campaign') {
          line += ' per campaign';
        }

        lines.push(line);
      }
    });

    return lines;
  };

  const invoiceLines = generateInvoiceText();

  return (
    <div className="bg-[#0A0A0A] border border-gray-800 text-white rounded-lg p-8 shadow-2xl h-full flex flex-col">
      {/* Header */}
      <div className="border-b-2 border-white/20 pb-4 mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">PAYMENT AGREEMENT</h2>
        <p className="text-sm text-gray-400">Creator Compensation Structure</p>
      </div>

      {/* Creator Info */}
      <div className="mb-6">
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Creator</div>
        <div className="text-lg font-semibold text-white">{creatorName}</div>
      </div>

      {/* Contract Name */}
      {structure.name && (
        <div className="mb-6">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Contract</div>
          <div className="text-base text-white">{structure.name}</div>
        </div>
      )}

      {/* Payment Terms */}
      <div className="flex-1">
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-3 border-b border-white/10 pb-1">
          Payment Terms
        </div>
        <div className="space-y-3">
          {invoiceLines.map((line, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="text-base text-gray-300 leading-relaxed">{line}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-6 border-t-2 border-white/20">
        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-400">
            {structure.tiers.length} payment stage{structure.tiers.length !== 1 ? 's' : ''}
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
    </div>
  );
};

export default PaymentInvoicePreview;

