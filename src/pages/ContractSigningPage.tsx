import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ContractService } from '../services/ContractService';
import { ShareableContract } from '../types/contract';
import { FileText, Check, Clock, AlertCircle, Loader2, Download, CheckCircle2, Circle, PenLine } from 'lucide-react';
import SignatureCanvas from '../components/ui/SignatureCanvas';

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

  useEffect(() => { loadContract(); }, [contractId]);

  useEffect(() => {
    if (printMode && contract && !loading) {
      setTimeout(() => window.print(), 500);
    }
  }, [printMode, contract, loading]);

  useEffect(() => {
    if (signAs === 'creator' && contract?.creatorName) {
      setSignerName(contract.creatorName);
    } else if (signAs === 'company') {
      setSignerName('');
    }
  }, [signAs, contract]);

  const loadContract = async () => {
    if (!contractId) { setError('Invalid contract link'); setLoading(false); return; }
    try {
      const data = await ContractService.getContractById(contractId);
      if (!data) { setError('Contract not found'); }
      else if (data.status === 'expired' || (data.expiresAt && data.expiresAt.toDate() < new Date())) {
        setContract(data); setExpired(true);
      } else { setContract(data); }
    } catch (err) {
      console.error('Error loading contract:', err);
      setError('Failed to load contract');
    } finally { setLoading(false); }
  };

  const handleSign = async () => {
    if (!contract || !signAs || !signerName.trim() || !signatureData || !agreedToTerms) return;
    setSigning(true);
    try {
      if (signAs === 'creator') await ContractService.signAsCreator(contract.id, signerName, signatureData);
      else await ContractService.signAsCompany(contract.id, signerName, signatureData);
      setJustSigned(true);
      await loadContract();
      setTimeout(() => { setSignAs(null); setSignerName(''); setSignatureData(null); setAgreedToTerms(false); setJustSigned(false); }, 3000);
    } catch (err) {
      console.error('Error signing contract:', err);
      alert('Failed to sign contract. Please try again.');
    } finally { setSigning(false); }
  };

  const fmt = (d: string) => {
    if (!d || d === 'Indefinite') return d;
    try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
    catch { return d; }
  };

  const fmtDt = (d: Date) => d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

  const processedNotes = useMemo(() => {
    if (!contract?.contractNotes) return '';
    let p = contract.contractNotes;
    const r: Record<string, string> = {
      '{{CREATOR_NAME}}': contract.creatorName || '[Creator Name]',
      '{{COMPANY_NAME}}': contract.companyName || '[Company Name]',
      '{{START_DATE}}': fmt(contract.contractStartDate),
      '{{END_DATE}}': contract.contractEndDate === 'Indefinite' ? 'Indefinite' : fmt(contract.contractEndDate),
      '{{CREATOR_EMAIL}}': contract.creatorInfo?.email || contract.creatorEmail || '[Creator Email]',
      '{{CREATOR_PHONE}}': contract.creatorInfo?.phone || '[Creator Phone]',
      '{{CREATOR_ADDRESS}}': contract.creatorInfo?.address || '[Creator Address]',
      '{{COMPANY_EMAIL}}': contract.companyInfo?.email || '[Company Email]',
      '{{COMPANY_PHONE}}': contract.companyInfo?.phone || '[Company Phone]',
      '{{COMPANY_ADDRESS}}': contract.companyInfo?.address || '[Company Address]',
      '{{PAYMENT_STRUCTURE}}': contract.paymentStructureName || '[Payment Structure]',
      '{{TODAY_DATE}}': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    };
    Object.entries(r).forEach(([k, v]) => { p = p.replace(new RegExp(k.replace(/[{}]/g, '\\$&'), 'g'), v); });
    return p;
  }, [contract]);

  // ─── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-neutral-400 animate-spin mx-auto mb-3" />
          <p className="text-neutral-500 text-sm">Loading document...</p>
        </div>
      </div>
    );
  }

  // ─── Error ──────────────────────────────────────────────────
  if (error && !contract) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-xl border border-neutral-200 p-8 text-center">
          <AlertCircle className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-neutral-900 mb-1">Contract Unavailable</h1>
          <p className="text-sm text-neutral-500">{error}</p>
        </div>
      </div>
    );
  }

  // ─── Expired ────────────────────────────────────────────────
  if (expired && contract) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="bg-neutral-900 px-6 py-4">
            <h1 className="text-white font-semibold">Contract Expired</h1>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-neutral-600">
              <span className="font-medium text-neutral-900">{contract.contractTitle || 'Creator Agreement'}</span>
              {' '}expired on{' '}
              <span className="font-medium">{contract.expiresAt ? fmtDt(contract.expiresAt.toDate()) : 'a previous date'}</span>.
            </p>
            <p className="text-sm text-neutral-500">
              Contact <span className="font-medium text-neutral-700">{contract.companyName || 'the sender'}</span> to request a new signing link.
            </p>
            <div className="border-t border-neutral-100 pt-3 space-y-1.5">
              {[{ label: 'Creator', name: contract.creatorName, signed: !!contract.creatorSignature },
                { label: 'Company', name: contract.companyName || 'N/A', signed: !!contract.companySignature }
              ].map(p => (
                <div key={p.label} className="flex items-center gap-2 text-sm">
                  {p.signed ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Circle className="w-3.5 h-3.5 text-neutral-300" />}
                  <span className="text-neutral-600">{p.name}</span>
                  <span className="text-neutral-400">({p.label})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!contract) return null;

  const isFullySigned = !!(contract.creatorSignature && contract.companySignature);
  const canCreatorSign = !contract.creatorSignature;
  const canCompanySign = !contract.companySignature;

  const renderSigBlock = (
    label: string,
    sig: typeof contract.creatorSignature,
    fallbackName: string,
  ) => (
    <div className="flex-1">
      <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-3">{label}</p>
      {sig ? (
        <div>
          {sig.signatureData && (
            <div className="h-16 mb-1">
              <img src={sig.signatureData} alt="Signature" className="max-h-full" />
            </div>
          )}
          <div className="border-t border-neutral-900 pt-1.5">
            <p className="text-sm font-medium text-neutral-900">{sig.name}</p>
            <p className="text-[11px] text-neutral-400">{fmtDt(sig.signedAt.toDate())}</p>
          </div>
        </div>
      ) : (
        <div>
          <div className="h-16 mb-1" />
          <div className="border-t border-neutral-300 border-dashed pt-1.5">
            <p className="text-sm text-neutral-400">{fallbackName}</p>
            <p className="text-[11px] text-neutral-300">Date: _______________</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 0.5in; size: letter; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-contract { box-shadow: none !important; margin: 0 !important; max-width: 100% !important; }
        }
      `}</style>

      <div className="min-h-screen bg-neutral-100">
        {/* Header */}
        <div className="bg-white border-b border-neutral-200 no-print">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="w-5 h-5 text-neutral-400 flex-shrink-0" />
              <span className="text-sm font-semibold text-neutral-900 truncate">
                {contract.contractTitle || 'Creator Agreement'}
              </span>
              {isFullySigned ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-50 text-green-700 border border-green-200 flex-shrink-0">
                  <Check className="w-3 h-3" /> Completed
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 text-neutral-600 border border-neutral-200 flex-shrink-0">
                  <Clock className="w-3 h-3" /> Pending
                </span>
              )}
            </div>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors">
              <Download className="w-4 h-4" /> <span className="hidden sm:inline">Print</span>
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* ── Contract Document ─────────────────────────────── */}
            <div className="flex-1 min-w-0 print-contract">
              <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
                <div className="p-8 sm:p-12">
                  {/* Title */}
                  <div className="text-center mb-10">
                    <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-wide uppercase">
                      {contract.contractTitle || 'Creator Agreement'}
                    </h1>
                  </div>

                  {/* Intro */}
                  <p className="text-neutral-600 leading-relaxed mb-8 text-sm text-center">
                    This Agreement is entered into as of{' '}
                    <span className="font-semibold text-neutral-800">{fmt(contract.contractStartDate)}</span>,
                    by and between the parties identified below.
                  </p>

                  {/* Parties */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 py-5 border-y border-neutral-200">
                    {[
                      { title: 'Company', name: contract.companyName || '[Company Name]', info: contract.companyInfo },
                      { title: 'Creator', name: contract.creatorName, info: contract.creatorInfo || { name: contract.creatorName, email: contract.creatorEmail } },
                    ].map(party => (
                      <div key={party.title}>
                        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-2">{party.title}</p>
                        <p className="text-neutral-900 font-semibold">{party.name}</p>
                        {party.info?.email && <p className="text-neutral-500 text-xs mt-0.5">{party.info.email}</p>}
                        {party.info?.phone && <p className="text-neutral-500 text-xs">{party.info.phone}</p>}
                        {party.info?.address && <p className="text-neutral-500 text-xs">{party.info.address}</p>}
                      </div>
                    ))}
                  </div>

                  {/* Period & Compensation — inline */}
                  <div className="flex flex-wrap gap-x-8 gap-y-2 mb-8 text-sm">
                    <div>
                      <span className="text-neutral-400">Start: </span>
                      <span className="text-neutral-800 font-medium">{fmt(contract.contractStartDate)}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400">End: </span>
                      <span className="text-neutral-800 font-medium">
                        {contract.contractEndDate === 'Indefinite' ? 'Ongoing' : fmt(contract.contractEndDate)}
                      </span>
                    </div>
                    {contract.paymentStructureName && (
                      <div>
                        <span className="text-neutral-400">Compensation: </span>
                        <span className="text-neutral-800 font-medium">{contract.paymentStructureName}</span>
                      </div>
                    )}
                  </div>

                  {/* Terms */}
                  <div className="mb-10">
                    <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-3 pb-2 border-b border-neutral-200">
                      Terms & Conditions
                    </p>
                    <div className="text-neutral-700 leading-relaxed whitespace-pre-wrap text-sm">
                      {processedNotes}
                    </div>
                  </div>

                  {/* Signatures */}
                  <div className="pt-8 border-t border-neutral-200">
                    <div className="flex flex-col sm:flex-row gap-10">
                      {renderSigBlock('For the Company', contract.companySignature, 'Authorized Signatory')}
                      {renderSigBlock('For the Creator', contract.creatorSignature, contract.creatorName)}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-10 pt-3 border-t border-neutral-200 text-center">
                    <p className="text-[10px] text-neutral-400">
                      ID: {contract.id} &middot; {contract.createdAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Sidebar ─────────────────────────────────────── */}
            <div className="w-full lg:w-80 flex-shrink-0 no-print">
              <div className="sticky top-6 space-y-3">
                {/* Signing card */}
                <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-neutral-100">
                    <h3 className="text-sm font-semibold text-neutral-900">Sign Document</h3>
                  </div>

                  <div className="p-5">
                    {justSigned ? (
                      <div className="text-center py-4">
                        <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-neutral-900">Signature recorded</p>
                        <p className="text-xs text-neutral-500 mt-1">Thank you for signing.</p>
                      </div>
                    ) : isFullySigned ? (
                      <div className="text-center py-4">
                        <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-neutral-900">Fully Executed</p>
                        <p className="text-xs text-neutral-500 mt-1">All parties have signed this contract.</p>
                      </div>
                    ) : signAs ? (
                      <div className="space-y-4">
                        <p className="text-xs text-neutral-500 text-center">
                          Signing as <span className="font-medium text-neutral-700">{signAs === 'creator' ? 'Creator' : 'Company'}</span>
                        </p>

                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1">Full Name</label>
                          <input
                            type="text"
                            value={signerName}
                            onChange={(e) => setSignerName(e.target.value)}
                            placeholder="Enter your full name"
                            className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1">Signature</label>
                          <SignatureCanvas onSignatureChange={setSignatureData} initialName={signerName} />
                        </div>

                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={agreedToTerms}
                            onChange={(e) => setAgreedToTerms(e.target.checked)}
                            className="mt-0.5 w-3.5 h-3.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                          />
                          <span className="text-[11px] text-neutral-500 leading-relaxed">
                            I agree that my electronic signature is the legal equivalent of my handwritten signature.
                          </span>
                        </label>

                        <div className="flex gap-2">
                          <button
                            onClick={handleSign}
                            disabled={!signerName.trim() || !signatureData || signing || !agreedToTerms}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-neutral-900 hover:bg-black disabled:bg-neutral-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                          >
                            {signing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Signing...</> : <><PenLine className="w-3.5 h-3.5" /> Sign</>}
                          </button>
                          <button
                            onClick={() => { setSignAs(null); setSignerName(''); setSignatureData(null); setAgreedToTerms(false); }}
                            className="px-3 py-2.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg text-sm transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs text-neutral-500 text-center mb-1">Select your role to sign</p>

                        {(!roleFromUrl || roleFromUrl === 'creator') && canCreatorSign && (
                          <button onClick={() => setSignAs('creator')} className="w-full flex items-center gap-3 px-4 py-3 bg-neutral-900 hover:bg-black text-white rounded-lg text-sm font-medium transition-colors">
                            <PenLine className="w-4 h-4" />
                            <span>Sign as Creator</span>
                          </button>
                        )}

                        {(!roleFromUrl || roleFromUrl === 'company') && canCompanySign && (
                          <button onClick={() => setSignAs('company')} className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-neutral-50 border border-neutral-300 text-neutral-900 rounded-lg text-sm font-medium transition-colors">
                            <PenLine className="w-4 h-4 text-neutral-400" />
                            <span>Sign as Company</span>
                          </button>
                        )}

                        {roleFromUrl === 'creator' && !canCreatorSign && (
                          <p className="text-center text-xs text-green-600 py-2">Creator has already signed</p>
                        )}
                        {roleFromUrl === 'company' && !canCompanySign && (
                          <p className="text-center text-xs text-green-600 py-2">Company has already signed</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Signature status */}
                <div className="bg-white border border-neutral-200 rounded-xl p-4">
                  <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-3">Signatures</p>
                  <div className="space-y-2">
                    {[
                      { label: 'Creator', name: contract.creatorName, sig: contract.creatorSignature },
                      { label: 'Company', name: contract.companyName || 'Company', sig: contract.companySignature },
                    ].map(p => (
                      <div key={p.label} className="flex items-center gap-2">
                        {p.sig ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Circle className="w-3.5 h-3.5 text-neutral-300" />}
                        <span className="text-xs text-neutral-700 flex-1">{p.name}</span>
                        <span className="text-[10px] text-neutral-400">{p.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Activity */}
                <div className="bg-white border border-neutral-200 rounded-xl p-4">
                  <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-3">Activity</p>
                  <div className="space-y-2">
                    <div className="text-xs text-neutral-500">
                      Created {fmtDt(contract.createdAt.toDate())}
                    </div>
                    {contract.creatorSignature && (
                      <div className="text-xs text-neutral-500">
                        <span className="text-neutral-700 font-medium">{contract.creatorSignature.name}</span> signed {fmtDt(contract.creatorSignature.signedAt.toDate())}
                      </div>
                    )}
                    {contract.companySignature && (
                      <div className="text-xs text-neutral-500">
                        <span className="text-neutral-700 font-medium">{contract.companySignature.name}</span> signed {fmtDt(contract.companySignature.signedAt.toDate())}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ContractSigningPage;
