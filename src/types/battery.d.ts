// src/types/battery.d.ts
interface BatteryManager extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
}

interface Navigator {
  getBattery(): Promise<BatteryManager>;
}