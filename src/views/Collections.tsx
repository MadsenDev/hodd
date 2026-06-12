// @ts-nocheck
import React from 'react';
import { I } from '../icons';
import { Loading, ErrorState, EmptyState } from '../components';
import { useCollections, useCollectionsFull } from '../hooks';
import { CollCard, CollBanner } from './Home';

export function Collections({ ctx }) {
  const { data, loading, error, refetch } = useCollections();
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data.length) return <EmptyState title="No collections yet" sub="Start a collection from the + button and it'll appear here." />;
  return (
    <div className="view-enter">
      <div className="coll-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {data.map(c => <CollCard key={c.id} c={c} onClick={() => ctx.openCollection(c.id)} />)}
      </div>
    </div>
  );
}

export function CollectionsNew({ ctx, art = "Covers" }) {
  const { data, loading, error, refetch } = useCollectionsFull();
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data.length) return <EmptyState title="No collections yet" sub="Start a collection from the + button and it'll appear here." />;
  return (
    <div className="view-enter">
      <div className="coll-shelves">
        {data.map(c => <CollBanner key={c.id} c={c} art={art} onClick={() => ctx.openCollection(c.id)} />)}
        <button className="coll-new" onClick={() => ctx.newCollection()}>
          <span className="coll-new-plus"><I.plus size={26} stroke={1.8} /></span>
          <span className="coll-new-t">New collection</span>
          <span className="coll-new-s">Track anything — watches, sneakers, stamps, LEGO…</span>
        </button>
      </div>
    </div>
  );
}
