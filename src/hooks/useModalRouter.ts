import { useSearchParams } from 'react-router-dom';
import { useCallback } from 'react';

/**
 * Custom hook for managing modal state via URL parameters
 * Enables deep linking to specific modals and preserves state on refresh
 * 
 * @example
 * const { openModal, closeModal, isModalOpen } = useModalRouter();
 * 
 * // Open modal with URL: /dashboard?modal=support
 * openModal('support');
 * 
 * // Check if modal is open
 * if (isModalOpen('support')) { ... }
 * 
 * // Close modal (removes URL param)
 * closeModal('support');
 */
export function useModalRouter() {
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * Open a modal by adding its key to URL parameters
   * Supports additional parameters like date, videoId, etc.
   */
  const openModal = useCallback((
    modalKey: string,
    additionalParams?: Record<string, string>
  ) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('modal', modalKey);
    
    // Add any additional params (e.g., date, videoId, accountId)
    if (additionalParams) {
      Object.entries(additionalParams).forEach(([key, value]) => {
        newParams.set(key, value);
      });
    }
    
    setSearchParams(newParams, { replace: false });
  }, [searchParams, setSearchParams]);

  /**
   * Close a modal by removing its key from URL parameters
   * Optionally preserve specific parameters
   */
  const closeModal = useCallback((
    preserveParams?: string[]
  ) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('modal');
    
    // Remove all modal-specific params unless explicitly preserved
    const modalSpecificParams = ['date', 'videoId', 'accountId', 'linkId', 'interval', 'filter'];
    modalSpecificParams.forEach(param => {
      if (!preserveParams?.includes(param)) {
        newParams.delete(param);
      }
    });
    
    setSearchParams(newParams, { replace: false });
  }, [searchParams, setSearchParams]);

  /**
   * Check if a specific modal is currently open
   */
  const isModalOpen = useCallback((modalKey: string): boolean => {
    return searchParams.get('modal') === modalKey;
  }, [searchParams]);

  /**
   * Get the currently open modal key (if any)
   */
  const currentModal = searchParams.get('modal');

  /**
   * Get a specific parameter value
   */
  const getParam = useCallback((key: string): string | null => {
    return searchParams.get(key);
  }, [searchParams]);

  /**
   * Set a parameter without changing the modal state
   */
  const setParam = useCallback((key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set(key, value);
    setSearchParams(newParams, { replace: false });
  }, [searchParams, setSearchParams]);

  return {
    openModal,
    closeModal,
    isModalOpen,
    currentModal,
    getParam,
    setParam,
  };
}

/**
 * Modal keys used throughout the application
 * Centralized for consistency and easy refactoring
 */
export const ModalKeys = {
  SUPPORT: 'support',
  ADD_VIDEO: 'add-video',
  ADD_ACCOUNT: 'add-account',
  TIKTOK_SEARCH: 'tiktok-search',
  VIDEO_ANALYTICS: 'video-analytics',
  DELETE_VIDEO: 'delete-video',
  DAY_VIDEOS: 'day-videos',
  LINK_CREATOR: 'link-creator',
  RULE: 'rule',
  REVENUE: 'revenue',
  SIGN_OUT: 'sign-out',
  UPGRADE: 'upgrade',
} as const;

export type ModalKey = typeof ModalKeys[keyof typeof ModalKeys];

