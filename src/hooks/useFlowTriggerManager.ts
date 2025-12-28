import { useEffect, useRef } from 'react';
import { useDeviceStore } from '@/store/useDeviceStore';
import { useAppStore } from '@/store/useAppStore';
import { calculateDistance } from '@/lib/utils';

/**
 * Hook that monitors the debounced device status and triggers relevant flows.
 * This connects the low-level DeviceStore (sensor data) to the high-level AppStore (flows/actions).
 */
export function useFlowTriggerManager() {
  const battery = useDeviceStore((state) => state.battery);
  const network = useDeviceStore((state) => state.network);
  const geolocation = useDeviceStore((state) => state.geolocation);
  const triggerFlows = useAppStore((state) => state.triggerFlows);
  const flows = useAppStore((state) => state.flows);

  const lastBatteryCharging = useRef(battery.charging);
  const lastNetworkOnline = useRef(network.online);
  
  // Track "inside/outside" state for each geolocation flow
  // Map<flowId, isInside>
  const zoneStates = useRef<Map<string, boolean>>(new Map());

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

  // Trigger for geolocation geofencing
  useEffect(() => {
    if (geolocation.supported && !geolocation.pending && geolocation.latitude !== null && geolocation.longitude !== null) {
      flows.forEach(flow => {
        if (flow.enabled && flow.trigger.type === 'GEOLOCATION') {
          const { latitude, longitude, radius, event } = flow.trigger.details;
          if (latitude === undefined || longitude === undefined || radius === undefined) return;

          const distance = calculateDistance(
            geolocation.latitude!,
            geolocation.longitude!,
            latitude,
            longitude
          );

          const isInside = distance <= radius;
          const wasInside = zoneStates.current.get(flow.id);

          // If this is the first time checking this flow, just record the state
          if (wasInside === undefined) {
            zoneStates.current.set(flow.id, isInside);
            return;
          }

          // Detect transitions
          if (isInside && !wasInside && event === 'ENTER') {
            triggerFlows('GEOLOCATION', { event: 'ENTER', distance }, flow.id);
          } else if (!isInside && wasInside && event === 'EXIT') {
            triggerFlows('GEOLOCATION', { event: 'EXIT', distance }, flow.id);
          }

          zoneStates.current.set(flow.id, isInside);
        }
      });
    }
  }, [geolocation.latitude, geolocation.longitude, geolocation.supported, geolocation.pending, flows, triggerFlows]);
}
