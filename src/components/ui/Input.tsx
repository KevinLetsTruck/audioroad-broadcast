import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

export const Input: React.FC<InputProps> = ({ 
  label,
  error,
  helperText,
  fullWidth = true,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const widthClass = fullWidth ? 'w-full' : '';
  const errorClass = error ? 'border-danger focus:border-danger' : 'border-stroke focus:border-primary';

  return (
    <div className={widthClass}>
      {label && (
        <label 
          htmlFor={inputId}
          className="mb-2.5 block text-sm font-medium text-dark dark:text-white"
        >
          {label}
          {props.required && <span className="text-danger ml-1">*</span>}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full rounded-[7px] border-[1.5px] ${errorClass} bg-transparent px-5.5 py-3 text-dark outline-none transition placeholder:text-body focus:border-primary active:border-primary disabled:cursor-default disabled:bg-gray-2 dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:border-primary dark:disabled:bg-dark-3 ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-danger">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-body dark:text-body-dark">{helperText}</p>
      )}
    </div>
  );
};

export default Input;

