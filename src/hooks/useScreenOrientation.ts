import { useEffect } from 'react';
import { useDeviceStore } from '@/store/useDeviceStore';

export function useScreenOrientation() {
  const updateOrientation = useDeviceStore((state) => state.updateOrientation);

  useEffect(() => {
    if (!screen?.orientation) {
      updateOrientation({ supported: false });
      return;
    }

    const handleChange = () => {
      updateOrientation({
        type: screen.orientation.type,
        angle: screen.orientation.angle,
        supported: true,
      });
    };

    // Set initial state
    handleChange();

    screen.orientation.addEventListener('change', handleChange);

    return () => {
      screen.orientation.removeEventListener('change', handleChange);
    };
  }, [updateOrientation]);
}
