import { PermissionsAndroid, Platform, type Permission } from 'react-native';
import FieldRecorder, { type DeviceHealth, type RecorderStatus } from '../modules/field-recorder';
import * as DB from './db';
import { audioDirPath, makeInspectionDir } from './storage';
import { newId } from './util';

export const LOW_STORAGE_WARN = 1024 * 1024 * 1024; // 1GB 미만이면 경고
export const LOW_STORAGE_BLOCK = 150 * 1024 * 1024; // 150MB 미만이면 시작 불가
export const LOW_BATTERY_WARN = 30;

export type PermResult = { mic: boolean; camera: boolean; notifications: boolean };

export async function checkPermissions(): Promise<PermResult> {
  const P = PermissionsAndroid.PERMISSIONS;
  const mic = await PermissionsAndroid.check(P.RECORD_AUDIO);
  const camera = await PermissionsAndroid.check(P.CAMERA);
  const notifications =
    Number(Platform.Version) >= 33 && P.POST_NOTIFICATIONS ? await PermissionsAndroid.check(P.POST_NOTIFICATIONS) : true;
  return { mic, camera, notifications };
}

export async function requestPermissions(): Promise<PermResult> {
  const P = PermissionsAndroid.PERMISSIONS;
  const list: Permission[] = [P.RECORD_AUDIO, P.CAMERA];
  if (Number(Platform.Version) >= 33 && P.POST_NOTIFICATIONS) list.push(P.POST_NOTIFICATIONS);
  const r = await PermissionsAndroid.requestMultiple(list);
  const ok = (k: string) => r[k as keyof typeof r] === PermissionsAndroid.RESULTS.GRANTED;
  return {
    mic: ok(P.RECORD_AUDIO),
    camera: ok(P.CAMERA),
    notifications: Number(Platform.Version) >= 33 && P.POST_NOTIFICATIONS ? ok(P.POST_NOTIFICATIONS) : true,
  };
}

export function getHealth(): DeviceHealth | null {
  try {
    return FieldRecorder.getDeviceHealth();
  } catch (e) {
    console.warn('health', e);
    return null;
  }
}

export function healthWarnings(h: DeviceHealth | null): string[] {
  if (!h) return [];
  const w: string[] = [];
  if (h.freeBytes >= 0 && h.freeBytes < LOW_STORAGE_WARN)
    w.push(`저장공간이 ${Math.round(h.freeBytes / 1024 / 1024)}MB 남았습니다`);
  if (h.batteryPct >= 0 && h.batteryPct <= LOW_BATTERY_WARN && !h.charging)
    w.push(`배터리 ${h.batteryPct}% — 충전기를 준비하세요`);
  if (h.powerSaveMode) w.push('절전 모드가 켜져 있습니다 (녹음이 끊길 수 있음)');
  return w;
}

export function getStatus(): RecorderStatus | null {
  try {
    return FieldRecorder.getStatus();
  } catch {
    return null;
  }
}

export function isRecordingFor(id: string): boolean {
  const s = getStatus();
  return !!s && s.running && s.sessionId === id;
}

/** 새 점검: DB 기록 → 녹음 서비스 시작 */
export async function startInspection(site: string): Promise<DB.Inspection> {
  const id = newId();
  const dir = makeInspectionDir(id);
  const uri = dir.uri.endsWith('/') ? dir.uri.slice(0, -1) : dir.uri;
  const insp: DB.Inspection = {
    id,
    site: site.trim(),
    started_at: Date.now(),
    ended_at: null,
    status: 'active',
    dir: uri,
  };
  DB.createInspection(insp);
  await startRecording(insp);
  return insp;
}

export async function startRecording(insp: DB.Inspection): Promise<RecorderStatus> {
  const s = await FieldRecorder.start(insp.id, audioDirPath(insp), insp.site, insp.started_at);
  if (!s.running) {
    throw new Error(s.lastError || '녹음을 시작하지 못했습니다');
  }
  return s;
}

export async function finishInspection(insp: DB.Inspection): Promise<void> {
  try {
    await FieldRecorder.stop();
  } finally {
    DB.endInspection(insp.id, Date.now());
  }
}
