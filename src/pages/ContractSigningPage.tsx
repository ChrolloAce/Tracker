import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ContractService } from '../services/ContractService';
import { ShareableContract } from '../types/contract';
import { FileText, Check, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import SignatureCanvas from '../components/ui/SignatureCanvas';

const ContractSigningPage: React.FC = () => {
  const { contractId } = useParams<{ contractId: string }>();
  const [searchParams] = useSearchParams();
  const roleFromUrl = searchParams.get('role') as 'creator' | 'company' | null;
  
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
      
      // Reload contract to show updated signatures
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
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading contract...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#161616] border border-red-500/20 rounded-xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Contract Unavailable</h1>
          <p className="text-gray-400">{error}</p>
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
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="bg-[#161616] border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-white" />
              <h1 className="text-xl font-bold text-white">Contract Agreement</h1>
            </div>
            
            {/* Status Badge */}
            {isFullySigned ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-green-500">Fully Signed</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <Clock className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium text-yellow-500">Pending Signatures</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contract Document */}
          <div className="lg:col-span-2">
            <div className="bg-[#161616] border border-gray-800 rounded-xl p-8 text-white">
              {/* Contract Header */}
              <div className="border-b-2 border-white/20 pb-4 mb-6">
                <h2 className="text-2xl font-bold text-white mb-1">CREATOR CONTRACT</h2>
                <p className="text-sm text-gray-400">Content Creation Agreement</p>
              </div>

              {/* Parties */}
              <div className="mb-6">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Parties</div>
                <div className="text-base text-white space-y-1">
                  <p>Creator: <span className="font-semibold">{contract.creatorName}</span></p>
                  <p className="text-sm text-gray-400">{contract.creatorEmail}</p>
                  <p className="mt-2">Company: <span className="font-semibold">[Your Company Name]</span></p>
                </div>
              </div>

              {/* Contract Period */}
              <div className="mb-6">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Contract Period</div>
                <div className="text-base text-white">
                  <p>Start Date: {formatDate(contract.contractStartDate)}</p>
                  <p>End Date: {formatDate(contract.contractEndDate)}</p>
                </div>
              </div>

              {/* Payment Structure */}
              {contract.paymentStructureName && (
                <div className="mb-6">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Payment Structure</div>
                  <div className="text-base text-white">{contract.paymentStructureName}</div>
                </div>
              )}

              {/* Terms & Conditions */}
              <div className="mb-8">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-3 border-b border-white/10 pb-1">
                  Terms & Conditions
                </div>
                <div className="text-base text-gray-300 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                  {contract.contractNotes}
                </div>
              </div>

              {/* Signatures Section */}
              <div className="pt-6 border-t-2 border-white/20">
                <div className="grid grid-cols-2 gap-8">
                  {/* Creator Signature */}
                  <div>
                    <div className="text-sm text-gray-400 mb-2">Creator Signature</div>
                    {contract.creatorSignature ? (
                      <div className="bg-white/5 border border-green-500/20 rounded-lg p-4">
                        <div className="flex items-start gap-2 mb-3">
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-1" />
                          <div className="flex-1">
                            <div className="text-white font-medium">{contract.creatorSignature.name}</div>
                            <div className="text-xs text-gray-400 mt-1">
                              Signed {contract.creatorSignature.signedAt.toDate().toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        {contract.creatorSignature.signatureData && (
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <img 
                              src={contract.creatorSignature.signatureData} 
                              alt="Creator Signature" 
                              className="max-w-full h-auto max-h-24 bg-black rounded px-2 py-1"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white/5 border border-dashed border-white/10 rounded-lg p-4">
                        <Clock className="w-5 h-5 text-gray-400 mb-2" />
                        <div className="text-gray-400 text-sm">Awaiting signature</div>
                      </div>
                    )}
                  </div>

                  {/* Company Signature */}
                  <div>
                    <div className="text-sm text-gray-400 mb-2">Company Representative</div>
                    {contract.companySignature ? (
                      <div className="bg-white/5 border border-green-500/20 rounded-lg p-4">
                        <div className="flex items-start gap-2 mb-3">
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-1" />
                          <div className="flex-1">
                            <div className="text-white font-medium">{contract.companySignature.name}</div>
                            <div className="text-xs text-gray-400 mt-1">
                              Signed {contract.companySignature.signedAt.toDate().toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        {contract.companySignature.signatureData && (
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <img 
                              src={contract.companySignature.signatureData} 
                              alt="Company Signature" 
                              className="max-w-full h-auto max-h-24 bg-black rounded px-2 py-1"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white/5 border border-dashed border-white/10 rounded-lg p-4">
                        <Clock className="w-5 h-5 text-gray-400 mb-2" />
                        <div className="text-gray-400 text-sm">Awaiting signature</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-6 text-center text-xs text-gray-500 border-t border-white/10 pt-4">
                Contract ID: {contract.id} • Generated on {contract.createdAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Signing Panel */}
          <div className="lg:col-span-1">
            <div className="bg-[#161616] border border-gray-800 rounded-xl p-6 sticky top-6">
              <h3 className="text-lg font-semibold text-white mb-4">Sign Contract</h3>

              {isFullySigned ? (
                <div className="text-center py-8">
                  <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <p className="text-green-500 font-medium mb-2">Contract Fully Signed</p>
                  <p className="text-sm text-gray-400">
                    This contract has been signed by both parties and is now active.
                  </p>
                </div>
              ) : signAs ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full px-4 py-2 bg-black border border-gray-700 rounded-lg text-white focus:outline-none focus:border-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Signature
                    </label>
                    <SignatureCanvas onSignatureChange={setSignatureData} />
                  </div>

                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                    <p className="text-xs text-yellow-500">
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
                  {/* Show only the role-specific button if role is in URL */}
                  {(!roleFromUrl || roleFromUrl === 'creator') && canCreatorSign && (
                    <button
                      onClick={() => setSignAs('creator')}
                      className="w-full px-4 py-3 bg-white text-black hover:bg-gray-100 rounded-lg font-medium transition-colors"
                    >
                      Sign as Creator
                    </button>
                  )}

                  {(!roleFromUrl || roleFromUrl === 'company') && canCompanySign && (
                    <button
                      onClick={() => setSignAs('company')}
                      className="w-full px-4 py-3 bg-white/10 text-white hover:bg-white/20 border border-white/10 rounded-lg font-medium transition-colors"
                    >
                      Sign as Company Representative
                    </button>
                  )}

                  {/* Show message if the specific role has already signed */}
                  {roleFromUrl === 'creator' && !canCreatorSign && (
                    <div className="text-center py-4 text-gray-400 text-sm">
                      Creator has already signed this contract
                    </div>
                  )}
                  
                  {roleFromUrl === 'company' && !canCompanySign && (
                    <div className="text-center py-4 text-gray-400 text-sm">
                      Company has already signed this contract
                    </div>
                  )}

                  {!roleFromUrl && !canCreatorSign && !canCompanySign && (
                    <div className="text-center py-4 text-gray-400 text-sm">
                      Both parties have already signed this contract
                    </div>
                  )}
                </div>
              )}

              {/* Contract Info */}
              <div className="mt-6 pt-6 border-t border-gray-800 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Creator</span>
                  <span className="text-white">{contract.creatorName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Duration</span>
                  <span className="text-white">
                    {Math.round((new Date(contract.contractEndDate).getTime() - new Date(contract.contractStartDate).getTime()) / (1000 * 60 * 60 * 24 * 30))} months
                  </span>
                </div>
                {contract.expiresAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Link Expires</span>
                    <span className="text-white">
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
  );
};

export default ContractSigningPage;

