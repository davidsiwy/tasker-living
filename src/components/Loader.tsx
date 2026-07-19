// In-app loading indicator, visually consistent with the boot preloader in
// index.html. Used for lazy route chunks and session restore.

export function Loader({ label = 'Načítání' }: { label?: string }) {
  return (
    <div className="loader">
      <div className="loader-tile">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M14.7 6.3a1 1 0 0 0-1.4 0l-1.1 1.1a1 1 0 0 0 0 1.4l.3.3-6.2 6.2a2 2 0 0 0 2.8 2.8l6.2-6.2.3.3a1 1 0 0 0 1.4 0l1.1-1.1a1 1 0 0 0 0-1.4l-3.7-3.7Z" fill="#fff" />
          <path d="M8.5 4.2 6.3 5l-.8 2.2L6.3 9l2.2.8L10.3 9l.8-2.2L10.3 5 8.5 4.2Z" fill="#fff" opacity=".9" />
        </svg>
      </div>
      <div className="loader-bars"><span></span><span></span><span></span></div>
      <div className="loader-label">{label}</div>
    </div>
  )
}
