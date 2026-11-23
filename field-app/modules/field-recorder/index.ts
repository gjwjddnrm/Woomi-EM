import { requireNativeModule, type EventSubscription } from 'expo';

export type RecorderPhase = 'recording' | 'interrupted' | 'retrying' | 'stopped' | 'error';

export type RecorderStatus = {
  phase: RecorderPhase;
  running: boolean;
  sessionId: string | null;
  dir: string | null;
  startedAt: number;
  currentChunkPath: string | null;
  currentChunkStartedAt: number;
  chunkCount: number;
  restarts: number;
  interruptions: number;
  lastError: string | null;
  lowStorage: boolean;
  lowBattery: boolean;
};

export type Chunk = {
  path: string;
  startMs: number;
  durationMs: number;
  size: number;
  active: boolean;
};

export type ClipResult = {
  path: string;
  startMs: number;
  endMs: number;
  durationMs: number;
};

export type DeviceHealth = {
  batteryPct: number;
  charging: boolean;
  powerSaveMode: boolean;
  ignoringBatteryOptimizations: boolean;
  freeBytes: number;
  manufacturer: string;
  model: string;
  sdk: number;
};

type NativeModuleShape = {
  start(sessionId: string, dir: string, site: string, startedAt: number): Promise<RecorderStatus>;
  stop(): Promise<RecorderStatus>;
  getStatus(): RecorderStatus;
  listChunks(dir: string): Promise<Chunk[]>;
  writeClip(paths: string[], starts: number[], fromMs: number, toMs: number, outPath: string): Promise<ClipResult | null>;
  mergeToM4a(paths: string[], starts: number[], outPath: string): Promise<ClipResult | null>;
  getDeviceHealth(): DeviceHealth;
  requestIgnoreBatteryOptimizations(): boolean;
  openAppSettings(): boolean;
  openSamsungBatterySettings(): 'samsung' | 'generic' | 'app' | 'none';
  setVolumeKeyCapture(enabled: boolean): void;
  addListener(event: 'onVolumeKey', cb: (e: { key: 'up' | 'down' }) => void): EventSubscription;
};

const Native = requireNativeModule<NativeModuleShape>('FieldRecorder');

export default Native;
