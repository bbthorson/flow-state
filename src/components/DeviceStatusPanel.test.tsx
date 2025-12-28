import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeviceStatusPanel } from './DeviceStatusPanel';
import { useDeviceStore } from '@/store/useDeviceStore';
import * as deviceUtils from '@/lib/device';

describe('DeviceStatusPanel', () => {
  beforeEach(() => {
    useDeviceStore.setState({
      battery: { level: 0.75, charging: false, supported: true },
      network: { online: true, type: 'wifi', effectiveType: '4g', supported: true },
      visibility: { state: 'visible', supported: true },
    });
    vi.spyOn(deviceUtils, 'getPermissionStatus').mockResolvedValue('granted');
  });

  it('renders current status values', async () => {
    render(<DeviceStatusPanel />);
    
    await waitFor(() => {
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText('Online')).toBeInTheDocument();
      expect(screen.getByText('visible')).toBeInTheDocument();
      expect(screen.getByText(/Type: wifi/)).toBeInTheDocument();
    });
  });

  it('renders offline status', async () => {
    useDeviceStore.setState({ network: { online: false, type: 'none', effectiveType: 'none', supported: true } });
    render(<DeviceStatusPanel />);
    
    await waitFor(() => {
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });
  });

  it('shows alert when permissions are denied', async () => {
    vi.spyOn(deviceUtils, 'getPermissionStatus').mockImplementation(async (name) => {
      if (name === 'geolocation') return 'denied';
      return 'granted';
    });

    render(<DeviceStatusPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Permissions Required/)).toBeInTheDocument();
      expect(screen.getByText(/geolocation/)).toBeInTheDocument();
    });
  });
});
