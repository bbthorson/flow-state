import { useEffect, useRef } from 'react';
import { useDeviceStore } from '@/store/useDeviceStore';
import { useAppStore } from '@/store/useAppStore';
import { calculateDistance } from '@/lib/utils';
import { DAY_LABELS } from '@/lib/schedule';

/** How often to check schedule triggers while the app is foregrounded. */
const SCHEDULE_CHECK_MS = 30_000;

/**
 * Hook that monitors the debounced device status and triggers relevant flows.
 * This connects the low-level DeviceStore (sensor data) to the high-level AppStore (flows/actions).
 */
export function useFlowTriggerManager() {
  const battery = useDeviceStore((state) => state.battery);
  const network = useDeviceStore((state) => state.network);
  const geolocation = useDeviceStore((state) => state.geolocation);
  const idle = useDeviceStore((state) => state.idle);
  const motion = useDeviceStore((state) => state.motion);
  const orientation = useDeviceStore((state) => state.orientation);
  const triggerFlows = useAppStore((state) => state.triggerFlows);
  const flows = useAppStore((state) => state.flows);

  const lastBattery = useRef({ charging: battery.charging, level: battery.level });
  const lastNetworkOnline = useRef(network.online);
  const lastIdleUserState = useRef(idle.userState);
  const lastIdleScreenState = useRef(idle.screenState);
  const lastMotionGesture = useRef(motion.gesture);
  const lastOrientationType = useRef(orientation.type);
  
  // Track "inside/outside" state for each geolocation flow
  // Map<flowId, isInside>
  const zoneStates = useRef<Map<string, boolean>>(new Map());

  // Track the last schedule occurrence fired per flow (Map<flowId, "date time">)
  // so a flow fires at most once per scheduled minute.
  const scheduleFired = useRef<Map<string, string>>(new Map());

  // Battery: report charging changes and level changes together with the
  // previous state, so a flow can fire on *entering* its configured state
  // (e.g. unplugged AND at or below 20%) — see `matchesTrigger`.
  useEffect(() => {
    if (battery.supported && !battery.pending) {
      const previous = lastBattery.current;
      if (battery.charging !== previous.charging || battery.level !== previous.level) {
        void triggerFlows('NATIVE_BATTERY', { charging: battery.charging, level: battery.level, previous });
        lastBattery.current = { charging: battery.charging, level: battery.level };
      }
    }
  }, [battery.charging, battery.level, battery.supported, battery.pending, triggerFlows]);

  // Deferred (scheduled) action steps: run what came due while the app was
  // closed, then keep checking while it is open. Timers set at schedule time
  // cover the common case; this is the backstop.
  const runDueScheduled = useAppStore((state) => state.runDueScheduled);
  useEffect(() => {
    void runDueScheduled();
    const id = setInterval(() => void runDueScheduled(), SCHEDULE_CHECK_MS);
    return () => clearInterval(id);
  }, [runDueScheduled]);

  // Trigger for network online/offline status
  useEffect(() => {
    if (network.supported && !network.pending) {
      if (network.online !== lastNetworkOnline.current) {
        void triggerFlows('NETWORK', { online: network.online });
        lastNetworkOnline.current = network.online;
      }
    }
  }, [network.online, network.supported, network.pending, triggerFlows]);

  // Trigger for geolocation geofencing
  useEffect(() => {
    if (geolocation.supported && !geolocation.pending && geolocation.latitude !== null && geolocation.longitude !== null) {
      flows.forEach(flow => {
        if (flow.active && flow.trigger.type === 'GEOLOCATION') {
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
            void triggerFlows('GEOLOCATION', { event: 'ENTER', distance }, flow.id);
          } else if (!isInside && wasInside && event === 'EXIT') {
            void triggerFlows('GEOLOCATION', { event: 'EXIT', distance }, flow.id);
          }

          zoneStates.current.set(flow.id, isInside);
        }
      });
    }
  }, [geolocation.latitude, geolocation.longitude, geolocation.supported, geolocation.pending, flows, triggerFlows]);

  // Trigger for idle state changes
  useEffect(() => {
    if (idle.supported) {
      const userChanged = idle.userState !== lastIdleUserState.current;
      const screenChanged = idle.screenState !== lastIdleScreenState.current;

      if (userChanged || screenChanged) {
        void triggerFlows('IDLE', { userState: idle.userState, screenState: idle.screenState });
        lastIdleUserState.current = idle.userState;
        lastIdleScreenState.current = idle.screenState;
      }
    }
  }, [idle.userState, idle.screenState, idle.supported, triggerFlows]);

  // Trigger for device motion gestures
  useEffect(() => {
    if (motion.supported && motion.gesture && motion.gesture !== lastMotionGesture.current) {
      void triggerFlows('DEVICE_MOTION', { gesture: motion.gesture });
    }
    lastMotionGesture.current = motion.gesture;
  }, [motion.gesture, motion.supported, triggerFlows]);

  // Trigger for scheduled (TIME) flows. PWA constraint: this only fires while
  // the app is open. If the app is closed at the scheduled minute, the flow
  // does not run until the next matching occurrence — no background wakeups.
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const dow = now.getDay();
      const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

      flows.forEach((flow) => {
        if (!flow.active || flow.trigger.type !== 'TIME') return;
        const { time, days } = flow.trigger.details as { time?: string; days?: number[] };
        if (!time || time !== current) return;

        const dayOk = !days || days.length === 0 || days.includes(dow);
        if (!dayOk) return;

        const occurrence = `${dateKey} ${time}`;
        if (scheduleFired.current.get(flow.id) === occurrence) return;
        scheduleFired.current.set(flow.id, occurrence);

        void triggerFlows(
          'TIME',
          { time, date: now.toLocaleDateString(), day: DAY_LABELS[dow], timestamp: now.getTime() },
          flow.id,
        );
      });
    };

    check();
    const id = setInterval(check, SCHEDULE_CHECK_MS);
    return () => clearInterval(id);
  }, [flows, triggerFlows]);

  // Trigger for screen orientation changes
  useEffect(() => {
    if (orientation.supported && orientation.type !== lastOrientationType.current) {
      const mapped = orientation.type.startsWith('portrait') ? 'portrait' : 'landscape';
      void triggerFlows('SCREEN_ORIENTATION', { orientation: mapped, angle: orientation.angle });
      lastOrientationType.current = orientation.type;
    }
  }, [orientation.type, orientation.angle, orientation.supported, triggerFlows]);
}
