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
  creatorName, companyName, contractStartDate, contractEndDate,
  contractNotes, paymentStructureName, creatorSignature, companySignature,
  creatorInfo, companyInfo,
}) => {
  const fmt = (d: string) => {
    if (!d || d === 'Indefinite') return d || 'Not specified';
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const processedNotes = useMemo(() => {
    if (!contractNotes) return '';
    let p = contractNotes;
    const r: Record<string, string> = {
      '{{CREATOR_NAME}}': creatorName || '[Creator Name]',
      '{{COMPANY_NAME}}': companyName || '[Company Name]',
      '{{START_DATE}}': fmt(contractStartDate),
      '{{END_DATE}}': contractEndDate === 'Indefinite' ? 'Indefinite' : fmt(contractEndDate),
      '{{CREATOR_EMAIL}}': creatorInfo?.email || '[Creator Email]',
      '{{CREATOR_PHONE}}': creatorInfo?.phone || '[Creator Phone]',
      '{{CREATOR_ADDRESS}}': creatorInfo?.address || '[Creator Address]',
      '{{COMPANY_EMAIL}}': companyInfo?.email || '[Company Email]',
      '{{COMPANY_PHONE}}': companyInfo?.phone || '[Company Phone]',
      '{{COMPANY_ADDRESS}}': companyInfo?.address || '[Company Address]',
      '{{PAYMENT_STRUCTURE}}': paymentStructureName || '[Payment Structure]',
      '{{TODAY_DATE}}': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    };
    Object.entries(r).forEach(([k, v]) => { p = p.replace(new RegExp(k.replace(/[{}]/g, '\\$&'), 'g'), v); });
    return p;
  }, [contractNotes, creatorName, companyName, contractStartDate, contractEndDate, creatorInfo, companyInfo, paymentStructureName]);

  if (!contractStartDate && !contractEndDate && !contractNotes) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 h-full flex flex-col items-center justify-center text-center">
        <FileText className="w-10 h-10 text-gray-300 mb-3" />
        <p className="text-gray-500 text-sm">No contract details yet</p>
        <p className="text-gray-400 text-xs mt-1">Add information to see preview</p>
      </div>
    );
  }

  const renderSig = (label: string, sig: ContractSignature | null | undefined, fallback: string) => (
    <div className="flex-1">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-4">{label}</p>
      {sig?.signatureData ? (
        <div>
          <div className="h-12 mb-1">
            <img src={sig.signatureData} alt="Signature" className="max-h-full" />
          </div>
          <div className="border-t border-gray-900 pt-1.5">
            <p className="text-xs font-medium text-gray-900">{sig.name}</p>
            <p className="text-[10px] text-gray-400">
              {sig.signedAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
      ) : (
        <div>
          <div className="h-12 mb-1" />
          <div className="border-t border-gray-300 border-dashed pt-1.5">
            <p className="text-xs text-gray-400">{fallback}</p>
            <p className="text-[10px] text-gray-300 mt-1">Date: _______________</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white min-h-full">
      <div className="p-8 sm:p-10">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-lg font-bold text-gray-900 tracking-wide uppercase">
            Content Creator Agreement
          </h1>
        </div>

        {/* Intro */}
        <p className="text-gray-600 leading-relaxed mb-6 text-xs text-center">
          This Agreement is entered into as of{' '}
          <span className="font-semibold text-gray-800">{fmt(contractStartDate)}</span>,
          by and between the parties identified below.
        </p>

        {/* Parties */}
        <div className="grid grid-cols-2 gap-6 mb-6 py-4 border-y border-gray-200">
          {[
            { title: 'Company', name: companyName || '[Company Name]', info: companyInfo },
            { title: 'Creator', name: creatorName || '[Creator Name]', info: creatorInfo },
          ].map(p => (
            <div key={p.title}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">{p.title}</p>
              <p className="text-gray-900 font-semibold text-sm">{p.name}</p>
              {p.info?.email && <p className="text-gray-500 text-[11px]">{p.info.email}</p>}
              {p.info?.phone && <p className="text-gray-500 text-[11px]">{p.info.phone}</p>}
              {p.info?.address && <p className="text-gray-500 text-[11px]">{p.info.address}</p>}
            </div>
          ))}
        </div>

        {/* Period & Compensation */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 mb-6 text-xs">
          <div><span className="text-gray-400">Start: </span><span className="text-gray-800 font-medium">{fmt(contractStartDate)}</span></div>
          <div><span className="text-gray-400">End: </span><span className="text-gray-800 font-medium">{contractEndDate === 'Indefinite' ? 'Ongoing' : fmt(contractEndDate)}</span></div>
          {paymentStructureName && (
            <div><span className="text-gray-400">Compensation: </span><span className="text-gray-800 font-medium">{paymentStructureName}</span></div>
          )}
        </div>

        {/* Terms */}
        {processedNotes && (
          <div className="mb-8">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2 pb-1.5 border-b border-gray-200">
              Terms & Conditions
            </p>
            <div className="text-gray-700 leading-relaxed whitespace-pre-wrap text-xs">
              {processedNotes}
            </div>
          </div>
        )}

        {/* Signatures */}
        <div className="pt-6 border-t border-gray-200">
          <div className="flex gap-8">
            {renderSig('The Company', companySignature, 'Authorized Signatory')}
            {renderSig('The Creator', creatorSignature, creatorName || 'Creator')}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-3 border-t border-gray-200 text-center">
          <p className="text-[9px] text-gray-300">
            {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ContractPreview;
export { TEMPLATE_VARIABLES };
