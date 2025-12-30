import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ContractService } from '../services/ContractService';
import { ShareableContract } from '../types/contract';
import { FileText, Check, Clock, AlertCircle, Loader2, Printer } from 'lucide-react';
import { Button } from '../components/ui/Button';
import SignatureCanvas from '../components/ui/SignatureCanvas';

const ContractSigningPage: React.FC = () => {
  const { contractId } = useParams<{ contractId: string }>();
  const [searchParams] = useSearchParams();
  const roleFromUrl = searchParams.get('role') as 'creator' | 'company' | null;
  const printMode = searchParams.get('print') === 'true';
  
  const [contract, setContract] = useState<ShareableContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [signAs, setSignAs] = useState<'creator' | 'company' | null>(null);
  const [signerName, setSignerName] = useState('');
  const [signatureData, setSignatureData] = useState<string | null>(null);

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
        setError('This contract has expired');
      } else if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
        setError('This contract has expired');
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
    if (!contract || !signAs || !signerName.trim() || !signatureData) return;

    setSigning(true);
    try {
      if (signAs === 'creator') {
        await ContractService.signAsCreator(contract.id, signerName, signatureData);
      } else {
        await ContractService.signAsCompany(contract.id, signerName, signatureData);
      }
      
      await loadContract();
      setSignAs(null);
      setSignerName('');
      setSignatureData(null);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-gray-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading contract...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-red-200 rounded-xl p-8 text-center shadow-lg">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Contract Unavailable</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!contract) {
    return null;
  }

  const isFullySigned = contract.creatorSignature && contract.companySignature;
  const canCreatorSign = !contract.creatorSignature;
  const canCompanySign = !contract.companySignature;

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

      <div className="min-h-screen bg-gray-100">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm no-print">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-gray-700" />
                <h1 className="text-xl font-bold text-gray-900">Contract Agreement</h1>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Print Button */}
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span className="text-sm">Print</span>
                </button>
                
                {/* Status Badge */}
                {isFullySigned ? (
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">Fully Signed</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-700">Pending Signatures</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Contract Document - Professional White Paper Look */}
            <div className="lg:col-span-2 print-contract">
              <div 
                className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden"
                style={{ fontFamily: 'Georgia, Times New Roman, serif' }}
              >
                <div className="p-10">
                  {/* Header with decorative line */}
                  <div className="text-center mb-8">
                    <div className="w-24 h-1 bg-gray-800 mx-auto mb-6"></div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-wide mb-2">
                      {contract.contractTitle?.toUpperCase() || 'CREATOR AGREEMENT'}
                    </h1>
                    <p className="text-sm text-gray-500 italic">Content Creation Contract</p>
                    <div className="w-24 h-1 bg-gray-800 mx-auto mt-6"></div>
                  </div>

                  {/* Contract intro */}
                  <p className="text-gray-700 leading-relaxed mb-8 text-center text-sm">
                    This Agreement ("Agreement") is entered into as of <span className="font-semibold">{formatDate(contract.contractStartDate)}</span>,
                    by and between the parties identified below.
                  </p>

                  {/* Parties Section */}
                  <div className="grid grid-cols-2 gap-8 mb-8 border-t border-b border-gray-200 py-6">
                    {/* Company */}
                    <div>
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Company ("Client")</h3>
                      <div className="space-y-1">
                        <p className="text-gray-900 font-semibold text-lg">{contract.companyName || '[Company Name]'}</p>
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
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Creator ("Contractor")</h3>
                      <div className="space-y-1">
                        <p className="text-gray-900 font-semibold text-lg">{contract.creatorName}</p>
                        {contract.creatorInfo?.address && (
                          <p className="text-gray-600 text-sm">{contract.creatorInfo.address}</p>
                        )}
                        {(contract.creatorInfo?.email || contract.creatorEmail) && (
                          <p className="text-gray-600 text-sm">{contract.creatorInfo?.email || contract.creatorEmail}</p>
                        )}
                        {contract.creatorInfo?.phone && (
                          <p className="text-gray-600 text-sm">{contract.creatorInfo.phone}</p>
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
                        <span className="text-gray-900 font-medium">{formatDate(contract.contractStartDate)}</span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">End Date: </span>
                        <span className="text-gray-900 font-medium">
                          {contract.contractEndDate === 'Indefinite' ? 'Ongoing (No fixed end date)' : formatDate(contract.contractEndDate)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Structure */}
                  {contract.paymentStructureName && (
                    <div className="mb-6 bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Compensation</h3>
                      <p className="text-gray-900 font-medium">{contract.paymentStructureName}</p>
                    </div>
                  )}

                  {/* Terms & Conditions */}
                  <div className="mb-8">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 pb-2 border-b border-gray-200">
                      Terms & Conditions
                    </h3>
                    <div className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm max-h-96 overflow-y-auto">
                      {processedNotes}
                    </div>
                  </div>

                  {/* Signature Section */}
                  <div className="pt-8 border-t-2 border-gray-800">
                    <p className="text-center text-sm text-gray-500 mb-8 italic">
                      IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.
                    </p>
                    
                    <div className="grid grid-cols-2 gap-12">
                      {/* Company Signature */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">For the Company</h4>
                        {contract.companySignature ? (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Check className="w-4 h-4 text-green-600" />
                              <span className="text-green-700 text-sm font-medium">Signed</span>
                            </div>
                            {contract.companySignature.signatureData && (
                              <div className="mb-3 border-b-2 border-gray-300 pb-2">
                                <img 
                                  src={contract.companySignature.signatureData} 
                                  alt="Company Signature" 
                                  className="max-w-full h-auto max-h-16"
                                />
                              </div>
                            )}
                            <p className="text-gray-900 font-medium">{contract.companySignature.name}</p>
                            <p className="text-sm text-gray-500">
                              {contract.companySignature.signedAt.toDate().toLocaleDateString()}
                            </p>
                          </div>
                        ) : (
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                            <div className="h-16 border-b-2 border-gray-300 mb-2"></div>
                            <p className="text-gray-500 text-sm">Authorized Signatory</p>
                            <p className="text-gray-400 text-sm mt-1">Date: _______________</p>
                          </div>
                        )}
                      </div>

                      {/* Creator Signature */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">For the Creator</h4>
                        {contract.creatorSignature ? (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Check className="w-4 h-4 text-green-600" />
                              <span className="text-green-700 text-sm font-medium">Signed</span>
                            </div>
                            {contract.creatorSignature.signatureData && (
                              <div className="mb-3 border-b-2 border-gray-300 pb-2">
                                <img 
                                  src={contract.creatorSignature.signatureData} 
                                  alt="Creator Signature" 
                                  className="max-w-full h-auto max-h-16"
                                />
                              </div>
                            )}
                            <p className="text-gray-900 font-medium">{contract.creatorSignature.name}</p>
                            <p className="text-sm text-gray-500">
                              {contract.creatorSignature.signedAt.toDate().toLocaleDateString()}
                            </p>
                          </div>
                        ) : (
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                            <div className="h-16 border-b-2 border-gray-300 mb-2"></div>
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
                      Contract ID: {contract.id} • Generated {contract.createdAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Signing Panel */}
            <div className="lg:col-span-1 no-print">
              <div className="bg-white border border-gray-200 rounded-xl p-6 sticky top-6 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Sign Contract</h3>

                {isFullySigned ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="w-8 h-8 text-green-600" />
                    </div>
                    <p className="text-green-700 font-medium mb-2">Contract Fully Signed</p>
                    <p className="text-sm text-gray-500">
                      This contract has been signed by both parties and is now active.
                    </p>
                  </div>
                ) : signAs ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        placeholder="Enter your full name"
                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Signature
                      </label>
                      <SignatureCanvas onSignatureChange={setSignatureData} />
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs text-amber-700">
                        By signing, you agree to the terms and conditions outlined in this contract.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={handleSign}
                        disabled={!signerName.trim() || !signatureData || signing}
                        className="flex-1"
                      >
                        {signing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Signing...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Sign Contract
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => {
                          setSignAs(null);
                          setSignerName('');
                        }}
                        variant="secondary"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(!roleFromUrl || roleFromUrl === 'creator') && canCreatorSign && (
                      <button
                        onClick={() => setSignAs('creator')}
                        className="w-full px-4 py-3 bg-gray-900 text-white hover:bg-gray-800 rounded-lg font-medium transition-colors"
                      >
                        Sign as Creator
                      </button>
                    )}

                    {(!roleFromUrl || roleFromUrl === 'company') && canCompanySign && (
                      <button
                        onClick={() => setSignAs('company')}
                        className="w-full px-4 py-3 bg-white text-gray-900 hover:bg-gray-50 border border-gray-300 rounded-lg font-medium transition-colors"
                      >
                        Sign as Company Representative
                      </button>
                    )}

                    {roleFromUrl === 'creator' && !canCreatorSign && (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        Creator has already signed this contract
                      </div>
                    )}
                    
                    {roleFromUrl === 'company' && !canCompanySign && (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        Company has already signed this contract
                      </div>
                    )}
                  </div>
                )}

                {/* Contract Info */}
                <div className="mt-6 pt-6 border-t border-gray-200 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Creator</span>
                    <span className="text-gray-900 font-medium">{contract.creatorName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Company</span>
                    <span className="text-gray-900 font-medium">{contract.companyName || '—'}</span>
                  </div>
                  {contract.contractEndDate && contract.contractEndDate !== 'Indefinite' && contract.contractStartDate && (
                    (() => {
                      const months = Math.round((new Date(contract.contractEndDate).getTime() - new Date(contract.contractStartDate).getTime()) / (1000 * 60 * 60 * 24 * 30));
                      return !isNaN(months) && months > 0 ? (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Duration</span>
                          <span className="text-gray-900 font-medium">{months} month{months !== 1 ? 's' : ''}</span>
                        </div>
                      ) : null;
                    })()
                  )}
                  {contract.expiresAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Link Expires</span>
                      <span className="text-gray-900 font-medium">
                        {contract.expiresAt.toDate().toLocaleDateString()}
                      </span>
                    </div>
                  )}
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
