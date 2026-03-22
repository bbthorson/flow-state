import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DeviceState, DeviceActions, BatteryState, NetworkState, GeolocationState, IdleState, MotionState, OrientationState } from '@/types/device';

const DEBOUNCE_DELAY = 5000; // 5 seconds

interface DeviceStore extends DeviceState, DeviceActions {
  batteryTimer: NodeJS.Timeout | null;
  networkTimer: NodeJS.Timeout | null;
  geolocationTimer: NodeJS.Timeout | null;
  idleTimer: NodeJS.Timeout | null;
  orientationTimer: NodeJS.Timeout | null;
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
      geolocation: {
        latitude: null,
        longitude: null,
        accuracy: null,
        speed: null,
        supported: false,
      },
      idle: {
        userState: 'active',
        screenState: 'unlocked',
        supported: false,
      },
      motion: {
        gesture: null,
        supported: false,
      },
      orientation: {
        type: 'portrait-primary',
        angle: 0,
        supported: false,
      },
      batteryTimer: null,
      networkTimer: null,
      geolocationTimer: null,
      idleTimer: null,
      orientationTimer: null,

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

      updateGeolocation: (geoUpdate: Partial<GeolocationState>) => {
        const state = get();

        // Clear existing timer
        if (state.geolocationTimer) {
          clearTimeout(state.geolocationTimer);
        }

        // Merge with existing pending state if any
        const newPending = {
          ...(state.geolocation.pending || {}),
          ...geoUpdate
        };

        // Set pending state
        set((state) => ({
          geolocation: { ...state.geolocation, pending: newPending },
        }));

        // Start new timer
        const timer = setTimeout(() => {
          set((state) => ({
            geolocation: {
              ...state.geolocation,
              ...newPending,
              pending: undefined,
            },
            geolocationTimer: null,
          }));
        }, DEBOUNCE_DELAY);

        set({ geolocationTimer: timer });
      },

      updateIdle: (idleUpdate: Partial<IdleState>) => {
        const state = get();

        // Clear existing timer
        if (state.idleTimer) {
          clearTimeout(state.idleTimer);
        }

        // Start new timer with shorter debounce
        const timer = setTimeout(() => {
          set((state) => ({
            idle: {
              ...state.idle,
              ...idleUpdate,
            },
            idleTimer: null,
          }));
        }, 1000);

        set({ idleTimer: timer });
      },

      updateMotion: (motionUpdate: Partial<MotionState>) => {
        // No debounce — gestures are already debounced in the hook
        set((state) => ({
          motion: { ...state.motion, ...motionUpdate },
        }));
      },

      updateOrientation: (orientationUpdate: Partial<OrientationState>) => {
        const state = get();

        // Clear existing timer
        if (state.orientationTimer) {
          clearTimeout(state.orientationTimer);
        }

        // Start new timer with shorter debounce
        const timer = setTimeout(() => {
          set((state) => ({
            orientation: {
              ...state.orientation,
              ...orientationUpdate,
            },
            orientationTimer: null,
          }));
        }, 1000);

        set({ orientationTimer: timer });
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
        geolocation: {
          latitude: null,
          longitude: null,
          accuracy: null,
          speed: null,
          supported: state.geolocation.supported
        },
        idle: state.idle,
        motion: state.motion,
        orientation: state.orientation,
      }),
    }
  )
);