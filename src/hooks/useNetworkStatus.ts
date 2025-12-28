import { useEffect } from 'react';
import { useDeviceStore } from '@/store/useDeviceStore';

export function useNetworkStatus() {
  const updateNetwork = useDeviceStore((state) => state.updateNetwork);

  useEffect(() => {
    const handleOnline = () => updateNetwork({ online: true });
    const handleOffline = () => updateNetwork({ online: false });

    const handleConnectionChange = () => {
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      if (connection) {
        updateNetwork({
          type: connection.type || 'unknown',
          effectiveType: connection.effectiveType || 'unknown',
          supported: true,
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
      handleConnectionChange();
    }

    // Set initial online state
    updateNetwork({ online: navigator.onLine });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, [updateNetwork]);
}
