import { readFile, writeFile } from 'node:fs/promises';
import { SETTINGS_FILE } from './config.ts';

export async function readJson<T>(file: URL, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return fallback; // lần chạy đầu: chưa có file
  }
}

export const writeJson = (file: URL, data: unknown) => writeFile(file, JSON.stringify(data));

export interface Settings {
  ai: boolean;
}

export const settings = await readJson<Settings>(SETTINGS_FILE, { ai: true });

export const saveSettings = () => writeJson(SETTINGS_FILE, settings);
