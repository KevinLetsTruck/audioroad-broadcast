import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'bordered' | 'shadow' | 'elevated';
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  variant = 'default', 
  className = '',
  padding = 'md'
}) => {
  const baseClasses = 'rounded-[10px] bg-white dark:bg-gray-dark';
  
  const variantClasses = {
    default: 'border border-stroke dark:border-dark-3 shadow-1 dark:shadow-card',
    bordered: 'border-2 border-stroke dark:border-dark-3',
    shadow: 'shadow-2',
    elevated: 'shadow-4',
  };

  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'px-7.5 py-6',
    lg: 'p-8',
  };

  return (
    <div 
      className={`${baseClasses} ${variantClasses[variant]} ${paddingClasses[padding]} ${className}`}
    >
      {children}
    </div>
  );
};

export default Card;

