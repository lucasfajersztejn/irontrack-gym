// App logo.
import logoMark from '../../assets/logo-mark.png'

export default function Logo({ className = '', showWordmark = true }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src={logoMark}
        width="36"
        height="36"
        alt=""
        aria-hidden="true"
        className="h-9 w-9 object-contain"
      />
      {showWordmark && (
        <span className="font-display text-lg font-semibold tracking-tight text-text">
          IronTrack
        </span>
      )}
    </span>
  )
}
