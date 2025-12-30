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
    <div 
      className="bg-white min-h-full flex flex-col relative"
      style={{ 
        fontFamily: '"Times New Roman", Times, Georgia, serif',
        boxShadow: '0 0 20px rgba(0,0,0,0.1), inset 0 0 80px rgba(0,0,0,0.02)'
      }}
    >
      {/* Legal document border */}
      <div className="absolute inset-4 border-2 border-gray-300 pointer-events-none"></div>
      <div className="absolute inset-5 border border-gray-200 pointer-events-none"></div>
      
      {/* Document content */}
      <div className="p-12 flex-1 flex flex-col relative z-10">
        {/* Confidential watermark */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-100 text-6xl font-bold rotate-[-30deg] pointer-events-none select-none tracking-[0.3em] opacity-30">
          AGREEMENT
        </div>

        {/* Document Header */}
        <div className="text-center mb-10 relative">
          <div className="flex justify-center items-center gap-4 mb-4">
            <div className="flex-1 h-[2px] bg-gradient-to-r from-transparent via-gray-400 to-gray-600"></div>
            <div className="text-gray-400 text-sm tracking-[0.2em]">LEGAL DOCUMENT</div>
            <div className="flex-1 h-[2px] bg-gradient-to-l from-transparent via-gray-400 to-gray-600"></div>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 tracking-[0.15em] uppercase mb-2">
            CONTENT CREATOR AGREEMENT
          </h1>
          <div className="text-sm text-gray-600 tracking-wide">
            Independent Contractor Services Contract
          </div>
          
          <div className="flex justify-center items-center gap-4 mt-4">
            <div className="flex-1 h-[2px] bg-gradient-to-r from-transparent via-gray-400 to-gray-600"></div>
            <div className="w-3 h-3 border-2 border-gray-400 rotate-45"></div>
            <div className="flex-1 h-[2px] bg-gradient-to-l from-transparent via-gray-400 to-gray-600"></div>
          </div>
        </div>

        {/* Preamble */}
        <div className="mb-8 text-justify leading-relaxed text-gray-800">
          <p className="text-sm">
            <strong>THIS AGREEMENT</strong> (the "Agreement") is made and entered into as of{' '}
            <span className="underline font-semibold">{formatDate(contractStartDate)}</span>{' '}
            (the "Effective Date"), by and between the parties identified herein, each referred to individually 
            as a "Party" and collectively as the "Parties."
          </p>
        </div>

        {/* Recitals */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-gray-900 tracking-wider uppercase mb-4 border-b border-gray-300 pb-2">
            RECITALS
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed text-justify">
            <strong>WHEREAS</strong>, the Company desires to engage the Creator to provide content creation services; and{' '}
            <strong>WHEREAS</strong>, the Creator desires to provide such services to the Company subject to the terms and 
            conditions set forth herein; <strong>NOW, THEREFORE</strong>, in consideration of the mutual covenants and 
            agreements hereinafter set forth and for other good and valuable consideration, the receipt and sufficiency 
            of which are hereby acknowledged, the Parties agree as follows:
          </p>
        </div>

        {/* Article I: Parties */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-gray-900 tracking-wider uppercase mb-4 border-b border-gray-300 pb-2">
            ARTICLE I — PARTIES TO THE AGREEMENT
          </h2>
          
          <div className="grid grid-cols-2 gap-8">
            {/* Company */}
            <div className="border-l-4 border-gray-800 pl-4">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Section 1.1 — The Company</div>
              <div className="text-gray-900 font-bold">{companyName || '[COMPANY NAME]'}</div>
              {companyInfo?.address && (
                <div className="text-sm text-gray-600 mt-1">{companyInfo.address}</div>
              )}
              {companyInfo?.email && (
                <div className="text-sm text-gray-600">Email: {companyInfo.email}</div>
              )}
              {companyInfo?.phone && (
                <div className="text-sm text-gray-600">Tel: {companyInfo.phone}</div>
              )}
              <div className="text-xs text-gray-500 mt-2 italic">(hereinafter referred to as "Company" or "Client")</div>
            </div>

            {/* Creator */}
            <div className="border-l-4 border-gray-800 pl-4">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Section 1.2 — The Creator</div>
              <div className="text-gray-900 font-bold">{creatorName || '[CREATOR NAME]'}</div>
              {creatorInfo?.address && (
                <div className="text-sm text-gray-600 mt-1">{creatorInfo.address}</div>
              )}
              {creatorInfo?.email && (
                <div className="text-sm text-gray-600">Email: {creatorInfo.email}</div>
              )}
              {creatorInfo?.phone && (
                <div className="text-sm text-gray-600">Tel: {creatorInfo.phone}</div>
              )}
              <div className="text-xs text-gray-500 mt-2 italic">(hereinafter referred to as "Creator" or "Contractor")</div>
            </div>
          </div>
        </div>

        {/* Article II: Term */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-gray-900 tracking-wider uppercase mb-4 border-b border-gray-300 pb-2">
            ARTICLE II — TERM OF AGREEMENT
          </h2>
          
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              <strong>2.1 Effective Date.</strong> This Agreement shall become effective on{' '}
              <span className="underline">{formatDate(contractStartDate)}</span>.
            </p>
            <p>
              <strong>2.2 Term.</strong> This Agreement shall remain in effect{' '}
              {contractEndDate === 'Indefinite' ? (
                <span>indefinitely until terminated by either Party in accordance with the provisions herein.</span>
              ) : (
                <span>until <span className="underline">{formatDate(contractEndDate)}</span>, unless earlier terminated in accordance with the provisions herein.</span>
              )}
            </p>
          </div>
        </div>

        {/* Article III: Compensation */}
        {paymentStructureName && (
          <div className="mb-8">
            <h2 className="text-sm font-bold text-gray-900 tracking-wider uppercase mb-4 border-b border-gray-300 pb-2">
              ARTICLE III — COMPENSATION
            </h2>
            
            <p className="text-sm text-gray-700">
              <strong>3.1 Payment Structure.</strong> The Creator shall be compensated in accordance with the 
              following payment structure: <span className="font-semibold underline">{paymentStructureName}</span>.
              Specific payment terms, rates, and schedules are as detailed in Schedule A attached hereto.
            </p>
          </div>
        )}

        {/* Article IV: Terms & Conditions */}
        {processedNotes && (
          <div className="flex-1 mb-8">
            <h2 className="text-sm font-bold text-gray-900 tracking-wider uppercase mb-4 border-b border-gray-300 pb-2">
              ARTICLE {paymentStructureName ? 'IV' : 'III'} — TERMS AND CONDITIONS
            </h2>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap text-justify">
              {processedNotes}
            </div>
          </div>
        )}

        {/* Signature Block */}
        <div className="mt-auto pt-10 border-t-2 border-gray-800">
          <div className="text-center mb-8">
            <p className="text-sm text-gray-700 italic">
              <strong>IN WITNESS WHEREOF</strong>, the Parties have executed this Agreement as of the Effective Date 
              first written above, each by their duly authorized representative.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-16">
            {/* Company Signature */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-6 font-bold">
                THE COMPANY:
              </div>
              <div className="space-y-4">
                {companySignature?.signatureData ? (
                  <>
                    <div className="border-b-2 border-gray-900 pb-1">
                      <img 
                        src={companySignature.signatureData} 
                        alt="Company Signature" 
                        className="max-w-full h-auto max-h-12"
                      />
                    </div>
                    <div className="text-sm">
                      <div className="font-bold text-gray-900">{companySignature.name}</div>
                      <div className="text-gray-600">Authorized Representative</div>
                      <div className="text-gray-500 text-xs mt-1">
                        Signed: {companySignature.signedAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-12 border-b-2 border-gray-400"></div>
                    <div className="text-sm text-gray-500">
                      <div>Signature</div>
                      <div className="mt-4 pt-2 border-t border-gray-300">Name: _______________________</div>
                      <div className="mt-2">Title: ________________________</div>
                      <div className="mt-2">Date: ________________________</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Creator Signature */}
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-6 font-bold">
                THE CREATOR:
              </div>
              <div className="space-y-4">
                {creatorSignature?.signatureData ? (
                  <>
                    <div className="border-b-2 border-gray-900 pb-1">
                      <img 
                        src={creatorSignature.signatureData} 
                        alt="Creator Signature" 
                        className="max-w-full h-auto max-h-12"
                      />
                    </div>
                    <div className="text-sm">
                      <div className="font-bold text-gray-900">{creatorSignature.name}</div>
                      <div className="text-gray-600">Creator / Independent Contractor</div>
                      <div className="text-gray-500 text-xs mt-1">
                        Signed: {creatorSignature.signedAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-12 border-b-2 border-gray-400"></div>
                    <div className="text-sm text-gray-500">
                      <div>Signature</div>
                      <div className="mt-4 pt-2 border-t border-gray-300">Name: {creatorName || '_______________________'}</div>
                      <div className="mt-2">Date: ________________________</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Document Footer */}
        <div className="mt-10 pt-4 border-t border-gray-300 flex justify-between items-center text-xs text-gray-400">
          <div>Document ID: {Math.random().toString(36).substring(2, 10).toUpperCase()}</div>
          <div>Page 1 of 1</div>
          <div>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
      </div>
    </div>
  );
};

export default ContractPreview;

// Export template variables for use in editor
export { TEMPLATE_VARIABLES };
