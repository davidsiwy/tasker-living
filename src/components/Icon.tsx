// Single icon set used across the app. Stroke icons render with the .ico class
// so they inherit color and sizing from the design system.
const P: Record<string, string> = {
  nastenka: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  zavady: '<path d="M12 3l9 16H3z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
  najmy: '<path d="M3 10l9-5 9 5"/><path d="M5 10v8M19 10v8M9 10v8M15 10v8"/><path d="M3 20h18"/>',
  sluzby: '<path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9z"/><path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z"/>',
  schuze: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
  kontakty: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><path d="M16 6a3 3 0 010 6M22 20c0-2.5-2-4-4-4.5"/>',
  stiznosti: '<path d="M4 5h16v11H8l-4 3z"/><path d="M12 8v3M12 13h.01"/>',
  sprava: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4 4l2 2M18 18l2 2M2 12h3M19 12h3M4 20l2-2M18 6l2-2"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  doc: '<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v4h4M9 13h6M9 17h6"/>',
  phone: '<path d="M5 3h4l2 5-3 2a12 12 0 006 6l2-3 5 2v4a2 2 0 01-2 2A17 17 0 013 5a2 2 0 012-2z"/>',
  msg: '<path d="M4 5h16v11H8l-4 3z"/>',
  water: '<path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z"/>',
  bank: '<path d="M3 10l9-5 9 5v2H3z"/><path d="M5 12v6M19 12v6M9 12v6M15 12v6M4 20h16"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z"/>',
  bell: '<path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 20a2 2 0 004 0"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  send: '<path d="M4 12l16-7-7 16-2-6z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
}

export function Icon({ name, small }: { name: string; small?: boolean }) {
  return (
    <svg className={small ? 'ico ico-sm' : 'ico'} viewBox="0 0 24 24" aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: P[name] || P.doc }} />
  )
}
