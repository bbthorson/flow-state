import { useEffect } from 'react';
import { useDeviceStore } from '@/store/useDeviceStore';

export function useBatteryStatus() {
  const updateBattery = useDeviceStore((state) => state.updateBattery);

  useEffect(() => {
    let batteryManager: any = null;

    const updateAllBatteryInfo = () => {
      if (batteryManager) {
        updateBattery({
          level: batteryManager.level,
          charging: batteryManager.charging,
          supported: true,
        });
      }
    };

    if (typeof navigator !== 'undefined' && (navigator as any).getBattery) {
      (navigator as any).getBattery().then((bm: any) => {
        batteryManager = bm;
        updateAllBatteryInfo();

        batteryManager.addEventListener('chargingchange', updateAllBatteryInfo);
        batteryManager.addEventListener('levelchange', updateAllBatteryInfo);
      });
    } else {
        updateBattery({ supported: false });
    }

    return () => {
      if (batteryManager) {
        batteryManager.removeEventListener('chargingchange', updateAllBatteryInfo);
        batteryManager.removeEventListener('levelchange', updateAllBatteryInfo);
      }
    };
  }, [updateBattery]);
}
