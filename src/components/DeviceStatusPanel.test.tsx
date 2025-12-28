import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { DeviceStatusPanel } from './DeviceStatusPanel';
import { useDeviceStore } from '@/store/useDeviceStore';

describe('DeviceStatusPanel', () => {
  beforeEach(() => {
    useDeviceStore.setState({
      battery: { level: 0.75, charging: false, supported: true },
      network: { online: true, type: 'wifi', effectiveType: '4g', supported: true },
      visibility: { state: 'visible', supported: true },
    });
  });

  it('renders current status values', () => {
    render(<DeviceStatusPanel />);
    
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.getByText('visible')).toBeInTheDocument();
    expect(screen.getByText(/Type: wifi/)).toBeInTheDocument();
  });

  it('renders offline status', () => {
    useDeviceStore.setState({ network: { online: false, type: 'none', effectiveType: 'none', supported: true } });
    render(<DeviceStatusPanel />);
    
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });
});
