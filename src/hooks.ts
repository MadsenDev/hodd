// @ts-nocheck
import React from 'react';
import {
  getUser, getCollections, getCollectionsExpanded, getCollection,
  getHome, getStats, getStory, getSearchIndex,
} from './api';

export function useAsync(fn, deps) {
  const [state, setState] = React.useState({ data: null, loading: true, error: null });
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    setState((s) => ({ data: s.data, loading: true, error: null }));
    Promise.resolve()
      .then(fn)
      .then(
        (data) => { if (alive) setState({ data, loading: false, error: null }); },
        (error) => {
          if (alive) setState({ data: null, loading: false, error });
          console.error("[HODD] data error:", error);
        }
      );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...(deps || []), nonce]);

  const refetch = React.useCallback(() => setNonce((n) => n + 1), []);
  return { data: state.data, loading: state.loading, error: state.error, refetch };
}

export const useUser            = ()   => useAsync(() => getUser(), []);
export const useCollections     = ()   => useAsync(() => getCollections(), []);
export const useCollectionsFull = ()   => useAsync(() => getCollectionsExpanded(), []);
export const useCollection      = (id) => useAsync(() => (id ? getCollection(id) : Promise.resolve(null)), [id]);
export const useHome            = ()   => useAsync(() => getHome(), []);
export const useStats           = ()   => useAsync(() => getStats(), []);
export const useStory           = (id) => useAsync(() => getStory(id), [id]);
export const useSearchIndex     = ()   => useAsync(() => getSearchIndex(), []);

export function combine(...states) {
  return {
    data:    states.every((s) => s.data != null) ? states.map((s) => s.data) : null,
    loading: states.some((s) => s.loading),
    error:   states.map((s) => s.error).filter(Boolean)[0] || null,
    refetch: () => states.forEach((s) => s.refetch && s.refetch()),
  };
}
