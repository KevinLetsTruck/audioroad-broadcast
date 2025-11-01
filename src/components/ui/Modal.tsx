import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen,
  onClose,
  children,
  title,
  size = 'md',
  showCloseButton = true,
}) => {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-142.5',
    lg: 'max-w-180',
    xl: 'max-w-192.5',
  };

  return createPortal(
    <div 
      className="fixed left-0 top-0 z-9999 flex h-screen w-screen items-center justify-center bg-dark/80 px-4 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className={`w-full ${sizeClasses[size]} rounded-[10px] bg-white px-8 py-12 dark:bg-gray-dark animate-slideUp`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="mb-6 flex items-center justify-between">
            {title && (
              <h3 className="text-title-lg font-bold text-dark dark:text-white">
                {title}
              </h3>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="ml-auto flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-2 dark:hover:bg-dark-3 transition-colors"
                aria-label="Close modal"
              >
                <svg
                  className="h-6 w-6 text-body dark:text-body-dark"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div>{children}</div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;

