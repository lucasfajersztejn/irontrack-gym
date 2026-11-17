// App logo.
import logoMark from '../../assets/logo-mark.png'

export default function Logo({ className = '', showWordmark = true }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src={logoMark}
        width="28"
        height="28"
        alt=""
        aria-hidden="true"
        className="h-7 w-7 object-contain"
      />
      {showWordmark && (
        <span className="font-display text-lg font-semibold tracking-tight text-text">
          IronTrack
        </span>
      )}
    </span>
  )
}
