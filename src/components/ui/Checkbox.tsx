import React from 'react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ 
  label,
  error,
  className = '',
  id,
  ...props
}) => {
  const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="flex flex-col">
      <div className="flex items-center">
        <input
          id={checkboxId}
          type="checkbox"
          className={`h-5 w-5 rounded border-stroke bg-transparent text-primary focus:ring-2 focus:ring-primary/50 disabled:cursor-default disabled:bg-gray-2 dark:border-dark-3 dark:bg-dark-2 dark:focus:ring-primary ${className}`}
          {...props}
        />
        {label && (
          <label 
            htmlFor={checkboxId}
            className="ml-2 text-sm font-medium text-dark dark:text-white cursor-pointer select-none"
          >
            {label}
          </label>
        )}
      </div>
      {error && (
        <p className="mt-1 text-sm text-danger">{error}</p>
      )}
    </div>
  );
};

export default Checkbox;

