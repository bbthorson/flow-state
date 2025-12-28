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

export interface DeviceState {
  battery: BatteryState;
  network: NetworkState;
  visibility: VisibilityState;
}

export interface DeviceActions {
  updateBattery: (battery: Partial<BatteryState>) => void;
  updateNetwork: (network: Partial<NetworkState>) => void;
  updateVisibility: (visibility: Partial<VisibilityState>) => void;
}
