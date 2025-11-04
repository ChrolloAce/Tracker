import { Loader2 } from 'lucide-react';

interface BadgeProps {
  count?: number;
  loading?: boolean;
  className?: string;
}

export function Badge({ count, loading, className = '' }: BadgeProps) {
  if (loading) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!count || count === 0) {
    return null;
  }

  return (
    <div
      className={`
        flex items-center justify-center
        min-w-[20px] h-5 px-1.5
        bg-green-500 text-white
        rounded-full text-xs font-semibold
        ${className}
      `}
    >
      {count > 99 ? '99+' : count}
    </div>
  );
}

