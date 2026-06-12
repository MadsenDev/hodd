// @ts-nocheck
import React from 'react';

export function HoddMark({ size = 28, stroke = 1.6, color = "currentColor", style = undefined }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={style}>
      <g fill={color}>
        <rect x="22" y="24" width="9" height="52" rx="4" />
        <rect x="69" y="24" width="9" height="52" rx="4" />
        <rect x="31" y="35" width="38" height="7.5" rx="3.75" />
        <rect x="31" y="46.25" width="38" height="7.5" rx="3.75" />
        <rect x="31" y="57.5" width="38" height="7.5" rx="3.75" />
      </g>
    </svg>
  );
}

export function Icon({ children, size = 20, stroke = 1.7, style = undefined, className = undefined }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={style} className={className}>
      {children}
    </svg>
  );
}

export const I = {
  home:       (p) => <Icon {...p}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v9h14v-9" /><path d="M9.5 19v-5h5v5" /></Icon>,
  grid:       (p) => <Icon {...p}><rect x="3" y="3" width="7.5" height="7.5" rx="1.4" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.4" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.4" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.4" /></Icon>,
  heart:      (p) => <Icon {...p}><path d="M12 20s-7-4.5-9.2-8.6C1.3 8.3 2.8 5 6 5c2 0 3.2 1.2 4 2.4C10.8 6.2 12 5 14 5c3.2 0 4.7 3.3 3.2 6.4C19 15.5 12 20 12 20Z" /></Icon>,
  clock:      (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></Icon>,
  compass:    (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5 Z" /></Icon>,
  chart:      (p) => <Icon {...p}><path d="M5 20V10" /><path d="M12 20V4" /><path d="M19 20v-7" /></Icon>,
  search:     (p) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></Icon>,
  plus:       (p) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>,
  bell:       (p) => <Icon {...p}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10.5 19a1.7 1.7 0 0 0 3 0" /></Icon>,
  settings:   (p) => <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 13.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V20a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1A2 2 0 1 1 2.5 16l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1.5a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 3.4 6.5l-.1-.1A2 2 0 1 1 6 3.6l.1.1a1.6 1.6 0 0 0 1.8.3H8a1.6 1.6 0 0 0 1-1.5V2a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1A2 2 0 1 1 21.5 6l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.1a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.2 1Z" /></Icon>,
  arrowRight: (p) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>,
  arrowLeft:  (p) => <Icon {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Icon>,
  check:      (p) => <Icon {...p}><path d="M4 12.5 9 17.5 20 6.5" /></Icon>,
  sparkle:    (p) => <Icon {...p}><path d="M12 3.5c.6 3.7 1.8 4.9 5.5 5.5-3.7.6-4.9 1.8-5.5 5.5-.6-3.7-1.8-4.9-5.5-5.5 3.7-.6 4.9-1.8 5.5-5.5Z" /><path d="M18.5 14.5c.3 1.7.9 2.3 2.5 2.6-1.6.3-2.2.9-2.5 2.6-.3-1.7-.9-2.3-2.5-2.6 1.6-.3 2.2-.9 2.5-2.6Z" /></Icon>,
  book:       (p) => <Icon {...p}><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5Z" /><path d="M5 19.5A1.5 1.5 0 0 1 6.5 18H19v3H6.5A1.5 1.5 0 0 1 5 19.5Z" /></Icon>,
  film:       (p) => <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" /></Icon>,
  gamepad:    (p) => <Icon {...p}><path d="M7 8h10a4 4 0 0 1 4 4v1a3 3 0 0 1-5.2 2l-.8-.9H9l-.8.9A3 3 0 0 1 3 13v-1a4 4 0 0 1 4-4Z" /><path d="M7.5 11v2M6.5 12h2M15.5 11.5h.01M17.5 13.5h.01" /></Icon>,
  coin:       (p) => <Icon {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5.5" /></Icon>,
  comic:      (p) => <Icon {...p}><rect x="4" y="3" width="16" height="18" rx="1.6" /><path d="M8 3v18" /><path d="M11 7h6M11 10h6M11 13h4" /></Icon>,
  disc:       (p) => <Icon {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2" /></Icon>,
  eye:        (p) => <Icon {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.6" /></Icon>,
  lock:       (p) => <Icon {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Icon>,
  tag:        (p) => <Icon {...p}><path d="M3 12V4h8l9 9-8 8-9-9Z" /><circle cx="7.5" cy="7.5" r="1.4" /></Icon>,
  calendar:   (p) => <Icon {...p}><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Icon>,
  close:      (p) => <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>,
  edit:       (p) => <Icon {...p}><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="M13.5 6.5 17.5 10.5" /></Icon>,
  trash:      (p) => <Icon {...p}><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></Icon>,
  enter:      (p) => <Icon {...p}><path d="M5 12h12M13 7l5 5-5 5" /><path d="M18 5v14" opacity=".5" /></Icon>,
  diamond:    (p) => <Icon {...p}><path d="M12 3 19 12 12 21 5 12Z" /></Icon>,
  alert:      (p) => <Icon {...p}><path d="M12 3.5 22 20H2L12 3.5Z" /><path d="M12 10v4.5" /><path d="M12 17.5h.01" /></Icon>,
  refresh:    (p) => <Icon {...p}><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v4h-4" /></Icon>,
  download:   (p) => <Icon {...p}><path d="M12 3v13M7 11l5 5 5-5" /><path d="M3 20h18" /></Icon>,
  upload:     (p) => <Icon {...p}><path d="M12 21V8M7 13l5-5 5 5" /><path d="M3 4h18" /></Icon>,
};

export function typeIcon(type, props) {
  const m = { book: I.book, movie: I.film, game: I.gamepad, coin: I.coin, comic: I.comic, vinyl: I.disc, other: I.tag };
  const Fn = m[type] || I.grid;
  return Fn(props);
}
