/*
  Logo IronTrack: cuatro barras ascendentes en verde (acento), con la última
  más alta y resaltada, seguidas del wordmark. Las barras evocan progreso
  (gráfico) y a la vez discos apilados. Verde solo en las barras: el wordmark
  usa el texto normal para no cargar la cabecera.
*/
export default function Logo({ className = '', showWordmark = true }) {
  const accent = 'var(--color-accent)'

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        aria-hidden="true"
      >
        <rect x="2" y="18" width="4" height="8" rx="1.5" fill={accent} opacity="0.55" />
        <rect x="9" y="13" width="4" height="13" rx="1.5" fill={accent} opacity="0.75" />
        <rect x="16" y="8" width="4" height="18" rx="1.5" fill={accent} opacity="0.9" />
        <rect x="23" y="3" width="4" height="23" rx="1.5" fill={accent} />
      </svg>
      {showWordmark && (
        <span
          className="font-semibold tracking-tight text-[var(--color-text)]"
          style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem' }}
        >
          IronTrack
        </span>
      )}
    </span>
  )
}
