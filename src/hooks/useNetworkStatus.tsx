import { useState, useEffect } from 'react';

/**
 * Hook to detect network connectivity status
 * Shows a banner when offline and automatically hides when back online
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        console.log('✅ [NETWORK] Connection restored');
        setWasOffline(false);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      console.warn('⚠️ [NETWORK] Connection lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  return { isOnline, wasOffline };
}

/**
 * Network Status Banner Component
 * Displays when connection is lost
 */
export default function NetworkStatusBanner() {
  const { isOnline, wasOffline } = useNetworkStatus();

  if (isOnline || !wasOffline) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 bg-red-600 text-white px-4 py-2 text-center z-50 animate-pulse">
      <div className="flex items-center justify-center gap-2">
        <span>⚠️</span>
        <span className="font-semibold">Connection Lost</span>
        <span className="text-sm">- Some features may not work. Reconnecting...</span>
      </div>
    </div>
  );
}

