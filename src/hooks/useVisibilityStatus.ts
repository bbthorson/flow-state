import { useEffect } from 'react';
import { useDeviceStore } from '@/store/useDeviceStore';

export function useVisibilityStatus() {
  const updateVisibility = useDeviceStore((state) => state.updateVisibility);

  useEffect(() => {
    const handleVisibilityChange = () => {
      updateVisibility({ state: document.visibilityState });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set initial state
    updateVisibility({ state: document.visibilityState });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [updateVisibility]);
}
