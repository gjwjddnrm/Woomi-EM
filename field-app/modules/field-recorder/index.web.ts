// 웹 미리보기(디자인 확인)용 가짜 모듈. 실제 앱에서는 쓰이지 않습니다.
import type { Chunk, ClipResult, DeviceHealth, RecorderStatus } from './index';
export type { Chunk, ClipResult, DeviceHealth, RecorderPhase, RecorderStatus } from './index';

const t0 = Date.now() - 23 * 60_000 - 41_000;
let level = 0.4;
const Mock = {
  async start(): Promise<RecorderStatus> {
    return Mock.getStatus();
  },
  async stop(): Promise<RecorderStatus> {
    return Mock.getStatus();
  },
  getStatus(): RecorderStatus {
    level = Math.max(0.05, Math.min(1, level + (Math.random() - 0.5) * 0.5));
    return {
      phase: 'recording',
      running: true,
      sessionId: 'demo-active',
      dir: '/x',
      startedAt: t0,
      currentChunkPath: null,
      currentChunkStartedAt: Date.now(),
      chunkCount: 24,
      restarts: 0,
      interruptions: 0,
      lastError: null,
      lowStorage: false,
      lowBattery: false,
      level,
      voice: level > 0.3,
    };
  },
  async listChunks(): Promise<Chunk[]> {
    const base = Date.now() - 3 * 3600_000;
    return Array.from({ length: 34 }, (_, i) => ({
      path: `/c${i}`,
      startMs: base + i * 60_000,
      durationMs: 59_800,
      size: 480_000,
      active: false,
      speechMs: i % 5 === 3 ? 0 : 30_000 + (i % 3) * 9000,
    }));
  },
  async writeClip(): Promise<ClipResult | null> {
    return null;
  },
  async mergeToM4a(): Promise<ClipResult | null> {
    return null;
  },
  async writeSpans(): Promise<number> {
    return 0;
  },
  async speechSpans(): Promise<number[] | null> {
    return [];
  },
  async saveToGallery(paths: string[]): Promise<number> {
    return paths.length;
  },
  async zipFiles(): Promise<number> {
    return 1;
  },
  getDeviceHealth(): DeviceHealth {
    return {
      batteryPct: 82,
      charging: false,
      powerSaveMode: false,
      ignoringBatteryOptimizations: true,
      freeBytes: 41.2 * 1024 ** 3,
      manufacturer: 'samsung',
      model: 'SM-S921N',
      sdk: 35,
    };
  },
  requestIgnoreBatteryOptimizations: () => true,
  openAppSettings: () => true,
  openSamsungBatterySettings: () => 'samsung' as const,
  setVolumeKeyCapture: () => {},
  addListener: () => ({ remove() {} }),
};
export default Mock;
