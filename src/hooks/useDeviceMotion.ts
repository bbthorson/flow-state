import { useEffect } from 'react';
import { useDeviceStore } from '@/store/useDeviceStore';

const SHAKE_THRESHOLD = 15;
const SHAKE_DEBOUNCE_MS = 1000;
const FACE_SUSTAIN_MS = 500;
const GESTURE_RESET_MS = 2000;

export function useDeviceMotion() {
  const updateMotion = useDeviceStore((state) => state.updateMotion);

  useEffect(() => {
    if (typeof DeviceMotionEvent === 'undefined') {
      updateMotion({ supported: false });
      return;
    }

    updateMotion({ supported: true });

    let lastShakeTime = 0;
    let faceDownStart: number | null = null;
    let faceUpStart: number | null = null;
    let gestureResetTimer: NodeJS.Timeout | null = null;

    const setGesture = (gesture: string) => {
      updateMotion({ gesture });

      if (gestureResetTimer) {
        clearTimeout(gestureResetTimer);
      }
      gestureResetTimer = setTimeout(() => {
        updateMotion({ gesture: null });
        gestureResetTimer = null;
      }, GESTURE_RESET_MS);
    };

    const handleMotion = (event: DeviceMotionEvent) => {
      const now = Date.now();

      // Shake detection
      const acc = event.acceleration;
      if (acc && acc.x != null && acc.y != null && acc.z != null) {
        const magnitude = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
        if (magnitude > SHAKE_THRESHOLD && now - lastShakeTime > SHAKE_DEBOUNCE_MS) {
          lastShakeTime = now;
          setGesture('SHAKE');
          return;
        }
      }

      // Face down / face up detection
      const accG = event.accelerationIncludingGravity;
      if (accG && accG.z != null) {
        // Face down: z < -9
        if (accG.z < -9) {
          if (faceDownStart === null) {
            faceDownStart = now;
          } else if (now - faceDownStart >= FACE_SUSTAIN_MS) {
            setGesture('FACE_DOWN');
            faceDownStart = null;
            faceUpStart = null;
            return;
          }
        } else {
          faceDownStart = null;
        }

        // Face up: z > 9
        if (accG.z > 9) {
          if (faceUpStart === null) {
            faceUpStart = now;
          } else if (now - faceUpStart >= FACE_SUSTAIN_MS) {
            setGesture('FACE_UP');
            faceUpStart = null;
            faceDownStart = null;
            return;
          }
        } else {
          faceUpStart = null;
        }
      }
    };

    window.addEventListener('devicemotion', handleMotion);

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
      if (gestureResetTimer) {
        clearTimeout(gestureResetTimer);
      }
    };
  }, [updateMotion]);
}
