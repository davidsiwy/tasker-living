// Nacitani uvnitr aplikace. Vizualne stejne jako boot preloader v index.html:
// jednoduchy spinner, zadna slozita animace, svetle pozadi.
export function Loader({ label = 'Načítání' }: { label?: string }) {
  return (
    <div className="loader">
      <span className="loader-spin" />
      <div className="loader-label">{label}</div>
    </div>
  )
}
