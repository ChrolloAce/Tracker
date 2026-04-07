import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ContractService } from '../services/ContractService';
import { ShareableContract } from '../types/contract';
import { FileText, Check, Clock, AlertCircle, Loader2, Download, Shield, CheckCircle2, Circle, User, Building2, CalendarClock, PenLine, Eye, ChevronRight } from 'lucide-react';
import SignatureCanvas from '../components/ui/SignatureCanvas';

// ─── Step definitions for the progress stepper ─────────────────────────
const STEPS = [
  { key: 'review', label: 'Review', icon: Eye },
  { key: 'sign', label: 'Sign', icon: PenLine },
  { key: 'complete', label: 'Complete', icon: CheckCircle2 },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

const ContractSigningPage: React.FC = () => {
  const { contractId } = useParams<{ contractId: string }>();
  const [searchParams] = useSearchParams();
  const roleFromUrl = searchParams.get('role') as 'creator' | 'company' | null;
  const printMode = searchParams.get('print') === 'true';

  const [contract, setContract] = useState<ShareableContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [signing, setSigning] = useState(false);
  const [justSigned, setJustSigned] = useState(false);
  const [signAs, setSignAs] = useState<'creator' | 'company' | null>(null);
  const [signerName, setSignerName] = useState('');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => {
    loadContract();
  }, [contractId]);

  // Auto-trigger print dialog when in print mode
  useEffect(() => {
    if (printMode && contract && !loading) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [printMode, contract, loading]);

  // Auto-fill signer name based on role
  useEffect(() => {
    if (signAs === 'creator' && contract?.creatorName) {
      setSignerName(contract.creatorName);
    } else if (signAs === 'company' && contract?.companyName) {
      setSignerName('');
    }
  }, [signAs, contract]);

  const loadContract = async () => {
    if (!contractId) {
      setError('Invalid contract link');
      setLoading(false);
      return;
    }

    try {
      const data = await ContractService.getContractById(contractId);

      if (!data) {
        setError('Contract not found');
      } else if (data.status === 'expired') {
        setContract(data);
        setExpired(true);
      } else if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
        setContract(data);
        setExpired(true);
      } else {
        setContract(data);
      }
    } catch (err) {
      console.error('Error loading contract:', err);
      setError('Failed to load contract');
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    if (!contract || !signAs || !signerName.trim() || !signatureData || !agreedToTerms) return;

    setSigning(true);
    try {
      if (signAs === 'creator') {
        await ContractService.signAsCreator(contract.id, signerName, signatureData);
      } else {
        await ContractService.signAsCompany(contract.id, signerName, signatureData);
      }

      setJustSigned(true);
      await loadContract();
      setTimeout(() => {
        setSignAs(null);
        setSignerName('');
        setSignatureData(null);
        setAgreedToTerms(false);
        setJustSigned(false);
      }, 3000);
    } catch (err) {
      console.error('Error signing contract:', err);
      alert('Failed to sign contract. Please try again.');
    } finally {
      setSigning(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString || dateString === 'Indefinite') return dateString;
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Process contract notes to replace template variables
  const processedNotes = useMemo(() => {
    if (!contract?.contractNotes) return '';

    let processed = contract.contractNotes;

    const replacements: Record<string, string> = {
      '{{CREATOR_NAME}}': contract.creatorName || '[Creator Name]',
      '{{COMPANY_NAME}}': contract.companyName || '[Company Name]',
      '{{START_DATE}}': formatDate(contract.contractStartDate),
      '{{END_DATE}}': contract.contractEndDate === 'Indefinite' ? 'Indefinite' : formatDate(contract.contractEndDate),
      '{{CREATOR_EMAIL}}': contract.creatorInfo?.email || contract.creatorEmail || '[Creator Email]',
      '{{CREATOR_PHONE}}': contract.creatorInfo?.phone || '[Creator Phone]',
      '{{CREATOR_ADDRESS}}': contract.creatorInfo?.address || '[Creator Address]',
      '{{COMPANY_EMAIL}}': contract.companyInfo?.email || '[Company Email]',
      '{{COMPANY_PHONE}}': contract.companyInfo?.phone || '[Company Phone]',
      '{{COMPANY_ADDRESS}}': contract.companyInfo?.address || '[Company Address]',
      '{{PAYMENT_STRUCTURE}}': contract.paymentStructureName || '[Payment Structure]',
      '{{TODAY_DATE}}': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    };

    Object.entries(replacements).forEach(([placeholder, value]) => {
      processed = processed.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    });

    return processed;
  }, [contract]);

  // ─── Derive current step ──────────────────────────────────────────────
  const currentStep: StepKey = useMemo(() => {
    if (!contract) return 'review';
    const isFullySigned = contract.creatorSignature && contract.companySignature;
    if (isFullySigned) return 'complete';
    if (signAs) return 'sign';
    return 'review';
  }, [contract, signAs]);

  // ─── Build audit trail events ─────────────────────────────────────────
  const auditTrail = useMemo(() => {
    if (!contract) return [];
    const events: { label: string; date: string; icon: 'create' | 'sign' }[] = [];

    events.push({
      label: 'Contract created',
      date: formatDateTime(contract.createdAt.toDate()),
      icon: 'create',
    });

    if (contract.creatorSignature) {
      events.push({
        label: `${contract.creatorSignature.name} signed as Creator`,
        date: formatDateTime(contract.creatorSignature.signedAt.toDate()),
        icon: 'sign',
      });
    }

    if (contract.companySignature) {
      events.push({
        label: `${contract.companySignature.name} signed as Company`,
        date: formatDateTime(contract.companySignature.signedAt.toDate()),
        icon: 'sign',
      });
    }

    return events;
  }, [contract]);

  // ─── Loading state ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
          <p className="text-gray-600 font-medium">Loading your document...</p>
          <p className="text-gray-400 text-sm mt-1">Please wait while we retrieve the contract</p>
        </div>
      </div>
    );
  }

  // ─── Hard error (not found / network) ─────────────────────────────────
  if (error && !contract) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-10 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Contract Unavailable</h1>
          <p className="text-gray-500 leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  // ─── Expired state ────────────────────────────────────────────────────
  if (expired && contract) {
    const expiryDate = contract.expiresAt
      ? formatDateTime(contract.expiresAt.toDate())
      : 'a previous date';

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Orange banner */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-6">
            <div className="flex items-center gap-3">
              <CalendarClock className="w-7 h-7 text-white" />
              <h1 className="text-xl font-bold text-white">Contract Expired</h1>
            </div>
          </div>

          <div className="p-8 space-y-6">
            {/* Contract title */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Document</p>
              <p className="text-lg font-semibold text-gray-900">
                {contract.contractTitle || 'Creator Agreement'}
              </p>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Sent By</p>
                <p className="text-sm text-gray-800 font-medium">{contract.companyName || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Recipient</p>
                <p className="text-sm text-gray-800 font-medium">{contract.creatorName}</p>
              </div>
            </div>

            {/* Expiry message */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800 leading-relaxed">
                This contract expired on <span className="font-semibold">{expiryDate}</span>.
                Contact <span className="font-semibold">{contract.companyName || 'the sender'}</span> to
                request a new signing link.
              </p>
            </div>

            {/* Signature status at time of expiry */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Signature Status</p>
              <div className="flex items-center gap-2">
                {contract.creatorSignature ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <Circle className="w-4 h-4 text-gray-300" />
                )}
                <span className="text-sm text-gray-700">Creator ({contract.creatorName})</span>
              </div>
              <div className="flex items-center gap-2">
                {contract.companySignature ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <Circle className="w-4 h-4 text-gray-300" />
                )}
                <span className="text-sm text-gray-700">Company ({contract.companyName || 'N/A'})</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!contract) {
    return null;
  }

  const isFullySigned = !!(contract.creatorSignature && contract.companySignature);
  const canCreatorSign = !contract.creatorSignature;
  const canCompanySign = !contract.companySignature;

  // ─── Main render ──────────────────────────────────────────────────────
  return (
    <>
      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            margin: 0.5in;
            size: letter;
          }
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .print-contract {
            box-shadow: none !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
        }
      `}</style>

      <div className="min-h-screen bg-gray-50">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="bg-white border-b border-gray-200 shadow-sm no-print">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between">
              {/* Left: title + status pill */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                    {contract.contractTitle || 'Creator Agreement'}
                  </h1>
                  <p className="text-xs text-gray-400 hidden sm:block">
                    ID: {contract.id}
                  </p>
                </div>
                {/* Status pill */}
                {isFullySigned ? (
                  <span className="ml-2 hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                    <Check className="w-3 h-3" /> Completed
                  </span>
                ) : (
                  <span className="ml-2 hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                    <Clock className="w-3 h-3" /> Awaiting Signatures
                  </span>
                )}
              </div>

              {/* Right: download button */}
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Progress stepper ────────────────────────────────────── */}
        <div className="bg-white border-b border-gray-100 no-print">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-center justify-center gap-0">
              {STEPS.map((step, idx) => {
                const stepIdx = idx;
                const currentIdx = STEPS.findIndex((s) => s.key === currentStep);
                const isActive = step.key === currentStep;
                const isDone = stepIdx < currentIdx;
                const Icon = step.icon;

                return (
                  <React.Fragment key={step.key}>
                    {idx > 0 && (
                      <div
                        className={`hidden sm:block w-16 h-0.5 mx-1 transition-colors ${
                          isDone ? 'bg-indigo-500' : 'bg-gray-200'
                        }`}
                      />
                    )}
                    {idx > 0 && (
                      <ChevronRight className="sm:hidden w-4 h-4 text-gray-300 mx-1 flex-shrink-0" />
                    )}
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all text-sm font-semibold ${
                          isDone
                            ? 'bg-indigo-600 text-white'
                            : isActive
                            ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500 ring-offset-2'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                      </div>
                      <span
                        className={`text-sm font-medium hidden sm:inline ${
                          isActive ? 'text-indigo-700' : isDone ? 'text-indigo-600' : 'text-gray-400'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* ── Contract document ─────────────────────────────── */}
            <div className="flex-1 min-w-0 print-contract">
              <div
                className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                <div className="p-6 sm:p-10">
                  {/* Header with decorative line */}
                  <div className="text-center mb-8">
                    <div className="w-24 h-1 bg-gray-800 mx-auto mb-6"></div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-wide mb-2">
                      {contract.contractTitle?.toUpperCase() || 'CREATOR AGREEMENT'}
                    </h1>
                    <p className="text-sm text-gray-500 italic">Content Creation Contract</p>
                    <div className="w-24 h-1 bg-gray-800 mx-auto mt-6"></div>
                  </div>

                  {/* Contract intro */}
                  <p className="text-gray-700 leading-relaxed mb-8 text-center text-sm">
                    This Agreement ("Agreement") is entered into as of{' '}
                    <span className="font-semibold">{formatDate(contract.contractStartDate)}</span>, by
                    and between the parties identified below.
                  </p>

                  {/* Parties Section */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8 border-t border-b border-gray-200 py-6">
                    {/* Company */}
                    <div>
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                        Company ("Client")
                      </h3>
                      <div className="space-y-1">
                        <p className="text-gray-900 font-semibold text-lg">
                          {contract.companyName || '[Company Name]'}
                        </p>
                        {contract.companyInfo?.address && (
                          <p className="text-gray-600 text-sm">{contract.companyInfo.address}</p>
                        )}
                        {contract.companyInfo?.email && (
                          <p className="text-gray-600 text-sm">{contract.companyInfo.email}</p>
                        )}
                        {contract.companyInfo?.phone && (
                          <p className="text-gray-600 text-sm">{contract.companyInfo.phone}</p>
                        )}
                      </div>
                    </div>

                    {/* Creator */}
                    <div>
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                        Creator ("Contractor")
                      </h3>
                      <div className="space-y-1">
                        <p className="text-gray-900 font-semibold text-lg">{contract.creatorName}</p>
                        {contract.creatorInfo?.address && (
                          <p className="text-gray-600 text-sm">{contract.creatorInfo.address}</p>
                        )}
                        {(contract.creatorInfo?.email || contract.creatorEmail) && (
                          <p className="text-gray-600 text-sm">
                            {contract.creatorInfo?.email || contract.creatorEmail}
                          </p>
                        )}
                        {contract.creatorInfo?.phone && (
                          <p className="text-gray-600 text-sm">{contract.creatorInfo.phone}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contract Period */}
                  <div className="mb-6 bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                      Contract Period
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
                      <div>
                        <span className="text-sm text-gray-500">Effective Date: </span>
                        <span className="text-gray-900 font-medium">
                          {formatDate(contract.contractStartDate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">End Date: </span>
                        <span className="text-gray-900 font-medium">
                          {contract.contractEndDate === 'Indefinite'
                            ? 'Ongoing (No fixed end date)'
                            : formatDate(contract.contractEndDate)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Structure */}
                  {contract.paymentStructureName && (
                    <div className="mb-6 bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        Compensation
                      </h3>
                      <p className="text-gray-900 font-medium">{contract.paymentStructureName}</p>
                    </div>
                  )}

                  {/* Terms & Conditions */}
                  <div className="mb-8">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 pb-2 border-b border-gray-200">
                      Terms & Conditions
                    </h3>
                    <div className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm max-h-96 overflow-y-auto pr-2">
                      {processedNotes}
                    </div>
                  </div>

                  {/* ── Signature Section ───────────────────────────── */}
                  <div className="pt-8 border-t-2 border-gray-800">
                    <p className="text-center text-sm text-gray-500 mb-8 italic">
                      IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first
                      written above.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-12">
                      {/* Company Signature */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
                          For the Company
                        </h4>
                        {contract.companySignature ? (
                          <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                            <div className="flex items-center gap-2 mb-3">
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                              <span className="text-green-700 text-sm font-semibold">Signed</span>
                            </div>
                            {contract.companySignature.signatureData && (
                              <div className="mb-3 border-b-2 border-gray-300 pb-3 bg-white rounded-lg p-3">
                                <img
                                  src={contract.companySignature.signatureData}
                                  alt="Company Signature"
                                  className="max-w-full h-auto max-h-20 mx-auto"
                                />
                              </div>
                            )}
                            <p className="text-gray-900 font-semibold">
                              {contract.companySignature.name}
                            </p>
                            <p className="text-sm text-gray-500 mt-0.5">
                              {formatDateTime(contract.companySignature.signedAt.toDate())}
                            </p>
                            <p className="text-xs text-gray-400 mt-2 italic">
                              Signed via ViewTrack
                            </p>
                          </div>
                        ) : (
                          <div className="border-2 border-dashed border-gray-300 rounded-xl p-5 bg-gray-50">
                            <div className="h-20 border-b-2 border-gray-300 mb-3 flex items-center justify-center">
                              <span className="text-gray-300 text-sm">Awaiting signature</span>
                            </div>
                            <p className="text-gray-500 text-sm">Authorized Signatory</p>
                            <p className="text-gray-400 text-sm mt-1">Date: _______________</p>
                          </div>
                        )}
                      </div>

                      {/* Creator Signature */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
                          For the Creator
                        </h4>
                        {contract.creatorSignature ? (
                          <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                            <div className="flex items-center gap-2 mb-3">
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                              <span className="text-green-700 text-sm font-semibold">Signed</span>
                            </div>
                            {contract.creatorSignature.signatureData && (
                              <div className="mb-3 border-b-2 border-gray-300 pb-3 bg-white rounded-lg p-3">
                                <img
                                  src={contract.creatorSignature.signatureData}
                                  alt="Creator Signature"
                                  className="max-w-full h-auto max-h-20 mx-auto"
                                />
                              </div>
                            )}
                            <p className="text-gray-900 font-semibold">
                              {contract.creatorSignature.name}
                            </p>
                            <p className="text-sm text-gray-500 mt-0.5">
                              {formatDateTime(contract.creatorSignature.signedAt.toDate())}
                            </p>
                            <p className="text-xs text-gray-400 mt-2 italic">
                              Signed via ViewTrack
                            </p>
                          </div>
                        ) : (
                          <div className="border-2 border-dashed border-gray-300 rounded-xl p-5 bg-gray-50">
                            <div className="h-20 border-b-2 border-gray-300 mb-3 flex items-center justify-center">
                              <span className="text-gray-300 text-sm">Awaiting signature</span>
                            </div>
                            <p className="text-gray-500 text-sm">{contract.creatorName}</p>
                            <p className="text-gray-400 text-sm mt-1">Date: _______________</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-8 pt-4 border-t border-gray-200 text-center">
                    <p className="text-xs text-gray-400">
                      Contract ID: {contract.id} &bull; Generated{' '}
                      {contract.createdAt.toDate().toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Signing panel (sidebar) ───────────────────────────── */}
            <div className="w-full lg:w-96 flex-shrink-0 no-print">
              <div className="sticky top-6 space-y-4">
                {/* Main signing card */}
                <div className="bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden">
                  {/* Card header */}
                  <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-indigo-200" />
                      <h3 className="text-white font-semibold">Sign Contract</h3>
                    </div>
                  </div>

                  <div className="p-6">
                    {/* ── Success state (just signed) ──────────────── */}
                    {justSigned ? (
                      <div className="text-center py-6">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                          <CheckCircle2 className="w-10 h-10 text-green-500" />
                        </div>
                        <h4 className="text-xl font-bold text-green-700 mb-1">
                          Signature Complete!
                        </h4>
                        <p className="text-sm text-gray-500">
                          Your signature has been recorded successfully.
                        </p>
                      </div>
                    ) : isFullySigned ? (
                      /* ── Fully signed ────────────────────────────── */
                      <div className="text-center py-6">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CheckCircle2 className="w-10 h-10 text-green-500" />
                        </div>
                        <h4 className="text-xl font-bold text-gray-900 mb-1">All Signed</h4>
                        <p className="text-sm text-gray-500 mb-4">
                          This contract has been signed by all parties and is now fully executed.
                        </p>
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-left space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                            <span className="text-gray-700">
                              {contract.creatorSignature?.name}{' '}
                              <span className="text-gray-400">(Creator)</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                            <span className="text-gray-700">
                              {contract.companySignature?.name}{' '}
                              <span className="text-gray-400">(Company)</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : signAs ? (
                      /* ── Signing form ─────────────────────────────── */
                      <div className="space-y-5">
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-center">
                          <p className="text-sm text-indigo-700 font-medium">
                            Signing as {signAs === 'creator' ? 'Creator' : 'Company Representative'}
                          </p>
                        </div>

                        {/* Full name */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Full Legal Name
                          </label>
                          <input
                            type="text"
                            value={signerName}
                            onChange={(e) => setSignerName(e.target.value)}
                            placeholder="Enter your full name"
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                          />
                        </div>

                        {/* Signature canvas */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Your Signature
                          </label>
                          <SignatureCanvas
                            onSignatureChange={setSignatureData}
                            className="w-full"
                          />
                        </div>

                        {/* Legal agreement checkbox */}
                        <label className="flex items-start gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={agreedToTerms}
                            onChange={(e) => setAgreedToTerms(e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-xs text-gray-600 leading-relaxed">
                            I agree that my electronic signature is the legal equivalent of my
                            manual/handwritten signature and that I have read and agree to the terms
                            and conditions outlined in this contract.
                          </span>
                        </label>

                        {/* Action buttons */}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={handleSign}
                            disabled={!signerName.trim() || !signatureData || signing || !agreedToTerms}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors text-sm"
                          >
                            {signing ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Signing...
                              </>
                            ) : (
                              <>
                                <PenLine className="w-4 h-4" />
                                Sign & Complete
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setSignAs(null);
                              setSignerName('');
                              setSignatureData(null);
                              setAgreedToTerms(false);
                            }}
                            className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── Role selection ────────────────────────────── */
                      <div className="space-y-4">
                        <div className="text-center py-2">
                          <p className="text-sm text-gray-600 leading-relaxed">
                            You have been asked to review and sign this document. Select your role
                            below to proceed.
                          </p>
                        </div>

                        {/* Signature progress */}
                        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            Signature Progress
                          </p>
                          <div className="flex items-center gap-3">
                            {contract.creatorSignature ? (
                              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                            ) : (
                              <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">
                                {contract.creatorName}
                              </p>
                              <p className="text-xs text-gray-400">Creator</p>
                            </div>
                            {contract.creatorSignature && (
                              <span className="text-xs text-green-600 font-medium">Signed</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {contract.companySignature ? (
                              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                            ) : (
                              <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">
                                {contract.companyName || 'Company'}
                              </p>
                              <p className="text-xs text-gray-400">Company</p>
                            </div>
                            {contract.companySignature && (
                              <span className="text-xs text-green-600 font-medium">Signed</span>
                            )}
                          </div>
                        </div>

                        {/* Role buttons */}
                        <div className="space-y-2">
                          {(!roleFromUrl || roleFromUrl === 'creator') && canCreatorSign && (
                            <button
                              onClick={() => setSignAs('creator')}
                              className="w-full flex items-center gap-3 px-4 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-colors text-sm"
                            >
                              <User className="w-5 h-5" />
                              <div className="text-left">
                                <p>Sign as Creator</p>
                                <p className="text-xs font-normal text-indigo-200">
                                  {contract.creatorName}
                                </p>
                              </div>
                            </button>
                          )}

                          {(!roleFromUrl || roleFromUrl === 'company') && canCompanySign && (
                            <button
                              onClick={() => setSignAs('company')}
                              className="w-full flex items-center gap-3 px-4 py-3.5 bg-white hover:bg-gray-50 border-2 border-gray-200 text-gray-900 rounded-xl font-semibold transition-colors text-sm"
                            >
                              <Building2 className="w-5 h-5 text-gray-500" />
                              <div className="text-left">
                                <p>Sign as Company</p>
                                <p className="text-xs font-normal text-gray-400">
                                  {contract.companyName || 'Company Representative'}
                                </p>
                              </div>
                            </button>
                          )}

                          {roleFromUrl === 'creator' && !canCreatorSign && (
                            <div className="text-center py-4 bg-green-50 rounded-xl border border-green-200">
                              <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-1" />
                              <p className="text-sm text-green-700 font-medium">
                                Creator has already signed this contract
                              </p>
                            </div>
                          )}

                          {roleFromUrl === 'company' && !canCompanySign && (
                            <div className="text-center py-4 bg-green-50 rounded-xl border border-green-200">
                              <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-1" />
                              <p className="text-sm text-green-700 font-medium">
                                Company has already signed this contract
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Contract info card ─────────────────────────────── */}
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-3 text-sm">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Contract Details
                  </h4>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Creator</span>
                    <span className="text-gray-900 font-medium">{contract.creatorName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Company</span>
                    <span className="text-gray-900 font-medium">{contract.companyName || '\u2014'}</span>
                  </div>
                  {contract.contractEndDate &&
                    contract.contractEndDate !== 'Indefinite' &&
                    contract.contractStartDate &&
                    (() => {
                      const months = Math.round(
                        (new Date(contract.contractEndDate).getTime() -
                          new Date(contract.contractStartDate).getTime()) /
                          (1000 * 60 * 60 * 24 * 30)
                      );
                      return !isNaN(months) && months > 0 ? (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Duration</span>
                          <span className="text-gray-900 font-medium">
                            {months} month{months !== 1 ? 's' : ''}
                          </span>
                        </div>
                      ) : null;
                    })()}
                </div>

                {/* ── Audit trail card ──────────────────────────────── */}
                {auditTrail.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                      Activity Timeline
                    </h4>
                    <div className="relative">
                      {/* Vertical line */}
                      <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-gray-200" />

                      <div className="space-y-4">
                        {auditTrail.map((event, idx) => (
                          <div key={idx} className="flex items-start gap-3 relative">
                            <div
                              className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                                event.icon === 'sign'
                                  ? 'bg-green-100 text-green-600'
                                  : 'bg-indigo-100 text-indigo-600'
                              }`}
                            >
                              {event.icon === 'sign' ? (
                                <Check className="w-3 h-3" />
                              ) : (
                                <FileText className="w-3 h-3" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm text-gray-800 font-medium">{event.label}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{event.date}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ContractSigningPage;
