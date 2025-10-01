import React from 'react';
import { clsx } from 'clsx';

interface LoadingSkeletonProps {
  className?: string;
  variant?: 'text' | 'rectangle' | 'circle';
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ 
  className = '', 
  variant = 'rectangle' 
}) => {
  return (
    <div
      className={clsx(
        'animate-pulse bg-gray-200 dark:bg-gray-800',
        variant === 'circle' && 'rounded-full',
        variant === 'text' && 'rounded h-4',
        variant === 'rectangle' && 'rounded-lg',
        className
      )}
    />
  );
};

// Skeleton for KPI Card
export const KPICardSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <LoadingSkeleton className="w-32 h-5" variant="text" />
        <LoadingSkeleton className="w-10 h-10" variant="circle" />
      </div>
      <LoadingSkeleton className="w-24 h-8 mb-2" />
      <LoadingSkeleton className="w-20 h-4" variant="text" />
    </div>
  );
};

// Skeleton for Video Table Row
export const VideoRowSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-800 rounded-xl p-4 mb-3">
      <div className="flex items-center space-x-4">
        <LoadingSkeleton className="w-20 h-20 flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <LoadingSkeleton className="w-3/4 h-5" variant="text" />
          <LoadingSkeleton className="w-1/2 h-4" variant="text" />
          <div className="flex space-x-4">
            <LoadingSkeleton className="w-20 h-4" variant="text" />
            <LoadingSkeleton className="w-20 h-4" variant="text" />
            <LoadingSkeleton className="w-20 h-4" variant="text" />
          </div>
        </div>
        <LoadingSkeleton className="w-24 h-8" />
      </div>
    </div>
  );
};

// Skeleton for Account Card
export const AccountCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-[#1A1A1A] rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center space-x-3 mb-4">
        <LoadingSkeleton className="w-12 h-12" variant="circle" />
        <div className="flex-1 space-y-2">
          <LoadingSkeleton className="w-32 h-5" variant="text" />
          <LoadingSkeleton className="w-24 h-4" variant="text" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <LoadingSkeleton className="w-16 h-4" variant="text" />
          <LoadingSkeleton className="w-12 h-6" />
        </div>
        <div className="space-y-2">
          <LoadingSkeleton className="w-16 h-4" variant="text" />
          <LoadingSkeleton className="w-12 h-6" />
        </div>
      </div>
    </div>
  );
};

// Skeleton for Link Card
export const LinkCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-[#1A1A1A] rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 space-y-2">
          <LoadingSkeleton className="w-48 h-5" variant="text" />
          <LoadingSkeleton className="w-64 h-4" variant="text" />
        </div>
        <LoadingSkeleton className="w-8 h-8" variant="circle" />
      </div>
      <div className="flex items-center space-x-4 mt-4">
        <LoadingSkeleton className="w-20 h-8" />
        <LoadingSkeleton className="w-20 h-8" />
        <LoadingSkeleton className="w-20 h-8" />
      </div>
    </div>
  );
};

// Full Page Loading State
export const PageLoadingSkeleton: React.FC<{ type?: 'dashboard' | 'accounts' | 'links' }> = ({ 
  type = 'dashboard' 
}) => {
  if (type === 'dashboard') {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICardSkeleton />
          <KPICardSkeleton />
          <KPICardSkeleton />
          <KPICardSkeleton />
        </div>

        {/* Video Table */}
        <div className="space-y-3">
          <VideoRowSkeleton />
          <VideoRowSkeleton />
          <VideoRowSkeleton />
          <VideoRowSkeleton />
          <VideoRowSkeleton />
        </div>
      </div>
    );
  }

  if (type === 'accounts') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
        <AccountCardSkeleton />
        <AccountCardSkeleton />
        <AccountCardSkeleton />
        <AccountCardSkeleton />
        <AccountCardSkeleton />
        <AccountCardSkeleton />
      </div>
    );
  }

  if (type === 'links') {
    return (
      <div className="space-y-4 animate-fade-in">
        <LinkCardSkeleton />
        <LinkCardSkeleton />
        <LinkCardSkeleton />
        <LinkCardSkeleton />
        <LinkCardSkeleton />
      </div>
    );
  }

  return null;
};

