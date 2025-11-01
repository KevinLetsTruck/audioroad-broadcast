import React from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  title,
  description,
  icon,
  action,
  className = '',
}) => {
  const defaultIcon = (
    <svg 
      className="h-16 w-16 text-body/40 dark:text-body-dark/40" 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={1.5} 
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" 
      />
    </svg>
  );

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      <div className="mb-4">
        {icon || defaultIcon}
      </div>
      
      <h3 className="text-title-md mb-2 text-dark dark:text-white">
        {title}
      </h3>
      
      {description && (
        <p className="text-body-md mb-6 max-w-md text-body dark:text-body-dark">
          {description}
        </p>
      )}
      
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center justify-center gap-2.5 rounded-md bg-primary px-6 py-3 text-center font-medium text-white hover:bg-opacity-90 transition-all"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;

