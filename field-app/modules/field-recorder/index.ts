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
  /** 현재 소리 크기 0..1 */
  level: number;
  /** 최근 1.5초 안에 말소리 */
  voice: boolean;
};

export type Chunk = {
  path: string;
  startMs: number;
  durationMs: number;
  size: number;
  active: boolean;
  /** 말소리 길이(ms). -1이면 측정 불가 */
  speechMs: number;
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
  speechSpans(path: string): Promise<number[] | null>;
  writeSpans(path: string, spans: number[], outPath: string): Promise<number>;
  getDeviceHealth(): DeviceHealth;
  requestIgnoreBatteryOptimizations(): boolean;
  openAppSettings(): boolean;
  openSamsungBatterySettings(): 'samsung' | 'generic' | 'app' | 'none';
  setVolumeKeyCapture(enabled: boolean): void;
  addListener(event: 'onVolumeKey', cb: (e: { key: 'up' | 'down' }) => void): EventSubscription;
};

const Native = requireNativeModule<NativeModuleShape>('FieldRecorder');

export default Native;
