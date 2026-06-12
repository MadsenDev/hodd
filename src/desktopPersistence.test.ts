import { describe, expect, it } from 'vitest';
import { collectHoddState, restoreHoddState } from './desktopPersistence';

function memoryStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  return {
    get length() { return values.size; },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    values,
  };
}

describe('desktop persistence', () => {
  it('collects only HODD-owned local state', () => {
    const storage = memoryStorage({ 'hodd:holdings:v1': '{"pk-red":{}}', unrelated: 'ignore me' });
    expect(collectHoddState(storage)).toEqual({
      version: 1,
      values: { 'hodd:holdings:v1': '{"pk-red":{}}' },
    });
  });

  it('restores valid HODD keys and ignores malformed entries', () => {
    const storage = memoryStorage();
    restoreHoddState({ values: { 'hodd:stories:v1': '{}', unsafe: 'no', 'hodd:bad': 7 } }, storage);
    expect(Object.fromEntries(storage.values)).toEqual({ 'hodd:stories:v1': '{}' });
  });
});
