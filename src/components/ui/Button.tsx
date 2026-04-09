import React from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}) => {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center font-semibold rounded-lg transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0',
        {
          // Primary — orange depth
          'bg-orange-500 text-white shadow-[0_2px_0_0_#c2410c] hover:shadow-[0_1px_0_0_#c2410c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px]': variant === 'primary',
          // Secondary — neutral depth
          'bg-surface-secondary text-content border border-border shadow-[0_2px_0_0_var(--border)] hover:shadow-[0_1px_0_0_var(--border)] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px]': variant === 'secondary',
          // Ghost — no depth
          'text-content hover:bg-surface-hover active:bg-surface-active': variant === 'ghost',
          // Danger — red depth
          'bg-red-500 text-white shadow-[0_2px_0_0_#b91c1c] hover:shadow-[0_1px_0_0_#b91c1c] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px]': variant === 'danger',

          // Sizes
          'px-3 py-1.5 text-xs': size === 'sm',
          'px-4 py-2 text-sm': size === 'md',
          'px-6 py-3 text-sm': size === 'lg',
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};
