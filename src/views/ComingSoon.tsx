// @ts-nocheck
import React from 'react';
import { HoddMark } from '../icons';

export function ComingSoon({ name }) {
  return (
    <div className="coming view-enter">
      <div>
        <HoddMark size={48} color="var(--gold-deep)" style={{ opacity: .5 }} />
        <div className="em" style={{ marginTop: 18 }}>{name}</div>
        <div>This corner of your hoard is still being curated.</div>
      </div>
    </div>
  );
}
