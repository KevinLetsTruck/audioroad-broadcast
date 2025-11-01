import React from 'react';

export interface FormFieldProps {
  children: React.ReactNode;
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  htmlFor?: string;
}

export const FormField: React.FC<FormFieldProps> = ({ 
  children,
  label,
  error,
  helperText,
  required,
  htmlFor,
}) => {
  return (
    <div className="w-full">
      {label && (
        <label 
          htmlFor={htmlFor}
          className="mb-2.5 block text-sm font-medium text-dark dark:text-white"
        >
          {label}
          {required && <span className="text-danger ml-1">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="mt-1 text-sm text-danger">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-body dark:text-body-dark">{helperText}</p>
      )}
    </div>
  );
};

export default FormField;

