import * as DB from './db';
import * as SecureStore from 'expo-secure-store';

export type KeyName = 'openai' | 'anthropic' | 'gemini';
const ID: Record<KeyName, string> = { openai: 'openai_api_key', anthropic: 'anthropic_api_key', gemini: 'gemini_api_key' };

export type Engine = 'gemini' | 'paid';
/** 정리 기능에 쓸 AI. 기본은 Gemini(무료 사용량) */
export function getEngine(): Engine {
  return DB.getSetting('aiEngine') === 'paid' ? 'paid' : 'gemini';
}
export function setEngine(e: Engine): void {
  DB.setSetting('aiEngine', e);
}

export async function getKey(k: KeyName): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ID[k]);
  } catch {
    return null;
  }
}

export async function setKey(k: KeyName, v: string): Promise<void> {
  const t = v.trim();
  if (t) await SecureStore.setItemAsync(ID[k], t);
  else await SecureStore.deleteItemAsync(ID[k]);
}

export function maskKey(v: string | null): string {
  if (!v) return '없음';
  return v.length <= 10 ? '••••' : `${v.slice(0, 6)}…${v.slice(-4)}`;
}
