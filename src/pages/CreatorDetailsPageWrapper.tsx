import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { OrgMember } from '../types/firestore';
import OrganizationService from '../services/OrganizationService';
import CreatorDetailsPage from '../components/CreatorDetailsPage';
import { PageLoadingSkeleton } from '../components/ui/LoadingSkeleton';

/**
 * CreatorDetailsPageWrapper - Route wrapper for /creators/:creatorId
 * Fetches creator data and passes to CreatorDetailsPage component
 */
const CreatorDetailsPageWrapper = () => {
  const { creatorId } = useParams<{ creatorId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentOrgId, currentProjectId } = useAuth();
  const [creator, setCreator] = useState<OrgMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCreator();
  }, [creatorId, currentOrgId, currentProjectId]);

  const loadCreator = async () => {
    if (!currentOrgId || !currentProjectId || !creatorId) {
      setError('Missing required parameters');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get all creators/members from the organization
      const members = await OrganizationService.getOrgMembers(currentOrgId);
      
      // Find the specific creator
      const foundCreator = members.find(
        (member: OrgMember) => member.userId === creatorId || member.email === creatorId
      );

      if (!foundCreator) {
        setError('Creator not found');
        setLoading(false);
        return;
      }

      setCreator(foundCreator);
    } catch (err) {
      console.error('Error loading creator:', err);
      setError('Failed to load creator details');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    // Check if there's a return path in search params
    const returnPath = searchParams.get('return');
    if (returnPath) {
      navigate(returnPath);
    } else {
      navigate('/dashboard');
    }
  };

  const handleUpdate = async () => {
    // Reload creator data
    await loadCreator();
  };

  if (loading) {
    return <PageLoadingSkeleton type="creators" />;
  }

  if (error || !creator) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="bg-red-500/10 border border-red-500/20 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">
            {error || 'Creator Not Found'}
          </h1>
          <p className="text-white/60 mb-8">
            The creator you're looking for doesn't exist or you don't have permission to view it.
          </p>
          <button
            onClick={handleBack}
            className="w-full px-6 py-3 bg-white hover:bg-gray-100 text-black rounded-lg font-medium transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <CreatorDetailsPage
      creator={creator}
      onBack={handleBack}
      onUpdate={handleUpdate}
    />
  );
};

export default CreatorDetailsPageWrapper;

