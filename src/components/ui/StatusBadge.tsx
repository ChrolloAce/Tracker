import React from 'react';
import { clsx } from 'clsx';

interface StatusBadgeProps {
  status: 'pending' | 'approved' | 'rejected';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const statusConfig = {
    pending: {
      label: 'Pending',
      className: 'bg-gray-100 text-gray-700 border-gray-200'
    },
    approved: {
      label: 'Approved',
      className: 'bg-success-50 text-success-600 border-success-200'
    },
    rejected: {
      label: 'Rejected',
      className: 'bg-danger-50 text-danger-600 border-danger-200'
    }
  };

  const config = statusConfig[status];

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
};
