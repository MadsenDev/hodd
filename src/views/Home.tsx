// @ts-nocheck
import React from 'react';
import { I, typeIcon } from '../icons';
import { Cover, CompletionRing, CoverShelf, SpineMosaic, useNarrow, Loading, ErrorState, rgba, shade } from '../components';
import { useHome, useCollections, useCollectionsFull } from '../hooks';

function StatLine({ D }) {
  const by = {};
  (D.headlineStats || []).forEach(s => { by[s.id] = s; });
  const parts = [];
  if (by.added) parts.push(<span className="sl-item" key="a"><span className="sl-ic">{I.plus({ size: 14, stroke: 2 })}</span><span><b>{by.added.value}</b> added this month</span></span>);
  if (by.movies) parts.push(<span className="sl-item" key="m"><span><b>{by.movies.value}%</b> of Movies complete</span></span>);
  if (by.unread) parts.push(<span className="sl-item" key="u"><span><b>{by.unread.value}</b> unread books</span></span>);
  return (
    <div className="statline">
      {parts.map((p, i) => [i ? <span className="dot" key={"d" + i} /> : null, p])}
    </div>
  );
}

export function CollCard({ c, onClick }) {
  return (
    <div className="coll-card" onClick={onClick}>
      <div className="top">
        <div className="ic" style={{ color: c.accent }}>{typeIcon(c.type, { size: 22, stroke: 1.6 })}</div>
        <div className="nm">{c.name}</div>
      </div>
      <div className="bottom">
        <div className="counts"><div className="o">{c.owned} owned</div><div className="m">{c.missing} missing</div></div>
        <CompletionRing pct={c.pct} size={50} stroke={5} color={c.accent} fontSize={12} />
      </div>
    </div>
  );
}

export function CollTile({ c, art = "Covers", onClick }) {
  return (
    <div className="ctile" onClick={onClick}>
      {art === "Covers"
        ? <CoverShelf items={c.items} accent={c.accent} height={128} coverH={88} maxOwned={4} ghosts={1} />
        : <SpineMosaic accent={c.accent} pct={c.pct} count={12} height={128} />}
      <div className="meta">
        <div className="nm"><span style={{ color: c.accent, display: "flex" }}>{typeIcon(c.type, { size: 17, stroke: 1.7 })}</span> {c.name}</div>
        <div className="cnt">{c.owned} of {c.owned + c.missing}</div>
        <div className="pbar"><i style={{ width: c.pct + "%", background: c.accent }} /></div>
      </div>
    </div>
  );
}

export function CollBanner({ c, art = "Covers", onClick }) {
  return (
    <div className="cbanner" onClick={onClick}>
      {art === "Covers"
        ? <CoverShelf items={c.items} accent={c.accent} height={176} coverH={130} maxOwned={7} ghosts={2} />
        : <SpineMosaic accent={c.accent} pct={c.pct} count={20} height={176} />}
      <div className="body">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ty"><span style={{ color: c.accent, display: "flex" }}>{typeIcon(c.type, { size: 14, stroke: 1.8 })}</span> {c.type}</div>
          <h3>{c.name}</h3>
          <div className="cnt">{c.owned} owned · <span className="miss">{c.missing} to find</span></div>
          <div className="pbar"><i style={{ width: c.pct + "%", background: c.accent }} /></div>
        </div>
        <div className="pctnum" style={{ color: c.accent }}>{c.pct}<span>%</span></div>
      </div>
    </div>
  );
}

function HeadlineStat({ s }) {
  const lines = String(s.label).split("\n");
  const label = lines.map((l, i) => (i ? [<br key={i} />, l] : l));
  return (
    <div className="stat">
      {s.ring != null
        ? <CompletionRing pct={s.ring} size={50} stroke={5} color="var(--gold)" showPct={false} />
        : <div className="glyph" style={s.iconColor ? { color: s.iconColor } : null}>
            {React.createElement(I[s.icon] || I.plus, { size: 22, stroke: s.icon === "plus" ? 1.8 : 1.6 })}
          </div>}
      <div>
        <div className="big" style={s.unit === "months" ? { fontSize: 27 } : null}>
          {s.value}
          {s.unit === "%" && <span style={{ fontSize: 18, color: "var(--dim)", marginLeft: 1 }}>%</span>}
          {s.unit === "months" && <span style={{ fontSize: 16, color: "var(--dim)" }}> months</span>}
        </div>
        <div className="lbl">{label}</div>
      </div>
    </div>
  );
}

