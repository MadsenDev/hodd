import React from 'react';
import {
  getUser, getCollections, getCollectionsExpanded, getCollection,
  getHome, getStats, getStory, getSearchIndex, getTimeline, isFavorite,
} from './api';

// Fix 14 & 15: proper generics and optional onError callback
// NOTE: call sites should check the returned `.error` field to handle async errors gracefully.
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: React.DependencyList,
  onError?: (error: unknown) => void,
): {
  data: T | null;
  loading: boolean;
  error: unknown;
  refetch: () => void;
} {
  const [state, setState] = React.useState<{ data: T | null; loading: boolean; error: unknown }>({ data: null, loading: true, error: null });
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    setState((s) => ({ data: s.data, loading: true, error: null }));
    Promise.resolve()
      .then(fn)
      .then(
        (data) => { if (alive) setState({ data, loading: false, error: null }); },
        (error: unknown) => {
          if (alive) setState({ data: null, loading: false, error });
          console.error("[HODD] data error:", error);
          if (onError) onError(error);
        }
      );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...(deps || []), nonce]);

  const refetch = React.useCallback(() => setNonce((n) => n + 1), []);
  return { data: state.data, loading: state.loading, error: state.error, refetch };
}

export const useUser            = ()            => useAsync(() => getUser(), []);
export const useCollections     = ()            => useAsync(() => getCollections(), []);
export const useCollectionsFull = ()            => useAsync(() => getCollectionsExpanded(), []);
export const useCollection      = (id: string | null | undefined) => useAsync(() => (id ? getCollection(id) : Promise.resolve(null)), [id]);
export const useHome            = ()            => useAsync(() => getHome(), []);
export const useStats           = ()            => useAsync(() => getStats(), []);
export const useStory           = (id: string) => useAsync(() => getStory(id), [id]);
export const useSearchIndex     = ()            => useAsync(() => getSearchIndex(), []);
export const useTimeline        = ()            => useAsync(() => getTimeline(), []);
export const useFavorite        = (id: string) => useAsync(() => isFavorite(id), [id]);

// Fix 16: combine is not imported anywhere else in the codebase; kept with proper TypeScript types
// in case it becomes useful, but can be removed if confirmed unused.
interface AsyncState<T = unknown> {
  data: T | null;
  loading: boolean;
  error: unknown;
  refetch?: () => void;
}

export function combine(...states: AsyncState[]): AsyncState<unknown[]> {
  return {
    data:    states.every((s) => s.data != null) ? states.map((s) => s.data) : null,
    loading: states.some((s) => s.loading),
    error:   states.map((s) => s.error).filter(Boolean)[0] || null,
    refetch: () => states.forEach((s) => s.refetch && s.refetch()),
  };
}
