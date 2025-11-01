import React, { useState } from 'react';

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  content?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  className?: string;
  variant?: 'underline' | 'pills';
}

export const Tabs: React.FC<TabsProps> = ({ 
  tabs,
  defaultTab,
  onChange,
  className = '',
  variant = 'underline',
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleTabClick = (tabId: string, disabled?: boolean) => {
    if (disabled) return;
    setActiveTab(tabId);
    if (onChange) {
      onChange(tabId);
    }
  };

  const activeTabContent = tabs.find(tab => tab.id === activeTab)?.content;

  if (variant === 'pills') {
    return (
      <div className={className}>
        {/* Pills Navigation */}
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id, tab.disabled)}
              disabled={tab.disabled}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-primary text-white'
                  : 'bg-gray-2 text-body hover:bg-gray-3 dark:bg-dark-3 dark:text-body-dark dark:hover:bg-dark-4'
              } ${tab.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {tab.icon && <span>{tab.icon}</span>}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTabContent && <div>{activeTabContent}</div>}
      </div>
    );
  }

  // Underline variant (default)
  return (
    <div className={className}>
      {/* Underline Navigation */}
      <div className="border-b border-stroke dark:border-dark-3">
        <div className="flex gap-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id, tab.disabled)}
              disabled={tab.disabled}
              className={`inline-flex items-center gap-2 border-b-2 px-1 pb-4 text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-body hover:text-dark dark:text-body-dark dark:hover:text-white'
              } ${tab.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {tab.icon && <span>{tab.icon}</span>}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeTabContent && <div className="mt-6">{activeTabContent}</div>}
    </div>
  );
};

export default Tabs;

