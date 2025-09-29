import React from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'glass' | 'glass-primary' | 'glass-success' | 'glass-danger';
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
        'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
        {
          // Standard variants
          'bg-primary-500 text-white hover:bg-primary-600 shadow-md hover:shadow-lg focus:ring-primary-500': variant === 'primary',
          'bg-gray-100 text-gray-700 hover:bg-gray-200 shadow-sm hover:shadow-md focus:ring-gray-500': variant === 'secondary',
          'text-gray-700 hover:bg-gray-100 focus:ring-gray-500': variant === 'ghost',
          
          // Glass variants
          'glass-button text-gray-700 hover:text-gray-800 focus:ring-blue-500': variant === 'glass',
          'glass-button-primary hover:scale-105 focus:ring-blue-500': variant === 'glass-primary',
          'glass-button-success hover:scale-105 focus:ring-green-500': variant === 'glass-success',
          'glass-button-danger hover:scale-105 focus:ring-red-500': variant === 'glass-danger',
          
          // Sizes
          'px-3 py-1.5 text-sm': size === 'sm',
          'px-4 py-2 text-sm': size === 'md',
          'px-6 py-3 text-base': size === 'lg',
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};
