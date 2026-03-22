import { useEffect } from 'react';
import { useDeviceStore } from '@/store/useDeviceStore';

export function useIdleStatus() {
  const updateIdle = useDeviceStore((state) => state.updateIdle);

  useEffect(() => {
    if (!('IdleDetector' in window)) {
      updateIdle({ supported: false });
      return;
    }

    const IdleDetector = (window as any).IdleDetector;
    let detector: any = null;

    const startDetector = async () => {
      try {
        const permission = await IdleDetector.requestPermission();
        if (permission !== 'granted') {
          updateIdle({ supported: false });
          return;
        }

        detector = new IdleDetector();

        detector.addEventListener('change', () => {
          updateIdle({
            userState: detector.userState,
            screenState: detector.screenState,
            supported: true,
          });
        });

        await detector.start({ threshold: 60000 });

        updateIdle({
          userState: detector.userState ?? 'active',
          screenState: detector.screenState ?? 'unlocked',
          supported: true,
        });
      } catch {
        updateIdle({ supported: false });
      }
    };

    startDetector();

    return () => {
      if (detector) {
        detector.stop();
      }
    };
  }, [updateIdle]);
}
