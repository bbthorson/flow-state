import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DeviceState, DeviceActions } from '@/types/device';

export const useDeviceStore = create<DeviceState & DeviceActions>()(
  persist(
    (set) => ({
      battery: {
        level: 1,
        charging: false,
        supported: false,
      },
      network: {
        online: typeof navigator !== 'undefined' ? navigator.onLine : true,
        type: 'unknown',
        effectiveType: 'unknown',
        supported: false,
      },
      visibility: {
        state: typeof document !== 'undefined' ? document.visibilityState : 'visible',
        supported: false,
      },

      updateBattery: (battery) =>
        set((state) => ({
          battery: { ...state.battery, ...battery },
        })),
      updateNetwork: (network) =>
        set((state) => ({
          network: { ...state.network, ...network },
        })),
      updateVisibility: (visibility) =>
        set((state) => ({
          visibility: { ...state.visibility, ...visibility },
        })),
    }),
    {
      name: 'flow-state-device-v1',
    }
  )
);
