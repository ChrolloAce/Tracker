import React from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
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
        'inline-flex items-center justify-center font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-md border border-white/20 shadow-lg hover:shadow-xl',
        {
          // Variants - Glass effect with sharp edges
          'bg-gradient-to-r from-blue-500/80 to-purple-600/80 text-white hover:from-blue-600/90 hover:to-purple-700/90 hover:border-white/30': variant === 'primary',
          'bg-white/10 text-gray-700 hover:bg-white/20 hover:text-gray-800 border-gray-300/30': variant === 'secondary',
          'text-gray-700 hover:bg-white/10 border-transparent hover:border-white/20': variant === 'ghost',
          
          // Sizes
          'px-3 py-1.5 text-sm': size === 'sm',
          'px-4 py-2 text-sm': size === 'md',
          'px-6 py-3 text-base': size === 'lg',
        },
        className
      )}
      style={{
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
      {...props}
    >
      {children}
    </button>
  );
};
