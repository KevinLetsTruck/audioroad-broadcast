import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'neutral',
  size = 'md',
  className = '',
  dot = false,
}) => {
  const baseClasses = 'inline-flex items-center gap-1.5 rounded-full font-medium';
  
  const variantClasses = {
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-danger/10 text-danger',
    info: 'bg-primary/10 text-primary',
    primary: 'bg-primary text-white',
    neutral: 'bg-gray-2 text-body dark:bg-dark-3 dark:text-body-dark',
  };

  const sizeClasses = {
    sm: 'px-2.5 py-0.5 text-xs',
    md: 'px-3.5 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  const dotClasses = {
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    info: 'bg-primary',
    primary: 'bg-white',
    neutral: 'bg-body',
  };

  return (
    <span 
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {dot && (
        <span className={`h-1.5 w-1.5 rounded-full ${dotClasses[variant]}`} />
      )}
      {children}
    </span>
  );
};

export default Badge;

