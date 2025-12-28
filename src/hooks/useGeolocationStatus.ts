import { useEffect } from 'react';
import { useDeviceStore } from '@/store/useDeviceStore';

export function useGeolocationStatus() {
  const updateGeolocation = useDeviceStore((state) => state.updateGeolocation);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      updateGeolocation({ supported: false });
      return;
    }

    updateGeolocation({ supported: true });

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        updateGeolocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
        });
      },
      (error) => {
        console.error('Geolocation error:', error);
        // We still support it, but maybe permission denied or temporary failure
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [updateGeolocation]);
}