export function Home({ ctx }) {
  const home = useHome();
  const cols = useCollections();
  const phone = useNarrow();

  if (home.loading || cols.loading) return <Loading />;
  if (home.error || cols.error) {
    return <ErrorState error={home.error || cols.error} onRetry={() => { home.refetch(); cols.refetch(); }} />;
  }

  const D = home.data;
  const F = D.featured;
  const collections = cols.data;
  const redis = D.rediscover;
  const ownedShelf = F.items.filter(i => i.owned).slice(0, 3);
  const missShelf = F.items.filter(i => !i.owned).slice(0, 3);
  const openRediscover = () => ctx.openItem(redis);
  const wishColl = (collections || [])
    .filter(c => c.pct < 100 && c.missing > 0)
    .sort((a, b) => b.pct - a.pct)[0] || null;

  return (
    <div className="view-enter">
      <div className="stats">
        {D.headlineStats.map(s => <HeadlineStat key={s.id} s={s} />)}
      </div>

      <div className="section-head"><div className="eyebrow">Featured shelf</div><a className="link" onClick={() => ctx.openCollection("featured")}>View all <I.arrowRight size={14} /></a></div>
      <div className="featured">
        <div className="featured-inner">
          <div className="featured-copy">
            <div className="eyebrow" style={{ color: "var(--gold-deep)" }}>{F.sub || "Featured"}</div>
            <h2>{F.name}</h2>
            <div className="meta">{F.owned} owned · {F.missing} missing</div>
            <div className="blurb">{F.blurb}</div>
          </div>
          <div className="shelf-track">
            {ownedShelf.map(it => <Cover key={it.id} item={{ ...it, type: F.type }} h={196} onClick={() => ctx.openItem(it, F)} />)}
            {missShelf.map(it => <Cover key={it.id} item={{ ...it, type: F.type }} h={196} ghost onClick={() => ctx.openItem(it, F)} />)}
          </div>
        </div>
        <div className="shelf-plank" />
        <div className="shelf-progress">
          <div className="bar"><i style={{ width: F.pct + "%" }} /></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            <span style={{ fontSize: 12.5, color: "var(--gold-soft)", fontWeight: 600 }}>{F.pct}% complete</span>
            <span style={{ fontSize: 12.5, color: "var(--mute)" }}>{F.missing} to collect</span>
          </div>
        </div>
      </div>

      <div className="home-mid">
        <div className="panel" style={{ overflow: "hidden" }}>
          <div style={{ padding: "20px 24px 0" }}><div className="eyebrow">Rediscover</div></div>
          <div className="rediscover">
            <Cover item={{ title: redis.title, sub: redis.sub, type: redis.type, color: redis.color }} h={188} onClick={openRediscover} />
            <div className="copy">
              <div className="ago">You acquired this {redis.acquired}</div>
              <h3>{redis.title}</h3>
              <div className="auth">{redis.sub}</div>
              <div className="fmt">{redis.format}{redis.edition ? ` · ${redis.edition}` : ""}</div>
              <div className="note">{redis.note}</div>
              <button className="btn" style={{ marginTop: 18 }} onClick={openRediscover}>View item <I.arrowRight size={15} /></button>
            </div>
          </div>
        </div>

        <div>
          <div className="section-head"><div className="eyebrow">Recently added</div><a className="link" onClick={() => ctx.go("timeline")}>View all</a></div>
          <div className="recent-grid">
            {D.recent.map(it => (
              <div className="recent-card" key={it.id} onClick={() => ctx.openItem(it)}>
                <Cover item={it} h={phone ? 150 : 196} onClick={() => ctx.openItem(it)} />
                <div className="title">{it.title}</div>
                <div className="sub">{it.sub}</div>
                <div className="date">{it.acquired}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="home-collections">
        <div className="section-head"><div className="eyebrow">Collections</div><a className="link" onClick={() => ctx.go("collections")}>View all collections</a></div>
        <div className="coll-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(184px, 1fr))" }}>
          {collections.map(c => <CollCard key={c.id} c={c} onClick={() => ctx.openCollection(c.id)} />)}
        </div>
      </div>

      <div className="home-bottom">
        <div className="panel aside-panel">
          <div className="section-head" style={{ margin: "0 0 6px" }}><div className="eyebrow">Recently added</div><a className="link" onClick={() => ctx.go("timeline")}>View full timeline</a></div>
          <div className="tl-list">
            {(D.recent && D.recent.length > 0 ? D.recent.slice(0, 4) : []).map((it, i) => (
              <div className="tl-item" key={it.id || i} onClick={() => it.type && ctx.openItem(it)} style={{ cursor: it.type ? "pointer" : "default" }}>
                <div className="tl-dot"><i style={{ background: it.collAccent || "var(--accent)" }} /></div>
                <div className="tl-body">
                  <div className="tl-when">{it.collName || ""}</div>
                  <div className="tl-text"><b>{it.title}</b>{it.year ? ` (${it.year})` : ""}</div>
                </div>
                <div className="tl-thumb" style={{ background: `linear-gradient(150deg, ${shade(it.collAccent || "#6366f1", 20)}, ${shade(it.collAccent || "#6366f1", -40)})` }} />
              </div>
            ))}
            {(!D.recent || !D.recent.length) && (D.timeline || []).slice(0, 4).map((t, i) => (
              <div className="tl-item" key={i}>
                <div className="tl-dot"><i style={{ background: t.color }} /></div>
                <div className="tl-body">
                  <div className="tl-when">{t.when}</div>
                  <div className="tl-text">{t.label} <b>{t.item}</b> to {t.to}</div>
                </div>
                <div className="tl-thumb" style={{ background: `linear-gradient(150deg, ${shade(t.color, 20)}, ${shade(t.color, -40)})` }} />
              </div>
            ))}
          </div>
        </div>

        {wishColl && (
          <div className="panel aside-panel wish">
            <div className="eyebrow" style={{ marginBottom: 4 }}>Wishlist highlight</div>
            <div className="lead" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ color: wishColl.accent, display: "flex" }}>{typeIcon(wishColl.type, { size: 16, stroke: 1.8 })}</span>
              {wishColl.name}
            </div>
            <div className="desc">{wishColl.missing} item{wishColl.missing !== 1 ? "s" : ""} left to complete this collection.</div>
            <div className="bar" style={{ marginTop: 12 }}><i style={{ width: wishColl.pct + "%", background: wishColl.accent }} /></div>
            <div className="progress-row">
              <span className="frac">{wishColl.owned} / {wishColl.owned + wishColl.missing} collected</span>
              <a className="link" onClick={() => ctx.openCollection(wishColl.id)}>Open</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function HomeNew({ ctx, art = "Covers" }) {
  const home = useHome();
  const cols = useCollectionsFull();
  const phone = useNarrow();

  if (home.loading || cols.loading) return <Loading />;
  if (home.error || cols.error) return <ErrorState error={home.error || cols.error} onRetry={() => { home.refetch(); cols.refetch(); }} />;

  const D = home.data;
  const F = D.featured;
  const collections = cols.data;
  const wish = D.wishlist;
  const redis = D.rediscover;
  const ownedShelf = F.items.filter(i => i.owned).slice(0, 3);
  const missShelf = F.items.filter(i => !i.owned).slice(0, 3);
  const openRediscover = () => ctx.openItem(redis);

  const stillToFind = [
    ...F.items.filter(i => !i.owned).map(i => ({ it: { ...i, type: F.type }, coll: F })),
    ...(wish.items || []).filter(i => !i.owned).map(i => ({ it: { ...i, type: "book" }, coll: { name: wish.name, items: wish.items, type: "book" } })),
  ].slice(0, 7);

  return (
    <div className="view-enter">
      <StatLine D={D} />

      <div className="section-head"><div className="eyebrow">Continue exploring</div><a className="link" onClick={() => ctx.go("collections")}>All collections <I.arrowRight size={14} /></a></div>
      <div className="explore-rail">
        {collections.map(c => <CollTile key={c.id} c={c} art={art} onClick={() => ctx.openCollection(c.id)} />)}
      </div>

      <div className="section-head" style={{ marginTop: 34 }}><div className="eyebrow">Featured shelf</div><a className="link" onClick={() => ctx.openCollection("featured")}>View all <I.arrowRight size={14} /></a></div>
      <div className="featured">
        <div className="featured-inner">
          <div className="featured-copy">
            <div className="eyebrow" style={{ color: "var(--gold-deep)" }}>{F.sub || "Featured"}</div>
            <h2>{F.name}</h2>
            <div className="meta">{F.owned} owned · {F.missing} missing</div>
            <div className="blurb">{F.blurb}</div>
          </div>
          <div className="shelf-track">
            {ownedShelf.map(it => <Cover key={it.id} item={{ ...it, type: F.type }} h={196} onClick={() => ctx.openItem(it, F)} />)}
            {missShelf.map(it => <Cover key={it.id} item={{ ...it, type: F.type }} h={196} ghost onClick={() => ctx.openItem(it, F)} />)}
          </div>
        </div>
        <div className="shelf-plank" />
        <div className="shelf-progress">
          <div className="bar"><i style={{ width: F.pct + "%" }} /></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            <span style={{ fontSize: 12.5, color: "var(--gold-soft)", fontWeight: 600 }}>{F.pct}% complete</span>
            <span style={{ fontSize: 12.5, color: "var(--mute)" }}>{F.missing} to collect</span>
          </div>
        </div>
      </div>

      <div className="section-head" style={{ marginTop: 34 }}><div className="eyebrow">Recently added</div><a className="link" onClick={() => ctx.go("timeline")}>View all</a></div>
      <div className="recent-grid">
        {D.recent.map(it => (
          <div className="recent-card" key={it.id} onClick={() => ctx.openItem(it)}>
            <Cover item={it} h={phone ? 150 : 196} onClick={() => ctx.openItem(it)} />
            <div className="title">{it.title}</div>
            <div className="sub">{it.sub}</div>
            <div className="date">{it.acquired}</div>
          </div>
        ))}
      </div>

      {stillToFind.length > 0 && (
        <>
          <div className="section-head" style={{ marginTop: 34 }}><div className="eyebrow">Still to find</div><a className="link" onClick={() => ctx.go("wishlist")}>Wishlist</a></div>
          <div className="find-rail">
            {stillToFind.map(({ it, coll }, i) => (
              <div className="find-item" key={it.id || i} onClick={() => ctx.openItem(it, coll)}>
                <Cover item={it} h={150} ghost onClick={() => ctx.openItem(it, coll)} />
                <div className="fn">{it.title}</div>
                <div className="fc">{coll.name}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-head" style={{ marginTop: 34 }}><div className="eyebrow">Rediscover</div></div>
      <div className="panel" style={{ overflow: "hidden" }}>
        <div className="rediscover">
          <Cover item={{ title: redis.title, sub: redis.sub, type: redis.type, color: redis.color }} h={188} onClick={openRediscover} />
          <div className="copy">
            <div className="ago">You acquired this {redis.acquired}</div>
            <h3>{redis.title}</h3>
            <div className="auth">{redis.sub}</div>
            <div className="fmt">{redis.format}{redis.edition ? ` · ${redis.edition}` : ""}</div>
            <div className="note">{redis.note}</div>
            <button className="btn" style={{ marginTop: 18 }} onClick={openRediscover}>View item <I.arrowRight size={15} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
