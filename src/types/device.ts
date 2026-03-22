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

export interface IdleState {
  userState: 'active' | 'idle';
  screenState: 'locked' | 'unlocked';
  supported: boolean;
}

export interface MotionState {
  gesture: string | null; // 'SHAKE' | 'FACE_DOWN' | 'FACE_UP' | null
  supported: boolean;
}

export interface OrientationState {
  type: string; // portrait-primary, landscape-primary, etc.
  angle: number;
  supported: boolean;
}

export interface DeviceState {
  battery: BatteryState;
  network: NetworkState;
  visibility: VisibilityState;
  geolocation: GeolocationState;
  idle: IdleState;
  motion: MotionState;
  orientation: OrientationState;
}

export interface DeviceActions {
  updateBattery: (battery: Partial<BatteryState>) => void;
  updateNetwork: (network: Partial<NetworkState>) => void;
  updateVisibility: (visibility: Partial<VisibilityState>) => void;
  updateGeolocation: (geolocation: Partial<GeolocationState>) => void;
  updateIdle: (idle: Partial<IdleState>) => void;
  updateMotion: (motion: Partial<MotionState>) => void;
  updateOrientation: (orientation: Partial<OrientationState>) => void;
}
