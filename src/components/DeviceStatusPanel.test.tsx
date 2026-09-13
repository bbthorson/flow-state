import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeviceStatusPanel } from './DeviceStatusPanel';
import { useDeviceStore } from '@/store/useDeviceStore';
import * as deviceUtils from '@/lib/device';

/** happy-dom has neither API, so capability has to be stated explicitly. */
function deviceCan({ battery = true, connectionType = true } = {}) {
  vi.spyOn(deviceUtils, 'getSupportedTriggers').mockReturnValue({
    battery,
    connectionType,
    network: true,
    visibility: true,
  });
}

describe('DeviceStatusPanel', () => {
  beforeEach(() => {
    useDeviceStore.setState({
      battery: { level: 0.75, charging: false, supported: true },
      network: { online: true, type: 'wifi', effectiveType: '4g', supported: true },
      visibility: { state: 'visible', supported: true },
    });
    vi.spyOn(deviceUtils, 'getPermissionStatus').mockResolvedValue('granted');
    deviceCan();
  });

  it('renders current status values', async () => {
    render(<DeviceStatusPanel />);

    await waitFor(() => {
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText('Online')).toBeInTheDocument();
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

  describe('sensor the device cannot report at all', () => {
    it('reports the battery as unavailable instead of inventing a reading', async () => {
      // The store keeps its defaults (100%, discharging) when nothing reports.
      // Those used to render as a confident "100% / Discharging (Not Supported)".
      deviceCan({ battery: false });
      useDeviceStore.setState({ battery: { level: 1, charging: false, supported: false } });
      render(<DeviceStatusPanel />);

      await waitFor(() => {
        expect(screen.getByText('Unavailable')).toBeInTheDocument();
      });
      expect(screen.queryByText('100%')).not.toBeInTheDocument();
      expect(screen.queryByText(/Discharging/)).not.toBeInTheDocument();
    });

    it('still reports online/offline without the Network Information API', async () => {
      // navigator.onLine is universally available, so this stays truthful —
      // only the connection type is unknown.
      deviceCan({ connectionType: false });
      useDeviceStore.setState({
        network: { online: true, type: 'unknown', effectiveType: 'unknown', supported: false },
      });
      render(<DeviceStatusPanel />);

      await waitFor(() => {
        expect(screen.getByText('Online')).toBeInTheDocument();
      });
      expect(screen.getByText('Type unavailable')).toBeInTheDocument();
      expect(screen.queryByText(/Type: unknown/)).not.toBeInTheDocument();
    });
  });

  describe('sensor that can report but has not yet', () => {
    // Device store updates are debounced by 5s, so a capable device spends the
    // first moments with supported:false. That must not read as "unavailable".
    it('shows the battery as checking, not unavailable', async () => {
      deviceCan({ battery: true });
      useDeviceStore.setState({ battery: { level: 1, charging: false, supported: false } });
      render(<DeviceStatusPanel />);

      await waitFor(() => {
        expect(screen.getByText('Checking…')).toBeInTheDocument();
      });
      expect(screen.queryByText('Unavailable')).not.toBeInTheDocument();
      expect(screen.queryByText('100%')).not.toBeInTheDocument();
    });

    it('shows the connection type as checking, not unavailable', async () => {
      deviceCan({ connectionType: true });
      useDeviceStore.setState({
        network: { online: true, type: 'unknown', effectiveType: 'unknown', supported: false },
      });
      render(<DeviceStatusPanel />);

      await waitFor(() => {
        expect(screen.getByText('Online')).toBeInTheDocument();
      });
      expect(screen.getByText('Checking…')).toBeInTheDocument();
      expect(screen.queryByText('Type unavailable')).not.toBeInTheDocument();
    });
  });

  it('falls back to effectiveType when the browser leaves type undefined', async () => {
    // This is the common case on Chromium and Android Chrome; showing `type`
    // alone would render a useless "Type: unknown".
    useDeviceStore.setState({
      network: { online: true, type: 'unknown', effectiveType: '4g', supported: true },
    });
    render(<DeviceStatusPanel />);

    await waitFor(() => expect(screen.getByText('Type: 4g')).toBeInTheDocument());
    expect(screen.queryByText(/Type: unknown/)).not.toBeInTheDocument();
  });

  it('shows no type subtitle when offline', async () => {
    useDeviceStore.setState({
      network: { online: false, type: 'none', effectiveType: 'none', supported: true },
    });
    render(<DeviceStatusPanel />);

    await waitFor(() => expect(screen.getByText('Offline')).toBeInTheDocument());
    expect(screen.queryByText(/Type/)).not.toBeInTheDocument();
    expect(screen.queryByText('Checking…')).not.toBeInTheDocument();
  });

  it('does not surface visibility, which backs no trigger type', async () => {
    render(<DeviceStatusPanel />);

    await waitFor(() => expect(screen.getByText('Online')).toBeInTheDocument());
    expect(screen.queryByText(/Foreground/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Visibility/)).not.toBeInTheDocument();
  });
});
