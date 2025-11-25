// src/hooks/useDeviceStatus.ts
import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';

export function useDeviceStatus() {
  const {
    setCharging,
    setFaceDown,
    setOnlineStatus,
    setNetworkType,
    setVisibilityState
  } = useAppStore();

  useEffect(() => {
    // 1. Battery status
    let battery: any;
    const updateBatteryStatus = () => {
      if (battery) {
        setCharging(battery.charging);
      }
    };

    navigator.getBattery?.().then(b => {
      battery = b;
      battery.addEventListener('chargingchange', updateBatteryStatus);
      updateBatteryStatus();
    });

    // 2. Screen orientation
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta !== null && event.gamma !== null) {
        const isFaceDown = event.beta > 160 && event.beta < 200;
        setFaceDown(isFaceDown);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);

    // 3. Network Status (Online/Offline)
    const handleOnline = () => setOnlineStatus(true);
    const handleOffline = () => setOnlineStatus(false);

    // Initial check
    setOnlineStatus(navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 4. Network Connection Info (e.g. 'wifi', 'cellular') - Chrome/Android only
    // @ts-ignore - navigator.connection is non-standard
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const updateConnectionStatus = () => {
      if (connection) {
        setNetworkType(connection.effectiveType || connection.type);
      }
    };

    if (connection) {
      connection.addEventListener('change', updateConnectionStatus);
      updateConnectionStatus();
    }

    // 5. Visibility State
    const handleVisibilityChange = () => {
      setVisibilityState(document.visibilityState);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Initial check
    setVisibilityState(document.visibilityState);


    return () => {
      if (battery) {
        battery.removeEventListener('chargingchange', updateBatteryStatus);
      }
      window.removeEventListener('deviceorientation', handleOrientation);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', updateConnectionStatus);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [setCharging, setFaceDown, setOnlineStatus, setNetworkType, setVisibilityState]);
}