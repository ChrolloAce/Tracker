import React, { useMemo } from 'react';
import { FileText } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { CreatorContactInfo, CompanyContactInfo } from '../types/contract';

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
  creatorInfo?: CreatorContactInfo;
  companyInfo?: CompanyContactInfo;
}

// Template variables that can be used in contract text
const TEMPLATE_VARIABLES = {
  '{{CREATOR_NAME}}': 'creatorName',
  '{{COMPANY_NAME}}': 'companyName',
  '{{START_DATE}}': 'startDate',
  '{{END_DATE}}': 'endDate',
  '{{CREATOR_EMAIL}}': 'creatorEmail',
  '{{CREATOR_PHONE}}': 'creatorPhone',
  '{{CREATOR_ADDRESS}}': 'creatorAddress',
  '{{COMPANY_EMAIL}}': 'companyEmail',
  '{{COMPANY_PHONE}}': 'companyPhone',
  '{{COMPANY_ADDRESS}}': 'companyAddress',
  '{{PAYMENT_STRUCTURE}}': 'paymentStructure',
  '{{TODAY_DATE}}': 'todayDate',
};

const ContractPreview: React.FC<ContractPreviewProps> = ({
  creatorName,
  companyName,
  contractStartDate,
  contractEndDate,
  contractNotes,
  paymentStructureName,
  creatorSignature,
  companySignature,
  creatorInfo,
  companyInfo
}) => {
  const formatDate = (dateString: string) => {
    if (!dateString || dateString === 'Indefinite') return dateString || 'Not specified';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Process contract notes to replace template variables
  const processedNotes = useMemo(() => {
    if (!contractNotes) return '';
    
    let processed = contractNotes;
    
    // Replace template variables with actual values
    const replacements: Record<string, string> = {
      '{{CREATOR_NAME}}': creatorName || '[Creator Name]',
      '{{COMPANY_NAME}}': companyName || '[Company Name]',
      '{{START_DATE}}': formatDate(contractStartDate),
      '{{END_DATE}}': contractEndDate === 'Indefinite' ? 'Indefinite' : formatDate(contractEndDate),
      '{{CREATOR_EMAIL}}': creatorInfo?.email || '[Creator Email]',
      '{{CREATOR_PHONE}}': creatorInfo?.phone || '[Creator Phone]',
      '{{CREATOR_ADDRESS}}': creatorInfo?.address || '[Creator Address]',
      '{{COMPANY_EMAIL}}': companyInfo?.email || '[Company Email]',
      '{{COMPANY_PHONE}}': companyInfo?.phone || '[Company Phone]',
      '{{COMPANY_ADDRESS}}': companyInfo?.address || '[Company Address]',
      '{{PAYMENT_STRUCTURE}}': paymentStructureName || '[Payment Structure]',
      '{{TODAY_DATE}}': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    };
    
    Object.entries(replacements).forEach(([placeholder, value]) => {
      processed = processed.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    });
    
    return processed;
  }, [contractNotes, creatorName, companyName, contractStartDate, contractEndDate, creatorInfo, companyInfo, paymentStructureName]);

  const hasContent = contractStartDate || contractEndDate || contractNotes;

  if (!hasContent) {
    return (
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-8 h-full flex flex-col items-center justify-center text-center">
        <FileText className="w-12 h-12 text-gray-400 mb-3" />
        <p className="text-gray-600 text-sm">No contract details configured</p>
        <p className="text-gray-400 text-xs mt-1">Add contract information to see preview</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-xl border border-gray-200 min-h-full flex flex-col" style={{ fontFamily: 'Georgia, Times New Roman, serif' }}>
      {/* Paper texture effect */}
      <div className="p-10 flex-1 flex flex-col">
        {/* Header with decorative line */}
        <div className="text-center mb-8">
          <div className="w-24 h-1 bg-gray-800 mx-auto mb-6"></div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-wide mb-2">
            CREATOR AGREEMENT
          </h1>
          <p className="text-sm text-gray-500 italic">Content Creation Contract</p>
          <div className="w-24 h-1 bg-gray-800 mx-auto mt-6"></div>
        </div>

        {/* Contract intro paragraph */}
        <p className="text-gray-700 leading-relaxed mb-8 text-center text-sm">
          This Agreement ("Agreement") is entered into as of <span className="font-semibold">{formatDate(contractStartDate)}</span>,
          by and between the parties identified below.
        </p>

        {/* Parties Section */}
        <div className="grid grid-cols-2 gap-8 mb-8 border-t border-b border-gray-200 py-6">
          {/* Company */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Company ("Client")</h3>
            <div className="space-y-1">
              <p className="text-gray-900 font-semibold text-lg">{companyName || '[Company Name]'}</p>
              {companyInfo?.address && (
                <p className="text-gray-600 text-sm">{companyInfo.address}</p>
              )}
              {companyInfo?.email && (
                <p className="text-gray-600 text-sm">{companyInfo.email}</p>
              )}
              {companyInfo?.phone && (
                <p className="text-gray-600 text-sm">{companyInfo.phone}</p>
              )}
            </div>
          </div>

          {/* Creator */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Creator ("Contractor")</h3>
            <div className="space-y-1">
              <p className="text-gray-900 font-semibold text-lg">{creatorName || '[Creator Name]'}</p>
              {creatorInfo?.address && (
                <p className="text-gray-600 text-sm">{creatorInfo.address}</p>
              )}
              {creatorInfo?.email && (
                <p className="text-gray-600 text-sm">{creatorInfo.email}</p>
              )}
              {creatorInfo?.phone && (
                <p className="text-gray-600 text-sm">{creatorInfo.phone}</p>
              )}
            </div>
          </div>
        </div>

        {/* Contract Period */}
        <div className="mb-6 bg-gray-50 rounded-lg p-4 border border-gray-100">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Contract Period</h3>
          <div className="flex gap-8">
            <div>
              <span className="text-sm text-gray-500">Effective Date: </span>
              <span className="text-gray-900 font-medium">{formatDate(contractStartDate)}</span>
            </div>
            <div>
              <span className="text-sm text-gray-500">End Date: </span>
              <span className="text-gray-900 font-medium">
                {contractEndDate === 'Indefinite' ? 'Ongoing (No fixed end date)' : formatDate(contractEndDate)}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Structure */}
        {paymentStructureName && (
          <div className="mb-6 bg-gray-50 rounded-lg p-4 border border-gray-100">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Compensation</h3>
            <p className="text-gray-900 font-medium">{paymentStructureName}</p>
          </div>
        )}

        {/* Terms & Conditions */}
        {processedNotes && (
          <div className="flex-1 mb-8">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 pb-2 border-b border-gray-200">
              Terms & Conditions
            </h3>
            <div className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">
              {processedNotes}
            </div>
          </div>
        )}

        {/* Signature Section */}
        <div className="mt-auto pt-8 border-t-2 border-gray-800">
          <p className="text-center text-sm text-gray-500 mb-8 italic">
            IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.
          </p>
          
          <div className="grid grid-cols-2 gap-12">
            {/* Company Signature */}
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">For the Company</h4>
              {companySignature?.signatureData ? (
                <div>
                  <div className="mb-3 border-b-2 border-gray-800 pb-2">
                    <img 
                      src={companySignature.signatureData} 
                      alt="Company Signature" 
                      className="max-w-full h-auto max-h-16"
                    />
                  </div>
                  <p className="text-gray-900 font-medium">{companySignature.name}</p>
                  <p className="text-sm text-gray-500">
                    Date: {companySignature.signedAt.toDate().toLocaleDateString()}
                  </p>
                </div>
              ) : (
                <div>
                  <div className="h-16 border-b-2 border-gray-400 mb-2"></div>
                  <p className="text-gray-500 text-sm">Authorized Signatory</p>
                  <p className="text-gray-400 text-sm mt-1">Date: _______________</p>
                </div>
              )}
            </div>

            {/* Creator Signature */}
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">For the Creator</h4>
              {creatorSignature?.signatureData ? (
                <div>
                  <div className="mb-3 border-b-2 border-gray-800 pb-2">
                    <img 
                      src={creatorSignature.signatureData} 
                      alt="Creator Signature" 
                      className="max-w-full h-auto max-h-16"
                    />
                  </div>
                  <p className="text-gray-900 font-medium">{creatorSignature.name}</p>
                  <p className="text-sm text-gray-500">
                    Date: {creatorSignature.signedAt.toDate().toLocaleDateString()}
                  </p>
                </div>
              ) : (
                <div>
                  <div className="h-16 border-b-2 border-gray-400 mb-2"></div>
                  <p className="text-gray-500 text-sm">{creatorName || 'Creator'}</p>
                  <p className="text-gray-400 text-sm mt-1">Date: _______________</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">
            Page 1 of 1 • Generated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ContractPreview;

// Export template variables for use in editor
export { TEMPLATE_VARIABLES };
