// src/hooks/useDeviceStatus.ts
import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';

export function useDeviceStatus() {
  const { setCharging, setFaceDown } = useAppStore();

  useEffect(() => {
    // Battery status
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

    // Screen orientation
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta !== null && event.gamma !== null) {
        const isFaceDown = event.beta > 160 && event.beta < 200;
        setFaceDown(isFaceDown);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      if (battery) {
        battery.removeEventListener('chargingchange', updateBatteryStatus);
      }
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [setCharging, setFaceDown]);
}