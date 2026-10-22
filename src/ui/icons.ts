// 24×24 line icons. Stroke uses currentColor.
const svg = (d: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const ICON = {
  home: svg('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  soundOff: svg('<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>'),
  soundOn: svg('<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  back: svg('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  check: svg('<path d="m5 12 5 5L20 7"/>'),
  note: svg('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'),
};

export const ACC_ICON: Record<string, string> = {
  none: svg('<circle cx="12" cy="12" r="8"/><path d="m6.5 17.5 11-11"/>'),
  party: svg('<path d="M12 3 6 20h12z"/><path d="M8.5 13h7M7.3 16.5h9.4"/><circle cx="12" cy="3" r="1"/>'),
  crown: svg('<path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 10H5z"/>'),
  headphones: svg('<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>'),
  beanie: svg('<path d="M5 16a7 7 0 0 1 14 0"/><rect x="4" y="16" width="16" height="3" rx="1.5"/><circle cx="12" cy="7" r="1.5"/>'),
  flower: svg('<circle cx="12" cy="12" r="2"/><circle cx="12" cy="7" r="3"/><circle cx="12" cy="17" r="3"/><circle cx="7" cy="12" r="3"/><circle cx="17" cy="12" r="3"/>'),
  caps: svg('<rect x="8" y="3" width="8" height="7" rx="2"/><path d="M12 10v11"/>'),
  bulbs: svg('<path d="M9 16a6 6 0 1 1 6 0v3H9z"/><path d="M10 21h4"/>'),
  hearts: svg('<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>'),
  stars: svg('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
  glow: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>'),
  blush: svg('<ellipse cx="7" cy="13" rx="3.5" ry="2"/><ellipse cx="17" cy="13" rx="3.5" ry="2"/>'),
  glasses: svg('<circle cx="7" cy="13" r="3.5"/><circle cx="17" cy="13" r="3.5"/><path d="M10.5 13h3"/>'),
  sunglasses: svg('<path d="M3 10h18"/><rect x="3.5" y="10" width="7" height="5" rx="2" fill="currentColor"/><rect x="13.5" y="10" width="7" height="5" rx="2" fill="currentColor"/>'),
  eyebrows: svg('<path d="M4 11c2-2 4-2 6 0M14 11c2-2 4-2 6 0"/>'),
  balloon: svg('<ellipse cx="12" cy="9" rx="5.5" ry="6.5"/><path d="M12 15.5c-1 2 1 3 0 6"/>'),
  coffee: svg('<path d="M5 8h11v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M9 3v2M12 3v2"/>'),
  flag: svg('<path d="M5 21V4"/><path d="M5 4h12l-3 4 3 4H5"/>'),
  mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4"/>'),
  plant: svg('<path d="M7 15h10l-1.5 6h-7z"/><path d="M12 15V9M12 9c0-3 2-5 5-5 0 3-2 5-5 5zM12 11c0-2.5-1.8-4-4.5-4 0 2.5 1.8 4 4.5 4z"/>'),
  speaker: svg('<rect x="6" y="3" width="12" height="18" rx="2"/><circle cx="12" cy="14" r="3"/><circle cx="12" cy="7.5" r="1"/>'),
  spotlight: svg('<path d="M9 3h6l4 15H5z"/><path d="M5 21h14"/>'),
  rug: svg('<rect x="4" y="7" width="16" height="10" rx="1"/><path d="M4 9H2M4 12H2M4 15H2M22 9h-2M22 12h-2M22 15h-2"/>'),
};
