// @ts-nocheck
import React from 'react';
import { I } from '../icons';

export function LoanView({ ctx }) {
  const [borrowed, setBorrowed] = React.useState([]);
  const [lent, setLent] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      const api = window.hoddDesktop?.api;
      if (!api) return;

      const [holdings, catalog, userItems, userColl] = await Promise.all([
        api.getHoldings(),
        api.getCatalog(),
        api.getUserItems(),
        api.getUserCollections(),
      ]);

      const catMap = {};
      for (const c of catalog) catMap[c.id] = c;

      // Build borrowed list (ownership === 'borrowed' OR loan_from set)
      const borrowedItems = [];
      for (const [id, h] of Object.entries(holdings)) {
        if (h.ownership === 'borrowed' || h.loan_from) {
          const item = catMap[id] || { id, title: id };
          borrowedItems.push({ ...item, ...h, _id: id });
        }
      }

      // Build lent list (loan_to set)
      const lentItems = [];
      for (const [id, h] of Object.entries(holdings)) {
        if (h.loan_to) {
          const item = catMap[id] || { id, title: id };
          lentItems.push({ ...item, ...h, _id: id });
        }
      }
      // Also check user_items
      for (const collItems of Object.values(userItems)) {
        for (const it of collItems) {
          if (it.loan_to) lentItems.push({ ...it, _id: it.id });
        }
      }

      setBorrowed(borrowedItems);
      setLent(lentItems);
      setLoading(false);
    }
    load();
  }, []);

  function daysAgo(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }

  function isOverdue(dateStr) {
    const days = daysAgo(dateStr);
    return days !== null && days > 30;
  }

  if (loading) return <div className="loading-state">Loading loans…</div>;

  return (
    <div className="loan-view view-enter">
      <section className="loan-section">
        <h2 className="loan-heading">
          <I.download size={18} stroke={1.8} />
          Borrowed ({borrowed.length})
          <span className="loan-subhead">Items you've borrowed from others</span>
        </h2>
        {borrowed.length === 0 ? (
          <div className="ef-empty">Nothing borrowed right now.</div>
        ) : (
          <div className="loan-list">
            {borrowed.map(item => (
              <div key={item._id} className={"loan-card" + (isOverdue(item.loan_date) ? " overdue" : "")}>
                <div className="loan-card-color" style={{ background: item.color || 'var(--accent)' }} />
                <div className="loan-card-body">
                  <div className="loan-card-title">{item.title}</div>
                  {item.loan_from && <div className="loan-card-meta">From: <strong>{item.loan_from}</strong></div>}
                  {item.loan_date && (
                    <div className={"loan-card-meta" + (isOverdue(item.loan_date) ? " overdue-text" : "")}>
                      Since: {item.loan_date}
                      {daysAgo(item.loan_date) !== null && ` (${daysAgo(item.loan_date)} days)`}
                      {isOverdue(item.loan_date) && <span className="overdue-badge">Overdue</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="loan-section">
        <h2 className="loan-heading">
          <I.upload size={18} stroke={1.8} />
          Lent out ({lent.length})
          <span className="loan-subhead">Items you've lent to others</span>
        </h2>
        {lent.length === 0 ? (
          <div className="ef-empty">Nothing lent out right now.</div>
        ) : (
          <div className="loan-list">
            {lent.map(item => (
              <div key={item._id || item.id} className={"loan-card" + (isOverdue(item.loan_to_date) ? " overdue" : "")}>
                <div className="loan-card-color" style={{ background: item.color || 'var(--accent)' }} />
                <div className="loan-card-body">
                  <div className="loan-card-title">{item.title}</div>
                  {item.loan_to && <div className="loan-card-meta">To: <strong>{item.loan_to}</strong></div>}
                  {item.loan_to_date && (
                    <div className={"loan-card-meta" + (isOverdue(item.loan_to_date) ? " overdue-text" : "")}>
                      Since: {item.loan_to_date}
                      {daysAgo(item.loan_to_date) !== null && ` (${daysAgo(item.loan_to_date)} days)`}
                      {isOverdue(item.loan_to_date) && <span className="overdue-badge">Overdue</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
