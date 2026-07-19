// In-app loading indicator, visually consistent with the boot preloader in
// index.html: a building assembling itself floor by floor. No logo.
import type { CSSProperties } from 'react'

export function Loader({ label = 'Načítání' }: { label?: string }) {
  return (
    <div className="loader">
      <div className="loader-build">
        {[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}
      </div>
      <div className="loader-label">{label}<span className="loader-dots"><b>.</b><b>.</b><b>.</b></span></div>
    </div>
  )
}
