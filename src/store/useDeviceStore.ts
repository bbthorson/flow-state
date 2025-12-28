import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DeviceState, DeviceActions, BatteryState, NetworkState } from '@/types/device';

const DEBOUNCE_DELAY = 5000; // 5 seconds

interface DeviceStore extends DeviceState, DeviceActions {
  batteryTimer: NodeJS.Timeout | null;
  networkTimer: NodeJS.Timeout | null;
}

export const useDeviceStore = create<DeviceStore>()(
  persist(
    (set, get) => ({
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
      batteryTimer: null,
      networkTimer: null,

      updateBattery: (batteryUpdate: Partial<BatteryState>) => {
        const state = get();
        
        // Clear existing timer
        if (state.batteryTimer) {
          clearTimeout(state.batteryTimer);
        }

        // Merge with existing pending state if any
        const newPending = {
            ...(state.battery.pending || {}),
            ...batteryUpdate
        };

        // Set pending state
        set((state) => ({
          battery: { ...state.battery, pending: newPending },
        }));

        // Start new timer
        const timer = setTimeout(() => {
          set((state) => ({
            battery: {
              ...state.battery,
              ...newPending,
              pending: undefined,
            },
            batteryTimer: null,
          }));
        }, DEBOUNCE_DELAY);

        set({ batteryTimer: timer });
      },

      updateNetwork: (networkUpdate: Partial<NetworkState>) => {
        const state = get();
        
        // Clear existing timer
        if (state.networkTimer) {
          clearTimeout(state.networkTimer);
        }

        // Merge with existing pending state if any
        const newPending = {
            ...(state.network.pending || {}),
            ...networkUpdate
        };

        // Set pending state
        set((state) => ({
          network: { ...state.network, pending: newPending },
        }));

        // Start new timer
        const timer = setTimeout(() => {
          set((state) => ({
            network: {
              ...state.network,
              ...newPending,
              pending: undefined,
            },
            networkTimer: null,
          }));
        }, DEBOUNCE_DELAY);

        set({ networkTimer: timer });
      },

      updateVisibility: (visibility) =>
        set((state) => ({
          visibility: { ...state.visibility, ...visibility },
        })),
    }),
    {
      name: 'flow-state-device-v1',
      partialize: (state) => ({
        battery: state.battery,
        network: state.network,
        visibility: state.visibility,
      }),
    }
  )
);