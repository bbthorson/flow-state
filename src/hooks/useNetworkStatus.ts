import { useEffect } from 'react';
import { useDeviceStore } from '@/store/useDeviceStore';

export function useNetworkStatus() {
  const updateNetwork = useDeviceStore((state) => state.updateNetwork);

  useEffect(() => {
    const handleOnline = () => updateNetwork({ online: true });
    const handleOffline = () => updateNetwork({ online: false });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial state
    updateNetwork({ online: navigator.onLine });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [updateNetwork]);
}
