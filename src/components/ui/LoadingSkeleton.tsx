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

// Skeleton for Creator Card (for Creators page)
export const CreatorCardSkeleton: React.FC = () => {
  return (
    <div className="bg-zinc-900/60 backdrop-blur-sm rounded-xl border border-white/10 p-6">
      <div className="flex items-center space-x-3 mb-4">
        <LoadingSkeleton className="w-10 h-10" variant="circle" />
        <div className="flex-1 space-y-2">
          <LoadingSkeleton className="w-32 h-5" variant="text" />
          <LoadingSkeleton className="w-40 h-4" variant="text" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mt-4">
        <div className="space-y-2">
          <LoadingSkeleton className="w-16 h-4" variant="text" />
          <LoadingSkeleton className="w-12 h-6" />
        </div>
        <div className="space-y-2">
          <LoadingSkeleton className="w-20 h-4" variant="text" />
          <LoadingSkeleton className="w-16 h-6" />
        </div>
        <div className="space-y-2">
          <LoadingSkeleton className="w-12 h-4" variant="text" />
          <LoadingSkeleton className="w-10 h-6" />
        </div>
      </div>
    </div>
  );
};

// Skeleton for Team Member Row (for Team page)
export const TeamMemberRowSkeleton: React.FC = () => {
  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4 mb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 flex-1">
          <LoadingSkeleton className="w-10 h-10" variant="circle" />
          <div className="flex-1 space-y-2">
            <LoadingSkeleton className="w-40 h-5" variant="text" />
            <LoadingSkeleton className="w-48 h-4" variant="text" />
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <LoadingSkeleton className="w-20 h-8" />
          <LoadingSkeleton className="w-24 h-4" variant="text" />
          <div className="flex space-x-2">
            <LoadingSkeleton className="w-8 h-8" />
            <LoadingSkeleton className="w-8 h-8" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Full Page Loading State
export const PageLoadingSkeleton: React.FC<{ type?: 'dashboard' | 'accounts' | 'links' | 'creators' | 'team' }> = ({ 
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

  if (type === 'creators') {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-900/60 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <LoadingSkeleton className="w-10 h-10" variant="circle" />
              <LoadingSkeleton className="w-20 h-8" />
            </div>
            <LoadingSkeleton className="w-16 h-8 mb-2" />
            <LoadingSkeleton className="w-24 h-4" variant="text" />
          </div>
          <div className="bg-zinc-900/60 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <LoadingSkeleton className="w-10 h-10" variant="circle" />
            </div>
            <LoadingSkeleton className="w-16 h-8 mb-2" />
            <LoadingSkeleton className="w-24 h-4" variant="text" />
          </div>
          <div className="bg-zinc-900/60 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <LoadingSkeleton className="w-10 h-10" variant="circle" />
            </div>
            <LoadingSkeleton className="w-20 h-8 mb-2" />
            <LoadingSkeleton className="w-28 h-4" variant="text" />
          </div>
        </div>

        {/* Creators Table */}
        <div className="rounded-2xl bg-zinc-900/60 backdrop-blur border border-white/5 overflow-hidden">
          <div className="px-6 py-5 border-b border-white/5">
            <LoadingSkeleton className="w-48 h-6 mb-2" variant="text" />
            <LoadingSkeleton className="w-64 h-4" variant="text" />
          </div>
          <div className="space-y-0">
            <CreatorCardSkeleton />
            <CreatorCardSkeleton />
            <CreatorCardSkeleton />
            <CreatorCardSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (type === 'team') {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header skeleton */}
        <div className="flex items-start justify-between mb-6">
          <div className="space-y-2">
            <LoadingSkeleton className="w-48 h-8" variant="text" />
            <LoadingSkeleton className="w-96 h-4" variant="text" />
          </div>
          <LoadingSkeleton className="w-40 h-10" />
        </div>

        {/* Team Members Table */}
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700">
            <LoadingSkeleton className="w-48 h-6" variant="text" />
          </div>
          <div className="p-4 space-y-3">
            <TeamMemberRowSkeleton />
            <TeamMemberRowSkeleton />
            <TeamMemberRowSkeleton />
            <TeamMemberRowSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return null;
};

