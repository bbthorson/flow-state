import { useEffect, useRef } from 'react';
import { useDeviceStore } from '@/store/useDeviceStore';
import { useAppStore } from '@/store/useAppStore';

/**
 * Hook that monitors the debounced device status and triggers relevant flows.
 * This connects the low-level DeviceStore (sensor data) to the high-level AppStore (flows/actions).
 */
export function useFlowTriggerManager() {
  const battery = useDeviceStore((state) => state.battery);
  const network = useDeviceStore((state) => state.network);
  const triggerFlows = useAppStore((state) => state.triggerFlows);

  const lastBatteryCharging = useRef(battery.charging);
  const lastNetworkOnline = useRef(network.online);

  // Trigger for battery charging status
  useEffect(() => {
    if (battery.supported && !battery.pending) {
      if (battery.charging !== lastBatteryCharging.current) {
        triggerFlows('NATIVE_BATTERY', { charging: battery.charging });
        lastBatteryCharging.current = battery.charging;
      }
    }
  }, [battery.charging, battery.supported, battery.pending, triggerFlows]);

  // Trigger for network online/offline status
  useEffect(() => {
    if (network.supported && !network.pending) {
      if (network.online !== lastNetworkOnline.current) {
        triggerFlows('NETWORK', { online: network.online });
        lastNetworkOnline.current = network.online;
      }
    }
  }, [network.online, network.supported, network.pending, triggerFlows]);
}
