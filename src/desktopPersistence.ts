const HODD_PREFIX = 'hodd:';

type PersistedState = {
  version: 1;
  values: Record<string, string>;
};

export function collectHoddState(storage: Pick<Storage, 'length' | 'key' | 'getItem'>): PersistedState {
  const values: Record<string, string> = {};
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith(HODD_PREFIX)) continue;
    const value = storage.getItem(key);
    if (value !== null) values[key] = value;
  }
  return { version: 1, values };
}

export function restoreHoddState(
  state: Record<string, unknown>,
  storage: Pick<Storage, 'setItem'>,
) {
  const values = state.values;
  if (!values || typeof values !== 'object' || Array.isArray(values)) return;
  for (const [key, value] of Object.entries(values)) {
    if (key.startsWith(HODD_PREFIX) && typeof value === 'string') storage.setItem(key, value);
  }
}

