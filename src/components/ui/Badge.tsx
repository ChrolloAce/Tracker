import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';

interface BadgeProps {
  count?: number;
  loading?: boolean;
  className?: string;
}

export function Badge({ count, loading, className = '' }: BadgeProps) {
  // Debug logging
  useEffect(() => {
    console.log('🔔 Badge state:', { count, loading });
  }, [count, loading]);

  // Show loading spinner
  if (loading) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      </div>
    );
  }

  // Hide badge if no count
  if (!count || count === 0) {
    return null;
  }

  // Show unread count badge
  return (
    <div
      className={`
        flex items-center justify-center
        min-w-[20px] h-5 px-1.5
        bg-blue-500 text-white
        rounded-full text-xs font-semibold
        animate-pulse
        ${className}
      `}
    >
      {count > 99 ? '99+' : count}
    </div>
  );
}

