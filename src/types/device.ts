export interface BatteryState {
  level: number;
  charging: boolean;
  supported: boolean;
  pending?: Partial<Omit<BatteryState, 'pending'>>;
}

export interface NetworkState {
  online: boolean;
  type: string;
  effectiveType: string;
  supported: boolean;
  pending?: Partial<Omit<NetworkState, 'pending'>>;
}

export interface VisibilityState {
  state: DocumentVisibilityState;
  supported: boolean;
}

export interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  speed: number | null;
  supported: boolean;
  pending?: Partial<Omit<GeolocationState, 'pending'>>;
}

export interface DeviceState {
  battery: BatteryState;
  network: NetworkState;
  visibility: VisibilityState;
  geolocation: GeolocationState;
}

export interface DeviceActions {
  updateBattery: (battery: Partial<BatteryState>) => void;
  updateNetwork: (network: Partial<NetworkState>) => void;
  updateVisibility: (visibility: Partial<VisibilityState>) => void;
  updateGeolocation: (geolocation: Partial<GeolocationState>) => void;
}
